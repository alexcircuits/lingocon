//! API errors. Responses carry only a generic `{"error": "..."}`; details go to the log.

use axum::extract::rejection::JsonRejection;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Serialize;

use crate::db::lexicon::LexiconLoadError;
use crate::db::DbError;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(&'static str),
    #[error("unauthorized")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("not found: {0}")]
    NotFound(&'static str),
    #[error("request body too large")]
    PayloadTooLarge,
    #[error("unsupported media type")]
    UnsupportedMediaType,
    #[error("unprocessable: {0}")]
    Unprocessable(&'static str),
    #[error("too many concurrent requests")]
    Overloaded,
    #[error(transparent)]
    Database(#[from] DbError),
    #[error("background task failed: {0}")]
    Task(#[from] tokio::task::JoinError),
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    error: &'a str,
}

impl ApiError {
    pub fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::PayloadTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            Self::UnsupportedMediaType => StatusCode::UNSUPPORTED_MEDIA_TYPE,
            Self::Unprocessable(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Overloaded => StatusCode::SERVICE_UNAVAILABLE,
            Self::Database(err) if err.is_unavailable() => StatusCode::SERVICE_UNAVAILABLE,
            Self::Database(_) | Self::Task(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// The client-facing message: fixed strings only, never error internals.
    pub fn public_message(&self) -> &'static str {
        match self {
            Self::BadRequest(message) | Self::NotFound(message) | Self::Unprocessable(message) => {
                message
            }
            Self::Unauthorized => "unauthorized",
            Self::Forbidden => "forbidden",
            Self::PayloadTooLarge => "request body too large",
            Self::UnsupportedMediaType => "expected application/json",
            Self::Overloaded => "service overloaded",
            Self::Database(err) if err.is_unavailable() => "database unavailable",
            Self::Database(_) | Self::Task(_) => "internal error",
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        if status.is_server_error() {
            match &self {
                Self::Overloaded => tracing::warn!("rejecting request: concurrency limit reached"),
                Self::Database(err) if err.is_misconfiguration() => {
                    tracing::error!(error = %err, "database rejected the service's credentials or settings");
                }
                Self::Database(err) if err.is_unavailable() => {
                    tracing::warn!(error = %err, "database unavailable");
                }
                _ => tracing::error!(error = %self, detail = ?self, "request failed"),
            }
        }
        let mut response = json_error(status, self.public_message());
        if matches!(self, Self::Unauthorized) {
            response
                .headers_mut()
                .insert(header::WWW_AUTHENTICATE, HeaderValue::from_static("Bearer"));
        }
        response
    }
}

impl From<JsonRejection> for ApiError {
    fn from(rejection: JsonRejection) -> Self {
        match rejection.status() {
            StatusCode::PAYLOAD_TOO_LARGE => Self::PayloadTooLarge,
            StatusCode::UNSUPPORTED_MEDIA_TYPE => Self::UnsupportedMediaType,
            _ => Self::BadRequest("invalid JSON body"),
        }
    }
}

impl From<LexiconLoadError> for ApiError {
    fn from(err: LexiconLoadError) -> Self {
        match err {
            LexiconLoadError::Db(err) => Self::Database(err),
            LexiconLoadError::TooLarge { .. } => {
                Self::Unprocessable("lexicon is too large to analyse")
            }
        }
    }
}

/// `{"error": message}` with `status`.
pub fn json_error(status: StatusCode, message: &str) -> Response {
    (status, axum::Json(ErrorBody { error: message })).into_response()
}

/// Generic message for responses produced outside handlers (405, timeouts, …).
pub fn message_for_status(status: StatusCode) -> &'static str {
    match status {
        StatusCode::BAD_REQUEST => "bad request",
        StatusCode::UNAUTHORIZED => "unauthorized",
        StatusCode::FORBIDDEN => "forbidden",
        StatusCode::NOT_FOUND => "not found",
        StatusCode::METHOD_NOT_ALLOWED => "method not allowed",
        StatusCode::PAYLOAD_TOO_LARGE => "request body too large",
        StatusCode::UNSUPPORTED_MEDIA_TYPE => "expected application/json",
        StatusCode::SERVICE_UNAVAILABLE => "service unavailable",
        status if status.is_server_error() => "internal error",
        _ => "request failed",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    async fn body(response: Response) -> serde_json::Value {
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body")
            .to_bytes();
        serde_json::from_slice(&bytes).expect("json")
    }

    #[tokio::test]
    async fn errors_render_generic_json() {
        let cases = [
            (
                ApiError::BadRequest("languageId is required"),
                400,
                "languageId is required",
            ),
            (ApiError::Unauthorized, 401, "unauthorized"),
            (ApiError::Forbidden, 403, "forbidden"),
            (
                ApiError::NotFound("language not found"),
                404,
                "language not found",
            ),
            (ApiError::PayloadTooLarge, 413, "request body too large"),
            (ApiError::Overloaded, 503, "service overloaded"),
        ];
        for (error, status, message) in cases {
            let response = error.into_response();
            assert_eq!(response.status().as_u16(), status);
            assert_eq!(
                body(response).await,
                serde_json::json!({ "error": message })
            );
        }
    }

    #[tokio::test]
    async fn unauthorized_advertises_bearer() {
        let response = ApiError::Unauthorized.into_response();
        assert_eq!(
            response.headers().get(header::WWW_AUTHENTICATE),
            Some(&HeaderValue::from_static("Bearer"))
        );
    }

    #[tokio::test]
    async fn task_failures_do_not_leak_details() {
        let join_error = tokio::spawn(async { panic!("secret detail") })
            .await
            .expect_err("task panics");
        let response = ApiError::from(join_error).into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(
            body(response).await,
            serde_json::json!({ "error": "internal error" })
        );
    }
}

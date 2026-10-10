//! Cross-cutting HTTP middleware.
//!
//! Outermost first: request id → tracing → request-id propagation → JSON error
//! bodies → panic catcher → timeout → body size limit → (per route) concurrency
//! limit → handler. No CORS layer on purpose: browsers never talk to this service.

use std::any::Any;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::Router;
use tokio::sync::Semaphore;
use tower::ServiceBuilder;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::{DefaultOnFailure, DefaultOnResponse, TraceLayer};
use tower_http::LatencyUnit;
use tracing::{Level, Span};

use crate::config::HttpSettings;
use crate::error::{json_error, message_for_status, ApiError};

/// Wraps `router` in the standard middleware stack.
pub fn apply(router: Router, settings: &HttpSettings) -> Router {
    router.layer(
        ServiceBuilder::new()
            .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
            .layer(
                TraceLayer::new_for_http()
                    .make_span_with(make_span)
                    .on_response(
                        DefaultOnResponse::new()
                            .level(Level::INFO)
                            .latency_unit(LatencyUnit::Millis),
                    )
                    .on_failure(DefaultOnFailure::new().level(Level::WARN)),
            )
            .layer(PropagateRequestIdLayer::x_request_id())
            .layer(middleware::from_fn(json_error_bodies))
            .layer(CatchPanicLayer::custom(panic_response))
            .layer(TimeoutLayer::with_status_code(
                StatusCode::SERVICE_UNAVAILABLE,
                settings.request_timeout,
            ))
            .layer(RequestBodyLimitLayer::new(settings.body_limit)),
    )
}

/// Rejects with 503 instead of queueing once `permits` requests are in flight.
pub async fn limit_concurrency(
    State(permits): State<Arc<Semaphore>>,
    request: Request,
    next: Next,
) -> Response {
    match permits.try_acquire_owned() {
        Ok(permit) => {
            let response = next.run(request).await;
            drop(permit);
            response
        }
        Err(_) => ApiError::Overloaded.into_response(),
    }
}

/// Error responses produced by the framework or tower layers (404/405/408/413/503…)
/// get the same `{"error": "..."}` body as handler errors.
async fn json_error_bodies(request: Request, next: Next) -> Response {
    let response = next.run(request).await;
    let status = response.status();
    let is_error = status.is_client_error() || status.is_server_error();
    let is_json = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("application/json"));
    if !is_error || is_json {
        return response;
    }
    let (mut parts, _) = response.into_parts();
    let replacement = json_error(status, message_for_status(status));
    parts.headers.remove(header::CONTENT_LENGTH);
    parts.headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    Response::from_parts(parts, replacement.into_body())
}

fn panic_response(panic: Box<dyn Any + Send + 'static>) -> Response<Body> {
    let detail = panic
        .downcast_ref::<String>()
        .map(String::as_str)
        .or_else(|| panic.downcast_ref::<&str>().copied())
        .unwrap_or("non-string panic payload");
    tracing::error!(panic = detail, "handler panicked");
    json_error(StatusCode::INTERNAL_SERVER_ERROR, "internal error")
}

fn make_span(request: &Request) -> Span {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("-");
    // Path only: query strings and headers (cookies, tokens) are never logged.
    tracing::info_span!(
        "request",
        method = %request.method(),
        path = %request.uri().path(),
        request_id = %request_id,
    )
}

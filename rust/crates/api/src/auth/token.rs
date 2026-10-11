//! Internal service token (`LINGOCON_API_TOKEN`) required on `/v1/internal/*`.

use std::fmt;

use axum::extract::{Request, State};
use axum::http::header::AUTHORIZATION;
use axum::http::HeaderMap;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::error::ApiError;
use crate::state::AppState;

pub const MIN_TOKEN_LEN: usize = 32;
pub const MAX_TOKEN_LEN: usize = 256;

/// Only the SHA-256 digest is kept; comparing digests in constant time reveals
/// neither the token nor its length through timing.
#[derive(Clone)]
pub struct InternalToken {
    digest: [u8; 32],
}

impl fmt::Debug for InternalToken {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("InternalToken([redacted])")
    }
}

impl InternalToken {
    /// Accepts 32–256 visible ASCII characters (`!` to `~`, no spaces).
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.len() < MIN_TOKEN_LEN || raw.len() > MAX_TOKEN_LEN {
            return Err("must be 32 to 256 characters long (e.g. `openssl rand -hex 32`)");
        }
        if !raw.bytes().all(|byte| byte.is_ascii_graphic()) {
            return Err("must contain only printable ASCII characters without spaces");
        }
        Ok(Self {
            digest: Sha256::digest(raw.as_bytes()).into(),
        })
    }

    pub fn matches(&self, presented: &str) -> bool {
        let digest: [u8; 32] = Sha256::digest(presented.as_bytes()).into();
        digest.ct_eq(&self.digest).into()
    }

    /// `true` when the request carries exactly one `Authorization: Bearer <token>`
    /// header with the right token.
    pub fn authorizes(&self, headers: &HeaderMap) -> bool {
        bearer_token(headers).is_some_and(|token| self.matches(token))
    }
}

/// Extracts the credentials of a single `Authorization: Bearer …` header
/// (scheme is case-insensitive, per RFC 9110).
pub fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let mut values = headers.get_all(AUTHORIZATION).iter();
    let value = values.next()?;
    if values.next().is_some() {
        return None;
    }
    let (scheme, token) = value.to_str().ok()?.split_once(' ')?;
    let token = token.trim_start_matches(' ');
    (scheme.eq_ignore_ascii_case("bearer") && !token.is_empty()).then_some(token)
}

/// Middleware guarding `/v1/internal/*`.
pub async fn require_internal_token(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    if state.internal_token().authorizes(request.headers()) {
        next.run(request).await
    } else {
        ApiError::Unauthorized.into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef";

    fn headers(values: &[&str]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for value in values {
            map.append(
                AUTHORIZATION,
                HeaderValue::from_str(value).expect("header value"),
            );
        }
        map
    }

    #[test]
    fn missing_header_is_rejected() {
        let token = InternalToken::parse(TOKEN).expect("valid");
        assert!(!token.authorizes(&HeaderMap::new()));
    }

    #[test]
    fn wrong_token_is_rejected() {
        let token = InternalToken::parse(TOKEN).expect("valid");
        assert!(!token.authorizes(&headers(&["Bearer 0123456789abcdef0123456789abcdee"])));
        assert!(!token.authorizes(&headers(&["Bearer short"])));
        assert!(!token.authorizes(&headers(&[&format!("Bearer {TOKEN}x")])));
    }

    #[test]
    fn right_token_is_accepted_case_insensitively_on_the_scheme() {
        let token = InternalToken::parse(TOKEN).expect("valid");
        assert!(token.authorizes(&headers(&[&format!("Bearer {TOKEN}")])));
        assert!(token.authorizes(&headers(&[&format!("bearer {TOKEN}")])));
    }

    #[test]
    fn other_schemes_and_duplicates_are_rejected() {
        let token = InternalToken::parse(TOKEN).expect("valid");
        assert!(!token.authorizes(&headers(&[&format!("Basic {TOKEN}")])));
        assert!(!token.authorizes(&headers(&[TOKEN])));
        assert!(!token.authorizes(&headers(&["Bearer "])));
        let bearer = format!("Bearer {TOKEN}");
        assert!(!token.authorizes(&headers(&[&bearer, &bearer])));
    }

    #[test]
    fn debug_never_prints_the_token() {
        let token = InternalToken::parse(TOKEN).expect("valid");
        assert_eq!(format!("{token:?}"), "InternalToken([redacted])");
    }
}

//! Shared helpers for the integration tests.
#![allow(dead_code)]

use std::collections::HashMap;

use aes::Aes256;
use axum::body::Body;
use axum::http::{HeaderMap, Request, StatusCode};
use axum::Router;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use cbc::cipher::block_padding::Pkcs7;
use cbc::cipher::{BlockModeEncrypt, KeyIvInit};
use hkdf::Hkdf;
use hmac::{Hmac, KeyInit, Mac};
use http_body_util::BodyExt;
use lingocon_api::Config;
use serde_json::{json, Value};
use sha2::{Digest, Sha256, Sha512};
use tower::ServiceExt;

pub const TOKEN: &str = "test-token-0123456789abcdef0123456789abcdef";
pub const AUTH_SECRET: &str = "integration-test-auth-secret";
/// Nothing listens on port 1: connections are refused immediately.
pub const UNREACHABLE_DB: &str = "postgresql://nobody@127.0.0.1:1/unreachable";

pub fn config(vars: &[(&str, &str)]) -> Config {
    let mut map: HashMap<String, String> = HashMap::from([
        ("LINGOCON_API_TOKEN".to_owned(), TOKEN.to_owned()),
        ("DATABASE_URL".to_owned(), UNREACHABLE_DB.to_owned()),
        ("AUTH_SECRET".to_owned(), AUTH_SECRET.to_owned()),
    ]);
    for (name, value) in vars {
        map.insert((*name).to_owned(), (*value).to_owned());
    }
    Config::from_lookup(|name| map.get(name).cloned()).expect("test config is valid")
}

pub fn app(vars: &[(&str, &str)]) -> Router {
    lingocon_api::build_app(&config(vars)).expect("app builds")
}

pub struct TestResponse {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub json: Value,
}

pub async fn send(router: &Router, request: Request<Body>) -> TestResponse {
    let response = router
        .clone()
        .oneshot(request)
        .await
        .expect("router is infallible");
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    let json = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or_else(|_| {
            panic!(
                "{status}: body is not JSON: {}",
                String::from_utf8_lossy(&bytes)
            )
        })
    };
    TestResponse {
        status,
        headers,
        json,
    }
}

pub fn get(uri: &str) -> Request<Body> {
    Request::get(uri).body(Body::empty()).expect("request")
}

pub fn get_with_cookie(uri: &str, cookie: &str) -> Request<Body> {
    Request::get(uri)
        .header("cookie", cookie)
        .body(Body::empty())
        .expect("request")
}

pub fn analysis_request(token: Option<&str>, body: impl Into<Body>) -> Request<Body> {
    let mut builder =
        Request::post("/v1/internal/lexicon-analysis").header("content-type", "application/json");
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    builder.body(body.into()).expect("request")
}

pub fn analysis_for(language_id: &str) -> Request<Body> {
    analysis_request(
        Some(TOKEN),
        json!({ "languageId": language_id }).to_string(),
    )
}

/// Asserts the `LexiconAnalysis` response shape and its invariants.
pub fn assert_analysis_shape(json: &Value) {
    let warnings = json["warnings"].as_array().expect("warnings array");
    let total = json["total"].as_u64().expect("total number");
    let matched = json["matchedIds"].as_array().expect("matchedIds array");
    assert!(warnings.len() <= 50, "at most 50 warnings");
    assert!(total >= warnings.len() as u64);
    for warning in warnings {
        assert!(matches!(
            warning["type"].as_str(),
            Some("undefined_symbol" | "missing_paradigm")
        ));
        assert!(warning["message"].is_string());
        assert!(matches!(
            warning["severity"].as_str(),
            Some("warning" | "info")
        ));
    }
    let ids: Vec<u64> = matched
        .iter()
        .map(|id| id.as_u64().expect("numeric id"))
        .collect();
    assert!(ids.windows(2).all(|pair| pair[0] < pair[1]), "sorted ids");
}

// ---------------------------------------------------------------------------
// Auth.js-compatible session tokens, implemented independently of the crate
// (and checked against Auth.js-generated vectors in tests/session.rs).

pub struct TestSessionKey {
    pub cookie_name: String,
    mac_key: [u8; 32],
    enc_key: [u8; 32],
    pub kid: String,
}

pub fn session_key(secret: &str, cookie_name: &str) -> TestSessionKey {
    let mut okm = [0u8; 64];
    Hkdf::<Sha256>::new(Some(cookie_name.as_bytes()), secret.as_bytes())
        .expand(
            format!("Auth.js Generated Encryption Key ({cookie_name})").as_bytes(),
            &mut okm,
        )
        .expect("64 bytes is a valid HKDF length");
    let jwk = format!(r#"{{"k":"{}","kty":"oct"}}"#, URL_SAFE_NO_PAD.encode(okm));
    let kid = URL_SAFE_NO_PAD.encode(Sha512::digest(jwk.as_bytes()));
    let mut mac_key = [0u8; 32];
    let mut enc_key = [0u8; 32];
    mac_key.copy_from_slice(&okm[..32]);
    enc_key.copy_from_slice(&okm[32..]);
    TestSessionKey {
        cookie_name: cookie_name.to_owned(),
        mac_key,
        enc_key,
        kid,
    }
}

impl TestSessionKey {
    pub fn standard_header(&self) -> Value {
        json!({ "alg": "dir", "enc": "A256CBC-HS512", "kid": self.kid })
    }

    /// Compact JWE with an arbitrary protected header and raw plaintext.
    pub fn encrypt_raw(&self, header: &Value, plaintext: &[u8], encrypted_key: &str) -> String {
        let header_b64 = URL_SAFE_NO_PAD.encode(header.to_string());
        let iv = [7u8; 16];
        let ciphertext = cbc::Encryptor::<Aes256>::new_from_slices(&self.enc_key, &iv)
            .expect("key/iv sizes")
            .encrypt_padded_vec::<Pkcs7>(plaintext);
        let mut mac = <Hmac<Sha512> as KeyInit>::new_from_slice(&self.mac_key).expect("hmac key");
        mac.update(header_b64.as_bytes());
        mac.update(&iv);
        mac.update(&ciphertext);
        mac.update(&(header_b64.len() as u64 * 8).to_be_bytes());
        let tag = mac.finalize().into_bytes();
        format!(
            "{header_b64}.{encrypted_key}.{}.{}.{}",
            URL_SAFE_NO_PAD.encode(iv),
            URL_SAFE_NO_PAD.encode(ciphertext),
            URL_SAFE_NO_PAD.encode(&tag[..32])
        )
    }

    pub fn encrypt(&self, header: &Value, payload: &Value) -> String {
        self.encrypt_raw(header, payload.to_string().as_bytes(), "")
    }

    /// A normal Auth.js-shaped session for `user_id`, valid for an hour after `now`.
    pub fn session(&self, user_id: &str, now: i64) -> String {
        self.encrypt(
            &self.standard_header(),
            &json!({ "id": user_id, "sub": user_id, "iat": now, "exp": now + 3600, "jti": "t" }),
        )
    }

    pub fn cookie(&self, token: &str) -> String {
        format!("{}={token}", self.cookie_name)
    }
}

pub fn now() -> i64 {
    lingocon_api::auth::session::unix_now()
}

// ---------------------------------------------------------------------------
// Disposable database guard.

pub const TEST_DB_ENV: &str = "LINGOCON_API_TEST_DATABASE_URL";

/// The disposable test database, or `None` (tests skip) when the variable is unset.
/// Panics — refusing to run — unless it is a query-free localhost URL whose
/// database name starts with `lingocon_rewrite_test_`.
pub fn test_database_url() -> Option<String> {
    let url = std::env::var(TEST_DB_ENV)
        .ok()
        .filter(|url| !url.is_empty())?;
    if let Err(reason) = check_disposable(&url) {
        panic!("refusing to use {TEST_DB_ENV}: {reason}");
    }
    Some(url)
}

pub fn check_disposable(url: &str) -> Result<(), &'static str> {
    if url.contains('?') || url.contains('#') {
        return Err("it must not have a query string");
    }
    let rest = url
        .strip_prefix("postgresql://")
        .or_else(|| url.strip_prefix("postgres://"))
        .ok_or("it must be a postgresql:// URL")?;
    let (authority, database) = rest.split_once('/').ok_or("it must name a database")?;
    let host_port = authority
        .rsplit_once('@')
        .map_or(authority, |(_, host)| host);
    let host = if let Some(bracketed) = host_port.strip_prefix('[') {
        bracketed
            .split_once(']')
            .map(|(host, _)| host)
            .unwrap_or("")
    } else {
        host_port.split(':').next().unwrap_or("")
    };
    if !matches!(host, "localhost" | "127.0.0.1" | "::1") {
        return Err("its host must be localhost, 127.0.0.1 or [::1]");
    }
    if !database.starts_with("lingocon_rewrite_test_") || database.contains('/') {
        return Err("its database name must start with lingocon_rewrite_test_");
    }
    Ok(())
}

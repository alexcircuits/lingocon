//! Auth.js session-cookie decoding.
//!
//! `fixtures/session-vectors.json` is produced by `fixtures/make-session-vectors.mjs`
//! with the installed `@auth/core` (every expectation cross-checked against
//! Auth.js's own `getToken`). The remaining cases use the independent encoder in
//! `common` for inputs Auth.js never produces.

mod common;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use lingocon_api::auth::session::{
    AuthSecret, SessionError, SessionKeys, SECURE_SESSION_COOKIE, SESSION_COOKIE,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    generated_at: i64,
    secret: String,
    clock_tolerance_seconds: i64,
    vectors: Vec<Vector>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vector {
    name: String,
    cookie_header: String,
    expect: Value,
}

fn fixture() -> Fixture {
    serde_json::from_str(include_str!("fixtures/session-vectors.json")).expect("fixture parses")
}

fn error_name(err: SessionError) -> String {
    format!("{err:?}")
}

fn keys(secret: &str) -> SessionKeys {
    SessionKeys::derive(&AuthSecret::new(secret)).expect("derive")
}

#[test]
fn decodes_every_authjs_vector_as_expected() {
    let fixture = fixture();
    assert_eq!(fixture.clock_tolerance_seconds, 15);
    assert!(fixture.vectors.len() >= 15, "fixture has all cases");
    let keys = keys(&fixture.secret);
    for vector in &fixture.vectors {
        let result = keys.session_from_cookie_header(&vector.cookie_header, fixture.generated_at);
        match (&result, vector.expect.get("error")) {
            (Err(err), Some(Value::String(expected))) => {
                assert_eq!(&error_name(*err), expected, "{}", vector.name);
            }
            (Ok(Some(claims)), None) => {
                assert_eq!(
                    claims.user_id.as_deref(),
                    vector.expect["userId"].as_str(),
                    "{}",
                    vector.name
                );
            }
            _ => panic!("{}: unexpected result {result:?}", vector.name),
        }
    }
}

fn vector<'a>(fixture: &'a Fixture, name: &str) -> &'a Vector {
    fixture
        .vectors
        .iter()
        .find(|vector| vector.name == name)
        .unwrap_or_else(|| panic!("vector {name} exists"))
}

#[test]
fn expiry_honours_the_fifteen_second_clock_tolerance() {
    let fixture = fixture();
    let keys = keys(&fixture.secret);
    let header = &vector(&fixture, "valid_plain_cookie").cookie_header;
    let claims = keys
        .session_from_cookie_header(header, fixture.generated_at)
        .expect("valid")
        .expect("session");
    let exp = claims.expires_at.expect("exp") as i64;
    assert!(keys.session_from_cookie_header(header, exp + 14).is_ok());
    assert_eq!(
        keys.session_from_cookie_header(header, exp + 15),
        Err(SessionError::Expired)
    );
}

#[test]
fn independent_test_encoder_matches_authjs_key_derivation() {
    let fixture = fixture();
    for (name, cookie) in [
        ("valid_plain_cookie", SESSION_COOKIE),
        ("valid_secure_cookie", SECURE_SESSION_COOKIE),
    ] {
        let header = &vector(&fixture, name).cookie_header;
        let token = header
            .split("; ")
            .find_map(|pair| pair.strip_prefix(&format!("{cookie}=")))
            .expect("token");
        let protected = token.split('.').next().expect("header segment");
        let header: Value =
            serde_json::from_slice(&URL_SAFE_NO_PAD.decode(protected).expect("b64")).expect("json");
        assert_eq!(
            header["kid"].as_str(),
            Some(common::session_key(&fixture.secret, cookie).kid.as_str()),
            "{name}"
        );
    }
}

const SECRET: &str = "edge-case-secret";
const NOW: i64 = 1_800_000_000;

fn decode(token: &str) -> Result<Option<String>, SessionError> {
    keys(SECRET)
        .session_from_cookie_header(&format!("{SESSION_COOKIE}={token}"), NOW)
        .map(|claims| claims.and_then(|claims| claims.user_id))
}

fn plain() -> common::TestSessionKey {
    common::session_key(SECRET, SESSION_COOKIE)
}

#[test]
fn test_encoder_round_trips() {
    let key = plain();
    assert_eq!(
        decode(&key.session("user_1", NOW)),
        Ok(Some("user_1".into()))
    );
}

#[test]
fn not_before_honours_the_clock_tolerance() {
    let key = plain();
    let header = key.standard_header();
    assert!(decode(&key.encrypt(&header, &json!({ "id": "u", "nbf": NOW + 15 }))).is_ok());
    assert_eq!(
        decode(&key.encrypt(&header, &json!({ "id": "u", "nbf": NOW + 16 }))),
        Err(SessionError::NotYetValid)
    );
}

#[test]
fn rejects_non_numeric_time_claims() {
    let key = plain();
    let header = key.standard_header();
    for payload in [
        json!({ "id": "u", "iat": "now" }),
        json!({ "id": "u", "exp": "later" }),
        json!({ "id": "u", "nbf": null }),
    ] {
        assert_eq!(
            decode(&key.encrypt(&header, &payload)),
            Err(SessionError::InvalidClaims),
            "{payload}"
        );
    }
}

#[test]
fn rejects_unsupported_headers() {
    let key = plain();
    let payload = json!({ "id": "u" });
    for header in [
        json!({ "alg": "dir", "enc": "A256CBC-HS512", "crit": ["exp"], "exp": 1 }),
        json!({ "alg": "dir", "enc": "A256CBC-HS512", "zip": "DEF" }),
        json!({ "alg": "A256KW", "enc": "A256CBC-HS512" }),
        json!({ "alg": "dir", "enc": "A128CBC-HS256" }),
        json!({ "alg": "dir" }),
    ] {
        assert_eq!(
            decode(&key.encrypt(&header, &payload)),
            Err(SessionError::UnsupportedHeader),
            "{header}"
        );
    }
}

#[test]
fn rejects_non_string_kid_and_encrypted_key() {
    let key = plain();
    let payload = json!({ "id": "u" });
    assert_eq!(
        decode(&key.encrypt(
            &json!({ "alg": "dir", "enc": "A256CBC-HS512", "kid": 7 }),
            &payload
        )),
        Err(SessionError::KeyIdMismatch)
    );
    assert_eq!(
        decode(&key.encrypt_raw(
            &key.standard_header(),
            payload.to_string().as_bytes(),
            "AAAA"
        )),
        Err(SessionError::Malformed)
    );
}

#[test]
fn rejects_payloads_that_are_not_objects() {
    let key = plain();
    assert_eq!(
        decode(&key.encrypt_raw(&key.standard_header(), b"[1,2]", "")),
        Err(SessionError::InvalidPayload)
    );
    assert_eq!(
        decode(&key.encrypt_raw(&key.standard_header(), b"not json", "")),
        Err(SessionError::InvalidPayload)
    );
}

#[test]
fn replicated_header_claims_must_match() {
    let key = plain();
    let mut header = key.standard_header();
    header["sub"] = json!("someone-else");
    assert_eq!(
        decode(&key.encrypt(&header, &json!({ "id": "u", "sub": "u" }))),
        Err(SessionError::InvalidClaims)
    );
    header["sub"] = json!("u");
    assert_eq!(
        decode(&key.encrypt(&header, &json!({ "id": "u", "sub": "u" }))),
        Ok(Some("u".into()))
    );
}

#[test]
fn user_id_prefers_id_then_sub() {
    let key = plain();
    let header = key.standard_header();
    let cases = [
        (json!({ "id": "a", "sub": "b" }), Some("a")),
        (json!({ "id": "", "sub": "b" }), Some("b")),
        (json!({ "id": 42, "sub": "b" }), Some("b")),
        (json!({ "sub": "" }), None),
        (json!({}), None),
    ];
    for (payload, expected) in cases {
        assert_eq!(
            decode(&key.encrypt(&header, &payload)),
            Ok(expected.map(str::to_owned)),
            "{payload}"
        );
    }
}

#[test]
fn secure_cookie_takes_precedence() {
    let keys = keys(SECRET);
    let plain = plain();
    let secure = common::session_key(SECRET, SECURE_SESSION_COOKIE);
    let header = format!(
        "{}; {}",
        plain.cookie(&plain.session("plain_user", NOW)),
        secure.cookie(&secure.session("secure_user", NOW))
    );
    let claims = keys
        .session_from_cookie_header(&header, NOW)
        .expect("valid")
        .expect("session");
    assert_eq!(claims.user_id.as_deref(), Some("secure_user"));

    // A __Secure- cookie minted with the http salt is not silently ignored in favour
    // of the plain one.
    let wrong = format!(
        "{}; {SECURE_SESSION_COOKIE}={}",
        plain.cookie(&plain.session("plain_user", NOW)),
        plain.session("x", NOW)
    );
    assert_eq!(
        keys.session_from_cookie_header(&wrong, NOW),
        Err(SessionError::KeyIdMismatch)
    );
}

#[test]
fn wrong_secret_fails_even_with_matching_structure() {
    let other = common::session_key("another-secret", SESSION_COOKIE);
    assert_eq!(
        decode(&other.session("u", NOW)),
        Err(SessionError::KeyIdMismatch)
    );
}

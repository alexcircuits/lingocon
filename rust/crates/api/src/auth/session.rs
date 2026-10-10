//! Auth.js (`@auth/core` 0.41) session-cookie verification.
//!
//! The cookie holds a compact JWE: `alg: "dir"`, `enc: "A256CBC-HS512"`, keyed with
//! `HKDF-SHA256(ikm = AUTH_SECRET, salt = cookie name,
//! info = "Auth.js Generated Encryption Key (<cookie name>)", 64 bytes)`. The first
//! 32 bytes are the HMAC-SHA-512 key, the last 32 the AES-256-CBC key (RFC 7518
//! §5.2). A `kid` header, when present, must equal the key's JWK SHA-512
//! thumbprint. `exp`/`nbf` are checked with Auth.js's 15 s clock tolerance.
//!
//! Deliberate difference: Auth.js `decode` also accepts `enc: "A256GCM"`, which its
//! own `encode` never emits; this decoder accepts only A256CBC-HS512.

use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};

use aes::Aes256;
use axum::http::HeaderMap;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use cbc::cipher::block_padding::Pkcs7;
use cbc::cipher::{BlockModeDecrypt, KeyIvInit};
use hkdf::Hkdf;
use hmac::{Hmac, KeyInit, Mac};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256, Sha512};
use subtle::ConstantTimeEq;

use super::cookies::Cookies;

pub const SESSION_COOKIE: &str = "authjs.session-token";
pub const SECURE_SESSION_COOKIE: &str = "__Secure-authjs.session-token";
/// `clockTolerance` Auth.js passes to `jose.jwtDecrypt`.
pub const CLOCK_TOLERANCE_SECS: i64 = 15;

const ALG: &str = "dir";
const ENC: &str = "A256CBC-HS512";
const IV_LEN: usize = 16;
const TAG_LEN: usize = 32;
const AES_BLOCK: usize = 16;

type HmacSha512 = Hmac<Sha512>;
type Aes256CbcDec = cbc::Decryptor<Aes256>;

/// `AUTH_SECRET`, kept out of `Debug` output.
#[derive(Clone)]
pub struct AuthSecret(String);

impl AuthSecret {
    pub fn new(secret: impl Into<String>) -> Self {
        Self(secret.into())
    }
}

impl fmt::Debug for AuthSecret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("AuthSecret([redacted])")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum SessionError {
    #[error("session token is malformed")]
    Malformed,
    #[error("session token uses an unsupported JOSE header")]
    UnsupportedHeader,
    #[error("session token was issued for a different key")]
    KeyIdMismatch,
    #[error("session token failed authentication")]
    InvalidTag,
    #[error("session token payload is not a JSON object")]
    InvalidPayload,
    #[error("session token claims are invalid")]
    InvalidClaims,
    #[error("session token has expired")]
    Expired,
    #[error("session token is not valid yet")]
    NotYetValid,
    #[error("session token is too large")]
    TooLarge,
}

#[derive(Debug, thiserror::Error)]
#[error("could not derive the session key")]
pub struct KeyDerivationError;

/// The verified claims the service uses.
#[derive(Debug, Clone, PartialEq)]
pub struct SessionClaims {
    /// `id` (set by main's `jwt` callback), falling back to `sub`; `None` if neither is a
    /// non-empty string.
    pub user_id: Option<String>,
    /// `exp`, seconds since the epoch.
    pub expires_at: Option<f64>,
}

struct DerivedKey {
    cookie_name: &'static str,
    mac_key: [u8; 32],
    enc_key: [u8; 32],
    kid: String,
}

impl DerivedKey {
    fn derive(secret: &AuthSecret, cookie_name: &'static str) -> Result<Self, KeyDerivationError> {
        let info = format!("Auth.js Generated Encryption Key ({cookie_name})");
        let mut okm = [0u8; 64];
        Hkdf::<Sha256>::new(Some(cookie_name.as_bytes()), secret.0.as_bytes())
            .expand(info.as_bytes(), &mut okm)
            .map_err(|_| KeyDerivationError)?;
        // JWK thumbprint (RFC 7638) of {"kty":"oct","k":…}, hashed with SHA-512
        // because Auth.js uses `sha${keyBits}` for its 512-bit key.
        let jwk = format!(r#"{{"k":"{}","kty":"oct"}}"#, URL_SAFE_NO_PAD.encode(okm));
        let kid = URL_SAFE_NO_PAD.encode(Sha512::digest(jwk.as_bytes()));
        let (mac, enc) = okm.split_at(32);
        let mut mac_key = [0u8; 32];
        let mut enc_key = [0u8; 32];
        mac_key.copy_from_slice(mac);
        enc_key.copy_from_slice(enc);
        Ok(Self {
            cookie_name,
            mac_key,
            enc_key,
            kid,
        })
    }
}

/// Keys for both cookie names (`authjs.session-token` over http,
/// `__Secure-authjs.session-token` over https), derived once at startup.
pub struct SessionKeys {
    plain: DerivedKey,
    secure: DerivedKey,
}

impl fmt::Debug for SessionKeys {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("SessionKeys([redacted])")
    }
}

impl SessionKeys {
    pub fn derive(secret: &AuthSecret) -> Result<Self, KeyDerivationError> {
        Ok(Self {
            plain: DerivedKey::derive(secret, SESSION_COOKIE)?,
            secure: DerivedKey::derive(secret, SECURE_SESSION_COOKIE)?,
        })
    }

    /// `Ok(None)` when no session cookie is present. The `__Secure-` cookie wins
    /// when both are present (browsers only store it over https).
    pub fn session_from_headers(
        &self,
        headers: &HeaderMap,
        now: i64,
    ) -> Result<Option<SessionClaims>, SessionError> {
        self.session_from_cookies(&Cookies::from_headers(headers), now)
    }

    /// Same as [`Self::session_from_headers`] for a raw `Cookie` header value.
    pub fn session_from_cookie_header(
        &self,
        header: &str,
        now: i64,
    ) -> Result<Option<SessionClaims>, SessionError> {
        self.session_from_cookies(&Cookies::parse(header), now)
    }

    fn session_from_cookies(
        &self,
        cookies: &Cookies,
        now: i64,
    ) -> Result<Option<SessionClaims>, SessionError> {
        let key = if cookies.has_session(SECURE_SESSION_COOKIE) {
            &self.secure
        } else if cookies.has_session(SESSION_COOKIE) {
            &self.plain
        } else {
            return Ok(None);
        };
        match cookies.session_token(key.cookie_name)? {
            Some(token) => decode(&token, key, now).map(Some),
            None => Ok(None),
        }
    }
}

/// Seconds since the Unix epoch, like `jose`'s `Math.floor(Date.now() / 1000)`.
pub fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| i64::try_from(elapsed.as_secs()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

fn decode(token: &str, key: &DerivedKey, now: i64) -> Result<SessionClaims, SessionError> {
    let segments: Vec<&str> = token.split('.').collect();
    let [header_b64, encrypted_key, iv_b64, ciphertext_b64, tag_b64] = segments.as_slice() else {
        return Err(SessionError::Malformed);
    };

    let header = json_object(&b64(header_b64)?).ok_or(SessionError::Malformed)?;
    if header.get("alg").and_then(Value::as_str) != Some(ALG)
        || header.get("enc").and_then(Value::as_str) != Some(ENC)
        || header.contains_key("crit")
        || header.contains_key("zip")
    {
        return Err(SessionError::UnsupportedHeader);
    }
    match header.get("kid") {
        None => {}
        Some(Value::String(kid)) if kid.as_bytes().ct_eq(key.kid.as_bytes()).into() => {}
        Some(_) => return Err(SessionError::KeyIdMismatch),
    }
    // "dir" uses the shared key directly: there must be no encrypted CEK.
    if !encrypted_key.is_empty() {
        return Err(SessionError::Malformed);
    }
    let iv = b64(iv_b64)?;
    let ciphertext = b64(ciphertext_b64)?;
    let tag = b64(tag_b64)?;
    if iv.len() != IV_LEN || ciphertext.is_empty() || ciphertext.len() % AES_BLOCK != 0 {
        return Err(SessionError::Malformed);
    }

    // RFC 7518 §5.2.2.1: T = first half of HMAC(MAC_KEY, AAD || IV || C || AL), where AAD
    // is the ASCII of the encoded protected header and AL its length in bits (u64 BE).
    let mut mac = <HmacSha512 as KeyInit>::new_from_slice(&key.mac_key)
        .map_err(|_| SessionError::InvalidTag)?;
    mac.update(header_b64.as_bytes());
    mac.update(&iv);
    mac.update(&ciphertext);
    mac.update(&(header_b64.len() as u64 * 8).to_be_bytes());
    let expected = mac.finalize().into_bytes();
    let tag_matches = tag.len() == TAG_LEN && bool::from(expected[..TAG_LEN].ct_eq(&tag));
    if !tag_matches {
        return Err(SessionError::InvalidTag);
    }

    let plaintext = Aes256CbcDec::new_from_slices(&key.enc_key, &iv)
        .map_err(|_| SessionError::Malformed)?
        .decrypt_padded_vec::<Pkcs7>(&ciphertext)
        .map_err(|_| SessionError::InvalidPayload)?;
    let payload = json_object(&plaintext).ok_or(SessionError::InvalidPayload)?;

    validate_time_claims(&payload, now)?;
    // jose: claims replicated into the protected header must match the payload.
    for claim in ["iss", "sub", "aud"] {
        if let Some(value) = header.get(claim) {
            if payload.get(claim) != Some(value) {
                return Err(SessionError::InvalidClaims);
            }
        }
    }

    Ok(SessionClaims {
        user_id: user_id(&payload),
        expires_at: payload.get("exp").and_then(Value::as_f64),
    })
}

fn validate_time_claims(payload: &Map<String, Value>, now: i64) -> Result<(), SessionError> {
    let now = now as f64;
    let tolerance = CLOCK_TOLERANCE_SECS as f64;
    if payload.get("iat").is_some_and(|iat| !iat.is_number()) {
        return Err(SessionError::InvalidClaims);
    }
    if let Some(nbf) = payload.get("nbf") {
        let nbf = nbf.as_f64().ok_or(SessionError::InvalidClaims)?;
        if nbf > now + tolerance {
            return Err(SessionError::NotYetValid);
        }
    }
    if let Some(exp) = payload.get("exp") {
        let exp = exp.as_f64().ok_or(SessionError::InvalidClaims)?;
        if exp <= now - tolerance {
            return Err(SessionError::Expired);
        }
    }
    Ok(())
}

fn user_id(payload: &Map<String, Value>) -> Option<String> {
    ["id", "sub"].into_iter().find_map(|claim| {
        payload
            .get(claim)
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
    })
}

fn b64(segment: &str) -> Result<Vec<u8>, SessionError> {
    URL_SAFE_NO_PAD
        .decode(segment)
        .map_err(|_| SessionError::Malformed)
}

fn json_object(bytes: &[u8]) -> Option<Map<String, Value>> {
    match serde_json::from_slice(bytes) {
        Ok(Value::Object(map)) => Some(map),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_distinct_keys_per_cookie_name() {
        let keys = SessionKeys::derive(&AuthSecret::new("secret")).expect("derive");
        assert_ne!(keys.plain.kid, keys.secure.kid);
        assert_ne!(keys.plain.enc_key, keys.secure.enc_key);
        // SHA-512 thumbprint: 64 bytes → 86 base64url characters.
        assert_eq!(keys.plain.kid.len(), 86);
    }

    #[test]
    fn no_cookie_means_no_session() {
        let keys = SessionKeys::derive(&AuthSecret::new("secret")).expect("derive");
        assert_eq!(keys.session_from_cookie_header("", 0), Ok(None));
        assert_eq!(keys.session_from_cookie_header("theme=dark", 0), Ok(None));
    }

    #[test]
    fn rejects_structurally_invalid_tokens() {
        let keys = SessionKeys::derive(&AuthSecret::new("secret")).expect("derive");
        for token in ["a.b.c.d", "a.b.c.d.e.f", "!!!.b.c.d.e", "e30.b.c.d.e"] {
            let header = format!("{SESSION_COOKIE}={token}");
            assert!(
                keys.session_from_cookie_header(&header, 0).is_err(),
                "{token}"
            );
        }
        // `{}` header: no alg/enc.
        assert_eq!(
            keys.session_from_cookie_header(&format!("{SESSION_COOKIE}=e30..AA.AA.AA"), 0),
            Err(SessionError::UnsupportedHeader)
        );
    }

    #[test]
    fn debug_output_is_redacted() {
        let secret = AuthSecret::new("super-secret");
        assert!(!format!("{secret:?}").contains("super-secret"));
        let keys = SessionKeys::derive(&secret).expect("derive");
        assert_eq!(format!("{keys:?}"), "SessionKeys([redacted])");
    }

    #[test]
    fn unix_now_is_after_2025() {
        assert!(unix_now() > 1_735_689_600);
    }
}

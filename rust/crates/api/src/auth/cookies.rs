//! Cookie parsing and session-cookie chunk assembly, mirroring Auth.js 0.41
//! (`lib/vendored/cookie.js` `parse` and `lib/utils/cookie.js` `SessionStore`).

use std::collections::HashSet;

use axum::http::header::COOKIE;
use axum::http::HeaderMap;
use percent_encoding::percent_decode_str;

use super::session::SessionError;

/// Auth.js splits session cookies above ~4 KB into `name.0`, `name.1`, …; real
/// sessions use one or two. These bounds keep hostile headers cheap to reject.
pub const MAX_CHUNKS: usize = 32;
pub const MAX_TOKEN_LEN: usize = 64 * 1024;

/// Parsed `Cookie` header(s). Like the `cookie` package, the first occurrence of a
/// name wins, names and values are trimmed, and values containing `%` are
/// URI-decoded when that succeeds.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Cookies(Vec<(String, String)>);

impl Cookies {
    pub fn from_headers(headers: &HeaderMap) -> Self {
        // HTTP/2 may split cookies across headers; RFC 9113 joins them with "; ".
        // Lossy decoding: one cookie with raw non-ASCII bytes (browsers send them)
        // must not hide the session cookie next to it.
        let joined = headers
            .get_all(COOKIE)
            .iter()
            .map(|value| String::from_utf8_lossy(value.as_bytes()))
            .collect::<Vec<_>>()
            .join("; ");
        Self::parse(&joined)
    }

    pub fn parse(header: &str) -> Self {
        let mut seen: HashSet<&str> = HashSet::new();
        let mut pairs: Vec<(String, String)> = Vec::new();
        for segment in header.split(';') {
            let Some((name, value)) = segment.split_once('=') else {
                continue;
            };
            let name = name.trim_matches([' ', '\t']);
            if !seen.insert(name) {
                continue;
            }
            pairs.push((
                name.to_owned(),
                decode_value(value.trim_matches([' ', '\t'])),
            ));
        }
        Self(pairs)
    }

    pub fn get(&self, name: &str) -> Option<&str> {
        self.0
            .iter()
            .find(|(existing, _)| existing == name)
            .map(|(_, value)| value.as_str())
    }

    /// `true` if a session cookie (whole or chunked) named `name` is present.
    pub fn has_session(&self, name: &str) -> bool {
        self.0
            .iter()
            .any(|(cookie, value)| cookie.starts_with(name) && !value.is_empty())
    }

    /// Reassembles the session token stored under `name` (`name` or `name.0`, `name.1`, …).
    ///
    /// Auth.js joins every non-empty cookie whose name starts with `name`, ordered by
    /// the numeric suffix. Mixtures it would join into garbage (the whole cookie next
    /// to chunks, gaps, foreign suffixes) are reported as malformed instead.
    pub fn session_token(&self, name: &str) -> Result<Option<String>, SessionError> {
        let parts: Vec<(&str, &str)> = self
            .0
            .iter()
            .filter(|(cookie, value)| cookie.starts_with(name) && !value.is_empty())
            .map(|(cookie, value)| (cookie.as_str(), value.as_str()))
            .collect();
        match parts.as_slice() {
            [] => return Ok(None),
            [(cookie, value)] if *cookie == name => return checked(value.to_string()),
            _ => {}
        }
        if parts.len() > MAX_CHUNKS {
            return Err(SessionError::TooLarge);
        }
        let mut chunks = parts
            .iter()
            .map(|(cookie, value)| chunk_index(cookie, name).map(|index| (index, *value)))
            .collect::<Option<Vec<_>>>()
            .ok_or(SessionError::Malformed)?;
        chunks.sort_unstable_by_key(|(index, _)| *index);
        if chunks
            .iter()
            .enumerate()
            .any(|(position, (index, _))| position != *index)
        {
            return Err(SessionError::Malformed);
        }
        checked(chunks.into_iter().map(|(_, value)| value).collect())
    }
}

fn checked(token: String) -> Result<Option<String>, SessionError> {
    if token.len() > MAX_TOKEN_LEN {
        return Err(SessionError::TooLarge);
    }
    Ok(Some(token))
}

/// `Some(n)` for `<name>.<n>` with a plain decimal `n`.
fn chunk_index(cookie: &str, name: &str) -> Option<usize> {
    let digits = cookie.strip_prefix(name)?.strip_prefix('.')?;
    if digits.is_empty() || digits.len() > 3 || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    digits.parse().ok()
}

/// `decodeURIComponent` when the value contains `%`, the raw value if that fails.
fn decode_value(raw: &str) -> String {
    if !raw.contains('%') || !has_only_valid_escapes(raw) {
        return raw.to_owned();
    }
    percent_decode_str(raw)
        .decode_utf8()
        .map(|decoded| decoded.into_owned())
        .unwrap_or_else(|_| raw.to_owned())
}

fn has_only_valid_escapes(raw: &str) -> bool {
    let bytes = raw.as_bytes();
    bytes.iter().enumerate().all(|(i, byte)| {
        *byte != b'%'
            || (bytes.get(i + 1).is_some_and(u8::is_ascii_hexdigit)
                && bytes.get(i + 2).is_some_and(u8::is_ascii_hexdigit))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    const NAME: &str = "authjs.session-token";

    #[test]
    fn parses_like_the_cookie_package() {
        let cookies = Cookies::parse(" a = 1 ;b=2; a=3;flag; c=%41%42; d=%zz; e=x=y;\tf=\t4");
        assert_eq!(cookies.get("a"), Some("1"), "first occurrence wins");
        assert_eq!(cookies.get("b"), Some("2"));
        assert_eq!(cookies.get("flag"), None);
        assert_eq!(cookies.get("c"), Some("AB"));
        assert_eq!(cookies.get("d"), Some("%zz"), "invalid escapes stay raw");
        assert_eq!(cookies.get("e"), Some("x=y"));
        assert_eq!(cookies.get("f"), Some("4"));
    }

    #[test]
    fn joins_multiple_cookie_headers() {
        let mut headers = HeaderMap::new();
        headers.append(COOKIE, HeaderValue::from_static("a=1"));
        headers.append(COOKIE, HeaderValue::from_static("b=2"));
        let cookies = Cookies::from_headers(&headers);
        assert_eq!(cookies.get("a"), Some("1"));
        assert_eq!(cookies.get("b"), Some("2"));
    }

    #[test]
    fn non_ascii_cookies_do_not_hide_the_session() {
        let mut headers = HeaderMap::new();
        headers.append(
            COOKIE,
            HeaderValue::from_bytes(b"pref=caf\xc3\xa9; authjs.session-token=tok")
                .expect("obs-text is a valid header value"),
        );
        let cookies = Cookies::from_headers(&headers);
        assert_eq!(cookies.session_token(NAME), Ok(Some("tok".to_owned())));
    }

    #[test]
    fn returns_whole_cookie() {
        let cookies = Cookies::parse("authjs.session-token=abc; other=x");
        assert_eq!(cookies.session_token(NAME), Ok(Some("abc".to_owned())));
        assert_eq!(Cookies::parse("other=x").session_token(NAME), Ok(None));
        assert_eq!(
            Cookies::parse("authjs.session-token=").session_token(NAME),
            Ok(None)
        );
    }

    #[test]
    fn joins_chunks_in_numeric_order() {
        let header = (0..12)
            .rev()
            .map(|i| format!("{NAME}.{i}=p{i}"))
            .collect::<Vec<_>>()
            .join("; ");
        let expected: String = (0..12).map(|i| format!("p{i}")).collect();
        assert_eq!(
            Cookies::parse(&header).session_token(NAME),
            Ok(Some(expected))
        );
    }

    #[test]
    fn rejects_ambiguous_or_incomplete_chunk_sets() {
        for header in [
            "authjs.session-token=a; authjs.session-token.0=b",
            "authjs.session-token.0=a; authjs.session-token.2=b",
            "authjs.session-token.1=a",
            "authjs.session-tokenX=a",
            "authjs.session-token.x=a",
        ] {
            assert_eq!(
                Cookies::parse(header).session_token(NAME),
                Err(SessionError::Malformed),
                "{header}"
            );
        }
    }

    #[test]
    fn rejects_oversized_sessions() {
        let header = (0..=MAX_CHUNKS)
            .map(|i| format!("{NAME}.{i}=x"))
            .collect::<Vec<_>>()
            .join("; ");
        assert_eq!(
            Cookies::parse(&header).session_token(NAME),
            Err(SessionError::TooLarge)
        );
        let huge = format!("{NAME}={}", "a".repeat(MAX_TOKEN_LEN + 1));
        assert_eq!(
            Cookies::parse(&huge).session_token(NAME),
            Err(SessionError::TooLarge)
        );
    }
}

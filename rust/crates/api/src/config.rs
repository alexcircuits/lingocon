//! Startup configuration, read from the environment and validated once.
//!
//! Every problem is reported with the variable name and what is expected, and
//! secrets never appear in error messages or `Debug` output.

use std::fmt;
use std::net::SocketAddr;
use std::time::Duration;

use crate::auth::session::AuthSecret;
use crate::auth::token::InternalToken;
use crate::db::url::DatabaseConfig;

pub const DEFAULT_BIND: &str = "127.0.0.1:3040";
pub const DEFAULT_DB_POOL: usize = 8;
pub const DEFAULT_STATEMENT_TIMEOUT_MS: u64 = 5_000;
pub const DEFAULT_MAX_INFLIGHT: usize = 32;
/// Every request is cut off after this long (in-flight work is dropped).
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// Largest accepted request body.
pub const BODY_LIMIT_BYTES: usize = 1024 * 1024;

const MAX_DB_POOL: usize = 256;
/// Statements must give up before the request does: a timed-out request does not
/// cancel its query, so a longer statement would keep a pooled connection busy.
const MAX_STATEMENT_TIMEOUT_MS: u64 = 9_000;
const MAX_INFLIGHT: usize = 10_000;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ConfigError {
    #[error("{name} is required")]
    Missing { name: &'static str },
    #[error("{name} {reason}")]
    Invalid { name: &'static str, reason: String },
}

impl ConfigError {
    fn invalid(name: &'static str, reason: impl Into<String>) -> Self {
        Self::Invalid {
            name,
            reason: reason.into(),
        }
    }
}

/// HTTP-layer limits shared by the router and its middleware.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HttpSettings {
    pub request_timeout: Duration,
    pub body_limit: usize,
    pub max_inflight: usize,
}

impl Default for HttpSettings {
    fn default() -> Self {
        Self {
            request_timeout: REQUEST_TIMEOUT,
            body_limit: BODY_LIMIT_BYTES,
            max_inflight: DEFAULT_MAX_INFLIGHT,
        }
    }
}

#[derive(Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub api_token: InternalToken,
    pub database: DatabaseConfig,
    /// `AUTH_SECRET`; `None` disables session verification (session routes answer 401).
    pub auth_secret: Option<AuthSecret>,
    pub db_pool_size: usize,
    pub statement_timeout: Duration,
    pub http: HttpSettings,
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("bind", &self.bind)
            .field("api_token", &self.api_token)
            .field("database", &self.database)
            .field(
                "auth_secret",
                &self.auth_secret.as_ref().map(|_| "[redacted]"),
            )
            .field("db_pool_size", &self.db_pool_size)
            .field("statement_timeout", &self.statement_timeout)
            .field("http", &self.http)
            .finish()
    }
}

impl Config {
    /// Reads the process environment.
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|name| std::env::var(name).ok())
    }

    /// Reads configuration through `lookup` (the environment in production, a map in tests).
    pub fn from_lookup<F>(lookup: F) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let bind = parse_bind(&lookup)?;

        let token = lookup("LINGOCON_API_TOKEN")
            .filter(|value| !value.is_empty())
            .ok_or(ConfigError::Missing {
                name: "LINGOCON_API_TOKEN",
            })?;
        let api_token = InternalToken::parse(&token)
            .map_err(|reason| ConfigError::invalid("LINGOCON_API_TOKEN", reason))?;

        let database_url = lookup("DATABASE_URL")
            .filter(|value| !value.trim().is_empty())
            .ok_or(ConfigError::Missing {
                name: "DATABASE_URL",
            })?;
        let database = DatabaseConfig::parse(database_url.trim())
            .map_err(|err| ConfigError::invalid("DATABASE_URL", err.to_string()))?;

        // An empty AUTH_SECRET is treated as unset, exactly like Auth.js refuses it.
        let auth_secret = lookup("AUTH_SECRET")
            .filter(|value| !value.is_empty())
            .map(AuthSecret::new);

        let db_pool_size = parse_number(
            &lookup,
            "LINGOCON_API_DB_POOL",
            DEFAULT_DB_POOL,
            1,
            MAX_DB_POOL,
        )?;
        let statement_timeout_ms = parse_number(
            &lookup,
            "LINGOCON_API_STATEMENT_TIMEOUT_MS",
            DEFAULT_STATEMENT_TIMEOUT_MS,
            1,
            MAX_STATEMENT_TIMEOUT_MS,
        )?;
        let max_inflight = parse_number(
            &lookup,
            "LINGOCON_API_MAX_INFLIGHT",
            DEFAULT_MAX_INFLIGHT,
            1,
            MAX_INFLIGHT,
        )?;

        Ok(Self {
            bind,
            api_token,
            database,
            auth_secret,
            db_pool_size,
            statement_timeout: Duration::from_millis(statement_timeout_ms),
            http: HttpSettings {
                request_timeout: REQUEST_TIMEOUT,
                body_limit: BODY_LIMIT_BYTES,
                max_inflight,
            },
        })
    }
}

fn parse_bind<F>(lookup: &F) -> Result<SocketAddr, ConfigError>
where
    F: Fn(&str) -> Option<String>,
{
    const NAME: &str = "LINGOCON_API_BIND";
    let raw = lookup(NAME)
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_BIND.to_owned());
    let bind: SocketAddr = raw.parse().map_err(|_| {
        ConfigError::invalid(
            NAME,
            format!("must be an IP socket address such as {DEFAULT_BIND} (got {raw:?})"),
        )
    })?;
    if !bind.ip().is_loopback() && !parse_flag(lookup, "LINGOCON_API_ALLOW_PUBLIC_BIND")? {
        return Err(ConfigError::invalid(
            NAME,
            format!(
                "is {bind}, which is not a loopback address; the service is meant to be reached \
                 only by Next.js on the same host. Set LINGOCON_API_ALLOW_PUBLIC_BIND=1 to allow it \
                 (e.g. inside a private container network)"
            ),
        ));
    }
    Ok(bind)
}

fn parse_flag<F>(lookup: &F, name: &'static str) -> Result<bool, ConfigError>
where
    F: Fn(&str) -> Option<String>,
{
    match lookup(name).as_deref().map(str::trim) {
        None | Some("") | Some("0") | Some("false") => Ok(false),
        Some("1") | Some("true") => Ok(true),
        Some(other) => Err(ConfigError::invalid(
            name,
            format!("must be 1 or 0 (got {other:?})"),
        )),
    }
}

fn parse_number<F, N>(
    lookup: &F,
    name: &'static str,
    default: N,
    min: N,
    max: N,
) -> Result<N, ConfigError>
where
    F: Fn(&str) -> Option<String>,
    N: std::str::FromStr + PartialOrd + fmt::Display + Copy,
{
    let Some(raw) = lookup(name).filter(|value| !value.trim().is_empty()) else {
        return Ok(default);
    };
    let invalid = || ConfigError::invalid(name, format!("must be an integer from {min} to {max}"));
    let value: N = raw.trim().parse().map_err(|_| invalid())?;
    if value < min || value > max {
        return Err(invalid());
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef";
    const DB: &str = "postgresql://app:s3cret@localhost:5432/langua?schema=public";

    fn config(vars: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let map: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
            .collect();
        Config::from_lookup(|name| map.get(name).cloned())
    }

    fn base() -> Vec<(&'static str, &'static str)> {
        vec![("LINGOCON_API_TOKEN", TOKEN), ("DATABASE_URL", DB)]
    }

    fn with(extra: &[(&'static str, &'static str)]) -> Vec<(&'static str, &'static str)> {
        let mut vars = base();
        vars.extend_from_slice(extra);
        vars
    }

    #[test]
    fn applies_defaults() {
        let cfg = config(&base()).expect("valid config");
        assert_eq!(cfg.bind, DEFAULT_BIND.parse().expect("default bind"));
        assert_eq!(cfg.db_pool_size, DEFAULT_DB_POOL);
        assert_eq!(cfg.statement_timeout, Duration::from_millis(5_000));
        assert_eq!(cfg.http.max_inflight, DEFAULT_MAX_INFLIGHT);
        assert_eq!(cfg.http.request_timeout, REQUEST_TIMEOUT);
        assert_eq!(cfg.http.body_limit, BODY_LIMIT_BYTES);
        assert!(cfg.auth_secret.is_none());
    }

    #[test]
    fn requires_token_and_database_url() {
        assert_eq!(
            config(&[("DATABASE_URL", DB)]).unwrap_err(),
            ConfigError::Missing {
                name: "LINGOCON_API_TOKEN"
            }
        );
        assert_eq!(
            config(&[("LINGOCON_API_TOKEN", TOKEN)]).unwrap_err(),
            ConfigError::Missing {
                name: "DATABASE_URL"
            }
        );
        assert_eq!(
            config(&[("LINGOCON_API_TOKEN", ""), ("DATABASE_URL", DB)]).unwrap_err(),
            ConfigError::Missing {
                name: "LINGOCON_API_TOKEN"
            }
        );
    }

    #[test]
    fn rejects_weak_or_malformed_tokens() {
        let long = "a".repeat(257);
        for bad in [
            "short",
            "0123456789abcdef0123456789abcde",
            "0123456789abcdef 0123456789abcdef",
            "0123456789abcdef\t0123456789abcdef",
            "0123456789abcdef0123456789abcdeé",
            long.as_str(),
        ] {
            let err = config(&[("LINGOCON_API_TOKEN", bad), ("DATABASE_URL", DB)])
                .expect_err("token must be rejected");
            let message = err.to_string();
            assert!(message.starts_with("LINGOCON_API_TOKEN "), "{message}");
            assert!(!message.contains(bad), "error must not echo the token");
        }
        let max = "~".repeat(256);
        assert!(config(&[("LINGOCON_API_TOKEN", &max), ("DATABASE_URL", DB)]).is_ok());
    }

    #[test]
    fn refuses_public_bind_unless_allowed() {
        let err = config(&with(&[("LINGOCON_API_BIND", "0.0.0.0:3040")])).unwrap_err();
        assert!(
            err.to_string().contains("LINGOCON_API_ALLOW_PUBLIC_BIND=1"),
            "{err}"
        );

        let cfg = config(&with(&[
            ("LINGOCON_API_BIND", "0.0.0.0:3040"),
            ("LINGOCON_API_ALLOW_PUBLIC_BIND", "1"),
        ]))
        .expect("explicitly allowed");
        assert_eq!(cfg.bind.port(), 3040);

        let ipv6 = config(&with(&[("LINGOCON_API_BIND", "[::1]:4000")])).expect("loopback v6");
        assert!(ipv6.bind.ip().is_loopback());

        assert!(config(&with(&[
            ("LINGOCON_API_BIND", "0.0.0.0:3040"),
            ("LINGOCON_API_ALLOW_PUBLIC_BIND", "yes"),
        ]))
        .is_err());
    }

    #[test]
    fn rejects_unparseable_bind() {
        let err = config(&with(&[("LINGOCON_API_BIND", "localhost:3040")])).unwrap_err();
        assert!(
            err.to_string().starts_with("LINGOCON_API_BIND must be"),
            "{err}"
        );
    }

    #[test]
    fn validates_numeric_limits() {
        let cfg = config(&with(&[
            ("LINGOCON_API_DB_POOL", "16"),
            ("LINGOCON_API_STATEMENT_TIMEOUT_MS", " 2500 "),
            ("LINGOCON_API_MAX_INFLIGHT", "4"),
        ]))
        .expect("valid numbers");
        assert_eq!(cfg.db_pool_size, 16);
        assert_eq!(cfg.statement_timeout, Duration::from_millis(2_500));
        assert_eq!(cfg.http.max_inflight, 4);

        for (name, value) in [
            ("LINGOCON_API_DB_POOL", "0"),
            ("LINGOCON_API_DB_POOL", "lots"),
            ("LINGOCON_API_STATEMENT_TIMEOUT_MS", "-1"),
            ("LINGOCON_API_STATEMENT_TIMEOUT_MS", "10000"),
            ("LINGOCON_API_MAX_INFLIGHT", "0"),
        ] {
            let err = config(&with(&[(name, value)])).unwrap_err();
            assert!(err.to_string().starts_with(name), "{err}");
        }
    }

    #[test]
    fn auth_secret_is_optional_and_empty_means_unset() {
        assert!(config(&with(&[("AUTH_SECRET", "")]))
            .expect("valid")
            .auth_secret
            .is_none());
        assert!(config(&with(&[("AUTH_SECRET", "s")]))
            .expect("valid")
            .auth_secret
            .is_some());
    }

    #[test]
    fn invalid_database_url_is_reported_without_credentials() {
        let err = config(&[
            ("LINGOCON_API_TOKEN", TOKEN),
            ("DATABASE_URL", "mysql://root:hunter2@db/x"),
        ])
        .unwrap_err();
        let message = err.to_string();
        assert!(message.starts_with("DATABASE_URL "), "{message}");
        assert!(!message.contains("hunter2"), "{message}");
    }

    #[test]
    fn debug_output_redacts_secrets() {
        let cfg = config(&with(&[("AUTH_SECRET", "super-secret-auth")])).expect("valid");
        let debug = format!("{cfg:?}");
        assert!(!debug.contains(TOKEN), "{debug}");
        assert!(!debug.contains("s3cret"), "{debug}");
        assert!(!debug.contains("super-secret-auth"), "{debug}");
    }
}

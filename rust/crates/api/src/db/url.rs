//! `DATABASE_URL` handling.
//!
//! The service shares the Next.js app's Prisma connection string. Prisma adds
//! query parameters libpq/tokio-postgres do not know (`schema`, `connection_limit`,
//! `pool_timeout`, `sslaccept`, …) and tokio-postgres rejects unknown ones, so
//! the URL is filtered here and the Prisma semantics that matter are applied:
//!
//! - `schema=<name>` becomes the connection's `search_path` (default `public`);
//! - `sslmode=require` (or `verify-ca`/`verify-full`) turns TLS on via rustls;
//!   anything else (`disable`, `prefer`, absent) connects in plain text;
//! - with `sslmode=require` the certificate is verified only when `sslaccept=strict`
//!   (Prisma's default is `accept_invalid_certs`, libpq's `require` does the same);
//!   `sslcert` (Prisma, relative to `prisma/`) or `sslrootcert` (libpq) add a CA file.

use std::fmt;
use std::path::PathBuf;
use std::time::Duration;

use percent_encoding::percent_decode_str;
use tokio_postgres::config::{Host, SslMode};

/// Query parameters tokio-postgres understands and receives unchanged.
const PASS_THROUGH: &[&str] = &[
    "user",
    "password",
    "dbname",
    "options",
    "application_name",
    "host",
    "hostaddr",
    "port",
    "connect_timeout",
    "tcp_user_timeout",
    "keepalives",
    "keepalives_idle",
    "keepalives_interval",
    "keepalives_retries",
    "target_session_attrs",
    "channel_binding",
    "load_balance_hosts",
    "sslnegotiation",
];

const DEFAULT_SCHEMA: &str = "public";
const DEFAULT_APPLICATION_NAME: &str = "lingocon-api";
const DEFAULT_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
/// Prisma resolves a relative `sslcert` against the schema directory.
const PRISMA_DIR: &str = "prisma";

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum DatabaseUrlError {
    #[error("must start with postgresql:// or postgres://")]
    Scheme,
    #[error("has a query parameter that is not valid percent-encoded UTF-8")]
    Encoding,
    #[error(
        "has an unsupported sslmode {0:?} (use disable, prefer, require, verify-ca or verify-full)"
    )]
    SslMode(String),
    #[error("has an unsupported sslaccept {0:?} (use strict or accept_invalid_certs)")]
    SslAccept(String),
    #[error(
        "has an invalid schema {0:?} (letters, digits and underscores only, at most 63 characters)"
    )]
    Schema(String),
    #[error(
        "points at PgBouncer (pgbouncer=true), which the service does not support (it uses \
         startup options and prepared statements); set DATABASE_URL for lingocon-api to the \
         PostgreSQL server itself"
    )]
    PgBouncer,
    #[error("could not be parsed: {0}")]
    Parse(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TlsMode {
    /// Plain TCP / Unix socket.
    Disabled,
    /// TLS is mandatory. `verify` checks the certificate chain and host name against
    /// the Mozilla roots plus `ca_file`; otherwise the connection is encrypted only.
    Required {
        verify: bool,
        ca_file: Option<PathBuf>,
    },
}

#[derive(Clone)]
pub struct DatabaseConfig {
    pg: tokio_postgres::Config,
    tls: TlsMode,
    schema: String,
    ignored_params: Vec<String>,
}

impl fmt::Debug for DatabaseConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.summary())
    }
}

impl DatabaseConfig {
    pub fn parse(url: &str) -> Result<Self, DatabaseUrlError> {
        if !(url.starts_with("postgresql://") || url.starts_with("postgres://")) {
            return Err(DatabaseUrlError::Scheme);
        }
        let (base, query) = match url.split_once('?') {
            Some((base, query)) => (base, query),
            None => (url, ""),
        };

        let mut kept: Vec<&str> = Vec::new();
        let mut ignored_params = Vec::new();
        let mut schema = None;
        let mut sslmode = None;
        let mut sslaccept = None;
        let mut ca_file = None;
        for pair in query.split('&').filter(|pair| !pair.is_empty()) {
            let (raw_key, raw_value) = pair.split_once('=').unwrap_or((pair, ""));
            let key = decode(raw_key)?;
            match key.as_str() {
                "schema" => schema = Some(decode(raw_value)?),
                "sslmode" => sslmode = Some(decode(raw_value)?),
                "sslaccept" => sslaccept = Some(decode(raw_value)?),
                "sslrootcert" => ca_file = Some(PathBuf::from(decode(raw_value)?)),
                "pgbouncer" if decode(raw_value)? == "true" => {
                    return Err(DatabaseUrlError::PgBouncer)
                }
                "sslcert" => {
                    let path = PathBuf::from(decode(raw_value)?);
                    ca_file = Some(if path.is_relative() {
                        PathBuf::from(PRISMA_DIR).join(path)
                    } else {
                        path
                    });
                }
                known if PASS_THROUGH.contains(&known) => kept.push(pair),
                // Prisma-only (connection_limit, pool_timeout, pgbouncer, …) or unknown.
                _ => ignored_params.push(key),
            }
        }

        let verify = match sslaccept.as_deref() {
            None | Some("accept_invalid_certs") => false,
            Some("strict") => true,
            Some(other) => return Err(DatabaseUrlError::SslAccept(other.to_owned())),
        };
        let tls = match sslmode.as_deref() {
            None | Some("disable") | Some("allow") | Some("prefer") => TlsMode::Disabled,
            Some("require") => TlsMode::Required { verify, ca_file },
            Some("verify-ca") | Some("verify-full") => TlsMode::Required {
                verify: true,
                ca_file,
            },
            Some(other) => return Err(DatabaseUrlError::SslMode(other.to_owned())),
        };

        let schema = schema.unwrap_or_else(|| DEFAULT_SCHEMA.to_owned());
        if !is_simple_identifier(&schema) {
            return Err(DatabaseUrlError::Schema(schema));
        }

        let rebuilt = if kept.is_empty() {
            base.to_owned()
        } else {
            format!("{base}?{}", kept.join("&"))
        };
        let mut pg: tokio_postgres::Config = rebuilt
            .parse()
            .map_err(|err: tokio_postgres::Error| DatabaseUrlError::Parse(err.to_string()))?;
        pg.ssl_mode(match tls {
            TlsMode::Disabled => SslMode::Disable,
            TlsMode::Required { .. } => SslMode::Require,
        });
        if pg.get_application_name().is_none() {
            pg.application_name(DEFAULT_APPLICATION_NAME);
        }
        if pg.get_connect_timeout().is_none() {
            pg.connect_timeout(DEFAULT_CONNECT_TIMEOUT);
        }

        Ok(Self {
            pg,
            tls,
            schema,
            ignored_params,
        })
    }

    pub fn tls(&self) -> &TlsMode {
        &self.tls
    }

    pub fn schema(&self) -> &str {
        &self.schema
    }

    /// Query parameters that were dropped (Prisma-only or unknown), for a startup log line.
    pub fn ignored_params(&self) -> &[String] {
        &self.ignored_params
    }

    /// The connection settings with the per-connection `statement_timeout` and
    /// `search_path` applied as startup options (no extra round trip; ours win
    /// over any earlier `-c` in the URL because PostgreSQL applies them in order).
    pub fn connect_config(&self, statement_timeout: Duration) -> tokio_postgres::Config {
        let mut pg = self.pg.clone();
        let ours = format!(
            "-c statement_timeout={} -c search_path={}",
            statement_timeout.as_millis(),
            self.schema
        );
        let options = match pg.get_options().map(str::trim) {
            Some(existing) if !existing.is_empty() => format!("{existing} {ours}"),
            _ => ours,
        };
        pg.options(options);
        pg
    }

    /// Credential-free description for logs.
    pub fn summary(&self) -> String {
        let hosts: Vec<String> = self
            .pg
            .get_hosts()
            .iter()
            .map(|host| match host {
                Host::Tcp(name) => name.clone(),
                #[cfg(unix)]
                Host::Unix(path) => path.display().to_string(),
            })
            .collect();
        let ports: Vec<String> = self
            .pg
            .get_ports()
            .iter()
            .map(ToString::to_string)
            .collect();
        let tls = match &self.tls {
            TlsMode::Disabled => "off".to_owned(),
            TlsMode::Required { verify: true, .. } => "required (verified)".to_owned(),
            TlsMode::Required { verify: false, .. } => "required (unverified)".to_owned(),
        };
        format!(
            "host={} port={} dbname={} user={} schema={} tls={}",
            hosts.join(","),
            ports.join(","),
            self.pg.get_dbname().unwrap_or("-"),
            self.pg.get_user().unwrap_or("-"),
            self.schema,
            tls
        )
    }
}

fn decode(raw: &str) -> Result<String, DatabaseUrlError> {
    percent_decode_str(raw)
        .decode_utf8()
        .map(|value| value.into_owned())
        .map_err(|_| DatabaseUrlError::Encoding)
}

fn is_simple_identifier(name: &str) -> bool {
    let mut chars = name.chars();
    let starts_well = chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_');
    starts_well && name.len() <= 63 && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(url: &str) -> DatabaseConfig {
        DatabaseConfig::parse(url).expect("valid url")
    }

    #[test]
    fn strips_prisma_parameters_and_applies_schema() {
        let cfg = parse(
            "postgresql://app:pw@db.internal:6543/langua?schema=lingo&connection_limit=8&pool_timeout=10",
        );
        assert_eq!(cfg.schema(), "lingo");
        assert_eq!(cfg.tls(), &TlsMode::Disabled);
        assert_eq!(cfg.ignored_params(), ["connection_limit", "pool_timeout"]);
        let pg = cfg.connect_config(Duration::from_millis(5_000));
        assert_eq!(pg.get_dbname(), Some("langua"));
        assert_eq!(pg.get_ports(), [6543]);
        assert_eq!(
            pg.get_options(),
            Some("-c statement_timeout=5000 -c search_path=lingo")
        );
        assert_eq!(pg.get_application_name(), Some("lingocon-api"));
        assert_eq!(pg.get_connect_timeout(), Some(&Duration::from_secs(5)));
        assert_eq!(pg.get_ssl_mode(), SslMode::Disable);
    }

    #[test]
    fn defaults_schema_to_public_and_keeps_existing_options() {
        let cfg =
            parse("postgres://app@localhost/langua?options=-c%20work_mem%3D4MB&application_name=x");
        let pg = cfg.connect_config(Duration::from_millis(250));
        assert_eq!(
            pg.get_options(),
            Some("-c work_mem=4MB -c statement_timeout=250 -c search_path=public")
        );
        assert_eq!(pg.get_application_name(), Some("x"));
    }

    #[test]
    fn keeps_percent_encoded_credentials() {
        let cfg = parse("postgresql://app:p%40ss%3Fw%2Frd@localhost:5432/langua");
        let pg = cfg.connect_config(Duration::from_secs(1));
        assert_eq!(pg.get_password(), Some(&b"p@ss?w/rd"[..]));
    }

    #[test]
    fn maps_ssl_modes() {
        assert_eq!(
            parse("postgresql://a@h/d?sslmode=prefer").tls(),
            &TlsMode::Disabled
        );
        assert_eq!(
            parse("postgresql://a@h/d?sslmode=require").tls(),
            &TlsMode::Required {
                verify: false,
                ca_file: None
            }
        );
        assert_eq!(
            parse("postgresql://a@h/d?sslmode=require&sslaccept=strict&sslcert=ca.pem").tls(),
            &TlsMode::Required {
                verify: true,
                ca_file: Some(PathBuf::from("prisma/ca.pem"))
            }
        );
        assert_eq!(
            parse("postgresql://a@h/d?sslmode=verify-full&sslrootcert=%2Fetc%2Fca.pem").tls(),
            &TlsMode::Required {
                verify: true,
                ca_file: Some(PathBuf::from("/etc/ca.pem"))
            }
        );
        let pg = parse("postgresql://a@h/d?sslmode=require").connect_config(Duration::from_secs(1));
        assert_eq!(pg.get_ssl_mode(), SslMode::Require);
    }

    #[test]
    fn rejects_bad_values() {
        assert_eq!(
            DatabaseConfig::parse("mysql://a@h/d").unwrap_err(),
            DatabaseUrlError::Scheme
        );
        assert!(matches!(
            DatabaseConfig::parse("postgresql://a@h/d?sslmode=sometimes"),
            Err(DatabaseUrlError::SslMode(_))
        ));
        assert!(matches!(
            DatabaseConfig::parse("postgresql://a@h/d?sslmode=require&sslaccept=maybe"),
            Err(DatabaseUrlError::SslAccept(_))
        ));
        assert!(matches!(
            DatabaseConfig::parse("postgresql://a@h/d?schema=bad;name"),
            Err(DatabaseUrlError::Schema(_))
        ));
        assert!(matches!(
            DatabaseConfig::parse("postgresql://a@h/d?schema=%FF"),
            Err(DatabaseUrlError::Encoding)
        ));
        assert_eq!(
            DatabaseConfig::parse("postgresql://a@h:6432/d?pgbouncer=true").unwrap_err(),
            DatabaseUrlError::PgBouncer
        );
        assert!(DatabaseConfig::parse("postgresql://a@h/d?pgbouncer=false").is_ok());
    }

    #[test]
    fn parse_errors_do_not_echo_the_password() {
        let err = DatabaseConfig::parse("postgresql://app:hunter2@localhost:notaport/db")
            .expect_err("bad port");
        assert!(!err.to_string().contains("hunter2"), "{err}");
    }

    #[test]
    fn summary_and_debug_hide_the_password() {
        let cfg = parse("postgresql://app:hunter2@localhost:5432/langua?sslmode=require");
        let summary = cfg.summary();
        assert_eq!(
            summary,
            "host=localhost port=5432 dbname=langua user=app schema=public tls=required (unverified)"
        );
        assert!(!format!("{cfg:?}").contains("hunter2"));
    }
}

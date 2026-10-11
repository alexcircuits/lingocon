//! PostgreSQL access: connection pool, error classification and per-domain queries.
//!
//! Prisma maps models to snake_case tables with camelCase quoted columns
//! (`dictionary_entries."languageId"`, `users."isSuspended"`); every query is
//! parameterized.

pub mod languages;
pub mod lexicon;
pub mod tls;
pub mod url;
pub mod users;

use std::time::Duration;

use deadpool_postgres::{Manager, ManagerConfig, RecyclingMethod, Runtime};
use tokio_postgres::NoTls;

pub use deadpool_postgres::Pool;

use self::tls::{rustls_connector, TlsSetupError};
use self::url::{DatabaseConfig, TlsMode};

/// Longest a request waits for a free pooled connection before answering 503.
const POOL_WAIT_TIMEOUT: Duration = Duration::from_secs(2);
const POOL_CREATE_TIMEOUT: Duration = Duration::from_secs(5);
const POOL_RECYCLE_TIMEOUT: Duration = Duration::from_secs(1);

#[derive(Debug, thiserror::Error)]
pub enum PoolSetupError {
    #[error(transparent)]
    Tls(#[from] TlsSetupError),
    #[error("could not build the database pool: {0}")]
    Build(#[from] deadpool_postgres::BuildError),
}

/// Builds the pool. No connection is opened until the first request needs one,
/// so the service starts (and reports `/readyz` 503) while the database is down.
pub fn build_pool(
    database: &DatabaseConfig,
    max_size: usize,
    statement_timeout: Duration,
) -> Result<Pool, PoolSetupError> {
    let pg = database.connect_config(statement_timeout);
    // Verified: a connection returned by a request that timed out mid-query is still
    // busy with that query; the check (bounded by the recycle timeout) catches it,
    // and deadpool replaces it instead of handing it to the next request.
    let manager_config = ManagerConfig {
        recycling_method: RecyclingMethod::Verified,
    };
    let manager = match database.tls() {
        TlsMode::Disabled => Manager::from_config(pg, NoTls, manager_config),
        TlsMode::Required { verify, ca_file } => Manager::from_config(
            pg,
            rustls_connector(*verify, ca_file.as_deref())?,
            manager_config,
        ),
    };
    Ok(Pool::builder(manager)
        .max_size(max_size)
        .runtime(Runtime::Tokio1)
        .wait_timeout(Some(POOL_WAIT_TIMEOUT))
        .create_timeout(Some(POOL_CREATE_TIMEOUT))
        .recycle_timeout(Some(POOL_RECYCLE_TIMEOUT))
        .build()?)
}

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("database pool: {0}")]
    Pool(#[from] deadpool_postgres::PoolError),
    #[error("database query: {0}")]
    Query(#[from] tokio_postgres::Error),
}

impl DbError {
    /// `true` when the database is unreachable, overloaded or too slow (answer 503 so
    /// callers fall back), `false` for errors that indicate a bug (answer 500).
    pub fn is_unavailable(&self) -> bool {
        use deadpool_postgres::PoolError;
        match self {
            DbError::Pool(PoolError::NoRuntimeSpecified) => false,
            DbError::Pool(_) => true,
            DbError::Query(err) => query_error_is_unavailable(err),
        }
    }

    /// `true` for errors an operator must fix (wrong password, missing database or
    /// schema, missing privileges) rather than wait out; they are logged as errors.
    pub fn is_misconfiguration(&self) -> bool {
        let err = match self {
            DbError::Pool(deadpool_postgres::PoolError::Backend(err)) | DbError::Query(err) => err,
            DbError::Pool(_) => return false,
        };
        err.code().is_some_and(|code| {
            let code = code.code();
            code.starts_with("28") || matches!(code, "3D000" | "3F000" | "42501")
        })
    }
}

fn query_error_is_unavailable(err: &tokio_postgres::Error) -> bool {
    if err.is_closed() {
        return true;
    }
    match err.code() {
        // 08: connection exceptions; 53300: too many connections; 57014: statement
        // timeout / cancel; 57P01–57P03: server shutting down or starting up.
        Some(code) => {
            let code = code.code();
            code.starts_with("08")
                || matches!(code, "53300" | "57014" | "57P01" | "57P02" | "57P03")
        }
        None => std::error::Error::source(err)
            .is_some_and(|source| source.downcast_ref::<std::io::Error>().is_some()),
    }
}

/// Cheap round trip used by `/readyz`.
pub async fn ping(pool: &Pool) -> Result<(), DbError> {
    let client = pool.get().await?;
    client.simple_query("SELECT 1").await?;
    Ok(())
}

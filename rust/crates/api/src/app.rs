//! Application assembly: state, routes and middleware.

use std::sync::Arc;

use axum::middleware::from_fn_with_state;
use axum::routing::{get, post};
use axum::Router;
use tokio::sync::Semaphore;

use crate::auth::session::{KeyDerivationError, SessionKeys};
use crate::auth::token::require_internal_token;
use crate::config::{Config, HttpSettings};
use crate::db::{build_pool, PoolSetupError};
use crate::middleware::{self, limit_concurrency};
use crate::routes::{health, lexicon, me, not_found};
use crate::state::AppState;

#[derive(Debug, thiserror::Error)]
pub enum StartupError {
    #[error(transparent)]
    Pool(#[from] PoolSetupError),
    #[error(transparent)]
    SessionKeys(#[from] KeyDerivationError),
}

/// Builds the shared state. Does not connect to the database yet.
pub fn build_state(config: &Config) -> Result<AppState, StartupError> {
    let pool = build_pool(
        &config.database,
        config.db_pool_size,
        config.statement_timeout,
    )?;
    let session_keys = config
        .auth_secret
        .as_ref()
        .map(SessionKeys::derive)
        .transpose()?;
    // Leave one core for the async workers (and Next.js on the same host).
    let cores = std::thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);
    Ok(AppState::new(
        pool,
        config.api_token.clone(),
        session_keys,
        cores.saturating_sub(1).max(1),
    ))
}

/// Routes plus middleware.
///
/// - `/healthz` and `/readyz` are outside the concurrency limit so probes report
///   process and database health, not load.
/// - Everything else shares `max_inflight` permits and answers 503 when saturated.
/// - `/v1/internal/*` additionally requires the bearer token.
pub fn build_router(state: AppState, settings: &HttpSettings) -> Router {
    let inflight = Arc::new(Semaphore::new(settings.max_inflight));

    let internal = Router::new()
        .route("/lexicon-analysis", post(lexicon::internal_analysis))
        .route_layer(from_fn_with_state(state.clone(), require_internal_token));

    let limited = Router::new()
        .route("/v1/me", get(me::me))
        .route(
            "/v1/languages/{language_id}/lexicon-analysis",
            get(lexicon::session_analysis),
        )
        .nest("/v1/internal", internal)
        .route_layer(from_fn_with_state(inflight, limit_concurrency));

    let router = Router::new()
        .route("/healthz", get(health::healthz))
        .route("/readyz", get(health::readyz))
        .merge(limited)
        .fallback(not_found)
        .with_state(state);
    middleware::apply(router, settings)
}

/// [`build_state`] + [`build_router`] from a validated [`Config`].
pub fn build_app(config: &Config) -> Result<Router, StartupError> {
    Ok(build_router(build_state(config)?, &config.http))
}

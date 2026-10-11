//! Structured JSON logs on stdout (PM2/Docker collect them). Level from `RUST_LOG`.

use tracing_subscriber::EnvFilter;

const DEFAULT_FILTER: &str = "info";

#[derive(Debug, thiserror::Error)]
#[error("could not initialise logging: {0}")]
pub struct TelemetryError(String);

/// Installs the global subscriber. An invalid `RUST_LOG` falls back to `info`
/// (and says so) instead of preventing startup.
pub fn init() -> Result<(), TelemetryError> {
    let configured = std::env::var("RUST_LOG")
        .ok()
        .filter(|value| !value.is_empty());
    let (filter, invalid) = match configured.as_deref().map(EnvFilter::try_new) {
        Some(Ok(filter)) => (filter, None),
        Some(Err(err)) => (EnvFilter::new(DEFAULT_FILTER), Some(err.to_string())),
        None => (EnvFilter::new(DEFAULT_FILTER), None),
    };
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(filter)
        .with_current_span(true)
        .with_span_list(false)
        .with_target(true)
        .try_init()
        .map_err(|err| TelemetryError(err.to_string()))?;
    if let Some(reason) = invalid {
        tracing::warn!(%reason, "ignoring invalid RUST_LOG; using \"info\"");
    }
    Ok(())
}

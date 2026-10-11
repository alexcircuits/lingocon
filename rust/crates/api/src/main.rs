//! `lingocon-api` binary: load `.env`, validate config, start logging, serve.

use std::path::Path;
use std::time::Duration;

use anyhow::Context;
use lingocon_api::{server, telemetry, Config};

fn main() -> anyhow::Result<()> {
    // Before any thread exists: dotenvy writes to the process environment.
    load_dotenv()?;
    telemetry::init()?;

    let config = match Config::from_env() {
        Ok(config) => config,
        Err(err) => {
            tracing::error!(error = %err, "invalid configuration");
            return Err(err).context("invalid configuration");
        }
    };

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .context("could not start the async runtime")?;
    let result = runtime.block_on(server::run(config));
    // Do not wait for analyses still running on the blocking pool after the drain
    // deadline: dropping the runtime would block until they finish.
    runtime.shutdown_timeout(SHUTDOWN_GRACE);
    result.inspect_err(|err| {
        tracing::error!(error = %err, "lingocon-api stopped");
    })?;
    Ok(())
}

const SHUTDOWN_GRACE: Duration = Duration::from_secs(1);

/// Next.js and this service share the repository's `.env` in production. Values
/// already in the environment (PM2, systemd, Docker) always win.
fn load_dotenv() -> anyhow::Result<()> {
    let path = Path::new(".env");
    if !path.exists() {
        return Ok(());
    }
    dotenvy::from_path(path).with_context(|| format!("could not read {}", path.display()))
}

//! Process lifecycle: bind, serve, and drain gracefully on SIGTERM/SIGINT.

use std::future::IntoFuture;
use std::net::SocketAddr;
use std::time::Duration;

use tokio::net::TcpListener;
use tokio::sync::oneshot;

use crate::app::{build_router, build_state, StartupError};
use crate::config::Config;
use crate::db::{self, url::TlsMode};

/// After a shutdown signal, in-flight requests get this long to finish (each is
/// already capped by the request timeout). Keep it below PM2's `kill_timeout`.
pub const DRAIN_DEADLINE: Duration = Duration::from_secs(20);
const STARTUP_PING_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, thiserror::Error)]
pub enum ServerError {
    #[error(transparent)]
    Startup(#[from] StartupError),
    #[error("could not listen on {addr}: {source}")]
    Bind {
        addr: SocketAddr,
        source: std::io::Error,
    },
    #[error("server stopped with an error: {0}")]
    Serve(std::io::Error),
}

pub async fn run(config: Config) -> Result<(), ServerError> {
    let state = build_state(&config)?;
    log_startup(&config);
    spawn_startup_ping(state.pool().clone());

    let router = build_router(state.clone(), &config.http);
    let listener = TcpListener::bind(config.bind)
        .await
        .map_err(|source| ServerError::Bind {
            addr: config.bind,
            source,
        })?;
    tracing::info!(addr = %config.bind, "listening");

    let (draining_tx, draining_rx) = oneshot::channel::<()>();
    let server = axum::serve(listener, router)
        .with_graceful_shutdown(async move {
            shutdown_signal().await;
            draining_tx.send(()).ok();
        })
        .into_future();
    let deadline = async move {
        if draining_rx.await.is_ok() {
            tokio::time::sleep(DRAIN_DEADLINE).await;
        } else {
            std::future::pending::<()>().await;
        }
    };

    tokio::select! {
        result = server => result.map_err(ServerError::Serve)?,
        () = deadline => tracing::warn!(
            deadline_secs = DRAIN_DEADLINE.as_secs(),
            "drain deadline exceeded; exiting with requests still in flight"
        ),
    }
    state.pool().close();
    tracing::info!("shutdown complete");
    Ok(())
}

fn log_startup(config: &Config) {
    tracing::info!(
        bind = %config.bind,
        database = %config.database.summary(),
        db_pool = config.db_pool_size,
        statement_timeout_ms = config.statement_timeout.as_millis() as u64,
        max_inflight = config.http.max_inflight,
        session_auth = config.auth_secret.is_some(),
        "starting lingocon-api"
    );
    if !config.database.ignored_params().is_empty() {
        tracing::info!(
            params = ?config.database.ignored_params(),
            "ignoring DATABASE_URL parameters the service does not use"
        );
    }
    if matches!(
        config.database.tls(),
        TlsMode::Required { verify: false, .. }
    ) {
        tracing::warn!(
            "database TLS is encrypted but the certificate is not verified \
             (add sslaccept=strict to DATABASE_URL to verify it)"
        );
    }
    if config.auth_secret.is_none() {
        tracing::warn!("AUTH_SECRET is not set: session-authenticated routes will answer 401");
    }
}

fn spawn_startup_ping(pool: db::Pool) {
    tokio::spawn(async move {
        match tokio::time::timeout(STARTUP_PING_TIMEOUT, db::ping(&pool)).await {
            Ok(Ok(())) => tracing::info!("database reachable"),
            Ok(Err(err)) => {
                tracing::warn!(error = %err, "database not reachable yet; /readyz will report it")
            }
            Err(_) => tracing::warn!("database ping timed out; /readyz will report it"),
        }
    });
}

async fn shutdown_signal() {
    let interrupt = async {
        if let Err(err) = tokio::signal::ctrl_c().await {
            tracing::error!(error = %err, "could not listen for SIGINT");
            std::future::pending::<()>().await;
        }
    };
    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        match signal(SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(err) => {
                tracing::error!(error = %err, "could not listen for SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = interrupt => {}
        () = terminate => {}
    }
    tracing::info!("shutdown signal received; draining in-flight requests");
}

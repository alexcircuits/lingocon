//! Liveness and readiness probes.

use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use crate::db;
use crate::error::json_error;
use crate::state::AppState;

const READINESS_TIMEOUT: Duration = Duration::from_secs(2);

/// `GET /healthz`: the process is up. Never touches the database.
pub async fn healthz() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

/// `GET /readyz`: the database answers within 2 s.
pub async fn readyz(State(state): State<AppState>) -> Response {
    match tokio::time::timeout(READINESS_TIMEOUT, db::ping(state.pool())).await {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({ "status": "ready" }))).into_response(),
        Ok(Err(err)) => {
            tracing::warn!(error = %err, "readiness check failed");
            json_error(StatusCode::SERVICE_UNAVAILABLE, "database unavailable")
        }
        Err(_) => {
            tracing::warn!("readiness check timed out");
            json_error(StatusCode::SERVICE_UNAVAILABLE, "database unavailable")
        }
    }
}

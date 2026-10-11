//! LingoCon platform service.
//!
//! Next.js authorizes the user, then calls this service over loopback with a
//! shared bearer token (`/v1/internal/*`). The service can also verify Auth.js
//! session cookies itself (`auth::session`) so pages can later be served from
//! Rust directly. See `docs/RUST_SERVICE.md` for architecture and operations.
#![forbid(unsafe_code)]

pub mod app;
pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod middleware;
pub mod routes;
pub mod server;
pub mod state;
pub mod telemetry;

pub use app::{build_app, build_router, build_state};
pub use config::Config;
pub use error::ApiError;
pub use state::AppState;

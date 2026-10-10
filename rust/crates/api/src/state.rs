//! Shared application state (cheap to clone: everything is behind `Arc`).

use std::sync::Arc;

use tokio::sync::Semaphore;

use crate::auth::session::SessionKeys;
use crate::auth::token::InternalToken;
use crate::db::Pool;

#[derive(Clone)]
pub struct AppState {
    pool: Pool,
    internal_token: Arc<InternalToken>,
    session_keys: Option<Arc<SessionKeys>>,
    /// Bounds CPU-heavy work on the blocking pool (one permit per core).
    cpu_permits: Arc<Semaphore>,
}

impl AppState {
    pub fn new(
        pool: Pool,
        internal_token: InternalToken,
        session_keys: Option<SessionKeys>,
        cpu_permits: usize,
    ) -> Self {
        Self {
            pool,
            internal_token: Arc::new(internal_token),
            session_keys: session_keys.map(Arc::new),
            cpu_permits: Arc::new(Semaphore::new(cpu_permits.max(1))),
        }
    }

    pub fn pool(&self) -> &Pool {
        &self.pool
    }

    pub fn internal_token(&self) -> &InternalToken {
        &self.internal_token
    }

    /// `None` when `AUTH_SECRET` is not configured (session routes then answer 401).
    pub fn session_keys(&self) -> Option<&SessionKeys> {
        self.session_keys.as_deref()
    }

    pub fn cpu_permits(&self) -> Arc<Semaphore> {
        Arc::clone(&self.cpu_permits)
    }
}

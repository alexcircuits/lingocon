//! HTTP routes. See `app::build_router` for how they are assembled and guarded.

pub mod health;
pub mod lexicon;
pub mod me;

use crate::error::ApiError;

/// Fallback for unknown paths.
pub async fn not_found() -> ApiError {
    ApiError::NotFound("not found")
}

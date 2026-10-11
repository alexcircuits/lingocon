//! Lexicon analysis (validation warnings + Swadesh coverage) for the studio overview.

use std::time::Instant;

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, State};
use axum::Json;
use lingocon_core::analysis::LexiconAnalysis;
use serde::Deserialize;

use crate::auth::access::{language_access, LanguageAccess};
use crate::auth::RequireUser;
use crate::db::lexicon::{load_lexicon_inputs, MAX_LEXICON_ENTRIES};
use crate::error::ApiError;
use crate::state::AppState;

/// Same cap as main's overview (`MAX_WARNINGS_SHOWN`): the response stays small.
pub const MAX_WARNINGS: usize = 50;
const MAX_LANGUAGE_ID_LEN: usize = 128;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconAnalysisRequest {
    pub language_id: String,
}

/// `POST /v1/internal/lexicon-analysis` (bearer token): Next has already authorized
/// the user for `languageId`.
pub async fn internal_analysis(
    State(state): State<AppState>,
    body: Result<Json<LexiconAnalysisRequest>, JsonRejection>,
) -> Result<Json<LexiconAnalysis>, ApiError> {
    let Json(request) = body?;
    let language_id = validate_language_id(&request.language_id)?;
    Ok(Json(analyze(&state, language_id).await?))
}

/// `GET /v1/languages/{languageId}/lexicon-analysis` (session cookie): the pattern
/// for pages served by Rust directly — authenticate, authorize like main's
/// `canViewLanguage`, then do the work.
pub async fn session_analysis(
    RequireUser(user): RequireUser,
    State(state): State<AppState>,
    Path(language_id): Path<String>,
) -> Result<Json<LexiconAnalysis>, ApiError> {
    let language_id = validate_language_id(&language_id)?;
    match language_access(state.pool(), language_id, Some(&user)).await? {
        // A language the user may not view answers exactly like a missing one, as
        // main's studio does (notFound), so private language ids cannot be probed.
        LanguageAccess::Missing | LanguageAccess::Denied => {
            Err(ApiError::NotFound("language not found"))
        }
        LanguageAccess::Allowed => Ok(Json(analyze(&state, language_id).await?)),
    }
}

fn validate_language_id(language_id: &str) -> Result<&str, ApiError> {
    let valid = !language_id.is_empty()
        && language_id.len() <= MAX_LANGUAGE_ID_LEN
        && !language_id.chars().any(char::is_control);
    if valid {
        Ok(language_id)
    } else {
        Err(ApiError::BadRequest(
            "languageId must be a non-empty string of at most 128 characters",
        ))
    }
}

async fn analyze(state: &AppState, language_id: &str) -> Result<LexiconAnalysis, ApiError> {
    let started = Instant::now();
    // One permit per analysis slot, taken before loading so that at most that many
    // lexicons are in memory at once. Waiting is bounded by the request timeout.
    let permit = state
        .cpu_permits()
        .acquire_owned()
        .await
        .map_err(|_| ApiError::Overloaded)?;
    let inputs = load_lexicon_inputs(state.pool(), language_id, MAX_LEXICON_ENTRIES)
        .await?
        .ok_or(ApiError::NotFound("language not found"))?;
    let loaded = started.elapsed();
    let entries = inputs.entries.len();

    // CPU-bound: run on the blocking pool. The permit moves into the task so it is
    // held until the work really ends, even if the request times out first.
    let analysis = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        inputs.analyze(MAX_WARNINGS)
    })
    .await?;

    tracing::debug!(
        language_id,
        entries,
        total_warnings = analysis.total,
        load_ms = loaded.as_millis() as u64,
        total_ms = started.elapsed().as_millis() as u64,
        "lexicon analysed"
    );
    Ok(analysis)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_language_ids() {
        assert!(validate_language_id("clx0abc").is_ok());
        assert!(validate_language_id("verify-large").is_ok());
        assert!(validate_language_id("").is_err());
        assert!(validate_language_id("a\nb").is_err());
        assert!(validate_language_id(&"x".repeat(129)).is_err());
    }
}

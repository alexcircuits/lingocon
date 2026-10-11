//! Axum extractors for session-authenticated routes.
//!
//! Semantics follow main's `getUserId`: a valid Auth.js session whose user exists
//! and is not suspended. Invalid, expired or foreign cookies simply mean "no user".

use axum::extract::{FromRef, FromRequestParts};
use axum::http::request::Parts;

use crate::auth::session::unix_now;
use crate::db::users::{find_active_user, ActiveUser};
use crate::error::ApiError;
use crate::state::AppState;

pub type AuthUser = ActiveUser;

/// The signed-in user, if any.
#[derive(Debug, Clone)]
pub struct OptionalUser(pub Option<AuthUser>);

/// The signed-in user; rejects with 401 otherwise.
#[derive(Debug, Clone)]
pub struct RequireUser(pub AuthUser);

/// Per-request cache so several extractors share one cookie decode and DB lookup.
#[derive(Clone)]
struct ResolvedUser(Option<AuthUser>);

impl<S> FromRequestParts<S> for OptionalUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        if let Some(ResolvedUser(user)) = parts.extensions.get::<ResolvedUser>() {
            return Ok(Self(user.clone()));
        }
        let state = AppState::from_ref(state);
        let user = resolve(&state, parts).await?;
        parts.extensions.insert(ResolvedUser(user.clone()));
        Ok(Self(user))
    }
}

impl<S> FromRequestParts<S> for RequireUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match OptionalUser::from_request_parts(parts, state).await? {
            OptionalUser(Some(user)) => Ok(Self(user)),
            OptionalUser(None) => Err(ApiError::Unauthorized),
        }
    }
}

async fn resolve(state: &AppState, parts: &Parts) -> Result<Option<AuthUser>, ApiError> {
    let Some(keys) = state.session_keys() else {
        return Ok(None);
    };
    let claims = match keys.session_from_headers(&parts.headers, unix_now()) {
        Ok(Some(claims)) => claims,
        Ok(None) => return Ok(None),
        Err(err) => {
            tracing::debug!(reason = %err, "ignoring unusable session cookie");
            return Ok(None);
        }
    };
    let Some(user_id) = claims.user_id else {
        return Ok(None);
    };
    Ok(find_active_user(state.pool(), &user_id).await?)
}

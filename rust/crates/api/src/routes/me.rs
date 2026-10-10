//! `GET /v1/me`: the smallest session-authenticated endpoint.

use axum::Json;
use serde::Serialize;

use crate::auth::RequireUser;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    pub user_id: String,
}

pub async fn me(RequireUser(user): RequireUser) -> Json<MeResponse> {
    Json(MeResponse { user_id: user.id })
}

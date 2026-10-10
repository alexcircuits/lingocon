//! `users` table.

use super::{DbError, Pool};

/// A user that exists and is not suspended (main's `getUserId` semantics).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveUser {
    pub id: String,
    /// `isAdmin` of a non-suspended user (main's `isAdmin` semantics).
    pub is_admin: bool,
}

const FIND_USER: &str = r#"SELECT "isAdmin", "isSuspended" FROM users WHERE id = $1"#;

/// `None` when the user does not exist or is suspended.
pub async fn find_active_user(pool: &Pool, user_id: &str) -> Result<Option<ActiveUser>, DbError> {
    let client = pool.get().await?;
    let statement = client.prepare_cached(FIND_USER).await?;
    let Some(row) = client.query_opt(&statement, &[&user_id]).await? else {
        return Ok(None);
    };
    let is_admin: bool = row.try_get("isAdmin")?;
    let is_suspended: bool = row.try_get("isSuspended")?;
    if is_suspended {
        return Ok(None);
    }
    Ok(Some(ActiveUser {
        id: user_id.to_owned(),
        is_admin,
    }))
}

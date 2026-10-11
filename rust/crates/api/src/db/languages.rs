//! `languages` / `language_collaborators` lookups used for authorization.

use super::{DbError, Pool};

/// What `canViewLanguage` needs to know about one language and one user.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LanguageAccessRow {
    /// `Visibility` enum as text: `PRIVATE`, `UNLISTED` or `PUBLIC`.
    pub visibility: String,
    pub owner_id: String,
    /// The user has a `language_collaborators` row (any role).
    pub is_collaborator: bool,
}

const ACCESS_ROW: &str = r#"
SELECT l.visibility::text AS visibility,
       l."ownerId" AS owner_id,
       ($2::text IS NOT NULL AND EXISTS (
           SELECT 1 FROM language_collaborators c
           WHERE c."languageId" = l.id AND c."userId" = $2::text
       )) AS is_collaborator
FROM languages l
WHERE l.id = $1
"#;

/// `None` when the language does not exist.
pub async fn access_row(
    pool: &Pool,
    language_id: &str,
    user_id: Option<&str>,
) -> Result<Option<LanguageAccessRow>, DbError> {
    let client = pool.get().await?;
    let statement = client.prepare_cached(ACCESS_ROW).await?;
    let Some(row) = client
        .query_opt(&statement, &[&language_id, &user_id])
        .await?
    else {
        return Ok(None);
    };
    Ok(Some(LanguageAccessRow {
        visibility: row.try_get("visibility")?,
        owner_id: row.try_get("owner_id")?,
        is_collaborator: row.try_get("is_collaborator")?,
    }))
}

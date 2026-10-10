//! Authorization helpers mirroring main's `lib/auth-helpers.ts`.

use crate::db::languages::{access_row, LanguageAccessRow};
use crate::db::{DbError, Pool};

use super::extract::AuthUser;

/// Result of checking one language for one (optional) user.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LanguageAccess {
    Missing,
    Denied,
    Allowed,
}

/// main's `canViewLanguage`: admins (not suspended — `AuthUser` never is) see
/// everything; otherwise PUBLIC languages, their owner and any collaborator.
/// UNLISTED is treated as private, exactly like main (it gates the studio).
pub async fn can_view_language(
    pool: &Pool,
    language_id: &str,
    user: Option<&AuthUser>,
) -> Result<bool, DbError> {
    if user.is_some_and(|user| user.is_admin) {
        return Ok(true);
    }
    Ok(language_access(pool, language_id, user).await? == LanguageAccess::Allowed)
}

/// Like [`can_view_language`] but tells a missing language apart from a denied one, for
/// handlers that need the difference (the session route answers 404 for both).
pub async fn language_access(
    pool: &Pool,
    language_id: &str,
    user: Option<&AuthUser>,
) -> Result<LanguageAccess, DbError> {
    let user_id = user.map(|user| user.id.as_str());
    Ok(match access_row(pool, language_id, user_id).await? {
        None => LanguageAccess::Missing,
        Some(row) if may_view(&row, user) => LanguageAccess::Allowed,
        Some(_) => LanguageAccess::Denied,
    })
}

/// The pure decision behind [`can_view_language`].
pub fn may_view(row: &LanguageAccessRow, user: Option<&AuthUser>) -> bool {
    if user.is_some_and(|user| user.is_admin) || row.visibility == "PUBLIC" {
        return true;
    }
    user.is_some_and(|user| user.id == row.owner_id || row.is_collaborator)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(visibility: &str, collaborator: bool) -> LanguageAccessRow {
        LanguageAccessRow {
            visibility: visibility.to_owned(),
            owner_id: "owner".to_owned(),
            is_collaborator: collaborator,
        }
    }

    fn user(id: &str, is_admin: bool) -> AuthUser {
        AuthUser {
            id: id.to_owned(),
            is_admin,
        }
    }

    #[test]
    fn public_languages_are_visible_to_everyone() {
        assert!(may_view(&row("PUBLIC", false), None));
        assert!(may_view(&row("PUBLIC", false), Some(&user("x", false))));
    }

    #[test]
    fn private_and_unlisted_need_owner_collaborator_or_admin() {
        for visibility in ["PRIVATE", "UNLISTED"] {
            assert!(!may_view(&row(visibility, false), None));
            assert!(!may_view(&row(visibility, false), Some(&user("x", false))));
            assert!(may_view(
                &row(visibility, false),
                Some(&user("owner", false))
            ));
            assert!(may_view(&row(visibility, true), Some(&user("x", false))));
            assert!(may_view(&row(visibility, false), Some(&user("x", true))));
        }
    }
}

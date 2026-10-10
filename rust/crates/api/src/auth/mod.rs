//! Authentication and authorization.
//!
//! - [`token`]: the shared bearer token Next.js sends on `/v1/internal/*`.
//! - [`session`] + [`cookies`]: Auth.js session-cookie verification.
//! - [`extract`]: `OptionalUser` / `RequireUser` extractors built on the session.
//! - [`access`]: `canViewLanguage` and friends.

pub mod access;
pub mod cookies;
pub mod extract;
pub mod session;
pub mod token;

pub use extract::{AuthUser, OptionalUser, RequireUser};

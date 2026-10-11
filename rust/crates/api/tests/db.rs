//! Tests against a real, disposable PostgreSQL database.
//!
//! Set `LINGOCON_API_TEST_DATABASE_URL` to a migrated database such as
//! `postgresql://me@localhost:5432/lingocon_rewrite_test_main_20261009`. The guard
//! refuses anything but a query-free localhost URL whose name starts with
//! `lingocon_rewrite_test_`; unset, every test here is skipped. Tests only create
//! and delete their own `rsapi-it-*` rows (seeded languages are read-only).

mod common;

use std::time::{Duration, Instant};

use axum::http::StatusCode;
use axum::Router;
use common::{assert_analysis_shape, check_disposable, get_with_cookie, send, test_database_url};
use lingocon_api::auth::access::can_view_language;
use lingocon_api::auth::session::SESSION_COOKIE;
use lingocon_api::auth::AuthUser;
use lingocon_api::db::lexicon::{load_lexicon_inputs, EntryRow, SymbolRow, MAX_LEXICON_ENTRIES};
use lingocon_api::{build_router, build_state, AppState};
use serde_json::json;
use tokio_postgres::{Client, NoTls};

struct Db {
    router: Router,
    state: AppState,
    client: Client,
}

/// `None` (test skipped) when no disposable database is configured.
async fn db() -> Option<Db> {
    let Some(url) = test_database_url() else {
        eprintln!("skipping: {} is not set", common::TEST_DB_ENV);
        return None;
    };
    let config = common::config(&[("DATABASE_URL", url.as_str())]);
    let state = build_state(&config).expect("state");
    let router = build_router(state.clone(), &config.http);
    let (client, connection) = tokio_postgres::connect(&url, NoTls)
        .await
        .expect("connect to the test database");
    tokio::spawn(async move {
        if let Err(err) = connection.await {
            eprintln!("test connection error: {err}");
        }
    });
    Some(Db {
        router,
        state,
        client,
    })
}

impl Db {
    /// Deletes users (cascading to their languages and everything below) by id.
    async fn delete_users(&self, ids: &[&str]) {
        self.client
            .execute("DELETE FROM users WHERE id = ANY($1)", &[&ids])
            .await
            .expect("cleanup");
    }

    async fn user(&self, id: &str, is_admin: bool, is_suspended: bool) {
        self.client
            .execute(
                r#"INSERT INTO users (id, name, "isAdmin", "isSuspended", "updatedAt")
                   VALUES ($1, $1, $2, $3, now())"#,
                &[&id, &is_admin, &is_suspended],
            )
            .await
            .expect("insert user");
    }

    async fn language(&self, id: &str, owner: &str, visibility: &str, allows_diacritics: bool) {
        self.client
            .execute(
                r#"INSERT INTO languages (id, name, slug, "ownerId", visibility, "allowsDiacritics", "updatedAt")
                   VALUES ($1, $1, $1, $2, $3::text::"Visibility", $4, now())"#,
                &[&id, &owner, &visibility, &allows_diacritics],
            )
            .await
            .expect("insert language");
    }
}

#[test]
fn disposable_database_guard() {
    assert!(check_disposable("postgresql://me@localhost:5432/lingocon_rewrite_test_x").is_ok());
    assert!(check_disposable("postgres://me:pw@127.0.0.1/lingocon_rewrite_test_x").is_ok());
    assert!(check_disposable("postgresql://me@[::1]:5432/lingocon_rewrite_test_x").is_ok());
    for bad in [
        "postgresql://me@db.example.com/lingocon_rewrite_test_x",
        "postgresql://me@localhost/lingocon",
        "postgresql://me@localhost/lingocon_rewrite_test_x?sslmode=require",
        "postgresql://me@localhost.evil.com/lingocon_rewrite_test_x",
        "postgresql://localhost@evil.com/lingocon_rewrite_test_x",
        "mysql://me@localhost/lingocon_rewrite_test_x",
    ] {
        assert!(check_disposable(bad).is_err(), "{bad}");
    }
}

#[tokio::test]
async fn readyz_and_connection_settings() {
    let Some(db) = db().await else { return };
    let response = send(&db.router, common::get("/readyz")).await;
    assert_eq!(response.status, StatusCode::OK);
    assert_eq!(response.json, json!({ "status": "ready" }));

    let client = db.state.pool().get().await.expect("pooled connection");
    let timeout: String = client
        .query_one("SHOW statement_timeout", &[])
        .await
        .expect("show")
        .get(0);
    let search_path: String = client
        .query_one("SHOW search_path", &[])
        .await
        .expect("show")
        .get(0);
    let application: String = client
        .query_one("SHOW application_name", &[])
        .await
        .expect("show")
        .get(0);
    assert_eq!(timeout, "5s");
    assert_eq!(search_path, "public");
    assert_eq!(application, "lingocon-api");
}

#[tokio::test]
async fn missing_database_is_reported_as_misconfiguration() {
    let Some(url) = test_database_url() else {
        return;
    };
    let (server, _) = url.rsplit_once('/').expect("url has a database");
    let missing = format!("{server}/lingocon_rewrite_test_does_not_exist");
    let state = build_state(&common::config(&[("DATABASE_URL", missing.as_str())])).expect("state");
    let err = lingocon_api::db::ping(state.pool())
        .await
        .expect_err("database does not exist");
    assert!(err.is_unavailable(), "{err}");
    assert!(err.is_misconfiguration(), "{err}");
}

#[tokio::test]
async fn lexicon_analysis_for_seeded_languages() {
    let Some(db) = db().await else { return };

    let missing = send(
        &db.router,
        common::analysis_for("rsapi-it-no-such-language"),
    )
    .await;
    assert_eq!(missing.status, StatusCode::NOT_FOUND);
    assert_eq!(missing.json, json!({ "error": "language not found" }));

    let small = send(&db.router, common::analysis_for("verify-small")).await;
    assert_eq!(small.status, StatusCode::OK, "{}", small.json);
    assert_analysis_shape(&small.json);
    let inputs = load_lexicon_inputs(db.state.pool(), "verify-small", MAX_LEXICON_ENTRIES)
        .await
        .expect("load")
        .expect("exists");
    assert_eq!(inputs.entries.len(), 30);
    assert_eq!(inputs.symbols.len(), 5);

    // 100k entries are streamed, analysed off the async runtime and answered well
    // inside the request timeout.
    let started = Instant::now();
    let large = send(&db.router, common::analysis_for("verify-large")).await;
    let elapsed = started.elapsed();
    assert_eq!(large.status, StatusCode::OK, "{}", large.json);
    assert_analysis_shape(&large.json);
    assert!(elapsed < Duration::from_secs(10), "took {elapsed:?}");
    eprintln!("verify-large lexicon analysis over HTTP: {elapsed:?}");

    let capped = load_lexicon_inputs(db.state.pool(), "verify-large", 1_000).await;
    assert!(capped.is_err(), "the entry cap is enforced");
}

#[tokio::test]
async fn loads_lexicon_inputs_in_id_order() {
    let Some(db) = db().await else { return };
    let owner = "rsapi-it-load-owner";
    let language = "rsapi-it-load-lang";
    db.delete_users(&[owner]).await;
    db.user(owner, false, false).await;
    db.language(language, owner, "PRIVATE", true).await;
    for (id, symbol, capital) in [
        ("rsapi-it-load-s2", "b", None),
        ("rsapi-it-load-s1", "a", Some("A")),
    ] {
        db.client
            .execute(
                r#"INSERT INTO script_symbols (id, symbol, "capitalSymbol", "languageId", "updatedAt")
                   VALUES ($1, $2, $3, $4, now())"#,
                &[&id, &symbol, &capital, &language],
            )
            .await
            .expect("insert symbol");
    }
    db.client
        .execute(
            r#"INSERT INTO paradigms (id, name, slots, "languageId", "updatedAt")
               VALUES ('rsapi-it-load-p1', 'P', '{}'::jsonb, $1, now())"#,
            &[&language],
        )
        .await
        .expect("insert paradigm");
    // Inserted out of id order on purpose.
    for (id, lemma, gloss, paradigm) in [
        ("rsapi-it-load-e3", "ca", "three", None),
        ("rsapi-it-load-e1", "ab", "water", Some("rsapi-it-load-p1")),
        ("rsapi-it-load-e2", "xyz", "fire", None),
    ] {
        db.client
            .execute(
                r#"INSERT INTO dictionary_entries (id, lemma, gloss, "paradigmId", "languageId", "updatedAt")
                   VALUES ($1, $2, $3, $4, $5, now())"#,
                &[&id, &lemma, &gloss, &paradigm, &language],
            )
            .await
            .expect("insert entry");
    }

    let inputs = load_lexicon_inputs(db.state.pool(), language, MAX_LEXICON_ENTRIES)
        .await
        .expect("load")
        .expect("exists");
    assert!(inputs.allows_diacritics);
    assert_eq!(
        inputs.symbols,
        vec![
            SymbolRow {
                symbol: "a".into(),
                capital_symbol: Some("A".into())
            },
            SymbolRow {
                symbol: "b".into(),
                capital_symbol: None
            },
        ]
    );
    assert_eq!(inputs.paradigm_ids, vec!["rsapi-it-load-p1".to_owned()]);
    assert_eq!(
        inputs.entries,
        vec![
            EntryRow {
                lemma: "ab".into(),
                gloss: "water".into(),
                paradigm_id: Some("rsapi-it-load-p1".into())
            },
            EntryRow {
                lemma: "xyz".into(),
                gloss: "fire".into(),
                paradigm_id: None
            },
            EntryRow {
                lemma: "ca".into(),
                gloss: "three".into(),
                paradigm_id: None
            },
        ]
    );

    let response = send(&db.router, common::analysis_for(language)).await;
    assert_eq!(response.status, StatusCode::OK);
    assert_analysis_shape(&response.json);

    db.delete_users(&[owner]).await;
}

#[tokio::test]
async fn session_authentication_and_language_authorization() {
    let Some(db) = db().await else { return };
    let owner = "rsapi-it-auth-owner";
    let stranger = "rsapi-it-auth-stranger";
    let collaborator = "rsapi-it-auth-collab";
    let admin = "rsapi-it-auth-admin";
    let suspended = "rsapi-it-auth-suspended";
    let suspended_admin = "rsapi-it-auth-suspended-admin";
    let users = [
        owner,
        stranger,
        collaborator,
        admin,
        suspended,
        suspended_admin,
    ];
    let private = "rsapi-it-auth-private";
    db.delete_users(&users).await;
    for user in [owner, stranger, collaborator] {
        db.user(user, false, false).await;
    }
    db.user(admin, true, false).await;
    db.user(suspended, false, true).await;
    db.user(suspended_admin, true, true).await;
    db.language(private, owner, "UNLISTED", false).await;
    db.client
        .execute(
            r#"INSERT INTO language_collaborators (id, "languageId", "userId", role, "updatedAt")
               VALUES ('rsapi-it-auth-c1', $1, $2, 'VIEWER', now())"#,
            &[&private, &collaborator],
        )
        .await
        .expect("insert collaborator");

    let key = common::session_key(common::AUTH_SECRET, SESSION_COOKIE);
    let cookie = |user: &str| key.cookie(&key.session(user, common::now()));

    // GET /v1/me: exists and not suspended.
    let me = send(&db.router, get_with_cookie("/v1/me", &cookie(owner))).await;
    assert_eq!(me.status, StatusCode::OK);
    assert_eq!(me.json, json!({ "userId": owner }));
    for user in [suspended, suspended_admin, "rsapi-it-auth-nobody"] {
        let response = send(&db.router, get_with_cookie("/v1/me", &cookie(user))).await;
        assert_eq!(response.status, StatusCode::UNAUTHORIZED, "{user}");
    }

    // Session-authenticated analysis: canViewLanguage semantics.
    let uri = format!("/v1/languages/{private}/lexicon-analysis");
    for (user, expected) in [
        (owner, StatusCode::OK),
        (collaborator, StatusCode::OK),
        (admin, StatusCode::OK),
        (stranger, StatusCode::NOT_FOUND),
        (suspended_admin, StatusCode::UNAUTHORIZED),
    ] {
        let response = send(&db.router, get_with_cookie(&uri, &cookie(user))).await;
        assert_eq!(response.status, expected, "{user}: {}", response.json);
        if expected == StatusCode::OK {
            assert_analysis_shape(&response.json);
        }
    }
    // Indistinguishable from a language that does not exist.
    let hidden = send(&db.router, get_with_cookie(&uri, &cookie(stranger))).await;
    let missing = send(
        &db.router,
        get_with_cookie(
            "/v1/languages/rsapi-it-auth-missing/lexicon-analysis",
            &cookie(stranger),
        ),
    )
    .await;
    assert_eq!(hidden.json, json!({ "error": "language not found" }));
    assert_eq!(
        (hidden.status, &hidden.json),
        (missing.status, &missing.json)
    );
    let public = send(
        &db.router,
        get_with_cookie(
            "/v1/languages/verify-small/lexicon-analysis",
            &cookie(stranger),
        ),
    )
    .await;
    assert_eq!(public.status, StatusCode::OK);
    let unknown = send(
        &db.router,
        get_with_cookie(
            "/v1/languages/rsapi-it-auth-none/lexicon-analysis",
            &cookie(owner),
        ),
    )
    .await;
    assert_eq!(unknown.status, StatusCode::NOT_FOUND);

    // The helper itself, including the guest and admin shortcuts.
    let pool = db.state.pool();
    let as_user = |id: &str, is_admin: bool| AuthUser {
        id: id.to_owned(),
        is_admin,
    };
    assert!(!can_view_language(pool, private, None).await.expect("query"));
    assert!(can_view_language(pool, "verify-small", None)
        .await
        .expect("query"));
    assert!(
        can_view_language(pool, private, Some(&as_user(owner, false)))
            .await
            .expect("query")
    );
    assert!(
        !can_view_language(pool, private, Some(&as_user(stranger, false)))
            .await
            .expect("query")
    );
    assert!(
        can_view_language(pool, private, Some(&as_user(admin, true)))
            .await
            .expect("query")
    );

    db.delete_users(&users).await;
}

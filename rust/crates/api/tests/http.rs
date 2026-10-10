//! Router-level tests that need no database (the pool points at a closed port).

mod common;

use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::routing::get;
use axum::Router;
use common::{analysis_request, app, get as get_request, get_with_cookie, send, TOKEN};
use lingocon_api::auth::session::SESSION_COOKIE;
use lingocon_api::config::HttpSettings;
use serde_json::json;
use tokio::net::TcpListener;

#[tokio::test]
async fn healthz_is_ok_and_tags_the_request() {
    let response = send(&app(&[]), get_request("/healthz")).await;
    assert_eq!(response.status, StatusCode::OK);
    assert_eq!(response.json, json!({ "status": "ok" }));
    assert!(response.headers.contains_key("x-request-id"));
}

#[tokio::test]
async fn an_incoming_request_id_is_propagated() {
    let request = Request::get("/healthz")
        .header("x-request-id", "from-next-123")
        .body(Body::empty())
        .expect("request");
    let response = send(&app(&[]), request).await;
    assert_eq!(
        response.headers.get("x-request-id").map(|v| v.as_bytes()),
        Some(&b"from-next-123"[..])
    );
}

#[tokio::test]
async fn unknown_routes_and_methods_get_json_errors() {
    let router = app(&[]);
    let missing = send(&router, get_request("/nope")).await;
    assert_eq!(missing.status, StatusCode::NOT_FOUND);
    assert_eq!(missing.json, json!({ "error": "not found" }));

    let wrong_method = send(
        &router,
        Request::post("/healthz")
            .body(Body::empty())
            .expect("request"),
    )
    .await;
    assert_eq!(wrong_method.status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(wrong_method.json, json!({ "error": "method not allowed" }));
}

#[tokio::test]
async fn readyz_reports_an_unreachable_database() {
    let response = send(&app(&[]), get_request("/readyz")).await;
    assert_eq!(response.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(response.json, json!({ "error": "database unavailable" }));
}

#[tokio::test]
async fn internal_routes_require_the_bearer_token() {
    let router = app(&[]);
    let body = json!({ "languageId": "x" }).to_string();

    let missing = send(&router, analysis_request(None, body.clone())).await;
    assert_eq!(missing.status, StatusCode::UNAUTHORIZED);
    assert_eq!(missing.json, json!({ "error": "unauthorized" }));
    assert_eq!(
        missing
            .headers
            .get("www-authenticate")
            .map(|v| v.as_bytes()),
        Some(&b"Bearer"[..])
    );

    let wrong = send(
        &router,
        analysis_request(Some("wrong-token-0123456789abcdef0123456789"), body.clone()),
    )
    .await;
    assert_eq!(wrong.status, StatusCode::UNAUTHORIZED);

    let basic = Request::post("/v1/internal/lexicon-analysis")
        .header("authorization", format!("Basic {TOKEN}"))
        .header("content-type", "application/json")
        .body(Body::from(body))
        .expect("request");
    assert_eq!(send(&router, basic).await.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn internal_analysis_validates_the_body() {
    let router = app(&[]);
    for body in [
        "not json".to_owned(),
        json!({}).to_string(),
        json!({ "languageId": 5 }).to_string(),
        json!({ "languageId": "" }).to_string(),
        json!({ "languageId": "x".repeat(129) }).to_string(),
    ] {
        let response = send(&router, analysis_request(Some(TOKEN), body.clone())).await;
        assert_eq!(response.status, StatusCode::BAD_REQUEST, "{body}");
        assert!(response.json["error"].is_string());
    }

    let no_content_type = Request::post("/v1/internal/lexicon-analysis")
        .header("authorization", format!("Bearer {TOKEN}"))
        .body(Body::from(json!({ "languageId": "x" }).to_string()))
        .expect("request");
    let response = send(&router, no_content_type).await;
    assert_eq!(response.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(
        response.json,
        json!({ "error": "expected application/json" })
    );
}

#[tokio::test]
async fn oversized_bodies_are_rejected() {
    let router = app(&[]);
    let huge = format!(r#"{{"languageId":"{}"}}"#, "x".repeat(1024 * 1024));
    let response = send(&router, analysis_request(Some(TOKEN), huge)).await;
    assert_eq!(response.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(response.json, json!({ "error": "request body too large" }));
}

#[tokio::test]
async fn database_outage_is_a_503_not_a_500() {
    let response = send(&app(&[]), common::analysis_for("some-language")).await;
    assert_eq!(response.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(response.json, json!({ "error": "database unavailable" }));
}

#[tokio::test]
async fn session_routes_reject_missing_or_invalid_sessions() {
    let router = app(&[]);
    for request in [
        get_request("/v1/me"),
        get_with_cookie("/v1/me", &format!("{SESSION_COOKIE}=garbage")),
        get_with_cookie("/v1/me", &format!("{SESSION_COOKIE}.1=orphan-chunk")),
        get_request("/v1/languages/some-language/lexicon-analysis"),
    ] {
        let response = send(&router, request).await;
        assert_eq!(response.status, StatusCode::UNAUTHORIZED);
        assert_eq!(response.json, json!({ "error": "unauthorized" }));
    }
}

#[tokio::test]
async fn sessions_are_ignored_without_auth_secret() {
    let router = app(&[("AUTH_SECRET", "")]);
    let key = common::session_key(common::AUTH_SECRET, SESSION_COOKIE);
    let cookie = key.cookie(&key.session("user", common::now()));
    let response = send(&router, get_with_cookie("/v1/me", &cookie)).await;
    assert_eq!(response.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn valid_session_needs_the_database_to_confirm_the_user() {
    let key = common::session_key(common::AUTH_SECRET, SESSION_COOKIE);
    let cookie = key.cookie(&key.session("user", common::now()));
    let response = send(&app(&[]), get_with_cookie("/v1/me", &cookie)).await;
    assert_eq!(response.status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn saturation_answers_503_immediately() {
    // A "database" that accepts connections and never answers keeps the first
    // request in flight; the second must be rejected instead of queueing.
    let hanging_db = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let port = hanging_db.local_addr().expect("addr").port();
    let database_url = format!("postgresql://nobody@127.0.0.1:{port}/hang");
    let router = app(&[
        ("DATABASE_URL", database_url.as_str()),
        ("LINGOCON_API_MAX_INFLIGHT", "1"),
    ]);

    let first = tokio::spawn({
        let router = router.clone();
        async move { send(&router, common::analysis_for("x")).await }
    });
    let (_connection, _) = tokio::time::timeout(Duration::from_secs(5), hanging_db.accept())
        .await
        .expect("first request reaches the database")
        .expect("accept");

    let second = send(&router, get_request("/v1/me")).await;
    assert_eq!(second.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(second.json, json!({ "error": "service overloaded" }));

    // Probes stay outside the limit.
    assert_eq!(
        send(&router, get_request("/healthz")).await.status,
        StatusCode::OK
    );

    // The pool gives up on the silent database after its connect timeout.
    let first = first.await.expect("first request completes");
    assert_eq!(first.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(first.json, json!({ "error": "database unavailable" }));
}

fn settings(request_timeout: Duration) -> HttpSettings {
    HttpSettings {
        request_timeout,
        ..HttpSettings::default()
    }
}

#[tokio::test]
async fn panics_become_json_500s() {
    async fn boom() -> &'static str {
        panic!("handler bug with internal detail")
    }
    let router = lingocon_api::middleware::apply(
        Router::new().route("/boom", get(boom)),
        &settings(Duration::from_secs(5)),
    );
    let response = send(&router, get_request("/boom")).await;
    assert_eq!(response.status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(response.json, json!({ "error": "internal error" }));
}

#[tokio::test]
async fn slow_requests_time_out_with_json_503() {
    async fn slow() -> &'static str {
        tokio::time::sleep(Duration::from_secs(5)).await;
        "late"
    }
    let router = lingocon_api::middleware::apply(
        Router::new().route("/slow", get(slow)),
        &settings(Duration::from_millis(50)),
    );
    let response = send(&router, get_request("/slow")).await;
    assert_eq!(response.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(response.json, json!({ "error": "service unavailable" }));
}

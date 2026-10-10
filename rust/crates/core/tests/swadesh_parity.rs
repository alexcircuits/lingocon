//! The Rust Swadesh list and matcher must equal `lib/data/swadesh-list.ts`.

mod common;

use std::collections::BTreeSet;

use common::load_fixture;
use lingocon_core::swadesh::{match_swadesh_list, SWADESH_LIST};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Concept {
    id: u32,
    english: String,
    category: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GlossCase {
    gloss: String,
    matched_ids: Vec<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SwadeshFixture {
    list: Vec<Concept>,
    gloss_cases: Vec<GlossCase>,
}

#[test]
fn generated_list_equals_typescript_list() {
    let fixture: SwadeshFixture = load_fixture("swadesh.json");
    assert_eq!(SWADESH_LIST.len(), 207);
    assert_eq!(fixture.list.len(), SWADESH_LIST.len());
    for (ts, rust) in fixture.list.iter().zip(SWADESH_LIST) {
        assert_eq!(
            (ts.id, ts.english.as_str(), ts.category.as_str()),
            (rust.id, rust.english, rust.category)
        );
    }
}

#[test]
fn single_glosses_match_typescript() {
    let fixture: SwadeshFixture = load_fixture("swadesh.json");
    for case in &fixture.gloss_cases {
        assert_eq!(
            match_swadesh_list([case.gloss.as_str()]),
            case.matched_ids,
            "gloss {:?}",
            case.gloss
        );
    }
}

#[test]
fn many_glosses_match_the_union_of_single_glosses() {
    let fixture: SwadeshFixture = load_fixture("swadesh.json");
    let union: BTreeSet<u32> = fixture
        .gloss_cases
        .iter()
        .flat_map(|case| case.matched_ids.iter().copied())
        .collect();
    let all = match_swadesh_list(fixture.gloss_cases.iter().map(|c| c.gloss.as_str()));
    assert_eq!(all, union.into_iter().collect::<Vec<_>>());
    assert_eq!(all.len(), 207, "every concept's own English matches it");
}

#[test]
fn no_glosses_match_nothing() {
    assert!(match_swadesh_list(std::iter::empty::<&str>()).is_empty());
}

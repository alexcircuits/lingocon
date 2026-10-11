//! Fixture loading shared by the parity tests. The fixtures are generated from main's
//! TypeScript by `scripts/rust-parity/generate-lexicon-fixtures.ts` and hold both the inputs
//! and the exact TypeScript outputs.
#![allow(dead_code)] // each test binary uses a different subset

use std::path::PathBuf;

use lingocon_core::analysis::{analyze_lexicon, EntryInput, LexiconAnalysis, SymbolInput};
use serde::de::DeserializeOwned;
use serde::Deserialize;

pub fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(name)
}

pub fn load_fixture<T: DeserializeOwned>(name: &str) -> T {
    let path = fixture_path(name);
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read {}: {error}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|error| panic!("parse {}: {error}", path.display()))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixtureSymbol {
    pub symbol: String,
    pub capital_symbol: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixtureEntry {
    pub lemma: String,
    pub gloss: String,
    pub paradigm_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Expected {
    /// Kept as raw JSON so the comparison covers field names and enum spellings too.
    pub warnings: Vec<serde_json::Value>,
    pub total: usize,
    pub matched_ids: Vec<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconCase {
    pub name: String,
    pub symbols: Vec<FixtureSymbol>,
    pub entries: Vec<FixtureEntry>,
    pub paradigm_ids: Vec<String>,
    pub allows_diacritics: bool,
    pub expected: Expected,
}

#[derive(Debug, Deserialize)]
pub struct LexiconFile {
    pub cases: Vec<LexiconCase>,
}

impl LexiconCase {
    pub fn run(&self, max_warnings: usize) -> LexiconAnalysis {
        let symbols: Vec<SymbolInput<'_>> = self
            .symbols
            .iter()
            .map(|s| SymbolInput {
                symbol: &s.symbol,
                capital_symbol: s.capital_symbol.as_deref(),
            })
            .collect();
        let entries: Vec<EntryInput<'_>> = self
            .entries
            .iter()
            .map(|e| EntryInput {
                lemma: &e.lemma,
                gloss: &e.gloss,
                paradigm_id: e.paradigm_id.as_deref(),
            })
            .collect();
        let paradigm_ids: Vec<&str> = self.paradigm_ids.iter().map(String::as_str).collect();
        analyze_lexicon(
            &symbols,
            &entries,
            &paradigm_ids,
            self.allows_diacritics,
            max_warnings,
        )
    }
}

/// Assert `actual` equals the first `max_warnings` TypeScript warnings, the true total and
/// the matched Swadesh ids, with a readable report of the first difference.
pub fn assert_matches_typescript(
    case: &LexiconCase,
    actual: &LexiconAnalysis,
    max_warnings: usize,
) {
    let expected = &case.expected;
    let keep = expected.warnings.len().min(max_warnings);
    let actual_warnings: Vec<serde_json::Value> = actual
        .warnings
        .iter()
        .map(|w| serde_json::to_value(w).expect("serialise warning"))
        .collect();
    if let Some(index) = (0..keep.max(actual_warnings.len()))
        .find(|&i| actual_warnings.get(i) != expected.warnings.get(i))
    {
        panic!(
            "case {:?} (max_warnings={max_warnings}): warning #{index} differs\n  rust: {}\n  ts:   {}",
            case.name,
            actual_warnings
                .get(index)
                .map_or("<none>".to_owned(), |w| w.to_string()),
            expected
                .warnings
                .get(index)
                .filter(|_| index < keep)
                .map_or("<none>".to_owned(), |w| w.to_string()),
        );
    }
    assert_eq!(
        actual.total, expected.total,
        "case {:?}: total warnings",
        case.name
    );
    assert_eq!(
        actual.matched_ids, expected.matched_ids,
        "case {:?}: matched Swadesh ids",
        case.name
    );
}

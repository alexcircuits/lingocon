//! Exhaustive check, for every Unicode scalar value, of the character data the analysis relies
//! on (`\s`, `\d`, `\p{P}`, `\p{S}`, `\p{M}`, `toLowerCase`, NFC, NFD) against a snapshot of the
//! JavaScript engine (`unicode-tables.json`, written by the fixture generator from V8/ICU).
//!
//! When the snapshot and the Rust crates carry the same Unicode version there must be no
//! difference at all. Against an engine on another Unicode version (set
//! `LINGOCON_UNICODE_TABLES=/path/to/unicode-tables.json`), differences are tolerated only on
//! code points that one side does not know yet (General_Category=Cn), and are summarised.

mod common;

use std::path::PathBuf;

use common::fixture_path;
use lingocon_core::js_text::{
    is_always_allowed, is_js_whitespace, is_mark, js_to_lowercase, nfc, nfd, UNICODE_VERSION,
};
use serde::Deserialize;
use unicode_properties::{GeneralCategory, UnicodeGeneralCategory};
use unicode_segmentation::UnicodeSegmentation;

type Ranges = Vec<(u32, u32)>;
type Mapping = Vec<(u32, String)>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Tables {
    unicode_version: String,
    icu_version: String,
    always_allowed: Ranges,
    mark: Ranges,
    whitespace: Ranges,
    unassigned: Ranges,
    lowercase: Mapping,
    nfd: Mapping,
    nfc: Mapping,
    grapheme_samples: Vec<u32>,
    grapheme_triples: String,
}

fn load_tables() -> Tables {
    let path = std::env::var_os("LINGOCON_UNICODE_TABLES")
        .map(PathBuf::from)
        .unwrap_or_else(|| fixture_path("unicode-tables.json"));
    let text = std::fs::read_to_string(&path).expect("read unicode tables");
    serde_json::from_str(&text).expect("parse unicode tables")
}

fn rust_unicode_version() -> String {
    format!("{}.{}", UNICODE_VERSION.0, UNICODE_VERSION.1)
}

fn contains(ranges: &[(u32, u32)], cp: u32) -> bool {
    let index = ranges.partition_point(|&(_, end)| end < cp);
    ranges.get(index).is_some_and(|&(start, _)| start <= cp)
}

fn mapped(mapping: &[(u32, String)], c: char) -> String {
    match mapping.binary_search_by_key(&(c as u32), |(cp, _)| *cp) {
        Ok(index) => mapping[index].1.clone(),
        Err(_) => c.to_string(),
    }
}

fn differences(tables: &Tables, c: char) -> Vec<&'static str> {
    let cp = c as u32;
    let s = c.to_string();
    let mut diffs = Vec::new();
    if is_always_allowed(c) != contains(&tables.always_allowed, cp) {
        diffs.push("always-allowed class");
    }
    if is_mark(c) != contains(&tables.mark, cp) {
        diffs.push("\\p{M}");
    }
    if is_js_whitespace(c) != contains(&tables.whitespace, cp) {
        diffs.push("\\s / trim");
    }
    if js_to_lowercase(&s) != mapped(&tables.lowercase, c) {
        diffs.push("toLowerCase");
    }
    let hangul_syllable = (0xac00..=0xd7a3).contains(&cp);
    if !hangul_syllable && nfd(&s) != mapped(&tables.nfd, c) {
        diffs.push("NFD");
    }
    if nfc(&s) != mapped(&tables.nfc, c) {
        diffs.push("NFC");
    }
    diffs
}

#[test]
fn unicode_data_matches_the_js_engine_for_every_code_point() {
    let tables = load_tables();
    let rust_version = rust_unicode_version();
    // `str::to_lowercase` uses the toolchain's tables, which may lag the crates on an older
    // compiler; then case-mapping-only differences are tolerated (and counted).
    let std_skew = char::UNICODE_VERSION != UNICODE_VERSION;

    let mut tolerated = Vec::new();
    let mut failures = Vec::new();
    for c in (0..=0x10_ffff_u32).filter_map(char::from_u32) {
        let diffs = differences(&tables, c);
        if diffs.is_empty() {
            continue;
        }
        let unknown_to_one_side = contains(&tables.unassigned, c as u32)
            || c.general_category() == GeneralCategory::Unassigned
            || (std_skew && diffs == ["toLowerCase"]);
        let row = format!("U+{:04X} {diffs:?}", c as u32);
        if unknown_to_one_side {
            tolerated.push(row);
        } else {
            failures.push(row);
        }
    }
    eprintln!(
        "engine Unicode {} (ICU {}) vs Rust crates Unicode {rust_version} (std {:?}): {} \
         tolerated differences on code points one side does not know, {} other differences",
        tables.unicode_version,
        tables.icu_version,
        char::UNICODE_VERSION,
        tolerated.len(),
        failures.len()
    );
    assert!(
        failures.is_empty(),
        "differences on code points both sides know: {:?}",
        &failures[..failures.len().min(25)]
    );
    if tables.unicode_version == rust_version && !std_skew {
        assert!(
            tolerated.is_empty(),
            "same Unicode version, yet differences: {:?}",
            &tolerated[..tolerated.len().min(25)]
        );
    }
}

/// Break digit for a three-character string, encoded like the fixture: bit 0 = break after the
/// first character, bit 1 = break after the second.
fn rust_breaks(chars: [char; 3]) -> u8 {
    let text: String = chars.iter().collect();
    let mut position = 0;
    let mut digit = 0;
    for grapheme in text.graphemes(true) {
        position += grapheme.chars().count();
        digit |= match position {
            1 => 1,
            2 => 2,
            _ => 0,
        };
    }
    digit
}

#[test]
fn grapheme_clusters_match_intl_segmenter_for_every_sample_triple() {
    let tables = load_tables();
    let samples: Vec<char> = tables
        .grapheme_samples
        .iter()
        .map(|&cp| char::from_u32(cp).expect("scalar value"))
        .collect();
    let expected = tables.grapheme_triples.as_bytes();
    assert_eq!(expected.len(), samples.len().pow(3));

    let mut triples = Vec::with_capacity(expected.len());
    for &a in &samples {
        for &b in &samples {
            for &c in &samples {
                triples.push([a, b, c]);
            }
        }
    }
    let mismatches: Vec<String> = triples
        .into_iter()
        .zip(expected)
        .filter_map(|(triple, &js)| {
            let rust = b'0' + rust_breaks(triple);
            (rust != js).then(|| {
                let cps: Vec<String> = triple
                    .iter()
                    .map(|c| format!("U+{:04X}", *c as u32))
                    .collect();
                format!("{}: rust {} js {}", cps.join(" "), rust as char, js as char)
            })
        })
        .collect();
    eprintln!(
        "{} of {} grapheme triples differ from Intl.Segmenter (engine Unicode {})",
        mismatches.len(),
        expected.len(),
        tables.unicode_version
    );
    if tables.unicode_version == rust_unicode_version() {
        assert!(
            mismatches.is_empty(),
            "{:?}",
            &mismatches[..mismatches.len().min(25)]
        );
    }
}

#[test]
fn every_unicode_data_source_is_on_the_same_version() {
    let as_u8 = |(a, b, c): (u64, u64, u64)| {
        (
            u8::try_from(a).unwrap(),
            u8::try_from(b).unwrap(),
            u8::try_from(c).unwrap(),
        )
    };
    assert_eq!(unicode_normalization::UNICODE_VERSION, UNICODE_VERSION);
    assert_eq!(
        as_u8(unicode_segmentation::UNICODE_VERSION),
        UNICODE_VERSION
    );
    assert_eq!(as_u8(unicode_properties::UNICODE_VERSION), UNICODE_VERSION);
    if char::UNICODE_VERSION != UNICODE_VERSION {
        // Not fatal: only case mappings of characters new in the newer version can differ,
        // and the exhaustive test above reports exactly which.
        eprintln!(
            "note: std (str::to_lowercase) is on Unicode {:?}, the crates on {UNICODE_VERSION:?}",
            char::UNICODE_VERSION
        );
    }
}

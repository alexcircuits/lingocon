//! `analyze_lexicon` must reproduce main's TypeScript (`getValidationWarnings` +
//! `matchSwadeshList`) byte for byte on every fixture case.

mod common;

use common::{assert_matches_typescript, load_fixture, LexiconCase, LexiconFile};

const FILES: [&str; 2] = ["lexicon-cases.json", "lexicon-corpus.json"];

fn all_cases() -> Vec<(&'static str, LexiconCase)> {
    FILES
        .iter()
        .flat_map(|file| {
            load_fixture::<LexiconFile>(file)
                .cases
                .into_iter()
                .map(move |case| (*file, case))
        })
        .collect()
}

#[test]
fn targeted_cases_match_typescript() {
    let file: LexiconFile = load_fixture("lexicon-cases.json");
    for case in &file.cases {
        assert_matches_typescript(case, &case.run(usize::MAX), usize::MAX);
    }
}

#[test]
fn random_corpus_matches_typescript() {
    let file: LexiconFile = load_fixture("lexicon-corpus.json");
    for case in &file.cases {
        assert_matches_typescript(case, &case.run(usize::MAX), usize::MAX);
    }
}

#[test]
fn truncation_keeps_typescript_order_and_reports_true_total() {
    for (_, case) in all_cases() {
        let total = case.expected.total;
        let limits = [0, 1, 2, 3, 7, 50, total.saturating_sub(1), total, total + 5];
        for max_warnings in limits {
            let actual = case.run(max_warnings);
            assert!(actual.warnings.len() <= max_warnings);
            assert_matches_typescript(&case, &actual, max_warnings);
        }
    }
}

/// Guards against a generator change silently dropping the interesting inputs.
#[test]
fn fixtures_cover_the_required_edges() {
    let cases = all_cases();
    let corpus_entries: usize = cases
        .iter()
        .filter(|(file, _)| *file == "lexicon-corpus.json")
        .map(|(_, case)| case.entries.len())
        .sum();
    assert!(
        corpus_entries >= 3_000,
        "corpus has only {corpus_entries} entries"
    );

    let messages: Vec<String> = cases
        .iter()
        .flat_map(|(_, case)| case.expected.warnings.iter())
        .map(|w| w["message"].as_str().unwrap_or_default().to_owned())
        .collect();
    let lemmas = || {
        cases
            .iter()
            .flat_map(|(_, case)| case.entries.iter().map(|e| e.lemma.as_str()))
    };
    let any_lemma = |needle: &str| lemmas().any(|lemma| lemma.contains(needle));

    assert!(messages
        .iter()
        .any(|m| m.contains("uses undefined symbols")));
    assert!(messages
        .iter()
        .any(|m| m.contains("references a missing paradigm")));
    assert!(cases.iter().any(|(_, c)| c.allows_diacritics));
    assert!(cases.iter().any(|(_, c)| !c.allows_diacritics));
    assert!(cases.iter().any(|(_, c)| c.symbols.is_empty()));
    for needle in [
        "\u{301}",           // combining mark
        "\u{1f468}\u{200d}", // emoji ZWJ sequence
        "\u{10330}",         // astral letter
        "\u{3a3}",           // Greek capital sigma
        "\u{130}",           // Turkish dotted capital I
        "\u{feff}",          // BOM (JS whitespace)
        "\u{85}",            // NEL (not JS whitespace)
        "\u{a0}",            // NBSP
        "\r\n",              // CRLF grapheme
        "\u{663}",           // Arabic-Indic digit three
        "\u{1c5}",           // titlecase digraph
    ] {
        assert!(any_lemma(needle), "no lemma contains {needle:?}");
    }
    assert!(cases
        .iter()
        .flat_map(|(_, c)| c.entries.iter())
        .any(|e| e.paradigm_id.as_deref() == Some("")));
    assert!(cases
        .iter()
        .any(|(_, c)| c.entries.iter().any(|e| e.lemma.chars().count() > 1_000)));
}

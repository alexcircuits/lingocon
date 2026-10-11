//! Lexicon analysis for the studio overview: validation warnings and Swadesh
//! coverage. Must produce exactly what `main`'s TypeScript produces
//! (`lib/utils/validation.ts`, `lib/utils/alphabet-validation.ts`,
//! `lib/data/swadesh-list.ts`) for the same inputs in the same order.
//!
//! INTERFACE CONTRACT (shared with `lingocon-api`): keep these types and the
//! `analyze_lexicon` signature stable; the implementation fills them in.
//!
//! Parity is enforced by `tests/lexicon_parity.rs`, `tests/swadesh_parity.rs` and
//! `tests/unicode_tables.rs` against fixtures generated from the TypeScript by
//! `scripts/rust-parity/generate-lexicon-fixtures.ts`; `npm test` fails when those fixtures are
//! stale. Character-data caveats are documented in [`crate::js_text`].

use std::collections::HashSet;

use serde::Serialize;

use crate::alphabet::CompiledAlphabet;
use crate::swadesh::match_swadesh_list;

/// One alphabet symbol (`script_symbols.symbol` / `capitalSymbol`).
#[derive(Debug, Clone, Copy)]
pub struct SymbolInput<'a> {
    pub symbol: &'a str,
    pub capital_symbol: Option<&'a str>,
}

/// One dictionary entry, in the order the caller wants warnings reported.
#[derive(Debug, Clone, Copy)]
pub struct EntryInput<'a> {
    pub lemma: &'a str,
    pub gloss: &'a str,
    pub paradigm_id: Option<&'a str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WarningKind {
    UndefinedSymbol,
    MissingParadigm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Warning,
    Info,
}

/// Same shape as the TypeScript `ValidationWarning` (`type`, `message`, `severity`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Warning {
    #[serde(rename = "type")]
    pub kind: WarningKind,
    pub message: String,
    pub severity: Severity,
}

/// Result for the overview: the first `max_warnings` warnings (TypeScript order:
/// every undefined-symbol warning in entry order, then every missing-paradigm
/// warning in entry order), the total count, and matched Swadesh concept ids
/// sorted ascending.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconAnalysis {
    pub warnings: Vec<Warning>,
    pub total: usize,
    pub matched_ids: Vec<u32>,
}

/// Analyse a lexicon: `getValidationWarnings(symbols, entries, paradigms, { allowsDiacritics })`
/// truncated to `max_warnings` (with the untruncated count in `total`), plus
/// `matchSwadeshList(entries.map(e => e.gloss)).matched` as sorted ids.
///
/// The alphabet is compiled once for the whole lexicon, and only the warnings that are
/// returned have their messages built; the rest are only counted (stopping at the first
/// undefined symbol of each lemma).
pub fn analyze_lexicon(
    symbols: &[SymbolInput<'_>],
    entries: &[EntryInput<'_>],
    paradigm_ids: &[&str],
    allows_diacritics: bool,
    max_warnings: usize,
) -> LexiconAnalysis {
    let mut warnings = Vec::with_capacity(max_warnings.min(entries.len()).min(256));
    let mut total = 0;

    // checkUndefinedSymbols: nothing at all for a language without an alphabet.
    if !symbols.is_empty() {
        let alphabet = CompiledAlphabet::new(symbols, allows_diacritics);
        for entry in entries {
            if warnings.len() < max_warnings {
                let invalid = alphabet.invalid_graphemes(entry.lemma);
                if !invalid.is_empty() {
                    total += 1;
                    warnings.push(undefined_symbol_warning(entry.lemma, &invalid));
                }
            } else if alphabet.has_invalid_grapheme(entry.lemma) {
                total += 1;
            }
        }
    }

    // checkMissingParadigms: a non-empty paradigmId that the language does not have.
    let known: HashSet<&str> = paradigm_ids.iter().copied().collect();
    for entry in entries {
        let missing = entry
            .paradigm_id
            .is_some_and(|id| !id.is_empty() && !known.contains(id));
        if missing {
            total += 1;
            if warnings.len() < max_warnings {
                warnings.push(missing_paradigm_warning(entry.lemma));
            }
        }
    }

    LexiconAnalysis {
        warnings,
        total,
        matched_ids: match_swadesh_list(entries.iter().map(|entry| entry.gloss)),
    }
}

fn undefined_symbol_warning(lemma: &str, invalid: &[String]) -> Warning {
    Warning {
        kind: WarningKind::UndefinedSymbol,
        message: format!(
            "Entry \"{lemma}\" uses undefined symbols: {}",
            invalid.join(", ")
        ),
        severity: Severity::Warning,
    }
}

fn missing_paradigm_warning(lemma: &str) -> Warning {
    Warning {
        kind: WarningKind::MissingParadigm,
        message: format!("Entry \"{lemma}\" references a missing paradigm"),
        severity: Severity::Warning,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry<'a>(lemma: &'a str, paradigm_id: Option<&'a str>) -> EntryInput<'a> {
        EntryInput {
            lemma,
            gloss: "",
            paradigm_id,
        }
    }

    #[test]
    fn undefined_symbols_come_before_missing_paradigms() {
        let symbols = [SymbolInput {
            symbol: "a",
            capital_symbol: Some("A"),
        }];
        let entries = [
            entry("ax", Some("gone")),
            entry("b", None),
            entry("a", Some("")),
        ];
        let result = analyze_lexicon(&symbols, &entries, &["p1"], false, usize::MAX);
        let messages: Vec<&str> = result.warnings.iter().map(|w| w.message.as_str()).collect();
        assert_eq!(
            messages,
            [
                "Entry \"ax\" uses undefined symbols: x",
                "Entry \"b\" uses undefined symbols: b",
                "Entry \"ax\" references a missing paradigm",
            ]
        );
        assert_eq!(result.total, 3);

        let truncated = analyze_lexicon(&symbols, &entries, &["p1"], false, 1);
        assert_eq!(truncated.warnings, result.warnings[..1]);
        assert_eq!(truncated.total, 3);
    }

    #[test]
    fn serialises_like_the_typescript_warning() {
        let warning = missing_paradigm_warning("x");
        let json = serde_json::to_string(&warning).unwrap();
        assert_eq!(
            json,
            r#"{"type":"missing_paradigm","message":"Entry \"x\" references a missing paradigm","severity":"warning"}"#
        );
    }
}

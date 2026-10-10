//! `validateStringAgainstAlphabet` (`lib/utils/alphabet-validation.ts`) with the alphabet
//! compiled once instead of once per entry.
//!
//! The TypeScript rebuilds the allowed-symbol set, re-sorts it by UTF-16 length and constructs a
//! new `Intl.Segmenter` for every lemma; that is where the overview spends its CPU. The result
//! only depends on the alphabet, so [`CompiledAlphabet`] builds it once.
//!
//! Matching is greedy longest-prefix. The TypeScript scans candidates sorted by `.length`
//! (UTF-16 code units) descending and takes the first that `startsWith`; any two candidates that
//! both prefix the remaining text are prefixes of each other, so "first in that order" is simply
//! "the longest match" — whatever the tie order, and whether length is counted in UTF-16 units
//! or bytes. Candidates are therefore grouped by first character and tried longest first.

use std::collections::HashSet;
use std::ops::ControlFlow;

use unicode_segmentation::UnicodeSegmentation;

use crate::analysis::SymbolInput;
use crate::js_text::{base_character, is_always_allowed, js_to_lowercase, nfc, nfd};

#[derive(Debug, Clone)]
pub struct CompiledAlphabet {
    /// Allowed strings grouped by first character (sorted for binary search), each group
    /// longest first.
    by_first_char: Vec<(char, Vec<Box<str>>)>,
    /// Lowercased base characters of every symbol (diacritics mode only).
    base_chars: HashSet<String>,
    allows_diacritics: bool,
    /// `symbols.length === 0`: the TypeScript validates nothing at all.
    no_symbols: bool,
}

impl CompiledAlphabet {
    pub fn new(symbols: &[SymbolInput<'_>], allows_diacritics: bool) -> Self {
        let mut allowed: HashSet<String> = HashSet::new();
        let mut base_chars: HashSet<String> = HashSet::new();
        let forms = symbols
            .iter()
            .flat_map(|s| [Some(s.symbol), s.capital_symbol])
            .flatten()
            .filter(|form| !form.is_empty());
        for form in forms {
            allowed.insert(form.to_owned());
            allowed.insert(nfc(form).into_owned());
            allowed.insert(nfd(form).into_owned());
            if allows_diacritics {
                let base = base_character(form);
                if !base.is_empty() {
                    base_chars.insert(js_to_lowercase(&base).into_owned());
                }
            }
        }
        Self {
            by_first_char: group_by_first_char(allowed),
            base_chars,
            allows_diacritics,
            no_symbols: symbols.is_empty(),
        }
    }

    /// The invalid graphemes of `text` (after NFC), de-duplicated in first-occurrence order —
    /// exactly `validateStringAgainstAlphabet(text, symbols, { allowsDiacritics })`.
    pub fn invalid_graphemes(&self, text: &str) -> Vec<String> {
        if self.no_symbols || text.is_empty() {
            return Vec::new();
        }
        let normalized = nfc(text);
        let mut seen: HashSet<&str> = HashSet::new();
        let mut invalid: Vec<&str> = Vec::new();
        let flow = self.scan(&normalized, |grapheme| {
            if seen.insert(grapheme) {
                invalid.push(grapheme);
            }
            ControlFlow::Continue(())
        });
        debug_assert!(flow.is_continue(), "the collector never stops the scan");
        invalid.into_iter().map(str::to_owned).collect()
    }

    /// Whether `invalid_graphemes(text)` would be non-empty, stopping at the first one.
    pub fn has_invalid_grapheme(&self, text: &str) -> bool {
        if self.no_symbols || text.is_empty() {
            return false;
        }
        self.scan(&nfc(text), |_| ControlFlow::Break(())).is_break()
    }

    /// Walk NFC `text` exactly like the TypeScript loop, reporting each invalid grapheme.
    fn scan<'t>(
        &self,
        text: &'t str,
        mut on_invalid: impl FnMut(&'t str) -> ControlFlow<()>,
    ) -> ControlFlow<()> {
        let mut rest = text;
        while !rest.is_empty() {
            if let Some(len) = self.longest_symbol_prefix(rest) {
                rest = &rest[len..];
                continue;
            }
            // Intl.Segmenter is applied to the remaining text, so segment from here.
            let grapheme = rest.graphemes(true).next().unwrap_or(rest);
            rest = &rest[grapheme.len()..];
            if !self.grapheme_allowed(grapheme) {
                on_invalid(grapheme)?;
            }
        }
        ControlFlow::Continue(())
    }

    fn longest_symbol_prefix(&self, rest: &str) -> Option<usize> {
        let first = rest.chars().next()?;
        let index = self
            .by_first_char
            .binary_search_by_key(&first, |(c, _)| *c)
            .ok()?;
        self.by_first_char[index]
            .1
            .iter()
            .find(|candidate| rest.starts_with(&***candidate))
            .map(|candidate| candidate.len())
    }

    /// The fallback for a grapheme no symbol matched: whitespace/digits/punctuation/symbols are
    /// always fine; in diacritics mode so is anything whose lowercased base is in the alphabet.
    fn grapheme_allowed(&self, grapheme: &str) -> bool {
        if grapheme.chars().all(is_always_allowed) {
            return true;
        }
        if !self.allows_diacritics {
            return false;
        }
        let base = base_character(grapheme);
        !base.is_empty() && self.base_chars.contains(js_to_lowercase(&base).as_ref())
    }
}

fn group_by_first_char(allowed: HashSet<String>) -> Vec<(char, Vec<Box<str>>)> {
    let mut sorted: Vec<String> = allowed.into_iter().collect();
    // First character ascending, then longest first; the tie order is irrelevant (see module
    // docs) but sorting fully keeps the structure deterministic.
    sorted.sort_by(|a, b| {
        a.chars()
            .next()
            .cmp(&b.chars().next())
            .then_with(|| b.len().cmp(&a.len()))
            .then_with(|| a.cmp(b))
    });
    let mut groups: Vec<(char, Vec<Box<str>>)> = Vec::new();
    for candidate in sorted {
        let Some(first) = candidate.chars().next() else {
            continue;
        };
        match groups.last_mut() {
            Some((c, group)) if *c == first => group.push(candidate.into_boxed_str()),
            _ => groups.push((first, vec![candidate.into_boxed_str()])),
        }
    }
    groups
}

#[cfg(test)]
mod tests {
    use super::*;

    fn alphabet(
        symbols: &[(&'static str, Option<&'static str>)],
        diacritics: bool,
    ) -> CompiledAlphabet {
        let inputs: Vec<SymbolInput<'_>> = symbols
            .iter()
            .map(|&(symbol, capital_symbol)| SymbolInput {
                symbol,
                capital_symbol,
            })
            .collect();
        CompiledAlphabet::new(&inputs, diacritics)
    }

    #[test]
    fn longest_match_wins_without_backtracking() {
        let a = alphabet(&[("c", None), ("h", None), ("ch", None)], false);
        assert!(a.invalid_graphemes("chch").is_empty());
        let a = alphabet(&[("ab", None), ("bc", None), ("a", None)], false);
        assert_eq!(a.invalid_graphemes("abc"), ["c"]);
    }

    #[test]
    fn invalid_graphemes_are_deduplicated_in_order() {
        let a = alphabet(&[("a", Some("A"))], false);
        assert_eq!(a.invalid_graphemes("xAyx a1-"), ["x", "y"]);
        assert!(a.has_invalid_grapheme("aax"));
        assert!(!a.has_invalid_grapheme("aA 1"));
    }

    #[test]
    fn diacritics_mode_accepts_marked_variants_of_known_bases() {
        let a = alphabet(&[("e", None)], true);
        assert!(a.invalid_graphemes("\u{11b}e\u{301}").is_empty());
        assert_eq!(a.invalid_graphemes("\u{301}"), ["\u{301}"]);
        let strict = alphabet(&[("e", None)], false);
        assert_eq!(strict.invalid_graphemes("\u{11b}"), ["\u{11b}"]);
    }

    #[test]
    fn empty_alphabet_and_empty_text_validate_nothing() {
        assert!(alphabet(&[], false).invalid_graphemes("xyz").is_empty());
        assert!(alphabet(&[("a", None)], false)
            .invalid_graphemes("")
            .is_empty());
        assert_eq!(
            alphabet(&[("", Some(""))], false).invalid_graphemes("b"),
            ["b"]
        );
    }
}

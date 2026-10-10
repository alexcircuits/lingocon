//! `matchSwadeshList` from `lib/data/swadesh-list.ts`.
//!
//! The concept list itself is generated from the TypeScript into `swadesh_data.rs` by
//! `scripts/rust-parity/generate-lexicon-fixtures.ts`; never edit it by hand.

use std::borrow::Cow;
use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};

use crate::js_text::{is_js_whitespace, js_to_lowercase, js_trim};

pub use crate::swadesh_data::SWADESH_LIST;

/// One entry of the Swadesh list (`SwadeshConcept` in TypeScript).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SwadeshConcept {
    pub id: u32,
    pub english: &'static str,
    pub category: &'static str,
}

/// Ids of the Swadesh concepts matched by `glosses`, ascending — the `matched` set of
/// `matchSwadeshList(glosses)`.
pub fn match_swadesh_list<'a>(glosses: impl IntoIterator<Item = &'a str>) -> Vec<u32> {
    let keys = concept_keys();
    let longest_key = keys.keys().map(String::len).max().unwrap_or(0);
    let max_id = SWADESH_LIST.iter().map(|c| c.id).max().unwrap_or(0);
    let mut matched = vec![false; max_id as usize + 1];
    let mut mark = |candidate: &str| {
        if candidate.len() > longest_key {
            return;
        }
        if let Some(ids) = keys.get(candidate) {
            for &id in ids {
                matched[id as usize] = true;
            }
        }
    };
    for gloss in glosses {
        for_each_expansion(gloss, &mut mark);
    }
    (0..=max_id).filter(|&id| matched[id as usize]).collect()
}

/// FNV-1a. The table is ~200 fixed short keys probed several times per gloss; SipHash's
/// flooding resistance buys nothing here (a probe longer than every key is skipped before
/// hashing, so a colliding probe costs at most a few short comparisons) and it is about half the
/// cost of matching a large lexicon.
struct Fnv1a(u64);

impl Default for Fnv1a {
    fn default() -> Self {
        Self(0xcbf2_9ce4_8422_2325)
    }
}

impl Hasher for Fnv1a {
    fn finish(&self) -> u64 {
        self.0
    }

    fn write(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.0 = (self.0 ^ u64::from(byte)).wrapping_mul(0x0000_0100_0000_01b3);
        }
    }
}

type ConceptKeys = HashMap<String, Vec<u32>, BuildHasherDefault<Fnv1a>>;

/// Lookup key → concept ids: each concept's lowercased English and, when non-empty, that
/// string with parentheticals removed and trimmed.
fn concept_keys() -> ConceptKeys {
    let mut keys = ConceptKeys::default();
    for concept in SWADESH_LIST {
        let english = js_to_lowercase(concept.english);
        let without_parens = js_trim(&remove_parenthesized(&english)).to_owned();
        keys.entry(english.into_owned())
            .or_default()
            .push(concept.id);
        if !without_parens.is_empty() {
            keys.entry(without_parens).or_default().push(concept.id);
        }
    }
    keys
}

/// Every string the TypeScript adds to `expandedGlosses` for one gloss, in the same order.
fn for_each_expansion(gloss: &str, emit: &mut impl FnMut(&str)) {
    let lowered = js_to_lowercase(gloss);
    let g = js_trim(&lowered);
    if g.is_empty() {
        return;
    }
    emit(g);
    let no_parens = remove_parenthesized(g);
    let no_parens = js_trim(&no_parens);
    if !no_parens.is_empty() {
        emit(no_parens);
        emit_non_empty(js_trim(strip_leading_to(no_parens)), emit);
    }
    for part in g.split([',', ';', '/']) {
        let p = js_trim(part);
        if p.is_empty() {
            continue;
        }
        emit(p);
        emit_non_empty(js_trim(strip_leading_to(p)), emit);
        let p_no_parens = remove_parenthesized(p);
        let p_no_parens = js_trim(&p_no_parens);
        if !p_no_parens.is_empty() {
            emit(p_no_parens);
            emit_non_empty(js_trim(strip_leading_to(p_no_parens)), emit);
        }
    }
}

fn emit_non_empty(s: &str, emit: &mut impl FnMut(&str)) {
    if !s.is_empty() {
        emit(s);
    }
}

/// `s.replace(/\([^)]*\)/g, "")`: each `(` up to the next `)` (inclusive) is removed; an
/// unclosed `(` and everything after it are kept.
fn remove_parenthesized(s: &str) -> Cow<'_, str> {
    if !s.contains('(') {
        return Cow::Borrowed(s);
    }
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(open) = rest.find('(') {
        let Some(close) = rest[open + 1..].find(')') else {
            break;
        };
        out.push_str(&rest[..open]);
        rest = &rest[open + 1 + close + 1..];
    }
    out.push_str(rest);
    Cow::Owned(out)
}

/// `s.replace(/^to\s+/, "")` with JavaScript's `\s`.
fn strip_leading_to(s: &str) -> &str {
    let Some(after) = s.strip_prefix("to") else {
        return s;
    };
    let stripped = after.trim_start_matches(is_js_whitespace);
    if stripped.len() < after.len() {
        stripped
    } else {
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parenthesized_text_is_removed_like_the_regex() {
        assert_eq!(remove_parenthesized("big (in size)"), "big ");
        assert_eq!(remove_parenthesized("a (b (c) d)"), "a  d)");
        assert_eq!(remove_parenthesized("(x) big (y"), " big (y");
        assert_eq!(remove_parenthesized("b(i)g"), "bg");
        assert!(matches!(remove_parenthesized("plain"), Cow::Borrowed(_)));
    }

    #[test]
    fn leading_to_needs_javascript_whitespace() {
        assert_eq!(strip_leading_to("to eat"), "eat");
        assert_eq!(strip_leading_to("to \t\u{a0}eat"), "eat");
        assert_eq!(strip_leading_to("to\u{feff}eat"), "eat");
        assert_eq!(strip_leading_to("to\u{85}eat"), "to\u{85}eat");
        assert_eq!(strip_leading_to("toe"), "toe");
        assert_eq!(strip_leading_to("to"), "to");
        assert_eq!(strip_leading_to("to "), "");
    }

    #[test]
    fn glosses_match_concepts() {
        assert_eq!(match_swadesh_list(["to eat"]), [93]);
        assert_eq!(match_swadesh_list(["you"]), [2, 5]);
        assert_eq!(match_swadesh_list(["right"]), [169, 180]);
        assert!(match_swadesh_list(["eat\u{85}"]).is_empty());
        assert_eq!(match_swadesh_list(["\u{feff}EAT "]), [93]);
    }
}

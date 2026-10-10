//! The JavaScript string semantics that main's TypeScript relies on, reproduced exactly.
//!
//! Rust's own notions differ in places that matter for parity: `char::is_whitespace` and
//! `str::trim` include U+0085 (NEL) but not U+FEFF, while JavaScript's `\s` and `trim()` are the
//! other way round; `char::is_numeric` is far wider than JavaScript's ASCII-only `\d`.
//!
//! Unicode data: `unicode-normalization` (NFC/NFD), `unicode-properties` (General_Category) and
//! the standard library (case mapping) are all on [`UNICODE_VERSION`]. V8/ICU on another Unicode
//! version can disagree only on code points one side has not assigned yet;
//! `tests/unicode_tables.rs` checks every scalar value against a V8 snapshot.
//!
//! Known divergence (measured with that test):
//! - ICU 78.2 / Unicode 17 (Node 25.5; Node 22.23 and 24.14 ship the same ICU): none.
//! - ICU 77.1 / Unicode 16 (Node 22.16, 24.2): 174 code points; ICU 74.2 / Unicode 15.1
//!   (Node 18.20): 1,013. All are characters assigned after the engine's Unicode version, which
//!   the engine treats as unassigned (`\p{Cn}`: not punctuation/symbol/mark, no case or
//!   normalisation mappings).
//! - Grapheme segmentation: 96 of 74,088 sampled break-class triples differ on Unicode 16,
//!   all from Unicode 17 extending GB9c conjuncts to Khmer, Myanmar and Balinese (e.g. "ក្ត" is
//!   one grapheme here and in Node 25, two in Node 22.16). An engine older than Unicode 17
//!   therefore reports the parts of such a cluster as separate undefined symbols where Rust
//!   reports the whole cluster.

use std::borrow::Cow;

use unicode_normalization::{is_nfc_quick, is_nfd_quick, IsNormalized, UnicodeNormalization};
use unicode_properties::{GeneralCategoryGroup, UnicodeGeneralCategory};

/// Unicode version of the character data used here (all three crates agree; tested).
pub const UNICODE_VERSION: (u8, u8, u8) = unicode_normalization::UNICODE_VERSION;

/// ECMAScript `WhiteSpace` + `LineTerminator`: what `/\s/` matches and `String.prototype.trim`
/// removes. TAB, VT, FF, SP, NBSP, ZWNBSP (U+FEFF), every `Zs`, LF, CR, LS and PS — and *not*
/// U+0085 or U+180E.
pub fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

/// One code point of the alphabet matcher's "always allowed" class, `/[\s\d\p{P}\p{S}]/u`.
/// `\d` is ASCII `[0-9]` in JavaScript even with the `u` flag.
pub fn is_always_allowed(c: char) -> bool {
    if c.is_ascii() {
        // Every ASCII punctuation character is General_Category P* or S*.
        return c.is_ascii_digit() || c.is_ascii_punctuation() || is_js_whitespace(c);
    }
    is_js_whitespace(c)
        || matches!(
            c.general_category_group(),
            GeneralCategoryGroup::Punctuation | GeneralCategoryGroup::Symbol
        )
}

/// `/\p{M}/u`: General_Category Mn, Mc or Me.
pub fn is_mark(c: char) -> bool {
    !c.is_ascii() && c.general_category_group() == GeneralCategoryGroup::Mark
}

/// `String.prototype.trim`.
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_whitespace)
}

/// `String.prototype.toLowerCase`: Unicode default full case mapping, including the
/// context-sensitive Final_Sigma rule and no locale tailoring — which is exactly what
/// `str::to_lowercase` implements.
pub fn js_to_lowercase(s: &str) -> Cow<'_, str> {
    if s.is_ascii() {
        if s.bytes().any(|b| b.is_ascii_uppercase()) {
            Cow::Owned(s.to_ascii_lowercase())
        } else {
            Cow::Borrowed(s)
        }
    } else {
        Cow::Owned(s.to_lowercase())
    }
}

/// `String.prototype.normalize("NFC")`, borrowing when the input is already NFC.
pub fn nfc(s: &str) -> Cow<'_, str> {
    if is_nfc_quick(s.chars()) == IsNormalized::Yes {
        Cow::Borrowed(s)
    } else {
        Cow::Owned(s.nfc().collect())
    }
}

/// `String.prototype.normalize("NFD")`, borrowing when the input is already NFD.
pub fn nfd(s: &str) -> Cow<'_, str> {
    if is_nfd_quick(s.chars()) == IsNormalized::Yes {
        Cow::Borrowed(s)
    } else {
        Cow::Owned(s.nfd().collect())
    }
}

/// `getBaseCharacter` from `alphabet-validation.ts`: NFD, then drop every `\p{M}`.
pub fn base_character(s: &str) -> Cow<'_, str> {
    if s.is_ascii() {
        return Cow::Borrowed(s);
    }
    Cow::Owned(s.nfd().filter(|&c| !is_mark(c)).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whitespace_follows_javascript_not_rust() {
        assert!(is_js_whitespace('\u{feff}'));
        assert!(!'\u{feff}'.is_whitespace());
        assert!(!is_js_whitespace('\u{85}'));
        assert!('\u{85}'.is_whitespace());
        assert!(!is_js_whitespace('\u{180e}'));
        assert!(!is_js_whitespace('\u{200b}'));
        assert_eq!(js_trim("\u{feff} eat\u{a0}\u{2028}"), "eat");
        assert_eq!(js_trim("eat\u{85}"), "eat\u{85}");
    }

    #[test]
    fn always_allowed_class() {
        for c in [
            ' ',
            '7',
            '-',
            '$',
            '\u{2019}',
            '\u{20ac}',
            '\u{1f642}',
            '\u{1f3fd}',
            '\u{feff}',
        ] {
            assert!(is_always_allowed(c), "{c:?}");
        }
        for c in [
            'a', '\u{663}', '\u{b2}', '\u{301}', '\u{200d}', '\u{fe0f}', '\u{85}', '\0',
        ] {
            assert!(!is_always_allowed(c), "{c:?}");
        }
    }

    #[test]
    fn lowercase_matches_javascript() {
        assert_eq!(js_to_lowercase("ABC"), "abc");
        assert!(matches!(js_to_lowercase("abc"), Cow::Borrowed(_)));
        assert_eq!(js_to_lowercase("\u{130}"), "i\u{307}");
        assert_eq!(js_to_lowercase("\u{3a3}"), "\u{3c3}");
        assert_eq!(js_to_lowercase("\u{391}\u{3a3}"), "\u{3b1}\u{3c2}");
        assert_eq!(js_to_lowercase("\u{212a}"), "k");
    }

    #[test]
    fn normalisation_and_base_characters() {
        assert_eq!(nfc("e\u{301}"), "\u{e9}");
        assert_eq!(nfd("\u{e9}"), "e\u{301}");
        assert_eq!(nfc("\u{212b}"), "\u{c5}");
        assert!(matches!(nfc("plain"), Cow::Borrowed(_)));
        assert_eq!(base_character("\u{11b}"), "e");
        assert_eq!(base_character("\u{130}"), "I");
        assert_eq!(base_character("\u{301}"), "");
        assert_eq!(base_character("\u{1c5}"), "\u{1c5}");
    }
}

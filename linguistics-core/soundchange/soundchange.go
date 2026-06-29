// Package soundchange is a phoneme-aware sound-change engine: it parses
// phonological rules (target → replacement / left _ right) and applies them to
// words.
//
// It is a Go port of lib/utils/sound-change.ts. The key design difference: the
// TS version uses regex with lookbehind/lookahead, but Go's stdlib regexp (RE2)
// has no lookarounds. So this engine uses a direct position scanner instead —
// which is faster (no per-word regex compilation), correct by construction for
// adjacent/overlapping environments (e.g. intervocalic `s → ∅ / V_V` deletes
// BOTH consonants in "asasa"), and runs identically on every platform via WASM
// (no Safari-version lookbehind caveat).
package soundchange

import (
	"regexp"
	"sort"
	"strings"
)

// arrowRe matches the rule arrow: →, a single >, or one-or-more dashes/equals
// before `>` (so `->`, `-->`, `==>` work) plus the en/em-dash variants (–> —>)
// macOS "smart dashes" can produce. The dash run is matched as a unit so `-->`
// does not leave a stray `-` glued to the target. Mirrors the TS engine regex.
var arrowRe = regexp.MustCompile(`→|[=–—-]+>|>`)

// Rule is a single phonological rewrite rule.
type Rule struct {
	Raw         string `json:"raw"`
	Target      string `json:"target"`
	Replacement string `json:"replacement"`
	LeftEnv     string `json:"leftEnv"`
	RightEnv    string `json:"rightEnv"`
	Enabled     bool   `json:"enabled"`
}

// Result is the outcome of applying a pipeline to one word.
type Result struct {
	Original     string   `json:"original"`
	Changed      string   `json:"changed"`
	RulesApplied []string `json:"rulesApplied"`
}

type tokenKind uint8

const (
	tokVowel tokenKind = iota
	tokConsonant
	tokBoundary // #
	tokAny      // .
	tokLiteral
)

type token struct {
	kind tokenKind
	lit  []rune // for tokLiteral
}

// Engine holds the phoneme classes (vowels/consonants), stored longest-first so
// multi-rune phonemes (e.g. "aː", "tʃ") match before their prefixes.
type Engine struct {
	vowels     [][]rune
	consonants [][]rune
}

// NewEngine builds an engine from explicit vowel/consonant inventories.
func NewEngine(vowels, consonants []string) *Engine {
	return &Engine{
		vowels:     toSortedRunes(vowels),
		consonants: toSortedRunes(consonants),
	}
}

// DefaultEngine uses the comprehensive default IPA inventory.
func DefaultEngine() *Engine {
	return NewEngine(defaultVowels, defaultConsonants)
}

// NewEngineOrDefault builds an engine, falling back to the default inventory for
// any class left empty. This mirrors the TS engine, where an omitted
// vowels/consonants argument independently defaults that one class.
func NewEngineOrDefault(vowels, consonants []string) *Engine {
	if len(vowels) == 0 {
		vowels = defaultVowels
	}
	if len(consonants) == 0 {
		consonants = defaultConsonants
	}
	return NewEngine(vowels, consonants)
}

func toSortedRunes(set []string) [][]rune {
	out := make([][]rune, 0, len(set))
	for _, s := range set {
		out = append(out, []rune(s))
	}
	sort.SliceStable(out, func(i, j int) bool { return len(out[i]) > len(out[j]) })
	return out
}

// ParseRule parses one rule line. Returns ok=false for comments/blank/invalid.
func ParseRule(text string) (Rule, bool) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" || strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "#") {
		return Rule{}, false
	}

	// Split on the first arrow: →, ->, or >
	target, rest, ok := splitArrow(trimmed)
	if !ok {
		return Rule{}, false
	}
	target = strings.TrimSpace(target)

	replacement := strings.TrimSpace(rest)
	leftEnv, rightEnv := "", ""
	if idx := strings.Index(rest, "/"); idx >= 0 {
		replacement = strings.TrimSpace(rest[:idx])
		envPart := strings.TrimSpace(rest[idx+1:])
		if u := strings.Index(envPart, "_"); u >= 0 {
			leftEnv = strings.TrimSpace(envPart[:u])
			rightEnv = strings.TrimSpace(envPart[u+1:])
		}
	}

	switch replacement {
	case "∅", "0", "Ø":
		replacement = ""
	}

	return Rule{
		Raw:         trimmed,
		Target:      target,
		Replacement: replacement,
		LeftEnv:     leftEnv,
		RightEnv:    rightEnv,
		Enabled:     true,
	}, true
}

func splitArrow(s string) (left, right string, ok bool) {
	loc := arrowRe.FindStringIndex(s)
	if loc == nil {
		return "", "", false
	}
	return s[:loc[0]], s[loc[1]:], true
}

// ParseRules parses a newline-separated block, skipping comments/blanks.
func ParseRules(text string) []Rule {
	var rules []Rule
	for _, line := range strings.Split(text, "\n") {
		if r, ok := ParseRule(line); ok {
			rules = append(rules, r)
		}
	}
	return rules
}

func tokenize(env string) []token {
	var toks []token
	for _, ch := range env {
		switch ch {
		case '#':
			toks = append(toks, token{kind: tokBoundary})
		case 'V':
			toks = append(toks, token{kind: tokVowel})
		case 'C':
			toks = append(toks, token{kind: tokConsonant})
		case '.':
			toks = append(toks, token{kind: tokAny})
		default:
			toks = append(toks, token{kind: tokLiteral, lit: []rune{ch}})
		}
	}
	return toks
}

func (e *Engine) class(k tokenKind) [][]rune {
	if k == tokVowel {
		return e.vowels
	}
	return e.consonants
}

// matchPrefixClass returns the rune length of the longest class member that is a
// prefix of runes[p:], or -1 if none matches.
func matchPrefixClass(runes []rune, p int, set [][]rune) int {
	for _, m := range set {
		if p+len(m) <= len(runes) && equalRunes(runes[p:p+len(m)], m) {
			return len(m)
		}
	}
	return -1
}

// matchSuffixClass returns the rune length of the longest class member that is a
// suffix of runes[:end], or -1 if none matches.
func matchSuffixClass(runes []rune, end int, set [][]rune) int {
	for _, m := range set {
		if end-len(m) >= 0 && equalRunes(runes[end-len(m):end], m) {
			return len(m)
		}
	}
	return -1
}

func equalRunes(a, b []rune) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// rightMatch reports whether the right-context tokens match starting at p.
// Contexts are zero-width: we only verify, never alter the word.
func (e *Engine) rightMatch(runes []rune, p int, toks []token) bool {
	for _, t := range toks {
		switch t.kind {
		case tokBoundary:
			if p != len(runes) {
				return false
			}
		case tokVowel, tokConsonant:
			n := matchPrefixClass(runes, p, e.class(t.kind))
			if n < 0 {
				return false
			}
			p += n
		case tokAny:
			if p >= len(runes) {
				return false
			}
			p++
		case tokLiteral:
			if p+len(t.lit) > len(runes) || !equalRunes(runes[p:p+len(t.lit)], t.lit) {
				return false
			}
			p += len(t.lit)
		}
	}
	return true
}

// leftMatch reports whether the left-context tokens match ending exactly at end.
// Tokens read left-to-right but anchor to the right edge, so we consume backward.
func (e *Engine) leftMatch(runes []rune, end int, toks []token) bool {
	for i := len(toks) - 1; i >= 0; i-- {
		t := toks[i]
		switch t.kind {
		case tokBoundary:
			if end != 0 {
				return false
			}
		case tokVowel, tokConsonant:
			n := matchSuffixClass(runes, end, e.class(t.kind))
			if n < 0 {
				return false
			}
			end -= n
		case tokAny:
			if end <= 0 {
				return false
			}
			end--
		case tokLiteral:
			if end-len(t.lit) < 0 || !equalRunes(runes[end-len(t.lit):end], t.lit) {
				return false
			}
			end -= len(t.lit)
		}
	}
	return true
}

// ApplyRule applies one rule to a word, left-to-right. Targets are consumed;
// environments are zero-width assertions against the original word.
func (e *Engine) ApplyRule(word string, r Rule) string {
	if !r.Enabled || r.Target == "" {
		return word
	}
	runes := []rune(word)
	target := []rune(r.Target)
	left := tokenize(r.LeftEnv)
	right := tokenize(r.RightEnv)
	repl := []rune(r.Replacement)

	var out []rune
	i := 0
	for i < len(runes) {
		if i+len(target) <= len(runes) &&
			equalRunes(runes[i:i+len(target)], target) &&
			e.leftMatch(runes, i, left) &&
			e.rightMatch(runes, i+len(target), right) {
			out = append(out, repl...)
			i += len(target)
		} else {
			out = append(out, runes[i])
			i++
		}
	}
	return string(out)
}

// ApplyPipeline applies rules in order, recording which ones fired.
func (e *Engine) ApplyPipeline(word string, rules []Rule) Result {
	current := word
	applied := []string{}
	for _, r := range rules {
		if !r.Enabled {
			continue
		}
		next := e.ApplyRule(current, r)
		if next != current {
			applied = append(applied, r.Raw)
			current = next
		}
	}
	return Result{Original: word, Changed: current, RulesApplied: applied}
}

// BatchApply runs a pipeline over many words.
func (e *Engine) BatchApply(words []string, rules []Rule) []Result {
	out := make([]Result, len(words))
	for i, w := range words {
		out[i] = e.ApplyPipeline(w, rules)
	}
	return out
}

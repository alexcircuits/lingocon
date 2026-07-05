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
	tokClass // user-defined named class (matches any one member)
)

type token struct {
	kind  tokenKind
	lit   []rune   // for tokLiteral
	class [][]rune // for tokClass: members, longest-first
}

// Engine holds the phoneme classes (vowels/consonants), stored longest-first so
// multi-rune phonemes (e.g. "aː", "tʃ") match before their prefixes.
type Engine struct {
	vowels     [][]rune
	consonants [][]rune
	// userClasses maps a class name to its members (longest-first).
	userClasses map[string][][]rune
	// userClassNames holds userClasses' keys sorted longest-first,
	// precomputed once at construction so tokenize never re-sorts this
	// invariant list on the hot path.
	userClassNames []string
}

// NewEngine builds an engine from explicit vowel/consonant inventories.
func NewEngine(vowels, consonants []string) *Engine {
	return &Engine{
		vowels:     toSortedRunes(vowels),
		consonants: toSortedRunes(consonants),
	}
}

// NewEngineWithClasses builds an engine from explicit vowel/consonant
// inventories plus user-defined named sound classes (as parsed into
// Program.Classes). Each class's members are stored longest-first, exactly
// like vowels/consonants, so multi-rune members match before their prefixes.
//
// An engine built with a nil/empty classes map behaves identically to
// NewEngine, since tokenize/ApplyRule only special-case names present in
// userClasses.
func NewEngineWithClasses(vowels, consonants []string, classes map[string][]string) *Engine {
	return NewEngine(vowels, consonants).withClasses(classes)
}

// withClasses registers user classes on an already-built engine and returns
// it. Members are stored longest-first, and the sorted class-name list is
// precomputed once (invariant for the engine's lifetime, so tokenize never
// re-sorts on the hot path). A nil/empty map is a no-op, leaving the engine
// class-free. Shared by NewEngineWithClasses and
// NewEngineOrDefaultWithClasses so the precompute logic lives in one place.
func (e *Engine) withClasses(classes map[string][]string) *Engine {
	if len(classes) == 0 {
		return e
	}
	e.userClasses = make(map[string][][]rune, len(classes))
	for name, members := range classes {
		e.userClasses[name] = toSortedRunes(members)
	}
	e.userClassNames = sortedClassNames(e.userClasses)
	return e
}

// DefaultEngine uses the comprehensive default IPA inventory.
func DefaultEngine() *Engine {
	return NewEngine(defaultVowels, defaultConsonants)
}

// NewEngineOrDefault builds an engine, falling back to the default inventory for
// any class left empty. This mirrors the TS engine, where an omitted
// vowels/consonants argument independently defaults that one class.
func NewEngineOrDefault(vowels, consonants []string) *Engine {
	v, c := defaultedInventories(vowels, consonants)
	return NewEngine(v, c)
}

// NewEngineOrDefaultWithClasses defaults empty vowel/consonant inventories to
// the built-in IPA sets (exactly like NewEngineOrDefault) AND registers the
// given user-defined classes. It shares the class-registration path with
// NewEngineWithClasses, so userClassNames is still precomputed once.
func NewEngineOrDefaultWithClasses(vowels, consonants []string, classes map[string][]string) *Engine {
	v, c := defaultedInventories(vowels, consonants)
	return NewEngine(v, c).withClasses(classes)
}

// defaultedInventories returns vowels/consonants with each empty class
// independently replaced by its built-in default set.
func defaultedInventories(vowels, consonants []string) (v, c []string) {
	v, c = vowels, consonants
	if len(v) == 0 {
		v = defaultVowels
	}
	if len(c) == 0 {
		c = defaultConsonants
	}
	return v, c
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

// tokenize splits an environment string into matcher tokens. classNames is
// the class-name list already sorted longest-first (precomputed once on the
// Engine), and classes maps each name to its (longest-first) members; at each
// position we try to match the longest defined class name before falling
// back to the built-in V/C/#/. tokens or a literal rune. Nil classNames/
// classes make this behave exactly as it did before user classes existed.
func tokenize(env string, classNames []string, classes map[string][][]rune) []token {
	runes := []rune(env)
	var toks []token
	for i := 0; i < len(runes); {
		// classNames is sorted longest-first, so the first name that is a
		// rune-prefix here is the longest match. Two distinct class names
		// cannot both match at this position with equal rune length — the
		// substring of a given length at a given offset is unique — so map
		// iteration order (and thus tie-break stability) is not
		// load-bearing: tokenization is deterministic regardless.
		if name, n := matchLongestClassName(runes, i, classNames); n > 0 {
			toks = append(toks, token{kind: tokClass, class: classes[name]})
			i += n
			continue
		}
		switch runes[i] {
		case '#':
			toks = append(toks, token{kind: tokBoundary})
		case 'V':
			toks = append(toks, token{kind: tokVowel})
		case 'C':
			toks = append(toks, token{kind: tokConsonant})
		case '.':
			toks = append(toks, token{kind: tokAny})
		default:
			toks = append(toks, token{kind: tokLiteral, lit: []rune{runes[i]}})
		}
		i++
	}
	return toks
}

// sortedClassNames returns the class names sorted longest-first (by rune
// count), so a name that is a prefix of another (e.g. "K" vs "KW") never
// shadows the longer match.
func sortedClassNames(classes map[string][][]rune) []string {
	if len(classes) == 0 {
		return nil
	}
	names := make([]string, 0, len(classes))
	for name := range classes {
		names = append(names, name)
	}
	sort.SliceStable(names, func(i, j int) bool {
		return len([]rune(names[i])) > len([]rune(names[j]))
	})
	return names
}

// matchLongestClassName returns the first (longest, by construction of
// names) class name that is a rune-prefix of runes[p:], and its rune length.
// Returns ("", 0) if none matches.
func matchLongestClassName(runes []rune, p int, names []string) (string, int) {
	for _, name := range names {
		nameRunes := []rune(name)
		if p+len(nameRunes) <= len(runes) && equalRunes(runes[p:p+len(nameRunes)], nameRunes) {
			return name, len(nameRunes)
		}
	}
	return "", 0
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
		case tokClass:
			n := matchPrefixClass(runes, p, t.class)
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
		case tokClass:
			n := matchSuffixClass(runes, end, t.class)
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
//
// If r.Target names a registered user class, any one member of that class
// matches at the target position (longest member first), and the whole
// matched member is replaced by r.Replacement — the class acts as a
// whole-word target, not just an environment token. Otherwise r.Target is
// matched literally, exactly as before user classes existed.
func (e *Engine) ApplyRule(word string, r Rule) string {
	if !r.Enabled || r.Target == "" {
		return word
	}
	runes := []rune(word)
	left := tokenize(r.LeftEnv, e.userClassNames, e.userClasses)
	right := tokenize(r.RightEnv, e.userClassNames, e.userClasses)
	repl := []rune(r.Replacement)

	targetClass, isClassTarget := e.userClasses[r.Target]
	target := []rune(r.Target)

	var out []rune
	i := 0
	for i < len(runes) {
		var matchLen int
		if isClassTarget {
			matchLen = matchPrefixClass(runes, i, targetClass)
		} else if i+len(target) <= len(runes) && equalRunes(runes[i:i+len(target)], target) {
			matchLen = len(target)
		} else {
			matchLen = -1
		}

		if matchLen >= 0 &&
			e.leftMatch(runes, i, left) &&
			e.rightMatch(runes, i+matchLen, right) {
			out = append(out, repl...)
			i += matchLen
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

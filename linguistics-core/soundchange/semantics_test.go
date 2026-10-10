package soundchange

import (
	"strings"
	"testing"
	"time"
)

// These tests pin the engine to the semantics of the server's TypeScript
// engine (lib/utils/sound-change.ts), which the browser preview must
// reproduce exactly. The parity proof against the TypeScript code itself is
// lib/linguistics/__tests__/sound-change-wasm-parity.test.ts.

// applyText parses one rule line (classes allowed, via Parse) and applies the
// program with the given inventories.
func applyText(t *testing.T, vowels, consonants []string, text, word string) string {
	t.Helper()
	prog := Parse(text)
	if len(prog.Rules) == 0 {
		t.Fatalf("no rule parsed from %q", text)
	}
	return NewEngineOrDefaultWithClasses(vowels, consonants, prog.Classes).ApplyPipeline(word, prog.Rules).Changed
}

// The E2E repro: with vowels {a, aa}, `_VVb` must find the split a|a|b even
// though the longest vowel at the first slot ("aa") leaves no room for the
// second. Environments are conditions that hold if ANY split matches.
func TestEnvironmentClassesConsiderEverySplit(t *testing.T) {
	vowels := []string{"a", "aa"}
	cases := []struct{ rule, word, want string }{
		{"a → e / _VVb", "aaab", "eaab"},
		{"a → e / bVV_", "baaa", "baae"},
		{"a → e / _VV#", "aaa", "eaa"},
		{"a → e / #VV_", "aaa", "aae"},
	}
	for _, c := range cases {
		if got := applyText(t, vowels, []string{"b"}, c.rule, c.word); got != c.want {
			t.Errorf("%q on %q = %q, want %q", c.rule, c.word, got, c.want)
		}
	}

	// The same holds for user classes whose members share a prefix.
	if got := applyText(t, nil, nil, "class Z = z zz\na → e / _ZZb", "azzb"); got != "ezzb" {
		t.Errorf("class environment: got %q, want %q", got, "ezzb")
	}
}

// The target tries its alternatives longest-first and takes the first one
// whose contexts hold, so a shorter member can win where the longer fails.
func TestTargetTakesFirstAlternativeWhoseContextsHold(t *testing.T) {
	cases := []struct{ text, word, want string }{
		{"class Z = z zz\nZ → x / _z", "zzz", "xz"},
		{"class Z = z zz\nZ → x / _zb", "zzb", "xzb"},
		{"class Z = z zz\nZ → x", "zzz", "xx"},
	}
	for _, c := range cases {
		if got := applyText(t, nil, nil, c.text, c.word); got != c.want {
			t.Errorf("%q on %q = %q, want %q", c.text, c.word, got, c.want)
		}
	}
}

// Shared-prefix classes used to make the regex engine backtrack
// exponentially; the position-set matcher must stay linear in the word length
// times the environment length.
func TestSharedPrefixEnvironmentsStayLinear(t *testing.T) {
	e := NewEngine([]string{"a", "aa"}, []string{"b"})
	word := strings.Repeat("a", 2000)
	right := Rule{Raw: "r", Target: "a", Replacement: "e", RightEnv: strings.Repeat("V", 30) + "b", Enabled: true}
	left := Rule{Raw: "l", Target: "a", Replacement: "e", LeftEnv: "b" + strings.Repeat("V", 30), Enabled: true}

	started := time.Now()
	if got := e.ApplyRule(word, right); got != word {
		t.Errorf("right environment changed a word without b")
	}
	if got := e.ApplyRule(word, left); got != word {
		t.Errorf("left environment changed a word without b")
	}
	want := "b" + strings.Repeat("a", 30) + strings.Repeat("e", 30)
	if got := e.ApplyRule("b"+strings.Repeat("a", 60), left); got != want {
		t.Errorf("left environment: got %q, want %q", got, want)
	}
	if elapsed := time.Since(started); elapsed > 500*time.Millisecond {
		t.Errorf("adversarial environments took %v, want linear time", elapsed)
	}
}

// `#` anywhere in an environment anchors the whole environment to the word
// edge (it is a flag, not a position), exactly like the TypeScript engine.
func TestBoundaryAnywhereAnchorsTheEnvironment(t *testing.T) {
	cases := []struct{ rule, word, want string }{
		{"a → e / _#b", "ab", "eb"},
		{"a → e / _#b", "abb", "abb"},
		{"a → e / b#_", "ba", "be"},
		{"a → e / b#_", "bba", "bba"},
	}
	for _, c := range cases {
		if got := run(t, c.rule, c.word); got != c.want {
			t.Errorf("%q on %q = %q, want %q", c.rule, c.word, got, c.want)
		}
	}
}

// An environment that is exactly "_" (e.g. the right side of `x__`) is no
// condition at all; any other "_" is a literal underscore.
func TestUnderscoreOnlyEnvironmentIsEmpty(t *testing.T) {
	if got := run(t, "a → e / x__", "xab"); got != "xeb" {
		t.Errorf("got %q, want %q", got, "xeb")
	}
	if got := run(t, "a → e / _b_", "ab_a"); got != "eb_a" {
		t.Errorf("got %q, want %q", got, "eb_a")
	}
}

// `.` is one UTF-16 unit (JavaScript's `.` without the u flag), so it covers
// half of an astral character, and it never matches a line terminator.
func TestDotIsOneUTF16UnitExceptLineTerminators(t *testing.T) {
	cases := []struct{ rule, word, want string }{
		{"b → x / ._", "😀b", "😀x"},
		{"b → x / .._", "😀b", "😀x"},
		{"b → x / ..._", "😀b", "😀b"},
		{"a → x / _.b", "a😀b", "a😀b"},
		{"a → x / _..b", "a😀b", "x😀b"},
		{"a → e / _.", "ab", "eb"},
		{"a → e / _.", "a\n", "a\n"},
		{"a → e / _.", "a\r", "a\r"},
		{"a → e / _.", "a\u2028", "a\u2028"},
		{"a → e / _.", "a\u2029", "a\u2029"},
		{"a → e / _.", "a\u0301", "e\u0301"},
		{"😀 → x / _#", "a😀", "ax"},
		{"a → 𝔞", "bab", "b𝔞b"},
	}
	for _, c := range cases {
		if got := run(t, c.rule, c.word); got != c.want {
			t.Errorf("%q on %q = %q, want %q", c.rule, c.word, got, c.want)
		}
	}
}

// Replacements expand `$&`, "$`", `$'` and `$$` like String#replace; with no
// capture groups, `$1` and `$<x>` stay literal.
func TestReplacementPatternsExpandLikeStringReplace(t *testing.T) {
	cases := []struct{ rule, want string }{
		{"a → [$&]", "x[a]y"},
		{"a → $$", "x$y"},
		{"a → $`", "xxy"},
		{"a → $'", "xyy"},
		{"a → $1", "x$1y"},
		{"a → $0", "x$0y"},
		{"a → $<x>", "x$<x>y"},
		{"a → $", "x$y"},
		{"a → $$&", "x$&y"},
		{"a → $&$&", "xaay"},
		{"a → <$`|$&|$'>", "x<x|a|y>y"},
	}
	for _, c := range cases {
		if got := run(t, c.rule, "xay"); got != c.want {
			t.Errorf("%q on xay = %q, want %q", c.rule, got, c.want)
		}
	}
	// Prefix/suffix are taken from the original word, not the rewritten one.
	if got := run(t, "a → $`", "aba"); got != "bab" {
		t.Errorf("$` on aba = %q, want %q", got, "bab")
	}
}

// A provided inventory with no non-empty member matches the empty string (the
// TypeScript engine's `(?:)`), while a nil inventory selects the default set.
func TestInventoryDefaultingAndEmptyInventories(t *testing.T) {
	if got := applyText(t, []string{}, []string{"t"}, "t → d / V_V", "tt"); got != "dd" {
		t.Errorf("empty vowel inventory: got %q, want %q", got, "dd")
	}
	if got := applyText(t, []string{""}, []string{"t"}, "t → d / V_V", "tt"); got != "dd" {
		t.Errorf("all-empty vowel inventory: got %q, want %q", got, "dd")
	}
	if got := applyText(t, nil, nil, "t → d / V_V", "tt"); got != "tt" {
		t.Errorf("default vowel inventory: got %q, want %q", got, "tt")
	}
	if got := applyText(t, nil, nil, "t → d / V_V", "ata"); got != "ada" {
		t.Errorf("default vowel inventory: got %q, want %q", got, "ada")
	}
}

// ParseRule follows the TypeScript regex /^(.+?)(?:→|[=–—-]+>|>)(.+)$/ and
// String#trim exactly, so the preview parses the same rules the server does.
func TestParseRuleFollowsTheTypeScriptParser(t *testing.T) {
	cases := []struct {
		line                       string
		ok                         bool
		raw, target, repl, le, rie string
	}{
		{line: "a->", ok: false},
		{line: "a→", ok: false},
		{line: "a → ", ok: false},
		{line: "->b", ok: true, raw: "->b", target: "-", repl: "b"},
		{line: "a-->b", ok: true, raw: "a-->b", target: "a", repl: "b"},
		{line: "a>b>c", ok: true, raw: "a>b>c", target: "a", repl: "b>c"},
		{line: "a->->b", ok: true, raw: "a->->b", target: "a", repl: "->b"},
		{line: "a\u2028→b", ok: false},
		{line: "a → b\rc", ok: false},
		{line: "\uFEFFa → b / c_d\uFEFF", ok: true, raw: "a → b / c_d", target: "a", repl: "b", le: "c", rie: "d"},
		{line: "\u0085a → b\u0085", ok: true, raw: "\u0085a → b\u0085", target: "\u0085a", repl: "b\u0085"},
		{line: "\u00A0a\u3000→\u2003b\u202F", ok: true, raw: "a\u3000→\u2003b", target: "a", repl: "b"},
		{line: "a → b / c _ d / e", ok: true, raw: "a → b / c _ d / e", target: "a", repl: "b", le: "c", rie: "d / e"},
		{line: "a → b / cd", ok: true, raw: "a → b / cd", target: "a", repl: "b"},
		{line: "a → ∅ / _#", ok: true, raw: "a → ∅ / _#", target: "a", repl: "", rie: "#"},
	}
	for _, c := range cases {
		r, ok := ParseRule(c.line)
		if ok != c.ok {
			t.Errorf("ParseRule(%q) ok = %v, want %v (%+v)", c.line, ok, c.ok, r)
			continue
		}
		if !ok {
			continue
		}
		if r.Raw != c.raw || r.Target != c.target || r.Replacement != c.repl || r.LeftEnv != c.le || r.RightEnv != c.rie {
			t.Errorf("ParseRule(%q) = %+v, want raw=%q target=%q repl=%q left=%q right=%q",
				c.line, r, c.raw, c.target, c.repl, c.le, c.rie)
		}
	}
}

// Class members split on JavaScript's \s (which includes U+FEFF and U+3000
// but not U+0085) and are de-duplicated like the TypeScript Set.
func TestParseClassLineFollowsTheTypeScriptParser(t *testing.T) {
	cases := []struct {
		line    string
		members []string
	}{
		{"class K = a\uFEFFb", []string{"a", "b"}},
		{"class K = a\u3000b", []string{"a", "b"}},
		{"class K = a\u0085b", []string{"a\u0085b"}},
		{"class K = p t p k t", []string{"p", "t", "k"}},
	}
	for _, c := range cases {
		_, members, ok := parseClassLine(c.line)
		if !ok {
			t.Errorf("parseClassLine(%q) rejected", c.line)
			continue
		}
		if strings.Join(members, "|") != strings.Join(c.members, "|") {
			t.Errorf("parseClassLine(%q) members = %q, want %q", c.line, members, c.members)
		}
	}
}

// A rule that rewrites a match to identical text leaves the word unchanged
// and is not reported as applied (TypeScript compares the strings).
func TestIdentityRewriteIsNotReported(t *testing.T) {
	res := DefaultEngine().ApplyPipeline("bab", ParseRules("a → $&\na → a\nb → p"))
	if res.Changed != "pap" {
		t.Errorf("changed = %q, want %q", res.Changed, "pap")
	}
	if strings.Join(res.RulesApplied, "|") != "b → p" {
		t.Errorf("rulesApplied = %q, want [b → p]", res.RulesApplied)
	}
}

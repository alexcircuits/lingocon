package soundchange

import (
	"reflect"
	"testing"
)

func TestParseClassLine(t *testing.T) {
	cases := []struct {
		name        string
		line        string
		wantName    string
		wantMembers []string
		wantOK      bool
	}{
		{
			name:        "happy path",
			line:        "class K = p t k",
			wantName:    "K",
			wantMembers: []string{"p", "t", "k"},
			wantOK:      true,
		},
		{
			name:        "whitespace tolerance",
			line:        "  class   K   =   p   t   k  ",
			wantName:    "K",
			wantMembers: []string{"p", "t", "k"},
			wantOK:      true,
		},
		{
			name:        "multi-rune members",
			line:        "class S = tʃ s",
			wantName:    "S",
			wantMembers: []string{"tʃ", "s"},
			wantOK:      true,
		},
		{
			name:   "empty name rejected",
			line:   "class = x",
			wantOK: false,
		},
		{
			name:   "no equals rejected",
			line:   "class K",
			wantOK: false,
		},
		{
			name:   "no members rejected",
			line:   "class K =",
			wantOK: false,
		},
		{
			name:   "no members whitespace only rejected",
			line:   "class K =    ",
			wantOK: false,
		},
		{
			name:   "not a class line",
			line:   "a → e / _#",
			wantOK: false,
		},
		{
			name:   "name with whitespace rejected",
			line:   "class K L = p t",
			wantOK: false,
		},
		{
			name:   "name with digits rejected (letters only)",
			line:   "class K1 = p t",
			wantOK: false,
		},
		{
			name:   "blank line rejected",
			line:   "   ",
			wantOK: false,
		},
		{
			name:   "word starting with class but not a class def",
			line:   "classify = x",
			wantOK: false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			name, members, ok := parseClassLine(c.line)
			if ok != c.wantOK {
				t.Fatalf("parseClassLine(%q) ok = %v, want %v", c.line, ok, c.wantOK)
			}
			if !ok {
				return
			}
			if name != c.wantName {
				t.Errorf("parseClassLine(%q) name = %q, want %q", c.line, name, c.wantName)
			}
			if !reflect.DeepEqual(members, c.wantMembers) {
				t.Errorf("parseClassLine(%q) members = %v, want %v", c.line, members, c.wantMembers)
			}
		})
	}
}

// TestReservedClassNames asserts that V and C — the built-in vowel/consonant
// classes — cannot be shadowed by a user definition. `class V = ...` and
// `class C = ...` are rejected by parseClassLine and dropped by Parse, exactly
// as the canonical TS engine does, so identical input yields identical
// behavior across both engines.
func TestReservedClassNames(t *testing.T) {
	for _, line := range []string{
		"class V = a i u",
		"class C = p t k",
	} {
		if _, _, ok := parseClassLine(line); ok {
			t.Errorf("parseClassLine(%q) accepted a reserved class name, want rejected", line)
		}
	}

	// Parse must drop reserved-name definitions entirely: they land in
	// neither Classes (reserved) nor Rules (they are not rules).
	prog := Parse("class V = a i u\nclass C = p t k\na → e / _#")
	if len(prog.Classes) != 0 {
		t.Errorf("Parse Classes = %v, want empty (V/C reserved)", prog.Classes)
	}
	wantRules := ParseRules("a → e / _#")
	if !reflect.DeepEqual(prog.Rules, wantRules) {
		t.Errorf("Parse Rules = %+v, want %+v", prog.Rules, wantRules)
	}
}

func TestParse(t *testing.T) {
	text := `
class K = p t k
// a comment
class S = tʃ s
a → e / _#
K → h
`
	prog := Parse(text)

	wantClasses := map[string][]string{
		"K": {"p", "t", "k"},
		"S": {"tʃ", "s"},
	}
	if !reflect.DeepEqual(prog.Classes, wantClasses) {
		t.Errorf("Classes = %v, want %v", prog.Classes, wantClasses)
	}

	wantRules := ParseRules("a → e / _#\nK → h")
	if !reflect.DeepEqual(prog.Rules, wantRules) {
		t.Errorf("Rules = %+v, want %+v", prog.Rules, wantRules)
	}
}

func TestParseDuplicateClassLastWins(t *testing.T) {
	text := `
class K = p t
class K = k g
`
	prog := Parse(text)
	want := map[string][]string{"K": {"k", "g"}}
	if !reflect.DeepEqual(prog.Classes, want) {
		t.Errorf("Classes = %v, want %v (last definition should win)", prog.Classes, want)
	}
}

// TestParseBackwardCompatWithParseRules proves that for any class-free text,
// Parse(text).Rules is byte-identical to the existing ParseRules(text) path.
func TestParseBackwardCompatWithParseRules(t *testing.T) {
	texts := []string{
		"a → e",
		"k → tʃ / _i",
		"a → e / _#\nb → p / #_",
		"// comment\n\na → e\n# comment\nb → p",
		"s → ∅ / V_V\na → e / V_\na → e / _a",
		"",
		"   \n// only comments\n# nope\n",
	}
	for _, text := range texts {
		old := ParseRules(text)
		got := Parse(text).Rules
		if !reflect.DeepEqual(old, got) {
			t.Errorf("Parse(%q).Rules = %+v, want %+v (ParseRules)", text, got, old)
		}
	}
}

// runWithClasses parses a single rule and applies it with an engine built via
// NewEngineWithClasses (nil vowels/consonants — these tests only exercise the
// user-defined class machinery).
func runWithClasses(t *testing.T, classes map[string][]string, ruleText, word string) string {
	t.Helper()
	r, ok := ParseRule(ruleText)
	if !ok {
		t.Fatalf("failed to parse rule: %q", ruleText)
	}
	e := NewEngineWithClasses(nil, nil, classes)
	return e.ApplyRule(word, r)
}

func TestClassInLeftEnvironment(t *testing.T) {
	classes := map[string][]string{"K": {"p", "t", "k"}}
	// "apa": second `a` is preceded by `p` (a K member) -> raised to e.
	// First `a` has no left context at all -> unchanged.
	if got := runWithClasses(t, classes, "a → e / K_", "apa"); got != "ape" {
		t.Errorf("a -> e / K_ on apa = %q, want %q", got, "ape")
	}
	// "asa": `a` preceded by `s`, which is NOT a K member -> unchanged.
	if got := runWithClasses(t, classes, "a → e / K_", "asa"); got != "asa" {
		t.Errorf("a -> e / K_ on asa = %q, want %q (s is not in K)", got, "asa")
	}
}

func TestClassInRightEnvironment(t *testing.T) {
	classes := map[string][]string{"K": {"p", "t", "k"}}
	// "atapa": both `a`s followed by a K member (t, p) are raised; the final
	// `a` (followed by nothing) is not.
	if got := runWithClasses(t, classes, "a → e / _K", "atapa"); got != "etepa" {
		t.Errorf("a -> e / _K on atapa = %q, want %q", got, "etepa")
	}
	// "asa": `a` followed by `s`, which is NOT a K member -> unchanged.
	if got := runWithClasses(t, classes, "a → e / _K", "asa"); got != "asa" {
		t.Errorf("a -> e / _K on asa = %q, want %q (s is not in K)", got, "asa")
	}
}

func TestClassMultiRuneMember(t *testing.T) {
	classes := map[string][]string{"S": {"tʃ", "s"}}
	// "tʃa": `a` preceded by the multi-rune member "tʃ" -> raised.
	if got := runWithClasses(t, classes, "a → e / S_", "tʃa"); got != "tʃe" {
		t.Errorf("a -> e / S_ on tʃa = %q, want %q", got, "tʃe")
	}
	// "sa": `a` preceded by the single-rune member "s" -> also raised.
	if got := runWithClasses(t, classes, "a → e / S_", "sa"); got != "se" {
		t.Errorf("a -> e / S_ on sa = %q, want %q", got, "se")
	}
	// "xa": `a` preceded by "x", not an S member -> unchanged.
	if got := runWithClasses(t, classes, "a → e / S_", "xa"); got != "xa" {
		t.Errorf("a -> e / S_ on xa = %q, want %q", got, "xa")
	}
}

func TestClassNameLongestMatchFirst(t *testing.T) {
	// "K" is a prefix of "KW". An env of "KW_" must resolve to the single
	// class name KW, not the class K followed by a literal "W".
	classes := map[string][]string{
		"K":  {"p", "t"},
		"KW": {"kʷ", "gʷ"},
	}
	// "a" preceded by "kʷ" (a KW member, matched via the KW class): raised.
	if got := runWithClasses(t, classes, "a → e / KW_", "kʷa"); got != "kʷe" {
		t.Errorf("a -> e / KW_ on kʷa = %q, want %q", got, "kʷe")
	}
	// "a" preceded by "p" (a K member, NOT a KW member): unchanged, proving
	// the tokenizer read "KW" as one class token and not "K" + literal "W".
	if got := runWithClasses(t, classes, "a → e / KW_", "pa"); got != "pa" {
		t.Errorf("a -> e / KW_ on pa = %q, want %q (p is only in K, not KW)", got, "pa")
	}
	// Conversely, the standalone class K still resolves correctly on its own.
	if got := runWithClasses(t, classes, "a → e / K_", "pa"); got != "pe" {
		t.Errorf("a -> e / K_ on pa = %q, want %q", got, "pe")
	}
}

func TestClassAsTargetWithDeletion(t *testing.T) {
	classes := map[string][]string{"K": {"p", "t", "k"}}
	// Final p/t/k deleted.
	if got := runWithClasses(t, classes, "K → ∅ / _#", "tap"); got != "ta" {
		t.Errorf("K -> ∅ / _# on tap = %q, want %q", got, "ta")
	}
	// Final consonant is "s", not a K member -> unchanged.
	if got := runWithClasses(t, classes, "K → ∅ / _#", "kass"); got != "kass" {
		t.Errorf("K -> ∅ / _# on kass = %q, want %q (final s is not in K)", got, "kass")
	}
}

func TestClassAsTargetMapsAnyMember(t *testing.T) {
	classes := map[string][]string{"K": {"p", "t", "k"}}
	// Any of p/t/k maps to h, wherever it occurs.
	if got := runWithClasses(t, classes, "K → h", "tapak"); got != "hahah" {
		t.Errorf("K -> h on tapak = %q, want %q", got, "hahah")
	}
}

func TestLiteralTargetStillWorksWithClassesRegistered(t *testing.T) {
	classes := map[string][]string{"K": {"p", "t", "k"}}
	// "t" is a literal target here (rule target is "t", not the class name
	// "K"), so only literal t is affected even though classes are registered.
	if got := runWithClasses(t, classes, "t → d", "tapak"); got != "dapak" {
		t.Errorf("t -> d on tapak = %q, want %q", got, "dapak")
	}
}

func TestClassTargetComposedWithClassEnvironment(t *testing.T) {
	// Two distinct user classes: K is the rule target, N is used in the
	// environment. N is a non-reserved name (V and C are reserved for the
	// built-in vowel/consonant classes and cannot be user-defined).
	classes := map[string][]string{
		"K": {"p", "t", "k"},
		"N": {"a", "i"},
	}
	// Any K member between two N-class members becomes h.
	if got := runWithClasses(t, classes, "K → h / N_N", "apa"); got != "aha" {
		t.Errorf("K -> h / N_N on apa = %q, want %q", got, "aha")
	}
	// K member at word edge (no left N) is not replaced.
	if got := runWithClasses(t, classes, "K → h / N_N", "pa"); got != "pa" {
		t.Errorf("K -> h / N_N on pa = %q, want %q (p has no left N)", got, "pa")
	}
}

func TestNewEngineWithClassesNilIsBackwardCompatible(t *testing.T) {
	// An engine built with nil classes must behave exactly like the
	// equivalent NewEngine (no user classes registered).
	vowels := []string{"a", "e", "i", "o", "u"}
	consonants := []string{"t", "d"}
	withClasses := NewEngineWithClasses(vowels, consonants, nil)
	plain := NewEngine(vowels, consonants)
	r, _ := ParseRule("t → d / V_V")
	if got, want := withClasses.ApplyRule("atu", r), plain.ApplyRule("atu", r); got != want {
		t.Errorf("NewEngineWithClasses(v,c,nil) diverges from NewEngine(v,c): got %q, want %q", got, want)
	}
}

// TestCrossEngineParityGoldenCases pins the Go engine to the SAME
// input→output golden tables the canonical TS engine is tested against, so
// the two engines are proven to agree. It exercises the full whole-program
// path the WASM bindings use: Parse (splitting class defs from rules) +
// NewEngineOrDefaultWithClasses + ApplyPipeline. Any divergence here means
// the browser-preview WASM engine and the server-side TS engine would produce
// different results on identical input.
func TestCrossEngineParityGoldenCases(t *testing.T) {
	// Class-as-target with word-final deletion. Mirrors the TS derive-forms
	// test: soundChangeRules "class K = p t k\nK → ∅ / _#".
	t.Run("class-target-final-deletion", func(t *testing.T) {
		prog := Parse("class K = p t k\nK → ∅ / _#")
		e := NewEngineOrDefaultWithClasses(nil, nil, prog.Classes)
		cases := []struct{ word, want string }{
			{"kat", "ka"},
			{"tap", "ta"},
			{"sak", "sa"},
		}
		for _, c := range cases {
			if got := e.ApplyPipeline(c.word, prog.Rules).Changed; got != c.want {
				t.Errorf("K → ∅ / _# on %q = %q, want %q", c.word, got, c.want)
			}
		}
	})

	// Class in the RIGHT environment. Mirrors the TS sound-change test:
	// rule "a → e / _K" with class K = {p, t, k}.
	t.Run("class-right-environment", func(t *testing.T) {
		prog := Parse("class K = p t k\na → e / _K")
		e := NewEngineOrDefaultWithClasses(nil, nil, prog.Classes)
		cases := []struct{ word, want string }{
			{"atapa", "etepa"}, // both a's before a K member (t, p) raise
			{"asa", "asa"},     // a before s (not a K member) -> unchanged
		}
		for _, c := range cases {
			if got := e.ApplyPipeline(c.word, prog.Rules).Changed; got != c.want {
				t.Errorf("a → e / _K on %q = %q, want %q", c.word, got, c.want)
			}
		}
	})
}

// TestNewEngineOrDefaultWithClasses confirms the constructor both defaults the
// inventories (like NewEngineOrDefault) and registers classes (like
// NewEngineWithClasses) — the exact combination the WASM bindings rely on.
func TestNewEngineOrDefaultWithClasses(t *testing.T) {
	classes := map[string][]string{"K": {"p", "t", "k"}}

	// nil inventories must be defaulted: a V-token rule fires against the
	// built-in vowel set (default 'a' is a vowel), and the K class works.
	withClasses := NewEngineOrDefaultWithClasses(nil, nil, classes)
	defaulted := NewEngineOrDefault(nil, nil)

	// V/C behavior must be identical to NewEngineOrDefault for a class-free rule.
	rVC, _ := ParseRule("t → d / V_V")
	if got, want := withClasses.ApplyRule("ata", rVC), defaulted.ApplyRule("ata", rVC); got != want {
		t.Errorf("defaulting diverges from NewEngineOrDefault: got %q, want %q", got, want)
	}

	// The registered class must be honored as a target.
	rK, _ := ParseRule("K → h")
	if got := withClasses.ApplyRule("tapak", rK); got != "hahah" {
		t.Errorf("K → h on tapak = %q, want %q", got, "hahah")
	}

	// An empty/nil classes map is a no-op: behaves like NewEngineOrDefault.
	noClasses := NewEngineOrDefaultWithClasses(nil, nil, nil)
	if got, want := noClasses.ApplyRule("ata", rVC), defaulted.ApplyRule("ata", rVC); got != want {
		t.Errorf("nil classes should behave like NewEngineOrDefault: got %q, want %q", got, want)
	}
}

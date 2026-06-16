package soundchange

import (
	"reflect"
	"testing"
)

// run parses a single rule and applies it with the default engine.
func run(t *testing.T, ruleText, word string) string {
	t.Helper()
	r, ok := ParseRule(ruleText)
	if !ok {
		t.Fatalf("failed to parse rule: %q", ruleText)
	}
	return DefaultEngine().ApplyRule(word, r)
}

func TestParseRule(t *testing.T) {
	r, ok := ParseRule("k → tʃ / _i")
	if !ok {
		t.Fatal("expected rule to parse")
	}
	if r.Target != "k" || r.Replacement != "tʃ" || r.LeftEnv != "" || r.RightEnv != "i" {
		t.Fatalf("unexpected parse: %+v", r)
	}

	for _, del := range []string{"s → ∅ / V_V", "s → 0 / V_V", "s → Ø / V_V"} {
		r, _ := ParseRule(del)
		if r.Replacement != "" {
			t.Fatalf("%q: expected empty replacement, got %q", del, r.Replacement)
		}
	}

	for _, arrow := range []string{"a > e", "a -> e", "a → e"} {
		r, _ := ParseRule(arrow)
		if r.Replacement != "e" {
			t.Fatalf("%q: expected replacement e, got %q", arrow, r.Replacement)
		}
	}

	for _, skip := range []string{"// comment", "# comment", "   "} {
		if _, ok := ParseRule(skip); ok {
			t.Fatalf("expected %q to be skipped", skip)
		}
	}
}

func TestBasicContexts(t *testing.T) {
	cases := []struct{ rule, word, want string }{
		{"a → e", "banana", "benene"},
		{"k → tʃ / _i", "kaki", "katʃi"},
		{"a → e / _#", "saga", "sage"},
		{"b → p / #_", "baba", "paba"},
	}
	for _, c := range cases {
		if got := run(t, c.rule, c.word); got != c.want {
			t.Errorf("%q on %q = %q, want %q", c.rule, c.word, got, c.want)
		}
	}
}

// The core regression: adjacent/overlapping environments must all fire.
func TestAdjacentEnvironments(t *testing.T) {
	cases := []struct{ rule, word, want string }{
		{"s → ∅ / V_V", "asasa", "aaa"}, // both intervocalic s deleted
		{"a → e / V_", "aaa", "aee"},    // shared left context
		{"a → e / _a", "aaa", "eea"},    // shared right context
	}
	for _, c := range cases {
		if got := run(t, c.rule, c.word); got != c.want {
			t.Errorf("%q on %q = %q, want %q", c.rule, c.word, got, c.want)
		}
	}
}

func TestPhonemeClasses(t *testing.T) {
	cases := []struct{ rule, word, want string }{
		{"t → d / V_V", "atu", "adu"},
		{"t → d / V_V", "ata", "ada"},
		{"t → d / V_V", "stk", "stk"}, // not intervocalic → unchanged
	}
	for _, c := range cases {
		if got := run(t, c.rule, c.word); got != c.want {
			t.Errorf("%q on %q = %q, want %q", c.rule, c.word, got, c.want)
		}
	}
}

func TestMultiRunePhonemes(t *testing.T) {
	// "tʃ" is a single consonant phoneme; "aː" a single (long) vowel.
	if got := run(t, "tʃ → ʃ / V_V", "atʃa"); got != "aʃa" {
		t.Errorf("got %q, want %q", got, "aʃa")
	}
}

func TestPipelineAndBatch(t *testing.T) {
	e := DefaultEngine()

	res := e.ApplyPipeline("kaki", ParseRules("k → tʃ / _i\na → e / _#"))
	if res.Changed != "katʃi" {
		t.Errorf("pipeline changed = %q, want %q", res.Changed, "katʃi")
	}
	if !reflect.DeepEqual(res.RulesApplied, []string{"k → tʃ / _i"}) {
		t.Errorf("rulesApplied = %v, want [k → tʃ / _i]", res.RulesApplied)
	}

	out := e.BatchApply([]string{"asasa", "isi", "sos"}, ParseRules("s → ∅ / V_V"))
	got := []string{out[0].Changed, out[1].Changed, out[2].Changed}
	want := []string{"aaa", "ii", "sos"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("batch = %v, want %v", got, want)
	}
}

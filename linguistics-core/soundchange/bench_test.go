package soundchange

import (
	"math/rand"
	"strings"
	"testing"
)

// BenchmarkApplyRuleWithClasses measures ApplyRule on an engine with several
// registered classes and a rule whose environment references one of them.
// This is the hot path where the sorted-class-name list was previously
// recomputed twice per ApplyRule call.
func BenchmarkApplyRuleWithClasses(b *testing.B) {
	classes := map[string][]string{
		"K":  {"p", "t", "k"},
		"G":  {"b", "d", "g"},
		"S":  {"s", "z", "ʃ"},
		"N":  {"m", "n", "ŋ"},
		"KW": {"kʷ", "gʷ"},
	}
	e := NewEngineWithClasses(defaultVowels, defaultConsonants, classes)
	r, ok := ParseRule("a → e / K_")
	if !ok {
		b.Fatal("failed to parse benchmark rule")
	}
	const word = "apatakapa"

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = e.ApplyRule(word, r)
	}
}

// BenchmarkSharedPrefixEnvironment is the adversarial case for a backtracking
// matcher: vowels {a, aa} (shared prefix), a right environment of 30 V then b,
// on a 2,000-letter word that never matches. Position sets keep it linear
// (word length × environment length).
func BenchmarkSharedPrefixEnvironment(b *testing.B) {
	e := NewEngine([]string{"a", "aa"}, []string{"b"})
	r := Rule{Raw: "r", Target: "a", Replacement: "e", RightEnv: strings.Repeat("V", 30) + "b", Enabled: true}
	word := strings.Repeat("a", 2000)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = e.ApplyRule(word, r)
	}
}

// The editor's real workload: one batchApply of 200 dictionary lemmas through
// a typical pipeline with the default inventory and a user class.
func BenchmarkBatchApplyPreview(b *testing.B) {
	prog := Parse(strings.Join([]string{
		"class K = p t k",
		"k → tʃ / _i",
		"a → e / _#",
		"s → ∅ / V_V",
		"t → d / V_V",
		"K → h / #_",
		"aː → a",
		"e → i / _C#",
		"n → m / _p",
	}, "\n"))
	e := NewEngineOrDefaultWithClasses(nil, nil, prog.Classes)
	rnd := rand.New(rand.NewSource(1))
	pieces := []string{"a", "e", "i", "o", "u", "aː", "p", "t", "k", "s", "n", "m", "tʃ", "l", "r"}
	words := make([]string, 200)
	for i := range words {
		var sb strings.Builder
		for n := 3 + rnd.Intn(6); n > 0; n-- {
			sb.WriteString(pieces[rnd.Intn(len(pieces))])
		}
		words[i] = sb.String()
	}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = e.BatchApply(words, prog.Rules)
	}
}

package soundchange

import (
	"math/rand"
	"strings"
	"testing"
)

// bruteMatches reports whether segs can be matched from p so that they end
// at end (end < 0: anywhere), by trying every alternative recursively — the
// exponential definition of "an environment holds if ANY split fits".
func bruteMatches(word []uint16, p int, segs []segment, end int) bool {
	if len(segs) == 0 {
		return end < 0 || p == end
	}
	for _, next := range segs[0].appendEnds(word, p, nil) {
		if bruteMatches(word, next, segs[1:], end) {
			return true
		}
	}
	return false
}

func bruteLeftOk(word []uint16, env environment, end int) bool {
	if env.boundary {
		return bruteMatches(word, 0, env.segments, end)
	}
	for start := 0; start <= end; start++ {
		if bruteMatches(word, start, env.segments, end) {
			return true
		}
	}
	return false
}

func bruteRightOk(word []uint16, env environment, start int) bool {
	if env.boundary {
		return bruteMatches(word, start, env.segments, len(word))
	}
	return bruteMatches(word, start, env.segments, -1)
}

// bruteApply is the scan of compiledRule.apply with brute-force contexts and
// without replacement expansion (covered by its own tests).
func bruteApply(word []uint16, c compiledRule) []uint16 {
	var out []uint16
	for p := 0; p < len(word); {
		end := -1
		for _, alt := range c.target.candidates(word[p]) {
			if hasPrefixAt(word, p, alt) && bruteLeftOk(word, c.left, p) && bruteRightOk(word, c.right, p+len(alt)) {
				end = p + len(alt)
				break
			}
		}
		if end < 0 {
			out = append(out, word[p])
			p++
			continue
		}
		out = append(out, c.replacement...)
		p = end
	}
	return out
}

func TestPositionSetsAgreeWithBruteForce(t *testing.T) {
	rnd := rand.New(rand.NewSource(20261010))
	pick := func(items []string) string { return items[rnd.Intn(len(items))] }
	text := func(pieces []string, max int) string {
		var b strings.Builder
		for n := rnd.Intn(max + 1); n > 0; n-- {
			b.WriteString(pick(pieces))
		}
		return b.String()
	}
	e := NewEngineWithClasses(
		[]string{"a", "aa", "aː", "e"},
		[]string{"t", "tʃ", "ʃ", "s", "😀"},
		map[string][]string{"Z": {"z", "zz", "zzz"}, "KW": {"kw", "k"}, "K": {"k", "g"}},
	)
	envPieces := []string{"V", "V", "C", "Z", "Z", "K", "KW", "#", ".", ".", "a", "z", "k", "w", "😀"}
	targets := []string{"a", "aa", "Z", "K", "KW", "z", "t", "😀"}
	wordPieces := []string{"a", "aa", "e", "t", "tʃ", "ʃ", "z", "zz", "k", "kw", "g", "w", "😀", "\n", "b"}

	env := func() string {
		if rnd.Intn(3) == 0 {
			return ""
		}
		return text(envPieces, 3)
	}

	changed := 0
	for n := 0; n < 20000; n++ {
		r := Rule{Raw: "r", Target: pick(targets), Replacement: "_", LeftEnv: env(), RightEnv: env(), Enabled: true}
		c, _ := e.compile(r)
		word := toUnits(text(wordPieces, 8))
		got, _ := c.apply(word)
		want := bruteApply(word, c)
		if !equalUnits(got, want) {
			t.Fatalf("rule %+v on %q: position sets give %q, brute force %q", r, fromUnits(word), fromUnits(got), fromUnits(want))
		}
		if !equalUnits(got, word) {
			changed++
		}
	}
	if changed < 2000 {
		t.Fatalf("generator too weak: only %d of 20000 cases changed the word", changed)
	}
}

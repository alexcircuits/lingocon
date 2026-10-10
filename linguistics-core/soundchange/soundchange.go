// Package soundchange is a phoneme-aware sound-change engine: it parses
// phonological rules (target → replacement / left _ right) and applies them to
// words.
//
// It is the browser preview's port of lib/utils/sound-change.ts, which is the
// reference: the server applies rules with the TypeScript engine, so this
// engine must produce exactly the same output for every input. That parity is
// proven by lib/linguistics/__tests__/sound-change-wasm-parity.test.ts, which
// runs the compiled WASM against the TypeScript engine on random programs.
//
// Semantics (all shared with the TypeScript engine):
//   - Environments are zero-width conditions on the ORIGINAL word that hold if
//     ANY way of matching them fits (V/C/user classes are alternatives, not
//     greedy tokens). They are computed as position sets, so matching stays
//     linear even when class members share prefixes ("a", "aa").
//   - `#` anywhere in an environment anchors it to the word edge; `.` is one
//     UTF-16 unit other than a line terminator; anything else is literal. An
//     environment that is exactly "_" is no condition.
//   - The target is a user class (if it has a non-empty member) or the literal
//     target text. At each position its alternatives are tried longest-first;
//     the first whose contexts hold wins; matches do not overlap.
//   - Replacements expand `$&`, "$`", `$'` and `$$` like String#replace.
//   - Text is handled as UTF-16 code units, as JavaScript does (see match.go).
//
// The one input the engines cannot agree on is a lone UTF-16 surrogate: it
// cannot exist in a Go (UTF-8) string, and the JS→Go boundary replaces it
// with U+FFFD. Real phoneme text never contains one.
package soundchange

import "sort"

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

// Engine holds the phoneme classes rules refer to: V, C and user classes.
type Engine struct {
	vowels     *alternatives
	consonants *alternatives
	// userClasses maps a class name to its alternatives; only classes with a
	// non-empty member are registered (others are read as literal text).
	userClasses map[string]*alternatives
	// classNames holds the registered names longest-first, computed once so
	// reading an environment never re-sorts them.
	classNames []namedClass
}

type namedClass struct {
	name []uint16
	alts *alternatives
}

// NewEngine builds an engine from explicit vowel/consonant inventories. An
// inventory with no non-empty member matches the empty string, exactly like
// an empty Set passed to the TypeScript engine.
func NewEngine(vowels, consonants []string) *Engine {
	return &Engine{
		vowels:     classAlternatives(vowels),
		consonants: classAlternatives(consonants),
	}
}

// NewEngineWithClasses builds an engine from explicit vowel/consonant
// inventories plus user-defined named sound classes (as parsed into
// Program.Classes).
func NewEngineWithClasses(vowels, consonants []string, classes map[string][]string) *Engine {
	return NewEngine(vowels, consonants).withClasses(classes)
}

// withClasses registers user classes on an already-built engine and returns
// it. A class with no non-empty member is skipped: as a target it falls back
// to literal text and in an environment its name is read as literal
// characters, as in the TypeScript engine (and a zero-length target could
// never advance the scan). An empty name is skipped too — it would match
// everywhere without consuming the environment text.
func (e *Engine) withClasses(classes map[string][]string) *Engine {
	if len(classes) == 0 {
		return e
	}
	e.userClasses = make(map[string]*alternatives, len(classes))
	for name, members := range classes {
		alts := classAlternatives(members)
		if name == "" || alts.matchesEmpty {
			continue
		}
		e.userClasses[name] = alts
		e.classNames = append(e.classNames, namedClass{name: toUnits(name), alts: alts})
	}
	// Longest name first so "KW" is read as one class rather than "K" + "W".
	// Two different names of equal length cannot both match at one position,
	// so the order among them (map order here) never matters.
	sort.SliceStable(e.classNames, func(i, j int) bool {
		return len(e.classNames[i].name) > len(e.classNames[j].name)
	})
	return e
}

// DefaultEngine uses the comprehensive default IPA inventory.
func DefaultEngine() *Engine {
	return NewEngine(defaultVowels, defaultConsonants)
}

// NewEngineOrDefault builds an engine where a nil inventory selects the
// default IPA set. A non-nil inventory is used as given, even when empty —
// mirroring the TypeScript engine, where only an omitted (undefined) argument
// defaults and an empty Set is a real, empty class.
func NewEngineOrDefault(vowels, consonants []string) *Engine {
	v, c := defaultedInventories(vowels, consonants)
	return NewEngine(v, c)
}

// NewEngineOrDefaultWithClasses defaults nil inventories exactly like
// NewEngineOrDefault and registers the given user-defined classes. This is
// the constructor the WASM bindings use.
func NewEngineOrDefaultWithClasses(vowels, consonants []string, classes map[string][]string) *Engine {
	v, c := defaultedInventories(vowels, consonants)
	return NewEngine(v, c).withClasses(classes)
}

// defaultedInventories replaces each nil inventory by its built-in set.
func defaultedInventories(vowels, consonants []string) (v, c []string) {
	v, c = vowels, consonants
	if v == nil {
		v = defaultVowels
	}
	if c == nil {
		c = defaultConsonants
	}
	return v, c
}

// environment reads an environment string into its segments: user class
// names (longest first), V, C, `#` (the boundary flag), `.`, and otherwise
// one literal UTF-16 unit.
func (e *Engine) environment(env string) environment {
	if env == "" || env == "_" {
		return environment{}
	}
	text := toUnits(env)
	var out environment
	for i := 0; i < len(text); {
		if alts, n := e.classAt(text, i); n > 0 {
			out.segments = append(out.segments, segment{alts: alts})
			i += n
			continue
		}
		switch text[i] {
		case '#':
			out.boundary = true
		case 'V':
			out.segments = append(out.segments, segment{alts: e.vowels})
		case 'C':
			out.segments = append(out.segments, segment{alts: e.consonants})
		case '.':
			out.segments = append(out.segments, segment{anyUnit: true})
		default:
			out.segments = append(out.segments, segment{alts: literalAlternatives(text[i : i+1])})
		}
		i++
	}
	return out
}

// classAt returns the longest registered class whose name starts at text[i],
// and the name's length in units (0 if none).
func (e *Engine) classAt(text []uint16, i int) (*alternatives, int) {
	for _, c := range e.classNames {
		if hasPrefixAt(text, i, c.name) {
			return c.alts, len(c.name)
		}
	}
	return nil, 0
}

// compile resolves a rule against the engine. ok is false for a rule that can
// never change a word (disabled, or with an empty target).
func (e *Engine) compile(r Rule) (compiledRule, bool) {
	if !r.Enabled || r.Target == "" {
		return compiledRule{}, false
	}
	target, isClass := e.userClasses[r.Target]
	if !isClass {
		target = literalAlternatives(toUnits(r.Target))
	}
	return compiledRule{
		raw:         r.Raw,
		left:        e.environment(r.LeftEnv),
		right:       e.environment(r.RightEnv),
		target:      target,
		replacement: toUnits(r.Replacement),
	}, true
}

// ApplyRule applies one rule to a word. Targets are consumed; environments
// are zero-width conditions on the original word.
func (e *Engine) ApplyRule(word string, r Rule) string {
	c, ok := e.compile(r)
	if !ok {
		return word
	}
	out, matched := c.apply(toUnits(word))
	if !matched {
		return word
	}
	return fromUnits(out)
}

// pipeline is a rule list compiled once and run on many words.
type pipeline []compiledRule

func (e *Engine) compilePipeline(rules []Rule) pipeline {
	p := make(pipeline, 0, len(rules))
	for _, r := range rules {
		if c, ok := e.compile(r); ok {
			p = append(p, c)
		}
	}
	return p
}

// run applies the rules in order, recording each one that changed the text
// (a rewrite to identical text does not count, as in the TypeScript engine).
func (p pipeline) run(word string) Result {
	current := toUnits(word)
	applied := []string{}
	for i := range p {
		next, matched := p[i].apply(current)
		if matched && !equalUnits(next, current) {
			applied = append(applied, p[i].raw)
			current = next
		}
	}
	changed := word
	if len(applied) > 0 {
		changed = fromUnits(current)
	}
	return Result{Original: word, Changed: changed, RulesApplied: applied}
}

// ApplyPipeline applies rules in order, recording which ones fired.
func (e *Engine) ApplyPipeline(word string, rules []Rule) Result {
	return e.compilePipeline(rules).run(word)
}

// BatchApply runs a pipeline over many words, compiling the rules once.
func (e *Engine) BatchApply(words []string, rules []Rule) []Result {
	p := e.compilePipeline(rules)
	out := make([]Result, len(words))
	for i, w := range words {
		out[i] = p.run(w)
	}
	return out
}

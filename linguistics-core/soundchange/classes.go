package soundchange

import "strings"

// Program is the parsed result of a rule-set source: user-defined named sound
// classes plus the ordered rules that reference them (or don't).
type Program struct {
	Classes map[string][]string
	Rules   []Rule
}

// Parse splits a rule-set source into class definitions and rules. Lines of
// the form `class NAME = m1 m2 m3` are collected into Classes (last
// definition wins on duplicate names); every other line is parsed with the
// existing ParseRule, exactly as ParseRules already does, so class-free text
// produces identical Rules to ParseRules.
func Parse(text string) Program {
	prog := Program{Classes: map[string][]string{}}
	for _, line := range strings.Split(text, "\n") {
		if name, members, ok := parseClassLine(line); ok {
			prog.Classes[name] = members
			continue
		}
		if r, ok := ParseRule(line); ok {
			prog.Rules = append(prog.Rules, r)
		}
	}
	return prog
}

// parseClassLine parses a single `class NAME = m1 m2 m3` definition line.
// Returns ok=false for anything else (including malformed class lines), so
// callers can fall through to ParseRule. Whitespace is JavaScript's (trim and
// \s, see parse.go) and members are de-duplicated in first-seen order, like
// the TypeScript engine's `new Set(members)`.
func parseClassLine(line string) (name string, members []string, ok bool) {
	trimmed := jsTrim(line)
	if trimmed == "" {
		return "", nil, false
	}

	const prefix = "class "
	if !strings.HasPrefix(trimmed, prefix) {
		return "", nil, false
	}
	rest := trimmed[len(prefix):]

	eq := strings.Index(rest, "=")
	if eq < 0 {
		return "", nil, false
	}

	rawName := jsTrim(rest[:eq])
	if rawName == "" || !isIdentifier(rawName) {
		return "", nil, false
	}

	// V and C are the built-in vowel/consonant classes and cannot be
	// shadowed by a user definition. Reject `class V = ...` / `class C = ...`
	// so it is ignored — parity with the canonical TS engine, which reserves
	// the same names, so identical input produces identical behavior.
	if rawName == "V" || rawName == "C" {
		return "", nil, false
	}

	members = uniqueStrings(jsFields(rest[eq+1:]))
	if len(members) == 0 {
		return "", nil, false
	}

	return rawName, members, true
}

// uniqueStrings drops repeated strings, keeping first occurrences in order.
func uniqueStrings(items []string) []string {
	seen := make(map[string]bool, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			out = append(out, item)
		}
	}
	return out
}

// isIdentifier reports whether s is a non-empty run of letters (no
// whitespace, no '=', no digits/punctuation) — i.e. a valid class name.
func isIdentifier(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !isLetter(r) {
			return false
		}
	}
	return true
}

func isLetter(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
}

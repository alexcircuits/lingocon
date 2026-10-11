package soundchange

import (
	"strings"
	"unicode/utf8"
)

// The parser mirrors parseRule/parseClassLine in lib/utils/sound-change.ts
// character for character, so the preview parses exactly the rules the
// server applies: JavaScript's String#trim and \s (not Go's unicode.IsSpace,
// which differs on U+0085 and U+FEFF), and the arrow regex
// /^(.+?)(?:→|[=–—-]+>|>)(.+)$/ including its laziness and the line
// terminators its `.` refuses.

// jsIsSpace reports whether r is ECMAScript WhiteSpace or LineTerminator —
// what String#trim removes and the regex \s matches.
func jsIsSpace(r rune) bool {
	switch r {
	case '\t', '\n', 0x0B, 0x0C, '\r', ' ', 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
		return true
	}
	return r >= 0x2000 && r <= 0x200A
}

// jsTrim is String#trim.
func jsTrim(s string) string { return strings.TrimFunc(s, jsIsSpace) }

// jsFields is s.split(/\s+/) without the empty strings.
func jsFields(s string) []string { return strings.FieldsFunc(s, jsIsSpace) }

// ParseRule parses one rule line. Returns ok=false for comments/blank/invalid.
func ParseRule(text string) (Rule, bool) {
	trimmed := jsTrim(text)
	if trimmed == "" || strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "#") {
		return Rule{}, false
	}

	target, rest, ok := splitArrow(trimmed)
	if !ok {
		return Rule{}, false
	}
	target = jsTrim(target)
	rest = jsTrim(rest)

	replacement := rest
	leftEnv, rightEnv := "", ""
	if slash := strings.IndexByte(rest, '/'); slash >= 0 {
		replacement = jsTrim(rest[:slash])
		envPart := jsTrim(rest[slash+1:])
		if u := strings.IndexByte(envPart, '_'); u >= 0 {
			leftEnv = jsTrim(envPart[:u])
			rightEnv = jsTrim(envPart[u+1:])
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

// splitArrow applies /^(.+?)(?:→|[=–—-]+>|>)(.+)$/: the target is the
// shortest non-empty prefix followed by an arrow that leaves a non-empty
// rest. The arrow is →, a single >, or a run of dashes/equals before > (so
// `->`, `-->`, `==>`, `–>`, `—>` work and `-->` leaves no stray `-`). The
// regex's `.` never matches a line terminator and ^…$ span the whole line, so
// a line containing one is not a rule.
func splitArrow(s string) (target, rest string, ok bool) {
	if strings.ContainsAny(s, "\n\r\u2028\u2029") {
		return "", "", false
	}
	_, first := utf8.DecodeRuneInString(s)
	for i := first; i < len(s); {
		if n := arrowLenAt(s, i); n > 0 && i+n < len(s) {
			return s[:i], s[i+n:], true
		}
		_, size := utf8.DecodeRuneInString(s[i:])
		i += size
	}
	return "", "", false
}

// arrowLenAt returns the byte length of the arrow starting at s[i], or 0.
// The three alternatives start with distinct characters, and a dash run can
// only be followed by > at its end, so at most one arrow fits at i.
func arrowLenAt(s string, i int) int {
	if s[i] == '>' {
		return 1
	}
	if strings.HasPrefix(s[i:], "→") {
		return len("→")
	}
	j := i
	for j < len(s) {
		r, size := utf8.DecodeRuneInString(s[j:])
		if r != '=' && r != '-' && r != '–' && r != '—' {
			break
		}
		j += size
	}
	if j > i && j < len(s) && s[j] == '>' {
		return j + 1 - i
	}
	return 0
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

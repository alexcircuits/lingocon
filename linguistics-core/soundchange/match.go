package soundchange

import (
	"sort"
	"unicode/utf16"
)

// Matching works on UTF-16 code units — the units a JavaScript string is
// made of — because that is what the TypeScript engine (the reference) sees:
// its `.` is one unit (half of an astral character such as 😀), lengths that
// order class members are unit counts, and a literal environment character is
// one unit. Converting at the edges keeps every observable result identical
// for any well-formed text. Matches always start and end on code-point
// boundaries (alternatives are well-formed), so decoding back is lossless.

func toUnits(s string) []uint16 { return utf16.Encode([]rune(s)) }

func fromUnits(u []uint16) string { return string(utf16.Decode(u)) }

func hasPrefixAt(word []uint16, p int, alt []uint16) bool {
	if p+len(alt) > len(word) {
		return false
	}
	for i, u := range alt {
		if word[p+i] != u {
			return false
		}
	}
	return true
}

func equalUnits(a, b []uint16) bool {
	return len(a) == len(b) && hasPrefixAt(a, 0, b)
}

// isLineTerminator reports the units JavaScript's `.` (without the s flag)
// refuses to match.
func isLineTerminator(u uint16) bool {
	return u == '\n' || u == '\r' || u == 0x2028 || u == 0x2029
}

// indexThreshold is the member count from which alternatives are indexed by
// first unit. Below it a linear scan is cheaper than a map lookup (TinyGo's
// maps are slow, and every literal has exactly one member).
const indexThreshold = 8

// alternatives is one position of a rule that matches literal text.
type alternatives struct {
	// members holds the alternatives in preference order.
	members [][]uint16
	// byFirstUnit groups larger sets by first unit, each group in preference
	// order; nil for small sets.
	byFirstUnit map[uint16][][]uint16
	// matchesEmpty is set for a class with no non-empty member, which matches
	// the empty string (the regex `(?:)` the TypeScript engine replaced).
	matchesEmpty bool
}

func newAlternatives(members [][]uint16) *alternatives {
	alts := &alternatives{members: members, matchesEmpty: len(members) == 0}
	if len(members) >= indexThreshold {
		alts.byFirstUnit = make(map[uint16][][]uint16, len(members))
		for _, m := range members {
			alts.byFirstUnit[m[0]] = append(alts.byFirstUnit[m[0]], m)
		}
	}
	return alts
}

// candidates returns, in preference order, a superset of the alternatives
// starting with unit u; callers confirm each with hasPrefixAt.
func (a *alternatives) candidates(u uint16) [][]uint16 {
	if a.byFirstUnit != nil {
		return a.byFirstUnit[u]
	}
	return a.members
}

// classAlternatives drops empty members and orders the rest longest-first by
// unit count, ties in the given order (JavaScript's sort is stable), so
// multi-unit phonemes such as "aː" or "tʃ" are preferred over their prefixes.
func classAlternatives(members []string) *alternatives {
	units := make([][]uint16, 0, len(members))
	for _, m := range members {
		if u := toUnits(m); len(u) > 0 {
			units = append(units, u)
		}
	}
	sort.SliceStable(units, func(i, j int) bool { return len(units[i]) > len(units[j]) })
	return newAlternatives(units)
}

// literalAlternatives matches exactly text, which must be non-empty.
func literalAlternatives(text []uint16) *alternatives {
	return newAlternatives([][]uint16{text})
}

// segment is one position of an environment: literal alternatives, or any
// single unit except a line terminator (`.`).
type segment struct {
	anyUnit bool
	alts    *alternatives
}

// appendEnds appends every position where s can end when it starts at p.
func (s segment) appendEnds(word []uint16, p int, out []int) []int {
	if s.anyUnit {
		if p < len(word) && !isLineTerminator(word[p]) {
			out = append(out, p+1)
		}
		return out
	}
	if s.alts.matchesEmpty {
		return append(out, p)
	}
	if p >= len(word) {
		return out
	}
	for _, alt := range s.alts.candidates(word[p]) {
		if hasPrefixAt(word, p, alt) {
			out = append(out, p+len(alt))
		}
	}
	return out
}

// environment is a rule context: its positions in order, plus whether a `#`
// anywhere in it anchors it to the word edge (start for the left context, end
// for the right one).
type environment struct {
	segments []segment
	boundary bool
}

// leftContextEnds marks every position the left context can end at. It is a
// zero-width condition that holds if ANY way of matching the segments ends
// there, computed as position sets — linear in word length × segments, with
// no backtracking however many class members share prefixes.
func leftContextEnds(word []uint16, env environment) []bool {
	reach := make([]bool, len(word)+1)
	if env.boundary {
		reach[0] = true
	} else {
		fillTrue(reach)
	}
	next := make([]bool, len(word)+1)
	var ends []int
	for _, seg := range env.segments {
		clear(next)
		for p, reached := range reach {
			if !reached {
				continue
			}
			ends = seg.appendEnds(word, p, ends[:0])
			for _, end := range ends {
				next[end] = true
			}
		}
		reach, next = next, reach
	}
	return reach
}

// rightContextStarts marks every position the right context can start at.
func rightContextStarts(word []uint16, env environment) []bool {
	ok := make([]bool, len(word)+1)
	if env.boundary {
		ok[len(word)] = true
	} else {
		fillTrue(ok)
	}
	previous := make([]bool, len(word)+1)
	var ends []int
	for i := len(env.segments) - 1; i >= 0; i-- {
		for p := range previous {
			previous[p] = false
			ends = env.segments[i].appendEnds(word, p, ends[:0])
			for _, end := range ends {
				if ok[end] {
					previous[p] = true
					break
				}
			}
		}
		ok, previous = previous, ok
	}
	return ok
}

func fillTrue(b []bool) {
	for i := range b {
		b[i] = true
	}
}

// compiledRule is a rule resolved against an engine's classes, ready to run
// on many words.
type compiledRule struct {
	raw         string
	left, right environment
	target      *alternatives
	replacement []uint16
}

// apply rewrites word, scanning left to right over the ORIGINAL word: at each
// position the first target alternative whose left context can end there and
// whose right context can start at its end wins; matches do not overlap and
// the scan resumes after each one. matched reports whether anything matched.
func (c *compiledRule) apply(word []uint16) (out []uint16, matched bool) {
	var leftOk, rightOk []bool
	copiedTo := 0
	for p := 0; p < len(word); {
		end := -1
		for _, alt := range c.target.candidates(word[p]) {
			if !hasPrefixAt(word, p, alt) {
				continue
			}
			if leftOk == nil {
				leftOk = leftContextEnds(word, c.left)
			}
			if !leftOk[p] {
				break
			}
			if rightOk == nil {
				rightOk = rightContextStarts(word, c.right)
			}
			if rightOk[p+len(alt)] {
				end = p + len(alt)
				break
			}
		}
		if end < 0 {
			p++
			continue
		}
		out = append(out, word[copiedTo:p]...)
		out = appendReplacement(out, word, p, end, c.replacement)
		copiedTo, p = end, end
	}
	if copiedTo == 0 {
		return word, false
	}
	return append(out, word[copiedTo:]...), true
}

// appendReplacement appends the replacement for the match word[start:end],
// expanding `$&` (the match), "$`" (text before it), `$'` (text after it) and
// `$$` exactly as String#replace did for the TypeScript engine's regex. That
// regex had no capture groups, so `$1`, `$<x>` and a lone `$` stay literal.
func appendReplacement(out, word []uint16, start, end int, replacement []uint16) []uint16 {
	for i := 0; i < len(replacement); i++ {
		if replacement[i] == '$' && i+1 < len(replacement) {
			switch replacement[i+1] {
			case '$':
				out = append(out, '$')
				i++
				continue
			case '&':
				out = append(out, word[start:end]...)
				i++
				continue
			case '`':
				out = append(out, word[:start]...)
				i++
				continue
			case '\'':
				out = append(out, word[end:]...)
				i++
				continue
			}
		}
		out = append(out, replacement[i])
	}
	return out
}

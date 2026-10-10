//go:build js && wasm

// Command wasm exposes the sound-change engine to JavaScript. It registers a
// global `__linguisticsCore` object with the functions the web app calls.
//
// Build: see ../build.sh (GOOS=js GOARCH=wasm).
package main

import (
	"encoding/json"
	"syscall/js"

	"lingocon/linguistics-core/soundchange"
)

// version names the engine semantics: soundchange-2 matches
// lib/utils/sound-change.ts exactly (any-split environments, String#replace
// `$` patterns, UTF-16 `.`, JavaScript whitespace in the parser).
const version = "soundchange-2"

func main() {
	core := js.Global().Get("Object").New()
	core.Set("version", version)
	core.Set("apply", js.FuncOf(apply))
	core.Set("applyPipeline", js.FuncOf(applyPipeline))
	core.Set("batchApply", js.FuncOf(batchApply))
	js.Global().Set("__linguisticsCore", core)

	// Signal readiness for the JS loader, then block so the registered
	// functions stay callable for the lifetime of the page.
	if cb := js.Global().Get("__linguisticsCoreReady"); cb.Type() == js.TypeFunction {
		cb.Invoke()
	}
	select {}
}

// apply(word, rulesText, vowels?, consonants?) -> changed string
func apply(_ js.Value, args []js.Value) any {
	if len(args) < 2 {
		return ""
	}
	engine, prog := engineFromArgs(args, 2, 3)
	return engine.ApplyPipeline(args[0].String(), prog.Rules).Changed
}

// applyPipeline(word, rulesText, vowels?, consonants?) -> JSON string of
// { original, changed, rulesApplied }
func applyPipeline(_ js.Value, args []js.Value) any {
	if len(args) < 2 {
		return "{}"
	}
	engine, prog := engineFromArgs(args, 2, 3)
	res := engine.ApplyPipeline(args[0].String(), prog.Rules)
	b, _ := json.Marshal(res)
	return string(b)
}

// batchApply(wordsArray, rulesText, vowels?, consonants?) -> JSON string of []Result
func batchApply(_ js.Value, args []js.Value) any {
	if len(args) < 2 {
		return "[]"
	}
	engine, prog := engineFromArgs(args, 2, 3)
	res := engine.BatchApply(readStringArray(args[0]), prog.Rules)
	b, _ := json.Marshal(res)
	return string(b)
}

// engineFromArgs parses the full program from the rulesText arg (splitting
// `class NAME = ...` definitions from rules) and builds an engine that honors
// both the optional vowels/consonants array args and the user-defined classes
// parsed from the rulesText. Like the TypeScript engine, an absent (undefined)
// inventory selects the default set, while a passed array is used as given —
// even an empty one, which (like an empty Set) matches the empty string. The
// JS call signature is unchanged: classes ride in via the rulesText.
func engineFromArgs(args []js.Value, vIdx, cIdx int) (*soundchange.Engine, soundchange.Program) {
	prog := soundchange.Parse(args[1].String())
	var v, c []string
	if vIdx < len(args) {
		v = readStringArray(args[vIdx])
	}
	if cIdx < len(args) {
		c = readStringArray(args[cIdx])
	}
	return soundchange.NewEngineOrDefaultWithClasses(v, c, prog.Classes), prog
}

// readStringArray converts a JS array value to []string. It returns nil for a
// non-object (undefined/null: "use the default inventory") and a non-nil
// slice, possibly empty, for an array — the distinction NewEngineOrDefault
// relies on.
func readStringArray(v js.Value) []string {
	if v.Type() != js.TypeObject {
		return nil
	}
	n := v.Length()
	out := make([]string, n)
	for i := 0; i < n; i++ {
		out[i] = v.Index(i).String()
	}
	return out
}

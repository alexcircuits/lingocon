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

const version = "soundchange-1"

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
// both the optional vowels/consonants array args (each falling back to the
// default inventory when absent or empty) and the user-defined classes parsed
// from the rulesText. The JS call signature is unchanged: classes ride in via
// the rulesText, so callers need no new argument.
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

// readStringArray converts a JS array value to []string (nil if not an array).
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

//! Rust side of the lexicon-analysis benchmark. Reads the dataset (and the TypeScript results)
//! written by `scripts/rust-parity/bench-lexicon.ts`, checks `analyze_lexicon` reproduces them,
//! and times it on the same input.
//!
//! ```text
//! npx tsx scripts/rust-parity/bench-lexicon.ts
//! cargo run --release --manifest-path rust/Cargo.toml -p lingocon-core --example bench_lexicon \
//!     [-- rust/target/lexicon-bench/dataset.json [samples]]
//! ```

use std::path::PathBuf;
use std::time::Instant;

use lingocon_core::analysis::{analyze_lexicon, EntryInput, SymbolInput};
use lingocon_core::swadesh::match_swadesh_list;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Symbol {
    symbol: String,
    capital_symbol: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    lemma: String,
    gloss: String,
    paradigm_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Expected {
    warnings: Vec<serde_json::Value>,
    total: usize,
    matched_ids: Vec<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Scenario {
    name: String,
    allows_diacritics: bool,
    expected: Expected,
    timings_ms: Vec<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Dataset {
    symbols: Vec<Symbol>,
    entries: Vec<Entry>,
    paradigm_ids: Vec<String>,
    max_warnings: usize,
    scenarios: Vec<Scenario>,
}

fn median(values: &mut [f64]) -> f64 {
    values.sort_by(f64::total_cmp);
    values[values.len() / 2]
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let path = args
        .next()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("rust/target/lexicon-bench/dataset.json"));
    let samples: usize = args.next().map(|s| s.parse()).transpose()?.unwrap_or(20);
    let text = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "{}: {e} (run scripts/rust-parity/bench-lexicon.ts first)",
            path.display()
        )
    })?;
    let dataset: Dataset = serde_json::from_str(&text)?;

    let symbols: Vec<SymbolInput<'_>> = dataset
        .symbols
        .iter()
        .map(|s| SymbolInput {
            symbol: &s.symbol,
            capital_symbol: s.capital_symbol.as_deref(),
        })
        .collect();
    let entries: Vec<EntryInput<'_>> = dataset
        .entries
        .iter()
        .map(|e| EntryInput {
            lemma: &e.lemma,
            gloss: &e.gloss,
            paradigm_id: e.paradigm_id.as_deref(),
        })
        .collect();
    let paradigm_ids: Vec<&str> = dataset.paradigm_ids.iter().map(String::as_str).collect();

    println!(
        "entries={} samples={samples} (release build, single thread)",
        entries.len()
    );
    for scenario in &dataset.scenarios {
        let run = || {
            analyze_lexicon(
                &symbols,
                &entries,
                &paradigm_ids,
                scenario.allows_diacritics,
                dataset.max_warnings,
            )
        };
        let result = run(); // warm-up, and the parity check on the benchmark data itself
        let warnings: Vec<serde_json::Value> = result
            .warnings
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<_, _>>()?;
        if warnings != scenario.expected.warnings
            || result.total != scenario.expected.total
            || result.matched_ids != scenario.expected.matched_ids
        {
            return Err(format!("{}: Rust output differs from TypeScript", scenario.name).into());
        }
        let mut timings: Vec<f64> = (0..samples)
            .map(|_| {
                let start = Instant::now();
                std::hint::black_box(run());
                start.elapsed().as_secs_f64() * 1000.0
            })
            .collect();
        let min = timings.iter().copied().fold(f64::INFINITY, f64::min);
        let rust_median = median(&mut timings);
        let ts_median = median(&mut scenario.timings_ms.clone());
        println!(
            "{:<15} warnings={:<6} matched={:<3} rust median {rust_median:.2} ms (min {min:.2}) | \
             ts median {ts_median:.1} ms | {:.0}x",
            scenario.name,
            result.total,
            result.matched_ids.len(),
            ts_median / rust_median,
        );
    }
    let mut swadesh_only: Vec<f64> = (0..samples)
        .map(|_| {
            let start = Instant::now();
            std::hint::black_box(match_swadesh_list(entries.iter().map(|e| e.gloss)));
            start.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    println!(
        "of which matchSwadeshList alone: median {:.2} ms",
        median(&mut swadesh_only)
    );
    Ok(())
}

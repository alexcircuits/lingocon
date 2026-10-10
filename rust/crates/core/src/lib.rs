//! Pure LingoCon language logic. No I/O, no global state: every function is a
//! deterministic transformation of its inputs, so it can be tested exhaustively and
//! called from the Axum service (or WebAssembly later) with identical results.
#![forbid(unsafe_code)]

pub mod alphabet;
pub mod analysis;
pub mod js_text;
pub mod swadesh;
mod swadesh_data;

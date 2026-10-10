//! Loads everything `lingocon_core::analysis::analyze_lexicon` needs for one language.

use futures_util::{pin_mut, TryStreamExt};
use lingocon_core::analysis::{analyze_lexicon, EntryInput, LexiconAnalysis, SymbolInput};
use tokio_postgres::IsolationLevel;

use super::{DbError, Pool};

/// Refuse to analyse absurdly large lexicons instead of exhausting memory (roughly
/// 100 MB per in-flight analysis at this size; Next falls back to TypeScript).
pub const MAX_LEXICON_ENTRIES: usize = 500_000;

const LANGUAGE: &str = r#"SELECT "allowsDiacritics" FROM languages WHERE id = $1"#;
const SYMBOLS: &str =
    r#"SELECT symbol, "capitalSymbol" FROM script_symbols WHERE "languageId" = $1 ORDER BY id"#;
const PARADIGMS: &str = r#"SELECT id FROM paradigms WHERE "languageId" = $1 ORDER BY id"#;
// Ordered by id, like main's TypeScript: which warnings come first must not depend
// on physical row order.
const ENTRIES: &str = r#"SELECT lemma, gloss, "paradigmId" FROM dictionary_entries WHERE "languageId" = $1 ORDER BY id"#;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SymbolRow {
    pub symbol: String,
    pub capital_symbol: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntryRow {
    pub lemma: String,
    pub gloss: String,
    pub paradigm_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LexiconInputs {
    pub allows_diacritics: bool,
    pub symbols: Vec<SymbolRow>,
    pub entries: Vec<EntryRow>,
    pub paradigm_ids: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum LexiconLoadError {
    #[error(transparent)]
    Db(#[from] DbError),
    #[error("language has more than {limit} dictionary entries")]
    TooLarge { limit: usize },
}

impl From<tokio_postgres::Error> for LexiconLoadError {
    fn from(err: tokio_postgres::Error) -> Self {
        Self::Db(DbError::Query(err))
    }
}

impl From<deadpool_postgres::PoolError> for LexiconLoadError {
    fn from(err: deadpool_postgres::PoolError) -> Self {
        Self::Db(DbError::Pool(err))
    }
}

/// `Ok(None)` when the language does not exist. All four reads share one
/// read-only snapshot, so the analysis never sees a half-applied edit. Entries are
/// streamed row by row into compact owned strings instead of buffering `Row`s.
pub async fn load_lexicon_inputs(
    pool: &Pool,
    language_id: &str,
    max_entries: usize,
) -> Result<Option<LexiconInputs>, LexiconLoadError> {
    let mut client = pool.get().await?;
    let tx = client
        .build_transaction()
        .read_only(true)
        .isolation_level(IsolationLevel::RepeatableRead)
        .start()
        .await?;

    let statement = tx.prepare_cached(LANGUAGE).await?;
    let Some(language) = tx.query_opt(&statement, &[&language_id]).await? else {
        return Ok(None);
    };
    let allows_diacritics: bool = language.try_get("allowsDiacritics")?;

    let statement = tx.prepare_cached(SYMBOLS).await?;
    let symbols = tx
        .query(&statement, &[&language_id])
        .await?
        .iter()
        .map(|row| {
            Ok(SymbolRow {
                symbol: row.try_get("symbol")?,
                capital_symbol: row.try_get("capitalSymbol")?,
            })
        })
        .collect::<Result<Vec<_>, tokio_postgres::Error>>()?;

    let statement = tx.prepare_cached(PARADIGMS).await?;
    let paradigm_ids = tx
        .query(&statement, &[&language_id])
        .await?
        .iter()
        .map(|row| row.try_get("id"))
        .collect::<Result<Vec<String>, _>>()?;

    let statement = tx.prepare_cached(ENTRIES).await?;
    let rows = tx.query_raw(&statement, [language_id]).await?;
    pin_mut!(rows);
    let mut entries = Vec::new();
    while let Some(row) = rows.try_next().await? {
        if entries.len() >= max_entries {
            return Err(LexiconLoadError::TooLarge { limit: max_entries });
        }
        entries.push(EntryRow {
            lemma: row.try_get(0)?,
            gloss: row.try_get(1)?,
            paradigm_id: row.try_get(2)?,
        });
    }

    tx.commit().await?;
    Ok(Some(LexiconInputs {
        allows_diacritics,
        symbols,
        entries,
        paradigm_ids,
    }))
}

impl LexiconInputs {
    /// CPU-bound: call from a blocking thread. Never returns more than `max_warnings` warnings.
    pub fn analyze(&self, max_warnings: usize) -> LexiconAnalysis {
        let symbols: Vec<SymbolInput<'_>> = self
            .symbols
            .iter()
            .map(|row| SymbolInput {
                symbol: &row.symbol,
                capital_symbol: row.capital_symbol.as_deref(),
            })
            .collect();
        let entries: Vec<EntryInput<'_>> = self
            .entries
            .iter()
            .map(|row| EntryInput {
                lemma: &row.lemma,
                gloss: &row.gloss,
                paradigm_id: row.paradigm_id.as_deref(),
            })
            .collect();
        let paradigm_ids: Vec<&str> = self.paradigm_ids.iter().map(String::as_str).collect();
        let mut analysis = analyze_lexicon(
            &symbols,
            &entries,
            &paradigm_ids,
            self.allows_diacritics,
            max_warnings,
        );
        // Keep the response bounded even if the analysis ignored the limit.
        analysis.warnings.truncate(max_warnings);
        analysis
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analyze_returns_a_bounded_well_formed_result() {
        let inputs = LexiconInputs {
            allows_diacritics: false,
            symbols: vec![SymbolRow {
                symbol: "a".into(),
                capital_symbol: Some("A".into()),
            }],
            entries: vec![EntryRow {
                lemma: "ab".into(),
                gloss: "water".into(),
                paradigm_id: Some("missing".into()),
            }],
            paradigm_ids: vec![],
        };
        let analysis = inputs.analyze(1);
        assert!(analysis.warnings.len() <= 1);
        assert!(analysis.total >= analysis.warnings.len());
        assert!(analysis
            .matched_ids
            .windows(2)
            .all(|pair| pair[0] < pair[1]));
    }
}

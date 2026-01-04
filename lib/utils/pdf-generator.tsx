"use client"

import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

// Register fonts if needed (optional)
// Font.register({
//   family: "Roboto",
//   src: "https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxP.ttf",
// })

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  coverPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  title: {
    fontSize: 36,
    marginBottom: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    color: "#666",
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
    color: "#333",
    maxWidth: 500,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    borderBottom: "2 solid #000",
    paddingBottom: 5,
  },
  tocTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  tocItem: {
    marginBottom: 10,
    fontSize: 12,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    marginTop: 10,
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1 solid #ddd",
    paddingVertical: 5,
  },
  tableHeader: {
    fontWeight: "bold",
    backgroundColor: "#f0f0f0",
  },
  tableCell: {
    flex: 1,
    padding: 5,
  },
  dictionaryEntry: {
    marginBottom: 8,
    paddingBottom: 5,
    borderBottom: "1 solid #eee",
  },
  lemma: {
    fontWeight: "bold",
    fontSize: 12,
  },
  gloss: {
    fontSize: 11,
    color: "#333",
    marginTop: 2,
  },
  ipa: {
    fontSize: 10,
    color: "#666",
    fontFamily: "Courier",
    marginTop: 2,
  },
  grammarContent: {
    fontSize: 11,
    lineHeight: 1.5,
    marginTop: 10,
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    color: "#666",
  },
})

interface PDFDocumentProps {
  language: {
    name: string
    description: string | null
    slug: string
  }
  scriptSymbols: Array<{
    symbol: string
    ipa: string | null
    latin: string | null
    name: string | null
    order: number
  }>
  grammarPages: Array<{
    title: string
    slug: string
    content: any
    order: number
  }>
  dictionaryEntries: Array<{
    lemma: string
    gloss: string
    ipa: string | null
    partOfSpeech: string | null
    notes: string | null
  }>
}

export function LanguagePDFDocument({
  language,
  scriptSymbols,
  grammarPages,
  dictionaryEntries,
}: PDFDocumentProps) {
  // Sort dictionary entries alphabetically by lemma
  const sortedEntries = [...dictionaryEntries].sort((a, b) =>
    a.lemma.localeCompare(b.lemma)
  )

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.title}>{language.name}</Text>
          {language.description && (
            <Text style={styles.description}>{language.description}</Text>
          )}
          <Text style={styles.subtitle}>Language Documentation</Text>
          <Text style={styles.pageNumber}>Generated on {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>

      {/* Table of Contents */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.tocTitle}>Table of Contents</Text>
        <View style={{ marginTop: 20 }}>
          {scriptSymbols.length > 0 && (
            <Text style={styles.tocItem}>1. Alphabet & Script Symbols</Text>
          )}
          {grammarPages.length > 0 && (
            <Text style={styles.tocItem}>
              2. Grammar ({grammarPages.length} {grammarPages.length === 1 ? "page" : "pages"})
            </Text>
          )}
          {dictionaryEntries.length > 0 && (
            <Text style={styles.tocItem}>
              3. Dictionary ({dictionaryEntries.length} entries)
            </Text>
          )}
        </View>
      </Page>

      {/* Alphabet Section */}
      {scriptSymbols.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Alphabet & Script Symbols</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Symbol</Text>
              <Text style={styles.tableCell}>IPA</Text>
              <Text style={styles.tableCell}>Latin</Text>
              <Text style={styles.tableCell}>Name</Text>
            </View>
            {scriptSymbols.map((symbol, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCell}>{symbol.symbol}</Text>
                <Text style={styles.tableCell}>{symbol.ipa || "-"}</Text>
                <Text style={styles.tableCell}>{symbol.latin || "-"}</Text>
                <Text style={styles.tableCell}>{symbol.name || "-"}</Text>
              </View>
            ))}
          </View>
        </Page>
      )}

      {/* Grammar Pages */}
      {grammarPages.map((page, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{page.title}</Text>
          <Text style={styles.grammarContent}>
            {typeof page.content === "string"
              ? page.content
              : JSON.stringify(page.content)}
          </Text>
        </Page>
      ))}

      {/* Dictionary Section */}
      {sortedEntries.length > 0 && (
        <>
          {sortedEntries.map((entry, idx) => {
            // Start new page every 20 entries to avoid overflow
            const shouldStartNewPage = idx > 0 && idx % 20 === 0
            return (
              <Page key={idx} size="A4" style={styles.page} wrap={false}>
                {shouldStartNewPage && (
                  <Text style={styles.sectionTitle}>Dictionary (continued)</Text>
                )}
                {idx === 0 && (
                  <Text style={styles.sectionTitle}>Dictionary</Text>
                )}
                <View style={styles.dictionaryEntry}>
                  <Text style={styles.lemma}>{entry.lemma}</Text>
                  <Text style={styles.gloss}>{entry.gloss}</Text>
                  {entry.ipa && (
                    <Text style={styles.ipa}>/{entry.ipa}/</Text>
                  )}
                  {entry.partOfSpeech && (
                    <Text style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                      {entry.partOfSpeech}
                    </Text>
                  )}
                  {entry.notes && (
                    <Text style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                      {entry.notes}
                    </Text>
                  )}
                </View>
              </Page>
            )
          })}
        </>
      )}
    </Document>
  )
}


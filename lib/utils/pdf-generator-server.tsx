import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer"

import { createAlphabetSorter } from "@/lib/utils/alphabet-sorter"
import { join } from "path"

// Register standard fonts
const fontsPath = join(process.cwd(), "public/fonts")
Font.register({
  family: "NotoSans",
  fonts: [
    { src: join(fontsPath, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: join(fontsPath, "NotoSans-Bold.ttf"), fontWeight: 700 }, // React-pdf uses 700 for bold usually
    { src: join(fontsPath, "NotoSans-Italic.ttf"), fontStyle: "italic", fontWeight: 400 },
  ]
})

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontSize: 10,
    fontFamily: "NotoSans",
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  coverPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  coverHeader: {
    marginBottom: 40,
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 48,
    fontFamily: "NotoSans",
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 20,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 60,
  },
  coverDescription: {
    fontSize: 14,
    textAlign: "center",
    color: "#475569",
    maxWidth: 400,
    lineHeight: 1.5,
  },
  coverFlag: {
    width: 200,
    height: 120,
    marginBottom: 30,
    objectFit: "contain",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
    textAlign: "center",
    fontSize: 9,
    color: "#94a3b8",
    borderTop: "1 solid #e2e8f0",
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: "NotoSans",
    fontWeight: "bold",
    marginBottom: 20,
    color: "#0f172a",
    borderBottom: "2 solid #0f172a",
    paddingBottom: 8,
  },
  h2: {
    fontSize: 18,
    fontFamily: "NotoSans",
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
    color: "#1e293b",
  },
  h3: {
    fontSize: 14,
    fontFamily: "NotoSans",
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
    color: "#334155",
  },
  paragraph: {
    marginBottom: 10,
    textAlign: "justify",
  },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
  bulletList: {
    marginLeft: 15,
    marginBottom: 10,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 5,
  },
  bullet: {
    width: 10,
    fontSize: 10,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    marginTop: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    minHeight: 24,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    fontWeight: "bold",
  },
  tableCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  tableCellLast: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0,
  },
  dictionaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dictionaryEntry: {
    width: "48%",
    marginBottom: 15,
    padding: 8,
    backgroundColor: "#fcfcfc",
    borderRadius: 4,
    borderLeft: "2 solid #cbd5e1",
  },
  lemma: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  gloss: {
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
  },
  ipa: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 1,
  },
  pos: {
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    marginTop: 4,
  },
  notes: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 4,
    fontStyle: "italic",
  },
})

interface PDFDocumentProps {
  language: {
    name: string
    description: string | null
    slug: string
  }
  flagUrl: string | null
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
  paradigms: Array<{
    id: string
    name: string
    slots: any
    notes: string | null
  }>
}

/**
 * Renders TipTap JSON content to react-pdf components
 */
const TipTapRenderer = ({ content, paradigms }: { content: any; paradigms: any[] }) => {
  if (!content || typeof content !== "object") return null

  const renderNodes = (nodes: any[]) => {
    return nodes.map((node, index) => {
      switch (node.type) {
        case "paragraph":
          return (
            <Text key={index} style={styles.paragraph}>
              {renderContent(node.content)}
            </Text>
          )
        case "heading":
          const headingStyle = node.attrs?.level === 2 ? styles.h2 : styles.h3
          return (
            <Text key={index} style={headingStyle}>
              {renderContent(node.content)}
            </Text>
          )
        case "bulletList":
          return (
            <View key={index} style={styles.bulletList}>
              {renderNodes(node.content)}
            </View>
          )
        case "orderedList":
          return (
            <View key={index} style={styles.bulletList}>
              {node.content.map((item: any, idx: number) => (
                <View key={idx} style={styles.listItem}>
                  <Text style={styles.bullet}>{idx + 1}.</Text>
                  <View style={{ flex: 1 }}>{renderNodes(item.content)}</View>
                </View>
              ))}
            </View>
          )
        case "listItem":
          return (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <View style={{ flex: 1 }}>{renderNodes(node.content)}</View>
            </View>
          )
        case "hardBreak":
          return <View key={index} style={{ height: 10 }} />
        case "igt":
          return (
            <View key={index} style={[styles.table, { backgroundColor: "#f8fafc", padding: 8, borderLeft: "4 solid #cbd5e1" }]}>
              <Text style={{ fontSize: 12, fontFamily: "NotoSans", fontWeight: "bold" }}>{node.attrs?.sentence}</Text>
              <Text style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{node.attrs?.gloss}</Text>
              <Text style={{ fontSize: 11, fontStyle: "italic", marginTop: 4 }}>{node.attrs?.translation}</Text>
            </View>
          )
        case "paradigm":
          const paradigm = paradigms.find((p: any) => p.id === node.attrs?.paradigmId)
          if (!paradigm) return null
          return (
            <View key={index} style={{ marginVertical: 10 }}>
              <Text style={styles.h3}>{paradigm.name}</Text>
              <ParadigmPDFTable paradigm={paradigm} />
            </View>
          )
        default:
          return null
      }
    })
  }

  const renderContent = (content: any[]) => {
    if (!content || !Array.isArray(content)) return null
    return content.map((item, index) => {
      if (item.type === "text") {
        let style: any = {}
        if (item.marks) {
          item.marks.forEach((mark: any) => {
            if (mark.type === "bold") style = { ...style, ...styles.bold }
            if (mark.type === "italic") style = { ...style, ...styles.italic }
          })
        }
        return (
          <Text key={index} style={style}>
            {item.text}
          </Text>
        )
      }
      return null
    })
  }

  if (content.type === "doc" && content.content) {
    return <View>{renderNodes(content.content)}</View>
  }

  return null
}

/**
 * Renders a Paradigm table for the PDF
 */
const ParadigmPDFTable = ({ paradigm }: { paradigm: any }) => {
  const slots = paradigm.slots
  const rows = Array.isArray(slots?.rows) ? slots.rows : []
  const columns = Array.isArray(slots?.columns) ? slots.columns : []
  const cells = slots?.cells || {}

  if (rows.length === 0 || columns.length === 0) return null

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={[styles.tableRow, styles.tableHeader]}>
        <View style={styles.tableCell}><Text style={styles.bold}></Text></View>
        {columns.map((col: string, idx: number) => (
          <View key={idx} style={idx === columns.length - 1 ? styles.tableCellLast : styles.tableCell}>
            <Text style={styles.bold}>{col}</Text>
          </View>
        ))}
      </View>
      {/* Rows */}
      {rows.map((row: string, rowIdx: number) => (
        <View key={rowIdx} style={styles.tableRow}>
          <View style={[styles.tableCell, { backgroundColor: "#f8fafc" }]}>
            <Text style={styles.bold}>{row}</Text>
          </View>
          {columns.map((_: string, colIdx: number) => {
            const cellValue = cells[`${rowIdx}-${colIdx}`] || "-"
            return (
              <View key={colIdx} style={colIdx === columns.length - 1 ? styles.tableCellLast : styles.tableCell}>
                <Text>{cellValue}</Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

export function LanguagePDFDocument({
  language,
  flagUrl,
  scriptSymbols,
  grammarPages,
  dictionaryEntries,
  paradigms,
}: PDFDocumentProps) {
  // Sort dictionary entries alphabet-basely
  const sorter = createAlphabetSorter(scriptSymbols)
  const sortedEntries = [...dictionaryEntries].sort((a, b) => sorter(a.lemma, b.lemma))

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverHeader}>
          {flagUrl && <Image src={flagUrl} style={styles.coverFlag} />}
          <Text style={styles.coverTitle}>{language.name}</Text>
          <Text style={styles.coverSubtitle}>Language Documentation</Text>
          {language.description && (
            <Text style={styles.coverDescription}>{language.description}</Text>
          )}
        </View>
        <Text style={styles.footer}>
          Generated on {new Date().toLocaleDateString()}
        </Text>
      </Page>

      {/* Alphabet Page */}
      {scriptSymbols.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Alphabet & Script</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Symbol</Text>
              <Text style={styles.tableCell}>Latin</Text>
              <Text style={styles.tableCell}>IPA</Text>
              <Text style={styles.tableCellLast}>Name</Text>
            </View>
            {scriptSymbols.map((symbol, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCell}>{symbol.symbol}</Text>
                <Text style={styles.tableCell}>{symbol.latin || "-"}</Text>
                <Text style={styles.tableCell}>{symbol.ipa || "-"}</Text>
                <Text style={styles.tableCellLast}>{symbol.name || "-"}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} — ${language.name}`} fixed />
        </Page>
      )}

      {/* Grammar Pages */}
      {grammarPages.map((page, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{page.title}</Text>
          <TipTapRenderer content={page.content} paradigms={paradigms} />
          <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} — ${language.name}`} fixed />
        </Page>
      ))}

      {/* Paradigms Section */}
      {paradigms.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Paradigms & Tables</Text>
          {paradigms.map((paradigm, pIdx) => (
            <View key={pIdx} style={{ marginBottom: 30 }} wrap={false}>
              <Text style={styles.h2}>{paradigm.name}</Text>
              {paradigm.notes && <Text style={[styles.notes, { marginBottom: 10 }]}>{paradigm.notes}</Text>}
              <ParadigmPDFTable paradigm={paradigm} />
            </View>
          ))}
          <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} — ${language.name}`} fixed />
        </Page>
      )}

      {/* Dictionary Section */}
      {sortedEntries.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <Text style={styles.sectionTitle}>Dictionary</Text>
          <View style={styles.dictionaryGrid}>
            {sortedEntries.map((entry, idx) => (
              <View key={idx} style={styles.dictionaryEntry} wrap={false}>
                <Text style={styles.lemma}>{entry.lemma}</Text>
                <Text style={styles.gloss}>{entry.gloss}</Text>
                {entry.ipa && <Text style={styles.ipa}>/{entry.ipa}/</Text>}
                {entry.partOfSpeech && <Text style={styles.pos}>{entry.partOfSpeech}</Text>}
                {entry.notes && <Text style={styles.notes}>{entry.notes}</Text>}
              </View>
            ))}
          </View>
          <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} — ${language.name}`} fixed />
        </Page>
      )}
    </Document>
  )
}


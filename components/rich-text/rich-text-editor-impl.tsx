"use client"

import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useEditor, useEditorState, EditorContent, type Content, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Quote,
    Table2,
    Type,
    Plus,
    PencilLine,
    Trash2,
    LayoutPanelLeft,
    LayoutPanelTop,
    Merge,
    Split,
    MoreVertical
} from "lucide-react"
import { cn } from "@/lib/utils"
import { xsampaToIpa } from "@/lib/utils/ipa-from-xsampa"
import { IGT } from "@/lib/tiptap/igt-extension"
import { Paradigm } from "@/lib/tiptap/paradigm-extension"
import { CustomFont } from "@/lib/tiptap/custom-font-extension"
import { WikiLink } from "@/lib/tiptap/wiki-link-extension"
import { useOpenedOnce } from "@/lib/hooks/use-opened-once"
import { RichTextEditorSkeleton } from "./rich-text-editor-skeleton"

// Secondary tools: their code loads the first time the user opens them (see useOpenedOnce).
const IpaChartGenerator = dynamic(() => import("@/components/ipa-chart-generator").then((m) => m.IpaChartGenerator))
const WikiLinkDialog = dynamic(() => import("@/components/wiki-link-dialog").then((m) => m.WikiLinkDialog))

// Configured once at module scope: tiptap compares extension identity on every render and
// reconfigures the editor (setOptions) whenever an instance differs.
const ConfiguredTable = Table.configure({
    resizable: true,
    allowTableNodeSelection: true,
})

const EDITOR_CLASSES = [
    "prose prose-slate dark:prose-invert max-w-none min-h-[300px] focus:outline-none p-4",
    "prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4",
    "prose-h2:text-2xl prose-h2:font-semibold prose-h2:mb-3",
    "prose-p:leading-relaxed prose-li:my-0",
    // Table specific styles that might not be covered completely by prose
    "[&_table]:border-collapse [&_table]:table-fixed [&_table]:w-full [&_table]:overflow-hidden",
    "[&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:relative [&_td]:min-w-[1em]",
    "[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:relative [&_th]:font-bold [&_th]:bg-secondary/20",
    "[&_.selectedCell:after]:content-[''] [&_.selectedCell:after]:absolute [&_.selectedCell:after]:inset-0 [&_.selectedCell:after]:bg-primary/20 [&_.selectedCell:after]:pointer-events-none",
    "[&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-primary/50 [&_.column-resize-handle]:absolute [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:right-[-2px] [&_.column-resize-handle]:cursor-col-resize",
]

export interface RichTextEditorProps {
    /**
     * The initial document, read once when the editor mounts. Later values are ignored, so a
     * parent re-render (e.g. after a save) can never reset or reconfigure the user's editor;
     * replace the document through the editor instance instead (`editor.commands.setContent`).
     */
    content: Content
    /**
     * Receives the live editor once it exists (and null on teardown). Parents read
     * `editor.getJSON()` when they need the document — at save time — instead of serializing it
     * into React state on every keystroke.
     */
    onEditorReady?: (editor: Editor | null) => void
    className?: string
    disabled?: boolean
    // Feature flags
    withIGT?: boolean
    withParadigm?: boolean
    onParadigmClick?: (editor: Editor) => void
    // IPA Chart
    withIpaChart?: boolean
    symbols?: { id: string; symbol: string; ipa: string | null; latin?: string | null; name: string | null; order?: number }[]
    // Wiki-links between grammar pages
    withWikiLinks?: boolean
    languageSlug?: string
    grammarPages?: { id: string; title: string; slug: string }[]
}

export function RichTextEditor({
    content,
    onEditorReady,
    className,
    disabled = false,
    withIGT = false,
    withParadigm = false,
    onParadigmClick,
    withIpaChart = false,
    symbols = [],
    withWikiLinks = false,
    languageSlug = "",
    grammarPages = [],
}: RichTextEditorProps) {
    const t = useTranslations("editor")
    const [isIpaChartOpen, setIsIpaChartOpen] = useState(false)
    const [isWikiLinkDialogOpen, setIsWikiLinkDialogOpen] = useState(false)

    const ipaChartMounted = useOpenedOnce(isIpaChartOpen)
    const wikiLinkDialogMounted = useOpenedOnce(isWikiLinkDialogOpen)

    const [initialContent] = useState(content)

    // Stable option identities: tiptap calls setOptions (view.setProps) whenever an option differs
    // from the previous render, which used to happen on every render — i.e. every keystroke.
    const extensions = useMemo(() => [
        StarterKit,
        CustomFont,
        ConfiguredTable,
        TableRow,
        TableHeader,
        TableCell,
        ...(withIGT ? [IGT] : []),
        ...(withParadigm ? [Paradigm] : []),
        ...(withWikiLinks ? [WikiLink.configure({ languageSlug })] : []),
    ], [withIGT, withParadigm, withWikiLinks, languageSlug])
    const editorProps = useMemo(() => ({
        attributes: { class: cn(...EDITOR_CLASSES, className) },
    }), [className])

    // `editable` is deliberately not an option here (tiptap would compare it on every render as
    // well); the effect below applies `disabled`.
    const editor = useEditor({
        extensions,
        content: initialContent,
        immediatelyRender: false,
        editorProps,
    })

    const onEditorReadyRef = useRef(onEditorReady)
    useEffect(() => {
        onEditorReadyRef.current = onEditorReady
    })
    useEffect(() => {
        if (!editor) return
        onEditorReadyRef.current?.(editor)
        return () => onEditorReadyRef.current?.(null)
    }, [editor])

    useEffect(() => {
        if (editor && !editor.isDestroyed && editor.isEditable === disabled) {
            editor.setEditable(!disabled, false)
        }
    }, [editor, disabled])

    // Re-render the toolbar only when an active mark/node actually changes, not per keystroke.
    const active = useEditorState({
        editor,
        selector: ({ editor: current }) => current ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            customFont: current.isActive("customFont"),
            heading1: current.isActive("heading", { level: 1 }),
            heading2: current.isActive("heading", { level: 2 }),
            bulletList: current.isActive("bulletList"),
            orderedList: current.isActive("orderedList"),
            blockquote: current.isActive("blockquote"),
            table: current.isActive("table"),
        } : null,
    })

    // The editor is created after mount (immediatelyRender: false); until then keep its frame.
    if (!editor) {
        return <RichTextEditorSkeleton />
    }

    return (
        <div className="flex flex-col border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b bg-secondary/30 flex-wrap">
                <Button aria-label={t("bold")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(active?.bold && "bg-secondary")}
                    disabled={disabled}
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button aria-label={t("italic")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(active?.italic && "bg-secondary")}
                    disabled={disabled}
                >
                    <Italic className="h-4 w-4" />
                </Button>

                <Button aria-label={t("toggleCustomFont")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleMark('customFont').run()}
                    className={cn(active?.customFont && "bg-secondary text-primary")}
                    disabled={disabled}
                    title={t("toggleCustomFont")}
                >
                    <Type className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />
                <Button aria-label={t("heading1")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={cn(active?.heading1 && "bg-secondary")}
                    disabled={disabled}
                >
                    <Heading1 className="h-4 w-4" />
                </Button>
                <Button aria-label={t("heading2")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={cn(active?.heading2 && "bg-secondary")}
                    disabled={disabled}
                >
                    <Heading2 className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        // Convert text node by text node, keeping each node's marks. Replacing the
                        // selection as one string flattened paragraphs, dropped marks (bold,
                        // custom script) and deleted IGT/paradigm/wiki-link atoms in the range.
                        editor.chain().focus().command(({ tr, state }) => {
                            const { from, to } = state.selection
                            if (from === to) return false
                            const edits: { from: number; to: number; node: ReturnType<typeof state.schema.text> }[] = []
                            state.doc.nodesBetween(from, to, (node, pos) => {
                                if (!node.isText || !node.text) return
                                const start = Math.max(from, pos)
                                const end = Math.min(to, pos + node.text.length)
                                const original = node.text.slice(start - pos, end - pos)
                                const converted = xsampaToIpa(original)
                                if (converted !== original) {
                                    edits.push({ from: start, to: end, node: state.schema.text(converted, node.marks) })
                                }
                            })
                            // Apply from the end so earlier positions stay valid.
                            for (const change of edits.reverse()) tr.replaceWith(change.from, change.to, change.node)
                            return edits.length > 0
                        }).run()
                    }}
                    title={t("convertXsampaToIpa")}
                    aria-label={t("convertXsampaToIpa")}
                    disabled={disabled}
                    >
                    <PencilLine className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />
                <Button aria-label={t("bulletList")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={cn(active?.bulletList && "bg-secondary")}
                    disabled={disabled}
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button aria-label={t("orderedList")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={cn(active?.orderedList && "bg-secondary")}
                    disabled={disabled}
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>
                <Button aria-label={t("quote")}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={cn(active?.blockquote && "bg-secondary")}
                    disabled={disabled}
                >
                    <Quote className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Table Controls */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(active?.table && "bg-secondary")}
                            disabled={disabled}
                            title={t("tableOperations")}
                            aria-label={t("tableOperations")}
                        >
                            <Table2 className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                        {/* Radix mounts the content only while the popover is open, so the
                            subscribed can() checks run just while the user is looking at them. */}
                        <TableMenu editor={editor} disabled={disabled} />
                    </PopoverContent>
                </Popover>

                {/* Extended Features */}
                {(withIGT || withParadigm || withWikiLinks) && <div className="w-px h-6 bg-border mx-1" />}

                {withIGT && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            editor.chain().focus().setIGT({ sentence: "", gloss: "", translation: "" }).run()
                        }
                        disabled={disabled}
                        title={t("insertIgt")}
                    >
                        <span className="text-xs font-semibold">IGT</span>
                    </Button>
                )}

                {withParadigm && (
                    <Button aria-label={t("insertParadigm")}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onParadigmClick?.(editor)}
                        disabled={disabled}
                        title={t("insertParadigm")}
                    >
                        <Table2 className="h-4 w-4" />
                    </Button>
                )}

                {withWikiLinks && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsWikiLinkDialogOpen(true)}
                        disabled={disabled}
                        title={t("insertWikiLink")}
                    >
                        <span className="text-xs font-semibold text-primary">[[]]</span>
                    </Button>
                )}

                {withIpaChart && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsIpaChartOpen(true)}
                        disabled={disabled}
                        title={t("generateIpaChart")}
                    >
                        <span className="text-xs font-bold border rounded px-0.5 border-current">IPA</span>
                    </Button>
                )}
            </div>

            {/* Content */}
            <div className="overflow-x-auto">
                <EditorContent editor={editor} />
            </div>

            {withIpaChart && ipaChartMounted && (
                <IpaChartGenerator
                    open={isIpaChartOpen}
                    onOpenChange={setIsIpaChartOpen}
                    symbols={symbols}
                    onInsert={(html) => {
                        editor.chain().focus().insertContent(html).run()
                    }}
                />
            )}

            {withWikiLinks && wikiLinkDialogMounted && (
                <WikiLinkDialog
                    open={isWikiLinkDialogOpen}
                    onOpenChange={setIsWikiLinkDialogOpen}
                    grammarPages={grammarPages}
                    onSelect={(slug, label) => {
                        editor.chain().focus().insertWikiLink({ slug, label }).run()
                    }}
                />
            )}
        </div>
    )
}

interface TableMenuProps {
    editor: Editor
    disabled: boolean
}

/** Table commands, re-rendered from editor transactions (the parent no longer re-renders per
 * keystroke, so reading `editor.can()` during its render would go stale while the menu is open). */
function TableMenu({ editor, disabled }: TableMenuProps) {
    const t = useTranslations("editor")
    const table = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            active: current.isActive("table"),
            addColumnBefore: current.can().addColumnBefore(),
            addColumnAfter: current.can().addColumnAfter(),
            deleteColumn: current.can().deleteColumn(),
            addRowBefore: current.can().addRowBefore(),
            addRowAfter: current.can().addRowAfter(),
            deleteRow: current.can().deleteRow(),
            mergeCells: current.can().mergeCells(),
            splitCell: current.can().splitCell(),
            deleteTable: current.can().deleteTable(),
        }),
    })

    return (
        <div className="grid gap-1">
            <Button
                variant="ghost"
                size="sm"
                className="justify-start h-8 px-2"
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                disabled={disabled}
            >
                <Plus className="h-4 w-4 mr-2" />
                {t("insertTable")}
            </Button>

            {table.active && (
                <>
                    <div className="h-px bg-border my-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2"
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                        disabled={!table.addColumnBefore}
                    >
                        <LayoutPanelLeft className="h-4 w-4 mr-2" />
                        {t("addColumnBefore")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2"
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        disabled={!table.addColumnAfter}
                    >
                        <LayoutPanelLeft className="h-4 w-4 mr-2 rotate-180" />
                        {t("addColumnAfter")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                        disabled={!table.deleteColumn}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("deleteColumn")}
                    </Button>
                    <div className="h-px bg-border my-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2"
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                        disabled={!table.addRowBefore}
                    >
                        <LayoutPanelTop className="h-4 w-4 mr-2" />
                        {t("addRowBefore")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2"
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        disabled={!table.addRowAfter}
                    >
                        <LayoutPanelTop className="h-4 w-4 mr-2 rotate-180" />
                        {t("addRowAfter")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                        onClick={() => editor.chain().focus().deleteRow().run()}
                        disabled={!table.deleteRow}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("deleteRow")}
                    </Button>
                    <div className="h-px bg-border my-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2"
                        onClick={() => editor.chain().focus().mergeCells().run()}
                        disabled={!table.mergeCells}
                    >
                        <Merge className="h-4 w-4 mr-2" />
                        {t("mergeCells")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2"
                        onClick={() => editor.chain().focus().splitCell().run()}
                        disabled={!table.splitCell}
                    >
                        <Split className="h-4 w-4 mr-2" />
                        {t("splitCell")}
                    </Button>
                    <div className="h-px bg-border my-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                        onClick={() => editor.chain().focus().deleteTable().run()}
                        disabled={!table.deleteTable}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("deleteTable")}
                    </Button>
                </>
            )}
        </div>
    )
}

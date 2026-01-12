"use client"

import { useEditor, EditorContent, Editor } from "@tiptap/react"
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
    Trash2,
    LayoutPanelLeft,
    LayoutPanelTop,
    Merge,
    Split,
    MoreVertical
} from "lucide-react"
import { cn } from "@/lib/utils"
// Import extensions dynamically or safely
import { IGT } from "@/lib/tiptap/igt-extension"
import { Paradigm } from "@/lib/tiptap/paradigm-extension"
import { CustomFont } from "@/lib/tiptap/custom-font-extension"

interface RichTextEditorProps {
    content: any
    onChange: (content: any) => void
    className?: string
    disabled?: boolean
    // Feature flags
    withIGT?: boolean
    withParadigm?: boolean
    onParadigmClick?: (editor: Editor) => void
}

export function RichTextEditor({
    content,
    onChange,
    className,
    disabled = false,
    withIGT = false,
    withParadigm = false,
    onParadigmClick,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            CustomFont,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            ...(withIGT ? [IGT] : []),
            ...(withParadigm ? [Paradigm] : []),
        ],
        content,
        immediatelyRender: false,
        editable: !disabled,
        onUpdate: ({ editor }) => {
            onChange(editor.getJSON())
        },
        editorProps: {
            attributes: {
                class: cn(
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
                    className
                ),
            },
        },
    })

    if (!editor) {
        return null
    }

    return (
        <div className="flex flex-col border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b bg-secondary/30 flex-wrap">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(editor.isActive("bold") && "bg-secondary")}
                    disabled={disabled}
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(editor.isActive("italic") && "bg-secondary")}
                    disabled={disabled}
                >
                    <Italic className="h-4 w-4" />
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleMark('customFont').run()}
                    className={cn(editor.isActive('customFont') && "bg-secondary text-primary")}
                    disabled={disabled}
                    title="Toggle Custom Font"
                >
                    <Type className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={cn(editor.isActive("heading", { level: 1 }) && "bg-secondary")}
                    disabled={disabled}
                >
                    <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={cn(editor.isActive("heading", { level: 2 }) && "bg-secondary")}
                    disabled={disabled}
                >
                    <Heading2 className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={cn(editor.isActive("bulletList") && "bg-secondary")}
                    disabled={disabled}
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={cn(editor.isActive("orderedList") && "bg-secondary")}
                    disabled={disabled}
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={cn(editor.isActive("blockquote") && "bg-secondary")}
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
                            className={cn(editor.isActive("table") && "bg-secondary")}
                            disabled={disabled}
                            title="Table Operations"
                        >
                            <Table2 className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                        <div className="grid gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start h-8 px-2"
                                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                                disabled={disabled}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Insert Table (3x3)
                            </Button>

                            {editor.isActive('table') && (
                                <>
                                    <div className="h-px bg-border my-1" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2"
                                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                                        disabled={!editor.can().addColumnBefore()}
                                    >
                                        <LayoutPanelLeft className="h-4 w-4 mr-2" />
                                        Add Column Before
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2"
                                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                                        disabled={!editor.can().addColumnAfter()}
                                    >
                                        <LayoutPanelLeft className="h-4 w-4 mr-2 rotate-180" />
                                        Add Column After
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                                        onClick={() => editor.chain().focus().deleteColumn().run()}
                                        disabled={!editor.can().deleteColumn()}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Column
                                    </Button>
                                    <div className="h-px bg-border my-1" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2"
                                        onClick={() => editor.chain().focus().addRowBefore().run()}
                                        disabled={!editor.can().addRowBefore()}
                                    >
                                        <LayoutPanelTop className="h-4 w-4 mr-2" />
                                        Add Row Before
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2"
                                        onClick={() => editor.chain().focus().addRowAfter().run()}
                                        disabled={!editor.can().addRowAfter()}
                                    >
                                        <LayoutPanelTop className="h-4 w-4 mr-2 rotate-180" />
                                        Add Row After
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                                        onClick={() => editor.chain().focus().deleteRow().run()}
                                        disabled={!editor.can().deleteRow()}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Row
                                    </Button>
                                    <div className="h-px bg-border my-1" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2"
                                        onClick={() => editor.chain().focus().mergeCells().run()}
                                        disabled={!editor.can().mergeCells()}
                                    >
                                        <Merge className="h-4 w-4 mr-2" />
                                        Merge Cells
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2"
                                        onClick={() => editor.chain().focus().splitCell().run()}
                                        disabled={!editor.can().splitCell()}
                                    >
                                        <Split className="h-4 w-4 mr-2" />
                                        Split Cell
                                    </Button>
                                    <div className="h-px bg-border my-1" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start h-8 px-2 text-destructive hover:text-destructive"
                                        onClick={() => editor.chain().focus().deleteTable().run()}
                                        disabled={!editor.can().deleteTable()}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Table
                                    </Button>
                                </>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Extended Features */}
                {(withIGT || withParadigm) && <div className="w-px h-6 bg-border mx-1" />}

                {withIGT && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            editor.chain().focus().setIGT({ sentence: "", gloss: "", translation: "" }).run()
                        }
                        disabled={disabled}
                        title="Insert IGT Block"
                    >
                        <span className="text-xs font-semibold">IGT</span>
                    </Button>
                )}

                {withParadigm && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onParadigmClick?.(editor)}
                        disabled={disabled}
                        title="Insert Paradigm Table (Structured)"
                    >
                        <Table2 className="h-4 w-4 text-blue-500" />
                    </Button>
                )}
            </div>

            {/* Content */}
            <EditorContent editor={editor} />
        </div>
    )
}

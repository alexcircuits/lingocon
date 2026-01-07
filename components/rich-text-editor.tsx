"use client"

import { useEditor, EditorContent, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Button } from "@/components/ui/button"
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Table2, Type } from "lucide-react"
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
                        title="Insert Paradigm Table"
                    >
                        <Table2 className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Content */}
            <EditorContent editor={editor} />
        </div>
    )
}

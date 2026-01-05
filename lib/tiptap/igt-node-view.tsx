"use client"

import { NodeViewWrapper, NodeViewProps } from "@tiptap/react"
import { IGTBlock } from "@/components/igt-block"

export function IGTNodeView(props: NodeViewProps) {
    const { node, updateAttributes, editor } = props
    const { sentence, gloss, translation } = node.attrs

    const handleEdit = (data: { sentence: string; gloss: string; translation: string }) => {
        updateAttributes(data)
    }

    return (
        <NodeViewWrapper className="igt-node-view">
            <IGTBlock
                sentence={sentence}
                gloss={gloss}
                translation={translation}
                onEdit={handleEdit}
                editable={editor.isEditable}
            />
        </NodeViewWrapper>
    )
}

"use client"

import { NodeViewWrapper, NodeViewProps } from "@tiptap/react"
import { ParadigmEmbed } from "@/components/paradigm-embed"

export function ParadigmNodeView(props: NodeViewProps) {
    const { node } = props
    const { paradigmId, paradigmName } = node.attrs

    return (
        <NodeViewWrapper className="paradigm-node-view">
            <ParadigmEmbed
                paradigmId={paradigmId}
                paradigmName={paradigmName}
            />
        </NodeViewWrapper>
    )
}

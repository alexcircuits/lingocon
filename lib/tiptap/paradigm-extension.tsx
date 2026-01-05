import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ParadigmNodeView } from "./paradigm-node-view"

export interface ParadigmOptions {
  HTMLAttributes: Record<string, any>
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paradigm: {
      setParadigm: (options: { paradigmId: string; paradigmName: string }) => ReturnType
    }
  }
}

export const Paradigm = Node.create<ParadigmOptions>({
  name: "paradigm",

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  content: "",

  parseHTML() {
    return [
      {
        tag: 'div[data-type="paradigm"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "paradigm",
        class: "paradigm-placeholder my-4 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors",
      }),
      [
        "div",
        { class: "flex items-center gap-2 text-primary font-semibold" },
        ["span", { class: "p-2 bg-primary/10 rounded" }, "Table"],
        ["span", {}, node.attrs.paradigmName || "Paradigm Table"],
      ],
      ["div", { class: "text-[10px] text-muted-foreground mt-1" }, "(Embedded Paradigm)"],
    ]
  },

  addAttributes() {
    return {
      paradigmId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-paradigm-id"),
        renderHTML: (attributes) => {
          if (!attributes.paradigmId) {
            return {}
          }
          return {
            "data-paradigm-id": attributes.paradigmId,
          }
        },
      },
      paradigmName: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-paradigm-name"),
        renderHTML: (attributes) => {
          if (!attributes.paradigmName) {
            return {}
          }
          return {
            "data-paradigm-name": attributes.paradigmName,
          }
        },
      },
    }
  },

  addCommands() {
    return {
      setParadigm:
        (options) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: options,
            })
          },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ParadigmNodeView)
  },
})



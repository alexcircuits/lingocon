import { Node, mergeAttributes } from "@tiptap/core"

export interface IGTOptions {
  HTMLAttributes: Record<string, any>
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    igt: {
      setIGT: (options: { sentence: string; gloss: string; translation: string }) => ReturnType
    }
  }
}

export const IGT = Node.create<IGTOptions>({
  name: "igt",

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
        tag: 'div[data-type="igt"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "igt",
        class: "igt-placeholder my-4 p-4 border-2 border-dashed border-accent/30 rounded-lg bg-accent/5 cursor-pointer hover:border-accent/50 transition-colors",
      }),
      [
        "div",
        { class: "flex items-center gap-2 mb-2" },
        ["span", { class: "text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent px-1.5 py-0.5 rounded" }, "IGT Block"],
        ["span", { class: "text-sm font-medium" }, node.attrs.sentence || "(empty sentence)"],
      ],
      [
        "div",
        { class: "text-xs text-muted-foreground italic pl-4 border-l-2 border-accent/20" },
        node.attrs.gloss || "(no gloss provided)"
      ],
    ]
  },

  addAttributes() {
    return {
      sentence: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-sentence"),
        renderHTML: (attributes) => {
          if (!attributes.sentence) {
            return {}
          }
          return {
            "data-sentence": attributes.sentence,
          }
        },
      },
      gloss: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-gloss"),
        renderHTML: (attributes) => {
          if (!attributes.gloss) {
            return {}
          }
          return {
            "data-gloss": attributes.gloss,
          }
        },
      },
      translation: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-translation"),
        renderHTML: (attributes) => {
          if (!attributes.translation) {
            return {}
          }
          return {
            "data-translation": attributes.translation,
          }
        },
      },
    }
  },

  addCommands() {
    return {
      setIGT:
        (options) =>
          ({ editor, commands }) => {
            // If a specific sentence wasn't provided, try to use the selected text
            const { from, to } = editor.state.selection
            const selectedText = editor.state.doc.textBetween(from, to, " ")

            const attrs = {
              ...options,
              sentence: options.sentence || selectedText || "",
            }

            return commands.insertContent({
              type: this.name,
              attrs,
            })
          },
    }
  },
})


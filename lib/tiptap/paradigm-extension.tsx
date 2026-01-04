import { Node, mergeAttributes } from "@tiptap/core"

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

  content: "",

  parseHTML() {
    return [
      {
        tag: 'div[data-type="paradigm"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "paradigm",
      }),
      0,
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
})


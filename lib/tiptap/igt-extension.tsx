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

  content: "",

  parseHTML() {
    return [
      {
        tag: 'div[data-type="igt"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "igt",
      }),
      0,
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
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})


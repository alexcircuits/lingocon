import { Mark, mergeAttributes } from '@tiptap/core';

export const CustomFont = Mark.create({
    name: 'customFont',

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'font-custom-script',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span',
                getAttrs: (element) => (element as HTMLElement).classList.contains('font-custom-script') && null,
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
});

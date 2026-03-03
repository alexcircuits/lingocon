import { Mark, mergeAttributes } from '@tiptap/core';

export const CustomFont = Mark.create({
    name: 'customFont',
    exitable: true,

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
                tag: 'span[class="font-custom-script"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
});

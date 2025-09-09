import { EditorView } from '@codemirror/view'

export const gistLight = EditorView.theme({
  // Cursor & selection
  '.cm-cursor-primary': {
    borderLeftColor: '#ff0000'
  },
  '.cm-selectionBackground': {
    background: 'rgba(255, 0, 0, 0.2) !important'
  },

  /**
   * Markdown Syntax
   */

  '.cm-content .cm-line:not(.cm-code-block) .ͼ11.ͼ13': {
    color: '#000000 '
  },
  '.cm-content .cm-line:not(.cm-code-block) .ͼ13': {
    color: '#000000 '
  },

  /**
   * Code blocks
   */

  '.cm-content .cm-code-block': {
    borderLeft: '0.5px rgba(0, 0, 0, 0.187) solid !important',
    borderRight: '0.5px rgba(0, 0, 0, 0.187) solid !important'
  },
  '.cm-code-block.cm-code-block-start': {
    borderTop: '0.5px rgba(0, 0, 0, 0.187) solid'
  },
  '.cm-code-block.cm-code-block-end': {
    borderBottom: '0.5px rgba(0, 0, 0, 0.187) solid'
  },
  '.cm-code-block::before': {
    background: 'rgb(244, 244, 244)'
  },
  '.cm-content': {
    color: '#272727'
  },

  /**
   * Lists
   */

  '.ordered-list-number, .custom-bullet': {
    color: '#ff0000'
  },

  /**
   * Heading Tags
   */

  '.cm-heading-1 span[contenteditable]::before, .cm-heading-2 span[contenteditable]::before, .cm-heading-3 span[contenteditable]::before, .cm-heading-4 span[contenteditable]::before, .cm-heading-5 span[contenteditable]::before, .cm-heading-6 span[contenteditable]::before':
    {
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: 'rgb(161, 161, 161)'
    },

  /**
   * Prompt
   */

  '.cm-prompt::before': {
    background: '#f0f0f0'
  },
  '.cm-prompt-placeholder::after': {
    color: '#909090'
  },
  // Sumbit button
  '.cm-prompt.cm-prompt-end': { position: 'relative' },
  '.cm-prompt-submit-button': {
    background: 'rgb(73, 73, 73)'
  },
  '.cm-prompt-submit-button:hover': {
    background: 'rgb(90, 90, 90)'
  },
  '.cm-prompt-submit-button:focus': {
    outline: '2px solid var(--focus-color, #007aff)',
    outlineOffset: '2px'
  }
})

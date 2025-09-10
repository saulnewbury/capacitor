import { EditorView } from '@codemirror/view'

export const commonStyles = EditorView.theme({
  /* Editor */
  '&': {
    minHeight: '100%'
  },
  '.cm-editor': {
    minHeight: '100%'
  },
  '.cm-scroller': {
    overflowX: 'visible !important',
    overflowY: 'auto !important',
    boxSizing: 'border-box',
    minHeight: '100%',
    height: 'auto'
  },

  '.cm-content': {
    fontSize: '16px',
    lineHeight: '1.7',
    caretColor: 'red',
    paddingBottom: '80vh',
    minHeight: 'calc(100vh - 100px + 1px)' // Force scroll by adding 1px
  },

  // Line wrapping styles
  '.cm-line': {
    paddingLeft: '4px !important', // Remove any line-level left padding
    paddingRight: '4px !important', // Remove any line-level left padding
    marginLeft: '0 !important', // Remove any line-level left margin
    textIndent: '0 !important',
    wordWrap: 'break-word', // Ensure words break properly
    whiteSpace: 'pre-wrap', // Preserve whitespace but allow wrapping

    wordBreak: 'break-word',
    overflowWrap: 'break-word'
  },

  '.cm-line[style*="--list-text-indent"]': {
    boxSizing: 'border-box'
  },

  /**
   * Tags
   */

  '.cm-tag': {
    borderRadius: '1000px',
    color: '#5b5b5b',
    fontWeight: 500,
    display: 'inline-block',
    lineHeight: 1.2,
    whiteSpace: 'pre-wrap',
    position: 'relative'
  },
  '.cm-tag::before': {
    content: "''",
    borderRadius: '1000px',
    backgroundColor: 'rgba(83, 90, 101, 0.164)',
    width: 'calc(100% + .8rem)',
    height: 'calc(100% + 0.35rem)',
    position: 'absolute',
    top: '50%',
    left: '-0.4rem',
    transform: 'translateY(-50%)',
    display: 'inline-block'
  },
  '.cm-hash': { opacity: 0.7 },

  /**
   * Cursor & selection
   */

  '.cm-cursor-primary': {
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid'
  },
  '.cm-selectionLayer': {
    zIndex: 100
  },

  /**
   * Font styles
   */

  '.fade-syntax': {
    opacity: 0.5,
    transition: 'opacity 0.15s ease'
  },
  '.cm-strong': {
    fontWeight: 'bold'
  },
  '.cm-em': {
    fontStyle: 'italic'
  },

  /**
   * Lists
   */

  '.list-indent-spacer': {
    display: 'inlineBlock',
    lineHeight: '1.7'
  },
  '.custom-bullet': {
    paddingRight: '0.9em',
    paddingLeft: '0.6em'
  },
  '.ordered-list-number': {
    paddingRight: '0.6em'
    /* Padding left is conditional see below*/
  },
  /* 0.6em for 1 digit  */
  '.ordered-list-number.single-digit-number': {
    paddingLeft: '0.6em'
  },
  /*  0em for 2 or more digits  */
  // '.ordered-list-number.multi-digit-number': {
  //   paddingLeft: '0em'
  // },
  /* KEEP AS INLINE (DONT USE INLINE BLOCK) */
  '.custom-bullet, .ordered-list-number': {
    textAlign: 'right',
    boxSizing: 'border-box',
    minWidth: '2.1em',
    fontWeight: 500,
    lineHeight: 1.7,
    verticalAlign: 'baseline'
  },

  /**
   * Link
   */

  'preview-title': {
    fontSize: '1.3rem',
    fontWeight: 700
  },

  /**
   * Headings
   */

  '.cm-heading': {
    position: 'relative',
    fontWeight: 700,
    fontFamily:
      '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  '.cm-heading, .cm-heading span': {
    display: 'contents'
  },

  // Heading font sizes
  '.cm-line:has(.cm-heading-1)': {
    fontSize: '1.6rem',
    fontWeight: 700
  },

  '.cm-line:has(.cm-heading-2)': {
    fontSize: '1.3rem',
    fontWeight: 700
  },

  '.cm-line:has(.cm-heading-3)': {
    fontSize: '1.15rem',
    fontWeight: 700
  },

  '.cm-heading-4, .cm-heading-5, .cm-heading-6': {
    fontSize: '1rem',
    fontWeight: 700
  },

  /* Heading bottom margin */
  '.cm-line:has(.cm-heading)': {
    marginBottom: '.25em',
    lineHeight: 1.2
  },

  /**
   * Heading tags
   */

  '.cm-heading span[contenteditable]:first-of-type': {
    position: 'absolute',
    cursor: 'pointer',
    paddingRight: '0.25em',
    display: 'none'
  },

  '.cm-heading span[contenteditable]:first-of-type::before': {
    fontSize: '0.6rem',
    fontWeight: 500,
    /* Hide all heading indicators by default */
    opacity: 0,
    width: '0px',
    transition: 'opacity 1s ease-in-out'
  },

  '.cm-heading-1 [contenteditable]:first-of-type::before': {
    content: "'h1'"
  },

  '.cm-heading-2 [contenteditable]:first-of-type::before': {
    content: "'h2'"
  },

  '.cm-heading-3 [contenteditable]:first-of-type::before': {
    content: "'h3'"
  },

  '.cm-heading-4 [contenteditable]:first-of-type::before': {
    content: "'h4'"
  },

  '.cm-heading-5 [contenteditable]:first-of-type::before': {
    content: "'h5'"
  },

  '.cm-heading-6 span[contenteditable]:first-of-type::before': {
    content: "'h6'"
  },

  /* Show the “hN” indicator only when the heading line has .cm-heading-focused */
  '.cm-heading.cm-heading-focused span[contenteditable]::before': {
    opacity: 1,
    transition: 'opacity 1s ease-in-out'
  },

  '.cm-heading.cm-heading-focused span[contenteditable]': {
    position: 'unset',
    display: 'inline-block'
    // width: '1.4rem',
    // left: '-1.4rem'
  },

  /**
   * Code blocks
   */

  '.cm-content .cm-code-block': {
    fontSize: '16px',
    lineHeight: 1.75,
    position: 'relative',
    paddingLeft: '1rem !important',
    paddingRight: '1rem !important',
    overflow: 'hidden',
    boxSizing: 'border-box'
  },
  '.cm-code-block.cm-code-block-start': {
    borderTopLeftRadius: '0.5em',
    borderTopRightRadius: '0.5em'
    // paddingTop: 0
  },
  '.cm-code-block.cm-code-block-end': {
    borderBottomLeftRadius: '0.5em',
    borderBottomRightRadius: '0.5em'
    // paddingBottom: 0
  },
  '.cm-code-block.cm-code-block-start span, .cm-code-block.cm-code-block-end span':
    {
      // opacity: 0.2
    },
  '.cm-code-block::before': {
    content: "''",
    boxSizing: 'border-box',
    position: 'absolute',
    display: 'block',
    zIndex: -2,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    height: '100%'
    // transform: 'translateZ(0)',
    // backfaceVisibility: 'hidden'
  }
})

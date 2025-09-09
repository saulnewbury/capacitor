import { EditorView } from '@codemirror/view'

export const commonStyles = EditorView.theme({
  /* Editor */

  '&': {
    backgroundColor: 'transparent',
    height: '100%'
  },
  '.markdown-editor .cm-editor.cm-focused': {
    outline: 'transparent !important'
  },
  '.cm-content': {
    fontSize: '16px',
    lineHeight: '1.7',
    padding: '50px',
    // Disable native selection styling
    caretColor: 'transparent', // Hide native caret
    '&::selection': { backgroundColor: 'transparent' },
    '& *::selection': { backgroundColor: 'transparent' } // Hide native selection in editor children
  },
  '.cm-scroller': {
    overflow: 'visible !important',
    padding: '50px'
  },
  // Line wrapping styles
  '.cm-line': {
    wordWrap: 'break-word', // Ensure words break properly
    whiteSpace: 'pre-wrap' // Preserve whitespace but allow wrapping
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
    width: 'calc(100% + 1rem)',
    height: 'calc(100% + 0.35rem)',
    position: 'absolute',
    top: '50%',
    left: '-0.5rem',
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
  '.ordered-list-number.multi-digit-number': {
    paddingReft: '0em'
  },
  /* KEEP AS INLINE (DONT USE INLINE BLOCK) */
  '.custom-bullet, .ordered-list-number': {
    textAlign: 'right',
    boxSizing: 'borderBox',
    minWidth: '2.1em',
    fontWeight: 500,
    lineHeight: 1.7,
    verticalAlign: 'baseline'
  },

  /**
   * Headings
   */

  '.cm-heading-1, .cm-heading-2, .cm-heading-3, .cm-heading-4, .cm-heading-5, .cm-heading-6':
    {
      position: 'relative',
      fontWeight: 700
    },

  // Heading font sizes
  '.cm-line:has(.cm-heading-1)': {
    fontSize: '2rem'
  },

  '.cm-line:has(.cm-heading-2)': {
    fontSize: '1.5rem'
  },

  '.cm-line:has(.cm-heading-3)': {
    fontSize: '1.25rem'
  },

  '.cm-heading-4, .cm-heading-5, .cm-heading-6': {
    fontSize: '1rem'
  },

  /* Heading bottom margin */
  '.cm-line:has(.cm-heading)': {
    marginBottom: '0.1em',
    lineHeight: 1.4
  },

  /**
   * Heading tags
   */

  '.cm-heading span[contenteditable]:first-of-type': {
    position: 'absolute',
    cursor: 'pointer',
    verticalAlign: 'sub',
    // left: '-1.8rem',
    // width: '1.8rem'
    left: '-1.4rem',
    width: '1.4rem'
  },

  '.cm-heading-1 span[contenteditable]:first-of-type::before': {
    fontSize: '0.8rem',
    fontWeight: 500
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

  /* Hide all heading indicators by default */
  '.cm-heading span[contenteditable]:first-of-type::before': {
    /* visibility: hidden; */
    opacity: 0,
    transition: 'opacity 1s ease-in-out'
  },

  /* Show the “hN” indicator only when the heading line has .cm-heading-focused */
  '.cm-heading.cm-heading-focused span[contenteditable]:first-of-type::before':
    {
      opacity: 1,
      transition: 'opacity 1s ease-in-out'
    },

  /**
   * Prompt
   */

  '.cm-prompt': {
    fontSize: '1em',
    color: '#000',
    lineHeight: 1.7,
    position: 'relative',
    borderLeft: '0.5px #cccccc solid',
    borderRight: '0.5px #cccccc solid',
    paddingLeft:
      '1.2rem !important' /* Add some padding on the left for visual clarity */,
    paddingRight:
      '1rem !important' /* Add some padding on the left for visual clarity */,
    overflow: 'hidden'
  },

  '.cm-prompt-fence': {
    opacity: 0
  },

  /* First line in a prompt block */
  '.cm-prompt.cm-prompt-start': {
    borderTopLeftRadius: '0.8rem',
    borderTopRightRadius: '0.8rem',
    paddingTop: 0,
    borderTop: '0.5px #cccccc solid',
    lineHeight: 1.2
  },

  /* Last line in a prompt block */
  '.cm-prompt.cm-prompt-end': {
    borderBottomLeftRadius: '0.8rem',
    borderBottomRightRadius: '0.8rem',
    paddingBottom: 0,
    borderBottom: '0.5px #cccccc solid',
    lineHeight: 3.5
  },

  '.cm-prompt::before': {
    content: "''",
    position: 'absolute',
    zIndex: -2,
    left: '0',
    right: '0',
    top: '0',
    bottom: '0',
    width: '100%',
    height: '100%'
  },

  '.cm-prompt-placeholder::after': {
    content: "'Ask anything...'",
    fontSize: 'var(--prompt-font-size)',
    position: 'absolute',
    left: '1.2rem',
    top: '0',
    cursor: 'text'
  },

  '.cm-prompt-submit-button': {
    position: 'absolute',
    right: '13px',
    bottom: '13px',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    height: '2.2rem',
    width: '2.2rem',
    cursor: 'pointer',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    zIndex: 10
  },

  /**
   * Code blocks
   */

  '.cm-content .cm-code-block': {
    fontSize: '0.9em',
    position: 'relative',
    paddingLeft: '1rem !important',
    paddingRight: '1rem !important',
    borderLeft: '0.5px var(--code-block-boder-color) solid',
    borderRight: '0.5px var(--code-block-boder-color) solid',
    overflow: 'hidden'
  },
  '.cm-code-block.cm-code-block-start': {
    borderTopLeftRadius: '0.5em',
    borderTopRightRadius: '0.5em',
    paddingTop: 0
  },
  '.cm-code-block.cm-code-block-end': {
    borderBottomLeftRadius: '0.5em',
    borderBottomRightRadius: '0.5em',
    paddingBottom: 0
  },
  '.cm-code-block.cm-code-block-start span, .cm-code-block.cm-code-block-end span':
    {
      // opacity: 0.2
    },
  '.cm-code-block::before': {
    content: "''",
    position: 'absolute',
    zIndex: -2,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    height: '100%'
  }

  /**
   * Links
   */

  // '.cm-line:has(.cm-link-preview-card)': {
  //   // lineHeight: 0,
  //   display: 'inline-block'
  // }
})

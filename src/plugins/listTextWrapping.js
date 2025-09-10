// listTextWrapping.js - Fixed version
import { Decoration, EditorView } from '@codemirror/view'
import { listIndentState } from './listStructure'

export const listTextWrappingDecoration = EditorView.decorations.compute(
  [listIndentState],
  (state) => {
    const builder = []
    const indentState = state.field(listIndentState, false)

    if (!indentState) return Decoration.set([])

    try {
      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i)
        const lineText = line.text

        // Check if this is a list item
        const unorderedMatch = lineText.match(/^(\s*)([*-])\s/)
        const orderedMatch = lineText.match(/^(\s*)(\d+[.)])\s/)

        if (unorderedMatch || orderedMatch) {
          const leadingSpaces = (unorderedMatch || orderedMatch)[1]
          const baseIndentLevel = Math.floor(leadingSpaces.length / 8)

          // Get the stored indent level for this line
          const storedIndentLevel = indentState.get(line.from) || 0
          const totalIndentLevel = baseIndentLevel + storedIndentLevel

          // Calculate marker width more precisely
          let markerWidth
          if (unorderedMatch) {
            markerWidth = '2.1em'
          } else {
            // For ordered lists: check actual number length
            const number = parseInt(orderedMatch[2].match(/\d+/)[0], 10)
            markerWidth = number < 10 ? '2.1em' : '2.7em'
          }

          // Calculate total indentation
          const baseIndentCh = totalIndentLevel * 8
          const totalIndent = `calc(${baseIndentCh}ch + ${markerWidth})`

          // Add line decoration with hanging indent
          builder.push(
            Decoration.line({
              attributes: {
                class: 'cm-list-item-line',
                style: `--marker-width: ${markerWidth}; --total-indent: ${totalIndent};`
              }
            }).range(line.from)
          )
        }
      }
    } catch (e) {
      console.error('Error in listTextWrappingDecoration:', e)
    }

    return Decoration.set(builder)
  }
)

// CSS theme with proper specificity to override existing rules
export const listWrappingStyles = EditorView.theme({
  // Specific rule for list item lines that overrides the general cm-line rule
  '.cm-line.cm-list-item-line': {
    textIndent: 'calc(-1 * var(--marker-width)) !important',
    paddingLeft: 'calc(4px + var(--total-indent)) !important', // Include original 4px padding
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    boxSizing: 'border-box'
  }
})

// Alternative approach: Update your existing commonStyles.js
// Replace the current .cm-line rule with this:
export const updatedCommonStylesRule = {
  '.cm-line': {
    paddingLeft: '4px !important',
    paddingRight: '4px !important',
    marginLeft: '0 !important',
    // Remove this line: textIndent: '0 !important',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word'
  },

  // Add this new rule for non-list lines only
  '.cm-line:not(.cm-list-item-line)': {
    textIndent: '0 !important'
  },

  // Specific styling for list item lines
  '.cm-line.cm-list-item-line': {
    textIndent: 'calc(-1 * var(--marker-width)) !important',
    paddingLeft: 'calc(4px + var(--total-indent)) !important'
  }
}

// plugins/headingLeftGuard.js

/**
 *
 * Handles horizontal cursor movement (left/right arrow keys).
 *
 * Prevents the cursor from entering the heading marker area
 * when pressing left arrow at the beginning of the heading
 * text.
 *
 * Ensures the cursor jumps from the end of one line
 * directly to the beginning of the heading text on the next
 * line when pressing right arrow
 *
 */

import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const headingLeftGuard = keymap.of([
  // Case 1: Prevent moving left from the beginning of the heading text
  {
    key: 'ArrowLeft',
    run(view) {
      const { state, dispatch } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)
      const text = line.text

      // match 1–6 hashes + the space
      const m = text.match(/^(#{1,6})\s/)
      if (!m) return false

      const prefixLen = m[1].length + 1 // e.g. "### " → 4
      const hideEnd = line.from + prefixLen // this is where the heading-text really starts

      // only if we're exactly at the start of the heading text
      if (head === hideEnd) {
        // Instead of moving to column 0, move to the end of the previous line
        // or do nothing if it's the first line

        if (line.number > 1) {
          // Get the previous line
          const prevLineNumber = line.number - 1
          const prevLine = state.doc.line(prevLineNumber)

          // Move to the end of the previous line
          dispatch({
            selection: EditorSelection.cursor(prevLine.to),
            scrollIntoView: true,
            userEvent: 'move.cursor'
          })
        } else {
          // First line of the document - do nothing
          // The default behavior will be to not move the cursor
        }
        return true
      }
      return false
    }
  },

  // Case 2: Prevent moving right from the end of previous line into the heading markers
  {
    key: 'ArrowRight',
    run(view) {
      const { state, dispatch } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)

      // Check if we're at the end of a line and not the last line
      if (head === line.to && line.number < state.doc.lines) {
        // Get the next line
        const nextLineNumber = line.number + 1
        const nextLine = state.doc.line(nextLineNumber)
        const nextLineText = nextLine.text

        // Check if the next line is a heading
        const m = nextLineText.match(/^(#{1,6})\s/)
        if (m) {
          const prefixLen = m[1].length + 1 // e.g. "### " → 4
          const headingTextStart = nextLine.from + prefixLen

          // Skip directly to the start of the heading text
          dispatch({
            selection: EditorSelection.cursor(headingTextStart),
            scrollIntoView: true,
            userEvent: 'move.cursor'
          })
          return true
        }
      }
      return false
    }
  }
])

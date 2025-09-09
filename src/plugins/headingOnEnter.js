// plugins/headingOnEnter.js
import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const headingOnEnter = keymap.of([
  {
    key: 'Enter',
    run(view) {
      const { state, dispatch } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)
      const text = line.text
      const m = text.match(/^(#{1,6})\s/) // capture 1–6 hashes + space
      if (!m) return false

      const prefixLen = m[1].length + 1 // e.g. "## " → 3
      const hideEnd = line.from + prefixLen
      const lineLen = line.to - line.from

      // Case 1: empty heading (no text after the space)
      // FIXED: Keep the heading syntax intact and add a new line below it
      if (lineLen === prefixLen && head === hideEnd) {
        dispatch({
          changes: { from: line.to, to: line.to, insert: '\n' },
          selection: EditorSelection.cursor(line.to + 1),
          userEvent: 'input'
        })
        return true
      }

      // Case 2: cursor is at the very start of the heading text
      if (head === hideEnd) {
        dispatch({
          changes: { from: line.from, to: line.from, insert: '\n' },
          // move cursor down into the heading on the new line
          selection: EditorSelection.cursor(head + 1),
          userEvent: 'input'
        })
        return true
      }

      return false
    }
  }
])

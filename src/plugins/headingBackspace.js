// plugins/headingBackspace.js
import { EditorSelection } from '@codemirror/state'
import { keymap } from '@codemirror/view'

export const headingBackspace = keymap.of([
  {
    key: 'Backspace',
    run(view) {
      const { state, dispatch } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)
      const text = line.text
      // match 1–6 hashes + space
      const m = text.match(/^(#{1,6})\s/)
      if (!m) return false

      const prefixLen = m[1].length + 1
      const prefixEnd = line.from + prefixLen

      // Only remove heading syntax if cursor is exactly at the start of heading text
      // (right after the heading prefix)
      if (head === prefixEnd) {
        // remove the hashes+space, place cursor at start of line
        dispatch({
          changes: { from: line.from, to: prefixEnd, insert: '' },
          selection: EditorSelection.cursor(line.from),
          userEvent: 'delete.backward'
        })
        return true
      }

      // If cursor is at the very start of the line (before the heading syntax),
      // let default backspace behavior happen (merge with previous line)
      return false
    }
  }
])

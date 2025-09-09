// plugins/headingContentBackspace.js
import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const headingContentBackspace = keymap.of([
  {
    key: 'Mod-Backspace',
    run(view) {
      const { state, dispatch } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)
      const text = line.text

      // Look for 1–6 hashes + space at start of this line
      const m = text.match(/^(#{1,6})\s/)
      if (!m) return false

      const prefixLen = m[1].length + 1 // e.g. "### " → 4
      const hideEnd = line.from + prefixLen // first real character

      // Only trigger if cursor is somewhere **after** that hidden prefix
      if (head > hideEnd) {
        // Delete from the start of the heading text back to hideEnd
        dispatch({
          changes: { from: hideEnd, to: head, insert: '' },
          selection: EditorSelection.cursor(hideEnd),
          userEvent: 'delete.backward'
        })
        return true
      }

      return false
    }
  }
])

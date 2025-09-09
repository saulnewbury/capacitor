// plugins/removeHeadingOnBackspace.js
import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const headingBackspace = keymap.of([
  {
    key: 'Backspace',
    run(view) {
      const { state, dispatch } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)
      const text = line.text
      // match 1–4 hashes + space
      const m = text.match(/^(#{1,6})\s/)
      if (!m) return false

      const prefixLen = m[1].length + 1
      const prefixEnd = line.from + prefixLen
      // only trigger if cursor is at or before prefixEnd
      if (head <= prefixEnd) {
        // remove the hashes+space, place cursor at start of line
        dispatch({
          changes: { from: line.from, to: prefixEnd, insert: '' },
          selection: EditorSelection.cursor(line.from),
          userEvent: 'delete.backward'
        })
        return true
      }
      return false
    }
  }
])

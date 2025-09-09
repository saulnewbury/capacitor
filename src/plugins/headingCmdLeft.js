// plugins/skipHeadingCmdLeft.js
import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const headingCmdLeft = keymap.of([
  {
    key: 'Mod-ArrowLeft',
    run(view) {
      const { state, dispatch } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)
      const text = line.text
      // detect an ATX heading prefix
      const m = text.match(/^(#{1,6})\s/)
      if (!m) return false

      const prefixLen = m[1].length + 1 // hashes + space
      const hideEnd = line.from + prefixLen // first real char

      // only when cursor is somewhere inside the heading text
      if (head > hideEnd) {
        dispatch({
          selection: EditorSelection.cursor(hideEnd),
          scrollIntoView: true,
          userEvent: 'move.cursor'
        })
        return true
      }
      return false
    }
  }
])

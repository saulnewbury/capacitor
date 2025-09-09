// plugins/headingSelectionDelete.js
import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const headingSelectionDelete = keymap.of([
  {
    key: 'Delete',
    run(view) {
      const { state, dispatch } = view
      const selection = state.selection.main

      // Only handle non-empty selections
      if (selection.empty) return false

      const { from, to } = selection
      const startLine = state.doc.lineAt(from)

      // Check if selection starts at a heading line
      const text = startLine.text
      const m = text.match(/^(#{1,6})\s/)
      if (!m) return false

      const prefixLen = m[1].length + 1 // hashes + space
      const headingTextStart = startLine.from + prefixLen

      // Only proceed if the selection starts right after the hidden heading markers
      if (from !== headingTextStart) return false

      // If selection extends to the end of the heading line
      // This is crucial - we need to ensure we're detecting a full-text selection
      if (to >= startLine.to - 1) {
        // Delete the entire line including the heading markers
        dispatch({
          changes: { from: startLine.from, to: to, insert: '' },
          selection: EditorSelection.cursor(startLine.from),
          userEvent: 'delete'
        })
        return true
      }

      return false
    }
  },
  {
    key: 'Backspace',
    run(view) {
      const { state, dispatch } = view
      const selection = state.selection.main

      // Only handle non-empty selections
      if (selection.empty) return false

      const { from, to } = selection
      const startLine = state.doc.lineAt(from)

      // Check if selection starts at a heading line
      const text = startLine.text
      const m = text.match(/^(#{1,6})\s/)
      if (!m) return false

      const prefixLen = m[1].length + 1 // hashes + space
      const headingTextStart = startLine.from + prefixLen

      // Only proceed if the selection starts right after the hidden heading markers
      if (from !== headingTextStart) return false

      // If selection extends to the end of the heading line
      if (to >= startLine.to - 1) {
        // Delete the entire line including the heading markers
        dispatch({
          changes: { from: startLine.from, to: to, insert: '' },
          selection: EditorSelection.cursor(startLine.from),
          userEvent: 'delete'
        })
        return true
      }

      return false
    }
  }
])

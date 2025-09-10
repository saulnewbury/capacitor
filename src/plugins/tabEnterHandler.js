// plugins/tabEnterHandler.js
import { EditorSelection, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'

export const tabEnterHandler = Prec.highest(
  keymap.of([
    {
      key: 'Enter',
      run(view) {
        const { state, dispatch } = view
        const { head } = state.selection.main

        // Only handle if selection is empty (just cursor)
        if (!state.selection.main.empty) return false

        const line = state.doc.lineAt(head)
        const lineText = line.text

        // Check if this line has tab indentation
        // (starts with at least one space, but not a list item)
        if (
          lineText.match(/^[ \t]+/) &&
          !lineText.match(/^[ \t]*[*-]\s/) &&
          !lineText.match(/^[ \t]*\d+[.)]\s/) &&
          !lineText.match(/^[ \t]*#[a-zA-Z0-9_\/-]/) // Skip lines with tags
        ) {
          // First transaction: insert the newline
          const tr = state.update({
            changes: { from: head, insert: '\n' },
            selection: EditorSelection.cursor(head + 1),
            userEvent: 'input'
          })

          dispatch(tr)

          // Now calculate the exact beginning of the new line
          const newState = view.state
          const newLine = newState.doc.lineAt(newState.selection.main.head)

          // Second transaction: move cursor to the exact beginning of the new line
          dispatch({
            selection: EditorSelection.cursor(newLine.from),
            userEvent: 'select'
          })

          return true
        }

        return false
      }
    }
  ])
)

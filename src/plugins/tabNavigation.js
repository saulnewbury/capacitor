// plugins/tabNavigation.js
import { keymap } from '@codemirror/view'
import { EditorSelection, Prec } from '@codemirror/state'

// Define tab size as 8 spaces (same as in smartTabHandler.js)
const TAB_SIZE = 8

export const tabNavigation = Prec.high(
  keymap.of([
    {
      key: 'ArrowRight',
      run(view) {
        const { state, dispatch } = view
        const { head } = state.selection.main

        // Only handle if selection is empty (just cursor)
        if (!state.selection.main.empty) return false

        const line = state.doc.lineAt(head)
        const lineText = line.text
        const posInLine = head - line.from

        // Check if cursor is at the start of an 8-space sequence
        // Be careful not to run past end of line
        if (posInLine < lineText.length) {
          // Check for exactly 8 spaces ahead
          const remainingText = lineText.slice(posInLine)
          if (remainingText.startsWith(' '.repeat(TAB_SIZE))) {
            // Jump past all 8 spaces
            dispatch({
              selection: EditorSelection.cursor(head + TAB_SIZE),
              scrollIntoView: true,
              userEvent: 'move.cursor'
            })
            return true
          }
        }

        return false
      }
    },
    {
      key: 'ArrowLeft',
      run(view) {
        const { state, dispatch } = view
        const { head } = state.selection.main

        // Only handle if selection is empty (just cursor)
        if (!state.selection.main.empty) return false

        const line = state.doc.lineAt(head)
        const lineText = line.text
        const posInLine = head - line.from

        // Check if cursor is just after an 8-space sequence
        if (posInLine >= TAB_SIZE) {
          const precedingText = lineText.slice(posInLine - TAB_SIZE, posInLine)
          if (precedingText === ' '.repeat(TAB_SIZE)) {
            // Jump to before all 8 spaces
            dispatch({
              selection: EditorSelection.cursor(head - TAB_SIZE),
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
)

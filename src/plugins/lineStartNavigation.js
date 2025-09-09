// plugins/lineStartNavigation.js
import { keymap } from '@codemirror/view'
import { EditorSelection, Prec } from '@codemirror/state'

// Add a debug log when the module is imported
console.log('🔍 lineStartNavigation module loaded')

const handler = {
  key: 'ArrowLeft',
  run(view) {
    // Add debug log when handler is called
    console.log('🎯 ArrowLeft handler triggered')

    const { state, dispatch } = view
    const { head } = state.selection.main

    // Get the current line information
    const line = state.doc.lineAt(head)
    console.log(
      `Current position: ${head}, Line start: ${line.from}, Line number: ${line.number}`
    )

    // Check if we're exactly at the start of any line
    const isAtLineStart = head === line.from

    if (!isAtLineStart) {
      console.log('❌ Not at line start')
      return false
    }

    // If we're at the start of the first line, nothing to do
    if (line.number === 1) {
      console.log('❌ At first line')
      return false
    }

    // Get the previous line
    const prevLine = state.doc.line(line.number - 1)

    // Move to the end of the previous line
    const targetPos = prevLine.to
    console.log(
      `✅ Moving to position ${targetPos} (end of line ${prevLine.number})`
    )

    dispatch({
      selection: EditorSelection.cursor(targetPos),
      scrollIntoView: true,
      userEvent: 'move.cursor'
    })

    return true
  }
}

export const lineStartNavigation = Prec.highest(keymap.of([handler]))

// Also export the handler directly to test if it's being properly registered
export const debugHandler = handler

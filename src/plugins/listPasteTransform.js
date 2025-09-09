// Updated listPasteTransform.js with space-based indentation support
import { EditorView } from '@codemirror/view'
import { Transaction } from '@codemirror/state'

export function listPasteTransform() {
  return EditorView.domEventHandlers({
    paste(event, view) {
      // Get the clipboard text
      const clipboardText = event.clipboardData.getData('text/plain')
      if (!clipboardText) return false

      // Check if the clipboard text contains any list items
      const hasListItems = /^[ \t]*[*-][ \t]+|^[ \t]*\d+[.)][ \t]+/m.test(
        clipboardText
      )

      // If no list items, let the default paste handler work
      if (!hasListItems) return false

      // Prevent the default paste behavior to handle ourselves
      event.preventDefault()

      // Split into lines and process
      const lines = clipboardText.split(/\r?\n/)

      // Get current cursor position (where we're pasting)
      const { state } = view
      const from = state.selection.main.from
      const cursorLine = state.doc.lineAt(from)

      // Determine indentation at cursor position
      let baseIndent = ''
      const cursorIndentMatch = cursorLine.text.match(/^(\s*)/)
      if (cursorIndentMatch) {
        baseIndent = cursorIndentMatch[1]
      }

      // Process the pasted lines
      const processedLines = lines.map((line) => {
        // Check if this is a list item
        const listMatch = line.match(/^(\s*)([*-]|\d+[.)])\s(.*)$/)

        if (listMatch) {
          const leadingSpaces = listMatch[1]
          const marker = listMatch[2]
          const content = listMatch[3]

          // Calculate indentation level based on spaces
          const indentLevel = Math.floor(leadingSpaces.length / 8)

          // Create proper indentation for this level
          const newIndent = baseIndent + ' '.repeat(indentLevel * 8)

          // Rebuild line with proper indentation
          return newIndent + marker + ' ' + content
        }

        // For non-list lines, just add the base indentation
        return baseIndent + line
      })

      // Join processed lines and insert at cursor
      const processedText = processedLines.join('\n')

      // Insert the processed text
      view.dispatch({
        changes: { from, to: state.selection.main.to, insert: processedText },
        selection: { anchor: from + processedText.length },
        annotations: Transaction.userEvent.of('paste')
      })

      return true
    }
  })
}

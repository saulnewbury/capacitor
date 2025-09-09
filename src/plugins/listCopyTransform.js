// listCopyTransform.js
import { EditorView } from '@codemirror/view'
import { listIndentState } from './listStructure' // Adjust the path if needed

export function listCopyTransform() {
  return EditorView.domEventHandlers({
    copy(event, view) {
      // Prevent the default copy behavior so we can supply our own text.
      event.preventDefault()
      const { state } = view

      // Determine the selected range.
      const selFrom = state.selection.main.from
      const selTo = state.selection.main.to

      // Get the lines that fall (fully or partially) within the selection.
      const startLine = state.doc.lineAt(selFrom)
      const endLine = state.doc.lineAt(selTo)
      const outputLines = []

      // Iterate over all lines in the selection.
      for (
        let lineNum = startLine.number;
        lineNum <= endLine.number;
        lineNum++
      ) {
        const line = state.doc.line(lineNum)
        let text = line.text
        // If the line is a list item according to your canonical format (e.g. starts with "* ")
        if (/^[*-]\s/.test(text)) {
          // Look up the indent level from your listIndentState.
          let indent = state.field(listIndentState, false).get(line.from) || 0
          // Build an indent string. Here, using two spaces per indent level.
          const indentStr = '  '.repeat(indent)
          // Prepend the indent string to the raw list marker.
          text = indentStr + text
        }
        outputLines.push(text)
      }

      // Join all lines together.
      const finalText = outputLines.join('\n')

      // Place the transformed text into the clipboard.
      event.clipboardData.setData('text/plain', finalText)
      return true
    }
  })
}

// plugins/smartTabHandler.js
import { keymap } from '@codemirror/view'
import { EditorSelection, Prec } from '@codemirror/state'

// Define tab size as 8 spaces
const TAB_SIZE = 8
const TAB_STRING = ' '.repeat(TAB_SIZE)

export const smartTabHandler = Prec.high(
  keymap.of([
    {
      key: 'Tab',
      run(view) {
        const { state, dispatch } = view
        const { selection } = state

        // If there's no selection (just cursor)
        if (selection.main.empty) {
          const line = state.doc.lineAt(selection.main.from)
          const lineText = line.text

          // Check if we're in a list - if so, let the list handler deal with it
          if (/^[*-]\s/.test(lineText) || /^\d+[.)]\s/.test(lineText)) {
            return false
          }

          // Not in a list, insert tab spaces at cursor position
          dispatch({
            changes: { from: selection.main.from, insert: TAB_STRING },
            selection: EditorSelection.cursor(selection.main.from + TAB_SIZE),
            userEvent: 'input'
          })
          return true
        }
        // If there's a selection (multiple lines)
        else {
          const ranges = selection.ranges
          let changeSet = []

          ranges.forEach((range) => {
            // Get all the lines that are part of this selection
            const startLine = state.doc.lineAt(range.from)
            const endLine = state.doc.lineAt(range.to)

            // Process each line in the selection
            for (let i = startLine.number; i <= endLine.number; i++) {
              const line = state.doc.line(i)

              // Check if we should skip list indentation
              if (/^[*-]\s/.test(line.text) || /^\d+[.)]\s/.test(line.text)) {
                continue
              }

              // Add tab at the beginning of the line
              changeSet.push({
                from: line.from,
                insert: TAB_STRING
              })
            }
          })

          // Apply all changes in a single transaction
          if (changeSet.length > 0) {
            dispatch({
              changes: changeSet,
              userEvent: 'indent'
            })
            return true
          }
        }

        return false
      }
    },
    {
      key: 'Shift-Tab',
      run(view) {
        const { state, dispatch } = view
        const { selection } = state

        // Determine if we're dealing with a single line or multiple lines
        if (selection.main.empty) {
          const line = state.doc.lineAt(selection.main.from)
          const lineText = line.text

          // Check if we're in a list - if so, let the list handler deal with it
          if (/^[*-]\s/.test(lineText) || /^\d+[.)]\s/.test(lineText)) {
            return false
          }

          // Check if there are spaces at the beginning that we can remove
          // Look for 1-8 spaces at the beginning
          const match = lineText.match(/^( {1,8})/)
          if (match) {
            const spaces = match[1]
            dispatch({
              changes: {
                from: line.from,
                to: line.from + spaces.length,
                insert: ''
              },
              userEvent: 'delete'
            })
            return true
          }
        }
        // Multiple lines selected
        else {
          const ranges = selection.ranges
          let changeSet = []

          ranges.forEach((range) => {
            // Get all the lines that are part of this selection
            const startLine = state.doc.lineAt(range.from)
            const endLine = state.doc.lineAt(range.to)

            // Process each line in the selection
            for (let i = startLine.number; i <= endLine.number; i++) {
              const line = state.doc.line(i)
              const lineText = line.text

              // Check if we should skip list unindentation
              if (/^[*-]\s/.test(lineText) || /^\d+[.)]\s/.test(lineText)) {
                continue
              }

              // Look for up to 8 spaces at the beginning of the line
              const match = lineText.match(/^( {1,8})/)
              if (match) {
                const spaces = match[1]
                changeSet.push({
                  from: line.from,
                  to: line.from + spaces.length,
                  insert: ''
                })
              }
            }
          })

          // Apply all changes in a single transaction
          if (changeSet.length > 0) {
            dispatch({
              changes: changeSet,
              userEvent: 'unindent'
            })
            return true
          }
        }

        return false
      }
    }
  ])
)

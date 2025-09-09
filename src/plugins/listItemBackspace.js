// listItemBackspace.js
import { keymap } from '@codemirror/view'
import { Prec, EditorSelection } from '@codemirror/state'

function handleListItemBackspace(view) {
  const { state } = view
  const { head, empty } = state.selection.main

  // Only handle empty selections
  if (!empty) return false

  const line = state.doc.lineAt(head)
  const text = line.text

  // Check if this is a list item with possible indentation
  const listMatch = text.match(/^(\s*)([*-]|\d+[.)])\s(.*)$/)
  if (!listMatch) return false

  const leadingSpaces = listMatch[1] || '' // Indentation spaces
  const marker = listMatch[2] // The marker (*, -, 1., etc.)
  const markerWithSpace = marker + ' ' // Marker plus the space
  const content = listMatch[3] // Content after the marker

  // Find position of the marker in the line
  const markerPos = line.from + leadingSpaces.length
  // Find position after the marker and space
  const afterMarkerPos = markerPos + markerWithSpace.length

  // If we're at the first position after the marker (i.e., at the beginning of content)
  if (head === afterMarkerPos) {
    // Delete the marker and its space, but keep the indentation
    view.dispatch({
      changes: { from: markerPos, to: afterMarkerPos, insert: '' },
      selection: { anchor: markerPos },
      scrollIntoView: true
    })
    return true
  }

  return false
}

export const listItemBackspace = Prec.highest(
  keymap.of([{ key: 'Backspace', run: handleListItemBackspace }])
)

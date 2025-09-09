// src/plugins/listSkipPastBullet.js
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'

function skipBackward(view) {
  const { state } = view
  const { head, empty } = state.selection.main
  if (!empty || head === 0) return false

  const line = state.doc.lineAt(head)
  const text = line.text

  // Look for list markers with possible indentation
  const listMatch = text.match(/^(\s*)([*-]|\d+[.)])\s/)
  if (!listMatch) return false

  const leadingSpaces = listMatch[1] || ''
  const marker = listMatch[2]

  // Calculate positions
  const markerPos = line.from + leadingSpaces.length
  const markerLength = marker.length + 1 // +1 for the space after marker
  const contentPos = markerPos + markerLength

  // If we're right after the marker+space (at content start)
  if (head === contentPos) {
    // Skip to before the marker (at the end of indentation)
    view.dispatch({
      selection: { anchor: markerPos },
      scrollIntoView: false
    })
    return true
  }

  // If we're at the beginning of the marker (after indentation)
  if (head === markerPos) {
    // Skip to the beginning of the line (before indentation)
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: false
    })
    return true
  }

  return false
}

function skipForward(view) {
  const { state } = view
  const { head, empty } = state.selection.main
  if (!empty) return false

  const line = state.doc.lineAt(head)
  const text = line.text

  // More permissive match for list items
  const listMatch = text.match(/^(\s*)([*-]|\d+[.)])(\s)/)
  if (!listMatch) return false

  const leadingSpaces = listMatch[1] || ''
  const marker = listMatch[2]
  const space = listMatch[3]

  // Calculate exact positions
  const indentPos = line.from
  const markerPos = indentPos + leadingSpaces.length
  const spacePos = markerPos + marker.length
  const contentPos = spacePos + space.length

  // Create a log string for debugging (commented out for production)
  // console.log(`head: ${head}, indentPos: ${indentPos}, markerPos: ${markerPos}, spacePos: ${spacePos}, contentPos: ${contentPos}`)

  // Check if cursor is exactly at the marker position
  if (head === markerPos) {
    view.dispatch({
      selection: { anchor: contentPos },
      scrollIntoView: false
    })
    return true
  }

  // Check if cursor is at the beginning of the line
  if (head === indentPos) {
    view.dispatch({
      selection: { anchor: markerPos },
      scrollIntoView: false
    })
    return true
  }

  return false
}

export const skipWidgetBufferKeymap = Prec.highest(
  keymap.of([
    { key: 'ArrowLeft', run: skipBackward },
    { key: 'ArrowRight', run: skipForward }
  ])
)

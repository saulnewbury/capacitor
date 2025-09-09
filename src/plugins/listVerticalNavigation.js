// Complete vertical list navigation with proper support for both directions

import { keymap } from '@codemirror/view'
import { Prec, EditorSelection } from '@codemirror/state'
import { parseOrderedListMarker } from './listStructure'

function skipVerticalIntoList(view) {
  const { state } = view
  const { head, empty } = state.selection.main
  if (!empty) return false

  const currentLine = state.doc.lineAt(head)
  const nextLineNumber = currentLine.number + 1

  // Check if next line exists
  if (nextLineNumber > state.doc.lines) return false
  const nextLine = state.doc.line(nextLineNumber)

  // Case 1: Moving from a non-list line to a list line
  const currentIsListItem =
    /^[*-]\s/.test(currentLine.text) || /^\d+[.)]\s/.test(currentLine.text)
  const nextIsListItem =
    /^[*-]\s/.test(nextLine.text) || /^\d+[.)]\s/.test(nextLine.text)

  if (!currentIsListItem && nextIsListItem) {
    // Moving from non-list to list - always position at column 0
    view.dispatch({
      selection: EditorSelection.cursor(nextLine.from),
      scrollIntoView: true,
      userEvent: 'move.cursor'
    })
    return true
  }

  // Case 2: Moving between list items
  if (currentIsListItem && nextIsListItem) {
    // If we're at column 0 of current list item, go to column 0 of next list item
    if (head === currentLine.from) {
      view.dispatch({
        selection: EditorSelection.cursor(nextLine.from),
        scrollIntoView: true,
        userEvent: 'move.cursor'
      })
      return true
    }

    // Handle navigation between list items with different indentation levels
    const currentMarker = parseOrderedListMarker(currentLine.text)
    const currentMarkerLen = currentMarker
      ? currentMarker.fullLength
      : /^[*-]\s/.test(currentLine.text)
      ? 2
      : 0
    const currentTextStart = currentLine.from + currentMarkerLen

    const nextMarker = parseOrderedListMarker(nextLine.text)
    const nextMarkerLen = nextMarker
      ? nextMarker.fullLength
      : /^[*-]\s/.test(nextLine.text)
      ? 2
      : 0
    const nextTextStart = nextLine.from + nextMarkerLen

    // If cursor is before the text content in current line, position at start of text in next line
    if (head < currentTextStart) {
      view.dispatch({
        selection: EditorSelection.cursor(nextTextStart),
        scrollIntoView: true,
        userEvent: 'move.cursor'
      })
      return true
    }

    // Otherwise, calculate correct offset into next line's content
    const offsetIntoContent = head - currentTextStart
    const targetPos = Math.min(nextTextStart + offsetIntoContent, nextLine.to)

    view.dispatch({
      selection: EditorSelection.cursor(targetPos),
      scrollIntoView: true,
      userEvent: 'move.cursor'
    })
    return true
  }

  return false
}

function skipVerticalOutOfList(view) {
  const { state } = view
  const { head, empty } = state.selection.main
  if (!empty) return false

  const currentLine = state.doc.lineAt(head)

  // Make sure there's a previous line
  if (currentLine.number <= 1) return false
  const prevLineNumber = currentLine.number - 1
  const prevLine = state.doc.line(prevLineNumber)

  // Detect list items
  const currentIsListItem =
    /^[*-]\s/.test(currentLine.text) || /^\d+[.)]\s/.test(currentLine.text)
  const prevIsListItem =
    /^[*-]\s/.test(prevLine.text) || /^\d+[.)]\s/.test(prevLine.text)

  // Case 1: Moving from a non-list line to a list line above
  if (!currentIsListItem && prevIsListItem) {
    // If we're at the start of the current non-list line
    if (head === currentLine.from) {
      // Position at column 0 of the list item above
      view.dispatch({
        selection: EditorSelection.cursor(prevLine.from),
        scrollIntoView: true,
        userEvent: 'move.cursor'
      })
      return true
    }

    // If we're at any other position in the current non-list line
    // Calculate the equivalent position in the list item, after the bullet
    const prevMarker = parseOrderedListMarker(prevLine.text)
    const prevMarkerLen = prevMarker
      ? prevMarker.fullLength
      : /^[*-]\s/.test(prevLine.text)
      ? 2
      : 0
    const prevTextStart = prevLine.from + prevMarkerLen

    // Determine relative position, but cap at the end of the previous line
    const posInLine = Math.min(
      head - currentLine.from,
      prevLine.to - prevTextStart
    )
    const targetPos = Math.min(prevTextStart + posInLine, prevLine.to)

    view.dispatch({
      selection: EditorSelection.cursor(targetPos),
      scrollIntoView: true,
      userEvent: 'move.cursor'
    })
    return true
  }

  // Case 2: Moving from list to non-list
  if (currentIsListItem && !prevIsListItem) {
    // If we're at column 0 of current list item, go to the end of previous line
    if (head === currentLine.from) {
      view.dispatch({
        selection: EditorSelection.cursor(prevLine.to),
        scrollIntoView: true,
        userEvent: 'move.cursor'
      })
      return true
    }
    return false // Let default handler deal with other positions
  }

  // Case 3: Moving between list items
  if (currentIsListItem && prevIsListItem) {
    // If we're at column 0 of current list item, go to column 0 of previous list item
    if (head === currentLine.from) {
      view.dispatch({
        selection: EditorSelection.cursor(prevLine.from),
        scrollIntoView: true,
        userEvent: 'move.cursor'
      })
      return true
    }

    // Calculate the start position of actual text in both lines
    const currentMarker = parseOrderedListMarker(currentLine.text)
    const currentMarkerLen = currentMarker
      ? currentMarker.fullLength
      : /^[*-]\s/.test(currentLine.text)
      ? 2
      : 0
    const currentTextStart = currentLine.from + currentMarkerLen

    const prevMarker = parseOrderedListMarker(prevLine.text)
    const prevMarkerLen = prevMarker
      ? prevMarker.fullLength
      : /^[*-]\s/.test(prevLine.text)
      ? 2
      : 0
    const prevTextStart = prevLine.from + prevMarkerLen

    // If cursor is before the text content in current line, position at start of text in prev line
    if (head < currentTextStart) {
      view.dispatch({
        selection: EditorSelection.cursor(prevTextStart),
        scrollIntoView: true,
        userEvent: 'move.cursor'
      })
      return true
    }

    // Otherwise, calculate correct offset into previous line's content
    const offsetIntoContent = head - currentTextStart
    const targetPos = Math.min(prevTextStart + offsetIntoContent, prevLine.to)

    view.dispatch({
      selection: EditorSelection.cursor(targetPos),
      scrollIntoView: true,
      userEvent: 'move.cursor'
    })
    return true
  }

  return false
}

export const listVerticalNavigation = Prec.highest(
  keymap.of([
    { key: 'ArrowDown', run: skipVerticalIntoList },
    { key: 'ArrowUp', run: skipVerticalOutOfList }
  ])
)

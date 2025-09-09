import { EditorView } from '@codemirror/view'
import { Transaction } from '@codemirror/state'
import { parseOrderedListMarker } from './listStructure'
import { listIndentState } from './listStructure'

// Function to renumber ordered lists with proper nesting
export function renumberOrderedLists() {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return

    const state = update.state

    // Skip during undo/redo or composition
    const isUndoRedo = update.transactions.some(
      (tr) => tr.isUserEvent('undo') || tr.isUserEvent('redo')
    )
    const isComposition = update.transactions.some(
      (tr) => tr.isUserEvent('compose') || tr.isUserEvent('input.type.compose')
    )
    if (isUndoRedo || isComposition) return

    const levelCounters = new Map()
    const levelStartNumbers = new Map()
    const itemsToRenumber = []
    let needsRenumbering = false
    let currentDeepestLevel = -1

    // First pass: detect user number edits and establish starting numbers
    let userEditedLevel = -1
    let userEditedNumber = -1

    // Check if this update changed a list number
    for (const tr of update.transactions) {
      if (tr.changes.empty) continue

      // Examine each change
      tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const lineBeforeChange = state.doc.lineAt(fromB)
        const textBeforeChange = lineBeforeChange.text

        // Check if this is an ordered list item
        const markerMatch = textBeforeChange.match(/^(\s*)(\d+)([.)])/)
        if (!markerMatch) return

        // Extract the indentation level
        const indentSpaces = markerMatch[1].length
        const indentLevel = Math.floor(indentSpaces / 8)

        // If the change is within the number part of the marker
        if (
          fromB >= lineBeforeChange.from + indentSpaces &&
          fromB <= lineBeforeChange.from + indentSpaces + markerMatch[2].length
        ) {
          // Extract the new number from the current line text
          const currentText = state.doc.lineAt(fromB).text
          const currentMatch = currentText.match(/^(\s*)(\d+)([.)])/)
          if (currentMatch) {
            userEditedLevel = indentLevel
            userEditedNumber = parseInt(currentMatch[2], 10)
          }
        }
      })
    }

    // Second pass: scan all list items and update as needed
    for (let i = 1; i <= state.doc.lines; i++) {
      const line = state.doc.line(i)
      const text = line.text

      // Skip non-list lines
      if (!/^\s*\d+[.)]\s/.test(text)) {
        currentDeepestLevel = -1
        continue
      }

      // Extract indentation and marker
      const indentMatch = text.match(/^(\s*)/)
      const indentSpaces = indentMatch ? indentMatch[1].length : 0
      const indentLevel = Math.floor(indentSpaces / 8)

      const markerMatch = text.match(/^\s*(\d+)([.)])/)
      if (!markerMatch) continue

      const currentNumber = parseInt(markerMatch[1], 10)
      const separator = markerMatch[2]

      // If we're going to a shallower level, reset deeper counters
      if (currentDeepestLevel > -1 && indentLevel < currentDeepestLevel) {
        for (
          let level = indentLevel + 1;
          level <= currentDeepestLevel;
          level++
        ) {
          levelCounters.delete(level)
          levelStartNumbers.delete(level)
        }
        currentDeepestLevel = indentLevel
      } else if (indentLevel > currentDeepestLevel) {
        currentDeepestLevel = indentLevel
      }

      // Initialize or get counter for this level
      if (!levelCounters.has(indentLevel)) {
        // If this is the first item at this level
        levelStartNumbers.set(indentLevel, currentNumber)
        levelCounters.set(indentLevel, currentNumber)
      }

      // Special handling for user-edited numbers
      if (
        userEditedLevel == indentLevel &&
        !levelStartNumbers.has(indentLevel)
      ) {
        // If a user edited a number at this level and it's the first item,
        // use that as the starting number
        levelStartNumbers.set(indentLevel, userEditedNumber)
        levelCounters.set(indentLevel, userEditedNumber)
      }

      // Get expected number for this item
      let expectedNumber = levelCounters.get(indentLevel)

      // Check if we need to renumber this item
      if (currentNumber !== expectedNumber) {
        needsRenumbering = true

        // Calculate positions - ONLY REPLACE THE NUMBER PART
        const markerStart = line.from + indentSpaces
        const markerLength = markerMatch[1].length // Just the number part
        const markerEnd = markerStart + markerLength // End of number, before separator

        itemsToRenumber.push({
          from: markerStart,
          to: markerEnd,
          newText: expectedNumber.toString() // Only insert the number
        })
      }

      // Increment counter for next item at this level
      levelCounters.set(indentLevel, expectedNumber + 1)
    }

    // Apply changes if needed
    if (needsRenumbering && itemsToRenumber.length > 0) {
      const changes = itemsToRenumber.map((item) => ({
        from: item.from,
        to: item.to,
        insert: item.newText
      }))

      update.view.dispatch({
        changes,
        scrollIntoView: false
      })
    }
  })
}

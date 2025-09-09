import { StateField, StateEffect, Prec, Transaction } from '@codemirror/state'
import { EditorView, Decoration, WidgetType, keymap } from '@codemirror/view'

// ── Effects for List Indent Operations ──
export const setListIndentEffect = StateEffect.define()
export const restoreIndentEffect = StateEffect.define()

// Regex for detecting list items (both ordered and unordered)
const LIST_ITEM_REGEX = /^([*-]|\d+[.)])\s/

export const listIndentState = StateField.define({
  create(state) {
    let mapping = new Map()
    let doc = state.doc
    for (let i = 1; i <= doc.lines; i++) {
      let line = doc.line(i)
      if (LIST_ITEM_REGEX.test(line.text)) {
        mapping.set(line.from, 0)
      }
    }
    return mapping
  },
  update(mapping, tr) {
    // Create a new map for the updated state
    let newMap = new Map()

    // Handle restoration effects first (they take priority)
    const hasRestoreEffects = tr.effects.some((e) => e.is(restoreIndentEffect))

    if (hasRestoreEffects) {
      // Start with a clean map for restorations
      for (let effect of tr.effects) {
        if (effect.is(restoreIndentEffect)) {
          const { pos, indent } = effect.value
          if (pos >= 0 && pos <= tr.state.doc.length) {
            newMap.set(pos, indent)
          }
        }
      }

      // Fill in any missing list items with default indent 0
      for (let i = 1; i <= tr.state.doc.lines; i++) {
        let line = tr.state.doc.line(i)
        if (LIST_ITEM_REGEX.test(line.text) && !newMap.has(line.from)) {
          newMap.set(line.from, 0)
        }
      }

      return newMap
    }

    // For normal updates: copy existing indentations and remap positions
    mapping.forEach((indent, pos) => {
      if (pos >= 0 && pos <= tr.startState.doc.length) {
        const newPos = tr.changes.mapPos(pos, 1)
        if (newPos !== null && newPos >= 0 && newPos <= tr.state.doc.length) {
          newMap.set(newPos, indent)
        }
      }
    })

    // Process any setListIndentEffect effects
    for (let effect of tr.effects) {
      if (effect.is(setListIndentEffect)) {
        const { pos, indent, assoc = 0 } = effect.value
        if (pos >= 0 && pos <= tr.startState.doc.length) {
          const mappedPos = tr.changes.mapPos(pos, assoc)
          if (
            mappedPos !== null &&
            mappedPos >= 0 &&
            mappedPos <= tr.state.doc.length
          ) {
            newMap.set(mappedPos, indent)
          }
        }
      }
    }

    // Add any missing list items with proper inheritance
    for (let i = 1; i <= tr.state.doc.lines; i++) {
      let line = tr.state.doc.line(i)
      if (LIST_ITEM_REGEX.test(line.text) && !newMap.has(line.from)) {
        // Try to inherit indent from nearby list items
        let inheritedIndent = 0

        // Check previous line first
        if (i > 1) {
          let prevLine = tr.state.doc.line(i - 1)
          if (
            LIST_ITEM_REGEX.test(prevLine.text) &&
            newMap.has(prevLine.from)
          ) {
            inheritedIndent = newMap.get(prevLine.from)
          }
        }

        // If no previous line indent, check next line
        if (inheritedIndent === 0 && i < tr.state.doc.lines) {
          let nextLine = tr.state.doc.line(i + 1)
          if (
            LIST_ITEM_REGEX.test(nextLine.text) &&
            newMap.has(nextLine.from)
          ) {
            inheritedIndent = newMap.get(nextLine.from)
          }
        }

        newMap.set(line.from, inheritedIndent)
      }
    }

    return newMap
  }
})

// ── Widget for the Bullet Symbol ──
class BulletWidget extends WidgetType {
  toDOM() {
    const bullet = document.createElement('span')
    bullet.className = 'custom-bullet'
    bullet.textContent = '•'
    return bullet
  }
  eq(other) {
    return true
  }
  ignoreEvent() {
    return false
  }
}

// ── Widget for Ordered List Numbers ──
class OrderedListWidget extends WidgetType {
  constructor(number, separator) {
    super()
    this.number = number
    this.separator = separator // Either "." or ")"
  }

  toDOM() {
    const numberContainer = document.createElement('span')
    numberContainer.className = 'ordered-list-number'

    // Add additional class based on digit count
    if (this.number < 10) {
      numberContainer.classList.add('single-digit-number')
    } else {
      numberContainer.classList.add('multi-digit-number')
    }

    numberContainer.textContent = `${this.number}${this.separator}`

    return numberContainer
  }

  eq(other) {
    return this.number === other.number && this.separator === other.separator
  }

  ignoreEvent() {
    return false
  }
}

// Helper function to parse ordered list marker - exported so it can be used by other modules
export function parseOrderedListMarker(text) {
  // More precise regex for ordered lists
  // Match: digits followed by either "." or ")" and a space
  const match = text.match(/^(\d+)([.)])(\s)/)
  if (!match) return null

  // Extract number and separator
  const number = parseInt(match[1], 10)
  const separator = match[2]

  return {
    number: number,
    separator: separator,
    length: match[1].length + 1, // Just the number and separator (not the space)
    fullLength: match[0].length // Includes the space
  }
}

// ── Decoration Plugin for List Structure ──
export const listStructureDecoration = EditorView.decorations.compute(
  [listIndentState],
  (state) => {
    const builder = []
    try {
      // Iterate over document lines to find list items.
      for (let i = 1; i <= state.doc.lines; i++) {
        let line = state.doc.line(i)
        const lineText = line.text

        // Check for unordered list items with possible leading spaces
        const unorderedMatch = lineText.match(/^(\s*)([*-])\s/)

        // Check for ordered list items with possible leading spaces
        const orderedMatch = lineText.match(/^(\s*)(\d+[.)])\s/)

        if (unorderedMatch) {
          // Extract the leading spaces and the marker
          const leadingSpaces = unorderedMatch[1]
          const marker = unorderedMatch[2]
          const markerStart = line.from + leadingSpaces.length
          const markerEnd = markerStart + marker.length + 1 // +1 for the space after the marker

          // Add a decoration to replace the marker
          builder.push(
            Decoration.replace({
              widget: new BulletWidget(),
              inclusive: false
            }).range(markerStart, markerEnd)
          )
        } else if (orderedMatch) {
          // Extract the leading spaces and the marker
          const leadingSpaces = orderedMatch[1]
          const fullMarker = orderedMatch[2]
          const markerStart = line.from + leadingSpaces.length

          // Parse the number and separator
          const numberMatch = fullMarker.match(/^(\d+)([.)])/)
          if (numberMatch) {
            const number = parseInt(numberMatch[1], 10)
            const separator = numberMatch[2]
            const markerEnd = markerStart + fullMarker.length + 1 // +1 for the space

            // Add a decoration to replace the marker
            builder.push(
              Decoration.replace({
                widget: new OrderedListWidget(number, separator),
                inclusive: false
              }).range(markerStart, markerEnd)
            )
          }
        }
      }
    } catch (e) {
      console.error('Error in listStructureDecoration:', e)
    }

    return Decoration.set(builder)
  }
)

// Helper to find the marker length for a list item
function getListMarkerLength(line) {
  // For unordered lists, it's always 2 characters (marker + space)
  if (/^[*-]\s/.test(line)) {
    return 2
  }

  // For ordered lists, use our parsing function for consistency
  const marker = parseOrderedListMarker(line)
  if (marker) {
    return marker.fullLength
  }

  // Fallback (shouldn't happen)
  return 0
}

// Helper to create a new list item with the correct marker type
function createNewListItem(text) {
  // Use our parse function for ordered lists
  const orderedMarker = parseOrderedListMarker(text)
  if (orderedMarker) {
    // Increment the number for the new item
    const number = orderedMarker.number + 1
    const separator = orderedMarker.separator // Either '.' or ')'
    return `${number}${separator} `
  }

  // Default to the same unordered marker type
  return text.startsWith('- ') ? '- ' : '* '
}

// ── Smart Commands for List Behavior ──
// Increase indent level (Tab)
function smartListIndent(view) {
  const { state } = view
  const { head } = state.selection.main

  // Get the current line
  let line = state.doc.lineAt(head)
  const text = line.text

  // Check if this is a list item (with possible leading spaces)
  const listMatch = text.match(/^(\s*)([*-]|\d+[.)])\s(.*)$/)
  if (!listMatch) return false

  const currentIndent = listMatch[1] || ''
  const marker = listMatch[2]
  const content = listMatch[3]
  const currentIndentLevel = Math.floor(currentIndent.length / 8)

  // Find the previous line if it exists
  let prevIndentLevel = -1
  if (line.number > 1) {
    const prevLine = state.doc.line(line.number - 1)
    const prevMatch = prevLine.text.match(/^(\s*)([*-]|\d+[.)])\s/)

    if (prevMatch) {
      const prevIndent = prevMatch[1] || ''
      prevIndentLevel = Math.floor(prevIndent.length / 8)
    }
  }

  // Check indentation constraints
  if (prevIndentLevel === -1 || currentIndentLevel >= prevIndentLevel + 1) {
    return true
  }

  // Add indentation
  const TAB_SIZE = 8

  // For ordered lists, rebuild the entire line with indentation and a new number
  if (/^\d+[.)]/.test(marker)) {
    // Extract the separator (. or ))
    const separatorMatch = marker.match(/\d+([.)])/)
    if (!separatorMatch) return true

    const separator = separatorMatch[1]

    // Build the new indented line with number 1
    const newIndent = currentIndent + ' '.repeat(TAB_SIZE)
    const newLine = newIndent + `1${separator} ` + content

    // Calculate cursor position - carefully to avoid out-of-bounds errors
    // Position the cursor after the marker in the new line
    const cursorOffset =
      head - (line.from + currentIndent.length + marker.length + 1)
    const newCursorPos =
      line.from + newIndent.length + 2 + separator.length + cursorOffset

    // Make sure the cursor position is within bounds
    const safePos = Math.min(newCursorPos, line.from + newLine.length)

    // Replace the entire line
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: newLine },
      selection: { anchor: safePos },
      scrollIntoView: true
    })
  } else {
    // For unordered lists, just add indentation
    view.dispatch({
      changes: { from: line.from, insert: ' '.repeat(TAB_SIZE) },
      selection: { anchor: head + TAB_SIZE },
      scrollIntoView: true
    })
  }

  return true
}

function smartListOutdent(view) {
  const { state } = view
  let line = state.doc.lineAt(state.selection.main.from)
  const text = line.text

  // Check for list items with leading spaces
  const leadingSpacesMatch = text.match(/^(\s+)/)
  if (!leadingSpacesMatch) return false

  // Check that after the spaces there is a list marker
  const afterSpacesIsListItem = text
    .substring(leadingSpacesMatch[0].length)
    .match(/^([*-]|\d+[.)])\s/)

  if (!afterSpacesIsListItem) return false

  const leadingSpaces = leadingSpacesMatch[1]
  const TAB_SIZE = 8

  // Remove up to 8 spaces
  const spacesToRemove = Math.min(leadingSpaces.length, TAB_SIZE)

  view.dispatch({
    changes: { from: line.from, to: line.from + spacesToRemove, insert: '' },
    selection: {
      anchor: Math.max(state.selection.main.from - spacesToRemove, line.from)
    },
    scrollIntoView: true
  })

  return true
}

// Fixed version of smartListEnter for better undo/redo performance
function smartListEnter(view) {
  const { state } = view
  if (!state.selection.main.empty) return false
  let line = state.doc.lineAt(state.selection.main.from)
  const text = line.text

  // Check if this is a list item (with possible leading spaces)
  // This matches both ordered and unordered lists with indentation
  const listMatch = text.match(/^(\s*)([*-]|\d+[.)])\s(.*)$/)
  if (!listMatch) return false

  // Extract important parts
  const leadingSpaces = listMatch[1] || '' // Indentation spaces
  const marker = listMatch[2] // The marker (*, -, 1., 2), etc.)
  const content = listMatch[3] // Content after the marker

  // If the content is empty, handle as empty list item
  if (content.trim() === '') {
    if (leadingSpaces === '') {
      // Top-level empty: delete the item
      view.dispatch(
        state.update({
          changes: { from: line.from, to: line.to, insert: '' },
          selection: { anchor: line.from },
          annotations: Transaction.addToHistory.of(true)
        })
      )
      return true
    } else {
      // Nested empty: reduce indentation
      const spacesToRemove = Math.min(leadingSpaces.length, 8) // Remove one "tab" worth
      const newIndent = leadingSpaces.slice(spacesToRemove)

      // Calculate the position after the marker in the dedented line
      const markerLength = marker.length + 1 // +1 for the space after the marker
      const posAfterMarker = line.from + newIndent.length + markerLength

      view.dispatch({
        changes: {
          from: line.from,
          to: line.from + spacesToRemove,
          insert: ''
        },
        selection: { anchor: posAfterMarker },
        scrollIntoView: true
      })
      return true
    }
  } else {
    // Create a new list item with the same indentation and marker type
    let insertionPos = line.to
    let newMarker

    // For ordered lists, increment the number
    if (/^\d+[.)]/.test(marker)) {
      const numMatch = marker.match(/^(\d+)([.)])/)
      if (numMatch) {
        const num = parseInt(numMatch[1], 10) + 1
        const separator = numMatch[2] // . or )
        newMarker = `${num}${separator} `
      } else {
        newMarker = marker + ' ' // Fallback, shouldn't happen
      }
    } else {
      // For unordered lists, use the same marker
      newMarker = marker + ' '
    }

    // Build the new line with the same indentation
    const newLine = '\n' + leadingSpaces + newMarker

    // Calculate position after the marker in the new line
    const newLineStart = insertionPos + 1 // +1 for the newline
    const posAfterMarker =
      newLineStart + leadingSpaces.length + newMarker.length

    // Insert the new line
    view.dispatch({
      changes: { from: insertionPos, insert: newLine },
      selection: { anchor: posAfterMarker },
      annotations: Transaction.addToHistory.of(true)
    })

    return true
  }
}

// ── Combine Commands into a Keymap ──
export const smartListKeymap = Prec.highest(
  keymap.of([
    { key: 'Tab', run: smartListIndent },
    { key: 'Shift-Tab', run: smartListOutdent },
    { key: 'Enter', run: smartListEnter }
  ])
)

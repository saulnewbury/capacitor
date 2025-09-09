// plugins/headingSelectionGuard.js

/**
 *
 * Prevents text selections from extending into the heading
 * marker area.
 *
 * Uses a transaction filter with highest precedence.
 *
 * Makes an exception for input events (like heading shortcuts)
 *
 * Adjusts any selection that would start in the heading marker
 * area to start at the beginning of the visible heading text
 * instead
 *
 */

import { EditorState, Prec } from '@codemirror/state'
import { EditorSelection } from '@codemirror/state'

// Create a transaction filter that prevents selections from entering heading marker areas
export const headingSelectionGuard = Prec.highest(
  EditorState.transactionFilter.of((tr) => {
    // Skip if this transaction doesn't modify the selection
    if (!tr.selection) return tr

    // Check if this is a userEvent='input' transaction (likely from shortcuts)
    // These transactions should be allowed to place the cursor anywhere
    if (tr.userEvent === 'input') return tr

    // Get the selection from the transaction
    const selection = tr.selection
    let modified = false
    let ranges = []

    // Check each selection range
    for (let range of selection.ranges) {
      const { from, to, anchor, head } = range

      // Skip cursor positions (where from === to)
      // This allows normal cursor placement to work
      if (from === to) {
        ranges.push(range)
        continue
      }

      // Get the line where the selection starts
      const startPos = Math.min(from, to)
      const line = tr.state.doc.lineAt(startPos)
      const text = line.text

      // Check if this is a heading line
      const headingMatch = text.match(/^(#{1,6})\s/)
      if (!headingMatch) {
        ranges.push(range)
        continue
      }

      const prefixLen = headingMatch[1].length + 1 // Length of heading markers + space
      const headingTextStart = line.from + prefixLen

      // If selection starts before heading text, adjust it
      if (startPos < headingTextStart) {
        modified = true

        // Determine if this is a forward or backward selection
        if (anchor < head) {
          // Forward selection (anchor at beginning)
          ranges.push(EditorSelection.range(headingTextStart, head))
        } else {
          // Backward selection (head at beginning)
          ranges.push(EditorSelection.range(anchor, headingTextStart))
        }
      } else {
        ranges.push(range)
      }
    }

    // If we modified any ranges, create a new selection
    if (modified) {
      return [tr, { selection: EditorSelection.create(ranges) }]
    }

    return tr
  })
)

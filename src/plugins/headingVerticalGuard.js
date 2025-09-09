// plugins/headingVerticalGuard.js

/**
 *
 * Handles vertical cursor movement (up/down arrow keys)
 *
 * When moving up to a heading line, ensures the cursor
 * lands at the beginning of the visible heading text
 *
 * When moving down to a heading line, ensures the cursor
 * lands at the beginning of the visible heading text
 *
 * Has a special case for the last line of the document
 * to prevent cursor wrapping
 *
 * Prevents cursor from moving into heading marker area
 * when pressing up from the start of heading text
 *
 */

import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const headingVerticalGuard = keymap.of([
  // Handle Up Arrow key
  {
    key: 'ArrowUp',
    run(view) {
      const { state } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)
      const text = line.text

      // Check if current line is a heading
      const currentHeadingMatch = text.match(/^(#{1,6})\s/)
      if (currentHeadingMatch) {
        const prefixLen = currentHeadingMatch[1].length + 1
        const headingTextStart = line.from + prefixLen

        // If cursor is at the start of heading text, prevent moving up
        // (this would otherwise move cursor into the hidden marker area)
        if (head === headingTextStart) {
          // Stay at current position - do nothing
          return true
        }
      }

      // Only intercept if we're not already on the first line
      if (line.number <= 1) return false

      // Get the line above
      const aboveLine = state.doc.line(line.number - 1)
      const aboveText = aboveLine.text

      // Check if line above is a heading
      const headingMatch = aboveText.match(/^(#{1,6})\s/)
      if (!headingMatch) return false

      // Calculate column position
      const prefixLen = headingMatch[1].length + 1 // Length of heading markers + space
      const headingTextStart = aboveLine.from + prefixLen
      const currentCol = head - line.from

      // Calculate where cursor would land on the line above
      const targetPos = aboveLine.from + currentCol

      // If cursor would land in heading marker area, move it to start of heading text
      if (targetPos < headingTextStart) {
        view.dispatch({
          selection: EditorSelection.cursor(headingTextStart),
          scrollIntoView: true,
          userEvent: 'move.cursor'
        })
        return true
      }

      // Otherwise let default behavior happen
      return false
    }
  },

  // Handle Down Arrow key
  {
    key: 'ArrowDown',
    run(view) {
      const { state } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)

      // Check if we're on the last line
      if (line.number >= state.doc.lines) return false

      // Get the line below
      const belowLine = state.doc.line(line.number + 1)
      const belowText = belowLine.text

      // Check if line below is a heading
      const headingMatch = belowText.match(/^(#{1,6})\s/)
      if (!headingMatch) return false

      // Calculate column position
      const prefixLen = headingMatch[1].length + 1 // Length of heading markers + space
      const headingTextStart = belowLine.from + prefixLen
      const currentCol = head - line.from

      // Calculate where cursor would land on the line below
      const targetPos = belowLine.from + currentCol

      // If cursor would land in heading marker area, move it to start of heading text
      if (targetPos < headingTextStart) {
        view.dispatch({
          selection: EditorSelection.cursor(headingTextStart),
          scrollIntoView: true,
          userEvent: 'move.cursor'
        })
        return true
      }

      // Otherwise let default behavior happen
      return false
    }
  },

  // Special case: When cursor is on a heading line and user presses down arrow,
  // but heading is the last line in the document
  {
    key: 'ArrowDown',
    run(view) {
      const { state } = view
      const { head } = state.selection.main
      const line = state.doc.lineAt(head)

      // Check if we're already on the last line
      if (line.number < state.doc.lines) return false

      // Check if this last line is a heading
      const headingMatch = line.text.match(/^(#{1,6})\s/)
      if (!headingMatch) return false

      // Calculate where the heading text starts
      const prefixLen = headingMatch[1].length + 1
      const headingTextStart = line.from + prefixLen

      // If cursor is at heading text start and there's no content,
      // prevent moving the cursor beyond the end of the line
      if (head === headingTextStart && line.length === prefixLen) {
        // Stay at current position (effectively doing nothing)
        // This prevents the cursor from wrapping to the start of the line
        return true
      }

      return false
    }
  }
])

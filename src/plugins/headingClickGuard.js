// plugins/headingClickGuard.js

/**
 *
 * Handles mouse clicks on heading lines
 *
 * Prevents the cursor from being placed in the heading
 * marker area when clicking on empty headings
 *
 * Redirects clicks in the marker area to the start
 * of the heading text area
 *
 * Prevents any cursor movement when clicking on the
 * heading indicator tags (h1, h2, etc.) to the left
 *
 */

import { EditorView, ViewPlugin } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

// ViewPlugin to handle heading indicator clicks
const headingIndicatorClickBlocker = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this.handleClick = this.handleClick.bind(this)
      // Use capture phase to intercept clicks before they bubble
      view.dom.addEventListener('mousedown', this.handleClick, true)
    }

    handleClick(event) {
      const target = event.target

      // Check if we clicked on an element with contenteditable inside a heading
      if (
        target &&
        target.hasAttribute &&
        target.hasAttribute('contenteditable')
      ) {
        let parent = target.parentElement
        while (parent) {
          if (
            parent.classList &&
            (parent.classList.contains('cm-heading-1') ||
              parent.classList.contains('cm-heading-2') ||
              parent.classList.contains('cm-heading-3') ||
              parent.classList.contains('cm-heading-4') ||
              parent.classList.contains('cm-heading-5') ||
              parent.classList.contains('cm-heading-6'))
          ) {
            // This is a heading indicator - block the click
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation()
            return
          }
          parent = parent.parentElement
        }
      }
    }

    destroy() {
      this.view.dom.removeEventListener('mousedown', this.handleClick, true)
    }
  }
)

// Original heading click guard for heading text area
export const headingClickGuard = [
  headingIndicatorClickBlocker,
  EditorView.domEventHandlers({
    mousedown(event, view) {
      // Get the position where the click occurred
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false

      const line = view.state.doc.lineAt(pos)
      const text = line.text

      // Check if this is a heading line
      const headingMatch = text.match(/^(#{1,6})\s/)
      if (!headingMatch) return false

      const prefixLen = headingMatch[1].length + 1 // Length of heading markers + space
      const headingTextStart = line.from + prefixLen

      // If click occurred in the heading marker area, redirect to heading text start
      if (pos < headingTextStart) {
        // Prevent the default click behavior
        event.preventDefault()

        // Position cursor at the start of the heading text
        view.dispatch({
          selection: EditorSelection.cursor(headingTextStart),
          scrollIntoView: true,
          userEvent: 'select.pointer'
        })

        return true // Event was handled
      }

      // Let default behavior happen for clicks in the heading text area
      return false
    }
  })
]

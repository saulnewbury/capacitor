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
 * Redirects clicks on the heading indicator tags (h1, h2, etc.)
 * to the start of the heading text
 *
 */

import { EditorSelection } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

// ViewPlugin to handle heading indicator clicks
const headingIndicatorClickHandler = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this.handleMouseDown = this.handleMouseDown.bind(this)
      // Only listen to mousedown to catch the event early
      view.dom.addEventListener('mousedown', this.handleMouseDown, true)
    }

    handleMouseDown(event) {
      // Check if this is a heading indicator element
      const target = event.target

      if (!target || !target.hasAttribute) return

      // Look for contenteditable="false" which marks heading indicators
      if (target.getAttribute('contenteditable') === 'false') {
        // Double-check this is actually within a heading line
        const pos = this.view.posAtCoords({
          x: event.clientX,
          y: event.clientY
        })
        if (pos === null) return

        const line = this.view.state.doc.lineAt(pos)
        const text = line.text
        const headingMatch = text.match(/^(#{1,6})\s/)

        if (headingMatch) {
          // Prevent all default behavior
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()

          const prefixLen = headingMatch[1].length + 1
          const headingTextStart = line.from + prefixLen

          // Ensure we're focused and dispatch immediately
          this.view.focus()

          // Use requestAnimationFrame to ensure DOM has settled
          requestAnimationFrame(() => {
            this.view.dispatch({
              selection: EditorSelection.cursor(headingTextStart),
              scrollIntoView: true,
              userEvent: 'select.pointer'
            })
          })

          return false
        }
      }
    }

    destroy() {
      this.view.dom.removeEventListener('mousedown', this.handleMouseDown, true)
    }
  }
)

// Additional handler for edge cases in heading areas
const headingAreaClickHandler = EditorView.domEventHandlers({
  mousedown(event, view) {
    // Get click position
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    const line = view.state.doc.lineAt(pos)
    const text = line.text

    // Check if this is a heading line
    const headingMatch = text.match(/^(#{1,6})\s/)
    if (!headingMatch) return false

    const prefixLen = headingMatch[1].length + 1
    const headingTextStart = line.from + prefixLen

    // Check if we clicked before the actual heading content starts
    if (pos < headingTextStart) {
      // Check if we clicked on empty space (not on the indicator)
      const target = event.target

      // If target doesn't have contenteditable="false", it's empty space
      if (
        !target ||
        !target.hasAttribute ||
        target.getAttribute('contenteditable') !== 'false'
      ) {
        // For empty space clicks, ensure cursor doesn't jump to wrong position
        // by explicitly setting it where clicked
        event.preventDefault()

        view.dispatch({
          selection: EditorSelection.cursor(pos),
          scrollIntoView: true,
          userEvent: 'select.pointer'
        })

        return true
      }
    }

    return false
  }
})

export const headingClickGuard = [
  headingIndicatorClickHandler,
  headingAreaClickHandler
]

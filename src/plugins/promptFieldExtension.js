// promptFieldExtension.js - Extension to handle ::: trigger and prompt field widget

import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin } from '@codemirror/view'
import { createPromptFieldWidget } from './promptFieldWidget.js'

// State effects for managing prompt fields
const addPromptField = StateEffect.define()
const removePromptField = StateEffect.define()

// State field to track active prompt fields
const promptFieldState = StateField.define({
  create() {
    return Decoration.none
  },
  update(widgets, tr) {
    widgets = widgets.map(tr.changes)

    for (let e of tr.effects) {
      if (e.is(addPromptField)) {
        widgets = widgets.update({
          add: [e.value]
        })
      } else if (e.is(removePromptField)) {
        widgets = widgets.update({
          filter: (from, to, decoration) => {
            return decoration.spec?.widget !== e.value
          }
        })
      }
    }

    return widgets
  },
  provide: (f) => EditorView.decorations.from(f)
})

// Store references to active widgets for better tracking
let activePromptWidgets = new Set()

// View plugin to detect ::: pattern after document changes
const promptTriggerPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
    }

    update(update) {
      if (!update.docChanged) return

      // Check if any insertion created a ::: pattern
      update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const insertedText = inserted.toString()

        // Only process single character insertions (typing)
        if (insertedText.length !== 1 || insertedText !== ':') return

        const newDoc = update.state.doc
        const insertPos = fromB + insertedText.length

        // Check if we have :: before this colon
        if (insertPos >= 3) {
          const beforeText = newDoc.sliceString(insertPos - 3, insertPos)

          console.log('Plugin checking pattern:', {
            insertPos,
            beforeText,
            isTripleColon: beforeText === ':::'
          })

          if (beforeText === ':::') {
            console.log('Triple colon detected by plugin!')

            // Schedule widget insertion after this update completes
            setTimeout(() => {
              this.insertPromptWidget(insertPos - 3, insertPos)
            }, 0)
          }
        }
      })
    }

    insertPromptWidget(start, end) {
      console.log('Inserting prompt widget from', start, 'to', end)

      const widget = createPromptFieldWidget(this.view)

      // Add to our tracking set
      activePromptWidgets.add(widget)
      console.log(
        'Added widget to tracking set, total active widgets:',
        activePromptWidgets.size
      )

      this.view.dispatch({
        changes: {
          from: start,
          to: end,
          insert: '' // Just remove the :::
        },
        effects: [
          addPromptField.of(
            Decoration.widget({
              widget: widget,
              side: 1,
              block: true
            }).range(start) // Widget goes where ::: was
          )
        ]
      })
    }
  }
)

// DOM event handler for outside clicks
const promptFieldClickHandler = EditorView.domEventHandlers({
  mousedown: (event, view) => {
    console.log('Prompt field click handler triggered')
    console.log('Active prompt widgets count:', activePromptWidgets.size)

    // If no active widgets, skip processing
    if (activePromptWidgets.size === 0) {
      console.log('No active widgets, skipping')
      return false
    }

    // Check if click is outside any prompt field widget
    const clickedElement = event.target
    console.log(
      'Clicked element:',
      clickedElement.tagName,
      clickedElement.className
    )

    const promptWidget = clickedElement.closest('.cm-prompt-field-widget')
    console.log('Closest prompt widget found:', !!promptWidget)

    if (!promptWidget) {
      console.log('Click is outside all widgets, removing all prompt fields')

      // Get current widgets from state and remove all prompt field widgets
      const widgets = view.state.field(promptFieldState)
      let effectsToDispatch = []

      widgets.between(0, view.state.doc.length, (from, to, decoration) => {
        // Check if this widget is in our active set
        if (activePromptWidgets.has(decoration.spec?.widget)) {
          console.log('Found active widget to remove')
          effectsToDispatch.push(removePromptField.of(decoration.spec.widget))
          // Remove from tracking set
          activePromptWidgets.delete(decoration.spec.widget)
        }
      })

      console.log('Effects to dispatch:', effectsToDispatch.length)

      // Dispatch removal effects if any
      if (effectsToDispatch.length > 0) {
        console.log('Dispatching removal effects')
        view.dispatch({
          effects: effectsToDispatch
        })
      }
    } else {
      console.log('Click is inside widget, keeping it')
    }

    return false // Don't prevent the event
  }
})

// Key handler for escape key to close prompt fields
const promptFieldKeymap = keymap.of([
  {
    key: 'Escape',
    run: (view) => {
      console.log('Escape key pressed, removing prompt fields')

      // Find any active prompt field widgets and remove them
      const widgets = view.state.field(promptFieldState)
      let effectsToDispatch = []

      widgets.between(0, view.state.doc.length, (from, to, decoration) => {
        if (activePromptWidgets.has(decoration.spec?.widget)) {
          effectsToDispatch.push(removePromptField.of(decoration.spec.widget))
          activePromptWidgets.delete(decoration.spec.widget)
        }
      })

      if (effectsToDispatch.length > 0) {
        view.dispatch({
          effects: effectsToDispatch
        })
      }

      return effectsToDispatch.length > 0
    }
  }
])

// Theme for prompt field styling
const promptFieldTheme = EditorView.theme({
  '.cm-prompt-field-widget': {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  '.prompt-add-context-button': {
    fontFamily: 'inherit !important'
  },

  '.prompt-source-pill': {
    fontFamily: 'inherit !important'
  },

  '.prompt-context-dropdown': {
    fontFamily: 'inherit !important'
  },

  '.prompt-text-area': {
    fontFamily: 'inherit !important'
  },

  '.prompt-submit-button': {
    fontFamily: 'inherit !important'
  }
})

// Export the complete extension
export const promptFieldExtensions = [
  promptFieldState,
  promptTriggerPlugin,
  promptFieldClickHandler,
  promptFieldKeymap,
  promptFieldTheme
]

// Export individual components for external use
export {
  addPromptField,
  createPromptFieldWidget,
  promptFieldState,
  removePromptField
}

// Make removal effect globally available for widgets to use
if (typeof window !== 'undefined') {
  window.removePromptFieldEffect = (widget) => removePromptField.of(widget)
  window.promptFieldState = promptFieldState
  window.activePromptWidgets = activePromptWidgets
}

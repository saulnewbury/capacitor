import { EditorView, Decoration, ViewPlugin } from '@codemirror/view'
import {
  StateField,
  StateEffect,
  RangeSet,
  EditorState,
  Transaction
} from '@codemirror/state'
import { isInsidePromptBlock } from './promptExtension' // Import the isInsidePromptBlock function

// Effect for adding a new code block decoration
const addCodeBlockEffect = StateEffect.define()

// Effect for removing a code block decoration
const removeCodeBlockEffect = StateEffect.define()

// Create a decoration to style code blocks with gray background
const codeBlockTheme = EditorView.theme({
  '.cm-code-block': {
    display: 'block',
    width: '100%'
  }
})

// Keep track of edited end lines for restoration
let editedEndLines = new Set()

// Flag to prevent recursive change handling
let isHandlingChange = false

// Store delayed timeout IDs
let pendingTimeouts = []

// Temporarily ignore next backtick lines when detecting blocks
let linesToIgnore = new Set()

// Helper function for finding next backtick line
function findNextBacktickLine(state, startLineNum) {
  for (let i = startLineNum + 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    if (line.text.trim().startsWith('```')) {
      return line
    }
  }
  return null
}

// Transaction filter to intercept and modify transactions that delete code block start backticks
const codeBlockTransactionFilter = EditorState.transactionFilter.of((tr) => {
  // Skip if we're already handling a change or this is our own transaction
  if (
    isHandlingChange ||
    tr.annotation(Transaction.userEvent) === 'codeblock.combined'
  ) {
    return tr
  }

  if (!tr.docChanged) return tr

  let endLineChange = null
  let foundStartBacktickDeletion = false
  let isWholeLineSelection = false

  // First, check if this is a whole line selection deletion
  tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    const prevState = tr.startState

    // Check if we're deleting across multiple lines
    if (
      prevState.doc.lineAt(fromA).number !== prevState.doc.lineAt(toA).number
    ) {
      isWholeLineSelection = true
    }
    // Or deleting from the beginning of a line to beyond its end
    else if (
      fromA === prevState.doc.lineAt(fromA).from &&
      toA >= prevState.doc.lineAt(toA).to
    ) {
      isWholeLineSelection = true
    }
  })

  // If this is a whole line selection deletion, just let it proceed normally
  if (isWholeLineSelection) {
    return tr
  }

  // Now handle individual backtick deletions
  tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    // Check for deletion (not an insertion)
    if (inserted.toString() === '' && toA - fromA > 0) {
      const prevState = tr.startState
      const prevLine = prevState.doc.lineAt(fromA)

      // If this was a start line with backticks being deleted
      if (prevLine.text.trim().startsWith('```')) {
        // Check if the change is actually removing backticks
        const changedText = prevLine.text.slice(
          fromA - prevLine.from,
          toA - prevLine.from
        )

        if (changedText.includes('`')) {
          // Check if this was actually a code block start by looking for matching end
          const matchingEndLine = findNextBacktickLine(
            prevState,
            prevLine.number
          )

          if (matchingEndLine) {
            foundStartBacktickDeletion = true

            try {
              // Calculate how many lines might be removed by this transaction
              const linesRemoved =
                prevState.doc.lineAt(toA).number -
                prevState.doc.lineAt(fromA).number -
                (tr.newDoc.lineAt(toB).number - tr.newDoc.lineAt(fromB).number)

              // Calculate the new line number for the end backticks
              const newEndLineNumber = matchingEndLine.number - linesRemoved

              // Ensure the calculated line exists
              if (newEndLineNumber > 0 && newEndLineNumber <= tr.newDoc.lines) {
                const newEndLine = tr.newDoc.line(newEndLineNumber)

                if (newEndLine.text.trim().startsWith('```')) {
                  endLineChange = {
                    from: newEndLine.from,
                    to: newEndLine.from + 3,
                    insert: ''
                  }
                }
              }
            } catch (e) {
              // If any errors occur during calculation, don't try to remove end backticks
              console.warn('Error calculating end backtick position:', e)
              endLineChange = null
            }
          }
        }
      }
    }
  })

  // If we found a start backtick deletion AND have a valid end line change
  if (foundStartBacktickDeletion && endLineChange) {
    // Create a combined transaction by composing the changes
    const combinedChanges = tr.changes.compose(
      tr.state.changes([endLineChange])
    )

    return {
      changes: combinedChanges,
      selection: tr.selection,
      effects: tr.effects,
      annotations: [
        ...tr.annotations,
        Transaction.userEvent.of('codeblock.combined')
      ]
    }
  }

  // Otherwise, return the original transaction
  return tr
})

// Helper function to count preceding lines starting with ```
function countPrecedingBacktickLines(state, lineNum) {
  let count = 0
  for (let i = 1; i < lineNum; i++) {
    const line = state.doc.line(i)
    if (line.text.trim().startsWith('```')) {
      count++
    }
  }
  return count
}

// Input handler to handle backtick input directly
const codeBlockInputHandler = EditorView.inputHandler.of(
  (view, from, to, text) => {
    // Only handle single backtick input
    if (text !== '`') return false

    const state = view.state
    const line = state.doc.lineAt(from)

    // Check if cursor is inside a prompt block
    if (isInsidePromptBlock(state, from)) {
      // If inside a prompt block, allow normal backtick insertion without creating a code block
      return false
    }

    // Check if we're completing three backticks at the beginning of a line
    if (from === line.from + 2 && line.text.startsWith('``')) {
      const lineNum = line.number
      const precedingBackticks = countPrecedingBacktickLines(state, lineNum)

      if (precedingBackticks % 2 === 0) {
        // Even count: Start a new code block, insert closing line
        view.dispatch({
          changes: { from, to, insert: '`\n```' },
          selection: { anchor: from + 1 },
          userEvent: 'input.type'
        })
        return true
      } else {
        // Odd count: Close existing code block, just insert the backtick
        return false // Allows default insertion of '`' to complete '```'
      }
    }

    return false
  }
)

// State field to track code blocks
const codeBlockField = StateField.define({
  create() {
    return RangeSet.empty
  },
  update(value, transaction) {
    // Apply changes to match document changes
    value = value.map(transaction.changes)

    // Apply effects for adding and removing decorations
    for (const effect of transaction.effects) {
      // Adding a new decoration
      if (effect.is(addCodeBlockEffect)) {
        const { from, blockPosition } = effect.value
        const decoration = Decoration.line({
          class: `cm-code-block cm-code-block-${blockPosition}`
        })
        value = value.update({ add: [decoration.range(from, from)] })
      }

      // Removing a decoration
      if (effect.is(removeCodeBlockEffect)) {
        const { from } = effect.value
        value = value.update({
          filter: (f, t, decoration) => {
            // Only return false (remove) for decorations at this line
            if (f === from && decoration.spec.class.includes('cm-code-block')) {
              return false
            }
            return true
          }
        })
      }
    }

    return value
  },
  provide(field) {
    return EditorView.decorations.from(field)
  }
})

// Plugin to detect ``` at the beginning of a line and automatically add matching closing ```
const codeBlockPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this.decorations = RangeSet.empty

      // Clear any pending timeouts when plugin is created
      this.clearPendingTimeouts()
    }

    destroy() {
      // Clean up timeouts on destroy
      this.clearPendingTimeouts()
    }

    clearPendingTimeouts() {
      // Clear all pending timeouts
      pendingTimeouts.forEach((id) => clearTimeout(id))
      pendingTimeouts = []
    }

    update(update) {
      if (update.docChanged) {
        // Update decorations after document changes
        const timeoutId = setTimeout(() => {
          if (!this.view) return
          this.updateAllCodeBlockDecorations()
        }, 0)

        pendingTimeouts.push(timeoutId)
      }
    }

    // Get the code block class for a line position
    getCodeBlockClass(state, pos) {
      let result = null

      state
        .field(codeBlockField, false)
        ?.between(pos, pos, (from, to, value) => {
          if (value.spec.class.includes('cm-code-block')) {
            result = value.spec.class
          }
        })

      return result
    }

    // Update all code block decorations
    updateAllCodeBlockDecorations() {
      if (!this.view) return

      isHandlingChange = true

      try {
        const state = this.view.state
        const removeEffects = []

        // First remove all code block decorations
        for (let i = 1; i <= state.doc.lines; i++) {
          const line = state.doc.line(i)
          const codeBlockClass = this.getCodeBlockClass(state, line.from)

          if (codeBlockClass) {
            removeEffects.push(removeCodeBlockEffect.of({ from: line.from }))
          }
        }

        // Then add back all proper decorations
        const currentState = this.view.state
        const addEffects = []

        // Identify all code blocks
        let blocks = this.identifyCodeBlocks(currentState)

        // Apply decorations for each block
        for (const block of blocks) {
          // Skip decorating code blocks that are inside prompt blocks
          const startLine = currentState.doc.line(block.start)
          if (isInsidePromptBlock(currentState, startLine.from)) {
            continue
          }

          // Start line
          addEffects.push(
            addCodeBlockEffect.of({
              from: startLine.from,
              blockPosition: 'start'
            })
          )

          // Middle lines
          if (block.end) {
            for (let i = block.start + 1; i < block.end; i++) {
              const midLine = currentState.doc.line(i)
              addEffects.push(
                addCodeBlockEffect.of({
                  from: midLine.from,
                  blockPosition: 'middle'
                })
              )
            }

            // End line
            const endLine = currentState.doc.line(block.end)
            addEffects.push(
              addCodeBlockEffect.of({
                from: endLine.from,
                blockPosition: 'end'
              })
            )
          } else {
            // For an unclosed block, treat remaining lines as middle
            for (let i = block.start + 1; i <= currentState.doc.lines; i++) {
              // Stop at the next block start
              const line = currentState.doc.line(i)
              if (line.text.trim().startsWith('```')) {
                break
              }
              addEffects.push(
                addCodeBlockEffect.of({
                  from: line.from,
                  blockPosition: 'middle'
                })
              )
            }
          }
        }

        // Dispatch combined effects
        this.view.dispatch({
          effects: [...removeEffects, ...addEffects]
        })
      } finally {
        isHandlingChange = false
      }
    }

    // Identify all code blocks in the document
    identifyCodeBlocks(state) {
      let blocks = []
      let inBlock = false
      let blockStart = 0

      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i)
        if (line.text.trim().startsWith('```')) {
          if (!inBlock) {
            // Start of a new block
            inBlock = true
            blockStart = i
          } else {
            // End of a block
            blocks.push({
              start: blockStart,
              end: i
            })
            inBlock = false
          }
        }
      }

      // Handle unclosed block if exists
      if (inBlock) {
        blocks.push({
          start: blockStart,
          end: null
        })
      }

      return blocks
    }
  }
)

// Range plugin for initial decorations
const codeBlockRangePlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this.decorations = this.buildDecorations(view.state)
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.state)
      }
    }

    // Build decorations for all lines in code blocks with strict pairing
    buildDecorations(state) {
      let decorations = []

      // Store blocks as {start, end} pairs
      let blocks = []

      // First pass - identify all blocks
      let inBlock = false
      let blockStart = 0

      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i)
        if (line.text.trim().startsWith('```')) {
          if (!inBlock) {
            // Start of a new block
            inBlock = true
            blockStart = i
          } else {
            // End of a block
            blocks.push({
              start: blockStart,
              end: i
            })
            inBlock = false
          }
        }
      }

      // Handle unclosed block if exists
      if (inBlock) {
        blocks.push({
          start: blockStart,
          end: null
        })
      }

      // Apply decorations based on strict block pairing
      for (const block of blocks) {
        // Skip decorating code blocks that are inside prompt blocks
        const startLine = state.doc.line(block.start)
        if (isInsidePromptBlock(state, startLine.from)) {
          continue
        }

        // Start line
        decorations.push(this.createDecoration(startLine, 'start'))

        // Middle lines
        if (block.end) {
          for (let i = block.start + 1; i < block.end; i++) {
            const midLine = state.doc.line(i)
            decorations.push(this.createDecoration(midLine, 'middle'))
          }

          // End line
          const endLine = state.doc.line(block.end)
          decorations.push(this.createDecoration(endLine, 'end'))
        } else {
          // For an unclosed block, treat remaining lines as middle
          for (let i = block.start + 1; i <= state.doc.lines; i++) {
            // Stop at the next block start
            const line = state.doc.line(i)
            if (line.text.trim().startsWith('```')) {
              break
            }
            decorations.push(this.createDecoration(line, 'middle'))
          }
        }
      }

      return RangeSet.of(decorations, true)
    }

    createDecoration(line, position) {
      // Line decorations must use zero-length ranges at the start of the line
      return Decoration.line({
        class: `cm-code-block cm-code-block-${position}`
      }).range(line.from, line.from) // Zero-length range at the start of the line
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

// Combine all the code block extensions
export const codeBlockExtensions = [
  codeBlockTheme,
  codeBlockField,
  codeBlockInputHandler,
  codeBlockTransactionFilter,
  codeBlockPlugin,
  codeBlockRangePlugin
]

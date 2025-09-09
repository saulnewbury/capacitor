// promptExtension.js
import { EditorView, Decoration, ViewPlugin } from '@codemirror/view'
import {
  StateField,
  StateEffect,
  RangeSet,
  EditorState,
  EditorSelection,
  Transaction,
  Prec
} from '@codemirror/state'
import { createPromptKeymaps } from './promptKeymaps'
import { PromptSubmitButton, handlePromptSubmit } from './promptSubmitWidget'
import {
  identifyPromptBlocksHelper,
  findPromptBlockContainingLine,
  pendingTimeouts
} from './promptHelpers'

// Effect for adding a new prompt block decoration
const addPromptEffect = StateEffect.define()

// Effect for removing a prompt block decoration
const removePromptEffect = StateEffect.define()

// Effect for adding fence decorations
const addFenceEffect = StateEffect.define()

// Effect for removing fence decorations
const removeFenceEffect = StateEffect.define()

// Create a decoration to style prompt blocks
const promptTheme = EditorView.theme({
  '.cm-prompt': {
    display: 'block',
    width: '100%'
  },
  '.cm-prompt-fence': {
    color: 'var(--prompt-block-colon-color, #909090)'
  }
})

// Keep track of edited end lines for restoration
let editedEndLines = new Set()

// Flag to prevent recursive change handling
let isHandlingChange = false

// Temporarily ignore next colon lines when detecting blocks
let linesToIgnore = new Set()

// Track triple-click state
let clickCount = 0
let lastClickTime = 0
let lastClickPos = null

// Helper function for finding next colon line
function findNextColonLine(state, startLineNum) {
  for (let i = startLineNum + 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    if (line.text.trim().startsWith(':::')) {
      return line
    }
  }
  return null
}

// Helper function to select all middle lines content
function selectAllMiddleContent(view, cursorLine) {
  const state = view.state

  // Check if we're in a prompt middle line
  let isInPromptMiddle = false
  state
    .field(promptField, false)
    ?.between(cursorLine.from, cursorLine.from, (from, to, value) => {
      if (value.spec.class && value.spec.class.includes('cm-prompt-middle')) {
        isInPromptMiddle = true
      }
    })

  if (!isInPromptMiddle) return false

  // Find the prompt block
  const blocks = identifyPromptBlocksHelper(state)

  for (const block of blocks) {
    if (
      cursorLine.number >= block.start &&
      (!block.end || cursorLine.number <= block.end)
    ) {
      // Calculate the range of all middle lines
      const startLine = state.doc.line(block.start + 1) // First middle line
      let endLine = startLine

      // Find the last middle line
      if (block.end) {
        // For closed blocks, end at the line before the closing :::
        endLine = state.doc.line(block.end - 1)
      } else {
        // For unclosed blocks, find the actual last content line
        for (let i = block.start + 1; i <= state.doc.lines; i++) {
          const line = state.doc.line(i)
          if (line.text.trim().startsWith(':::')) {
            break
          }
          endLine = line
        }
      }

      // Select all content in the middle lines
      view.dispatch({
        selection: { anchor: startLine.from, head: endLine.to },
        userEvent: 'select.all.prompt'
      })

      return true
    }
  }

  return false
}

// Transaction filter to intercept and modify transactions
const promptTransactionFilter = EditorState.transactionFilter.of((tr) => {
  // Skip if we're already handling a change or this is our own transaction
  if (
    isHandlingChange ||
    tr.annotation(Transaction.userEvent) === 'prompt.combined' ||
    tr.annotation(Transaction.userEvent) === 'prompt.delete-block'
  ) {
    return tr
  }

  if (!tr.docChanged) return tr

  let blockToDelete = null

  // Check if this change corrupts any fence lines or overlaps with fence lines
  tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    const prevState = tr.startState

    // Check if this is a deletion that overlaps with any fence line
    if (inserted.toString() === '' && toA > fromA) {
      // Find all prompt blocks that might be affected by this deletion
      const blocks = identifyPromptBlocksHelper(prevState)

      for (const block of blocks) {
        const startLine = prevState.doc.line(block.start)
        const endLine = block.end ? prevState.doc.line(block.end) : null

        // Check if deletion overlaps with start fence line
        const deletionOverlapsStart =
          fromA <= startLine.to && toA >= startLine.from

        // Check if deletion overlaps with end fence line (if it exists)
        const deletionOverlapsEnd =
          endLine && fromA <= endLine.to && toA >= endLine.from

        if (deletionOverlapsStart || deletionOverlapsEnd) {
          blockToDelete = block
          break // Exit the loop since we found a block to delete
        }
      }
    }

    // If we haven't found a block to delete yet, check for fence corruption
    if (!blockToDelete) {
      const prevLine = prevState.doc.lineAt(fromA)

      // Check if this line was originally a fence line (starts with :::)
      const wasOriginallyFence = prevLine.text.trim().startsWith(':::')

      if (wasOriginallyFence) {
        // Calculate what the line will look like after the change
        const beforeChange = prevLine.text.slice(0, fromA - prevLine.from)
        const afterChange = prevLine.text.slice(toA - prevLine.from)
        const newLineText = beforeChange + inserted.toString() + afterChange

        // Check if it's still a valid fence (exactly ::: or ::: followed by space)
        const newTrimmed = newLineText.trim()
        const isStillValidFence =
          newTrimmed.startsWith(':::') &&
          (newTrimmed === ':::' || newTrimmed.startsWith('::: '))

        // If this fence line is no longer valid, delete the entire block
        if (!isStillValidFence) {
          const block = findPromptBlockContainingLine(
            prevState,
            prevLine.number
          )
          if (block) {
            blockToDelete = block
          }
        }
      }
    }
  })

  // If we need to delete an entire block
  if (blockToDelete) {
    const prevState = tr.startState
    const startLine = prevState.doc.line(blockToDelete.start)
    const endLine = blockToDelete.end
      ? prevState.doc.line(blockToDelete.end)
      : startLine

    // Calculate range to delete
    let deleteFrom = startLine.from
    let deleteTo = endLine.to

    // If there's content after the block, include the newline
    if (deleteTo < prevState.doc.length) {
      deleteTo += 1
    }

    // Create a transaction that deletes the entire block
    return {
      changes: prevState.changes([
        { from: deleteFrom, to: deleteTo, insert: '' }
      ]),
      selection: EditorSelection.cursor(deleteFrom),
      effects: [],
      annotations: [Transaction.userEvent.of('prompt.delete-block')]
    }
  }

  // Otherwise, return the original transaction
  return tr
})

// Helper function to count preceding lines starting with :::
function countPrecedingColonLines(state, lineNum) {
  let count = 0
  for (let i = 1; i < lineNum; i++) {
    const line = state.doc.line(i)
    if (line.text.trim().startsWith(':::')) {
      count++
    }
  }
  return count
}

// Input handler to handle colon input directly
const promptInputHandler = EditorView.inputHandler.of(
  (view, from, to, text) => {
    // Only handle single colon input
    if (text !== ':') return false

    const state = view.state
    const line = state.doc.lineAt(from)

    // Check if we're completing three colons at the beginning of a line
    if (from === line.from + 2 && line.text.startsWith('::')) {
      const lineNum = line.number
      const precedingColons = countPrecedingColonLines(state, lineNum)

      if (precedingColons % 2 === 0) {
        // Even count: Start a new prompt block
        const isLastLine = lineNum === state.doc.lines

        // If we're on the last line, add an extra newline after the closing :::
        const insertText = isLastLine ? ':\n\n:::\n' : ':\n\n:::'
        const cursorOffset = from + 2 // Position cursor on the empty line between fences

        view.dispatch({
          changes: { from, to, insert: insertText },
          selection: { anchor: cursorOffset },
          userEvent: 'input.type'
        })
        return true
      } else {
        // Odd count: Close existing prompt block, just insert the colon
        return false // Allows default insertion of ':' to complete ':::'
      }
    }

    return false
  }
)

// Escape key handler to remove prompt blocks
const promptEscapeHandler = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key === 'Escape') {
      const state = view.state
      const cursor = state.selection.main.head
      const cursorLine = state.doc.lineAt(cursor)

      // Check if cursor is on a line with cm-prompt class
      let isInPromptBlock = false
      state
        .field(promptField, false)
        ?.between(cursorLine.from, cursorLine.from, (from, to, value) => {
          if (value.spec.class && value.spec.class.includes('cm-prompt')) {
            isInPromptBlock = true
          }
        })

      if (isInPromptBlock) {
        // Find the prompt block that contains this line
        const blocks = identifyPromptBlocksHelper(state)

        for (const block of blocks) {
          const blockStartLine = state.doc.line(block.start)
          const blockEndLine = block.end ? state.doc.line(block.end) : null

          // Check if cursor line is within this block
          if (
            cursorLine.number >= blockStartLine.number &&
            (!blockEndLine || cursorLine.number <= blockEndLine.number)
          ) {
            // Calculate range to delete
            let deleteFrom = blockStartLine.from
            let deleteTo = blockEndLine ? blockEndLine.to : cursorLine.to

            // If there's content after the block, include the newline
            if (deleteTo < state.doc.length) {
              deleteTo += 1
            }

            // Dispatch the deletion
            view.dispatch({
              changes: { from: deleteFrom, to: deleteTo, insert: '' },
              selection: { anchor: deleteFrom },
              userEvent: 'delete.prompt'
            })

            event.preventDefault()
            return true
          }
        }
      }
    }
    return false
  }
})

// Mouse click handler for prompt blocks with triple-click support
const promptClickHandler = EditorView.domEventHandlers({
  mousedown(event, view) {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    const state = view.state
    const clickLine = state.doc.lineAt(pos)

    // Track triple-click
    const now = Date.now()
    const timeDiff = now - lastClickTime
    const posDiff = lastClickPos ? Math.abs(pos - lastClickPos) : Infinity

    if (timeDiff < 500 && posDiff < 5) {
      clickCount++
    } else {
      clickCount = 1
    }

    lastClickTime = now
    lastClickPos = pos

    // Check if click is on a line with cm-prompt-start or cm-prompt-end class
    let isStartFence = false
    let isEndFence = false
    let isMiddleLine = false

    state
      .field(promptField, false)
      ?.between(clickLine.from, clickLine.from, (from, to, value) => {
        if (value.spec.class && value.spec.class.includes('cm-prompt-start')) {
          isStartFence = true
        }
        if (value.spec.class && value.spec.class.includes('cm-prompt-end')) {
          isEndFence = true
        }
        if (value.spec.class && value.spec.class.includes('cm-prompt-middle')) {
          isMiddleLine = true
        }
      })

    // Handle triple-click on middle lines
    if (clickCount === 3 && isMiddleLine) {
      selectAllMiddleContent(view, clickLine)
      event.preventDefault()
      return true
    }

    if (isStartFence || isEndFence) {
      // Find the prompt block that contains this line
      const blocks = identifyPromptBlocksHelper(state)

      for (const block of blocks) {
        // Handle opening fence click
        if (isStartFence && clickLine.number === block.start) {
          // Find the first middle line
          const firstMiddleLineNum = block.start + 1
          const firstMiddleLine = state.doc.line(firstMiddleLineNum)

          // Position cursor at the beginning of the first middle line
          const newPos = firstMiddleLine.from

          // Dispatch the cursor position change
          view.dispatch({
            selection: { anchor: newPos },
            userEvent: 'select.pointer'
          })

          // Prevent default click behavior
          event.preventDefault()
          return true
        }

        // Handle closing fence click
        if (isEndFence && block.end && clickLine.number === block.end) {
          // Find the last middle line
          const lastMiddleLineNum = block.end - 1
          const lastMiddleLine = state.doc.line(lastMiddleLineNum)

          // Position cursor at the end of the last middle line
          const newPos = lastMiddleLine.to

          // Dispatch the cursor position change
          view.dispatch({
            selection: { anchor: newPos },
            userEvent: 'select.pointer'
          })

          // Prevent default click behavior
          event.preventDefault()
          return true
        }
      }
    }

    return false
  }
})

// State field to track prompt blocks and fences
export const promptField = StateField.define({
  create() {
    return RangeSet.empty
  },
  update(value, transaction) {
    // Apply changes to match document changes
    value = value.map(transaction.changes)

    // Apply effects for adding and removing decorations
    for (const effect of transaction.effects) {
      // Adding a new line decoration
      if (effect.is(addPromptEffect)) {
        const { from, blockPosition } = effect.value
        const decoration = Decoration.line({
          class: `cm-prompt cm-prompt-${blockPosition}`
        })
        value = value.update({ add: [decoration.range(from, from)] })
      }

      // Adding a new fence decoration
      if (effect.is(addFenceEffect)) {
        const { from, to } = effect.value
        const decoration = Decoration.mark({
          class: 'cm-prompt-fence'
        })
        value = value.update({ add: [decoration.range(from, to)] })
      }

      // Removing a line decoration
      if (effect.is(removePromptEffect)) {
        const { from } = effect.value
        value = value.update({
          filter: (f, t, decoration) => {
            // Only return false (remove) for line decorations at this line
            if (
              f === from &&
              decoration.spec.class &&
              decoration.spec.class.includes('cm-prompt') &&
              !decoration.spec.class.includes('cm-prompt-fence')
            ) {
              return false
            }
            return true
          }
        })
      }

      // Removing fence decorations
      if (effect.is(removeFenceEffect)) {
        const { from, to } = effect.value
        value = value.update({
          filter: (f, t, decoration) => {
            // Remove fence decorations in the specified range
            if (
              f >= from &&
              t <= to &&
              decoration.spec.class === 'cm-prompt-fence'
            ) {
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

// Plugin to detect ::: at the beginning of a line and automatically add matching closing :::
const promptPlugin = ViewPlugin.fromClass(
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
      pendingTimeouts.length = 0
    }

    update(update) {
      if (update.docChanged) {
        // Update decorations after document changes
        const timeoutId = setTimeout(() => {
          if (!this.view) return
          this.updateAllPromptDecorations()
        }, 0)

        pendingTimeouts.push(timeoutId)
      }
    }

    // Get the prompt block class for a line position
    getPromptClass(state, pos) {
      let result = null

      state.field(promptField, false)?.between(pos, pos, (from, to, value) => {
        if (value.spec.class.includes('cm-prompt')) {
          result = value.spec.class
        }
      })

      return result
    }

    // Update all prompt block decorations
    updateAllPromptDecorations() {
      if (!this.view) return

      isHandlingChange = true

      try {
        const state = this.view.state
        const removeEffects = []
        const removeFenceEffects = []

        // First remove all prompt block decorations and fence decorations
        for (let i = 1; i <= state.doc.lines; i++) {
          const line = state.doc.line(i)
          const promptClass = this.getPromptClass(state, line.from)

          if (promptClass) {
            removeEffects.push(removePromptEffect.of({ from: line.from }))
          }
        }

        // Remove all fence decorations
        removeFenceEffects.push(
          removeFenceEffect.of({ from: 0, to: state.doc.length })
        )

        // Then add back all proper decorations
        const currentState = this.view.state
        const addEffects = []
        const addFenceEffects = []

        // Identify all prompt blocks
        let blocks = this.identifyPromptBlocks(currentState)

        // Apply decorations for each block
        for (const block of blocks) {
          // Start line
          const startLine = currentState.doc.line(block.start)
          addEffects.push(
            addPromptEffect.of({
              from: startLine.from,
              blockPosition: 'start'
            })
          )

          // Add fence decoration for start line
          const startFenceMatch = startLine.text.match(/^(\s*)(:::)/)
          if (startFenceMatch) {
            const fenceStart = startLine.from + startFenceMatch[1].length
            const fenceEnd = fenceStart + 3
            addFenceEffects.push(
              addFenceEffect.of({
                from: fenceStart,
                to: fenceEnd
              })
            )
          }

          // Middle lines with placeholder detection
          if (block.end) {
            let isFirstMiddle = true
            for (let i = block.start + 1; i < block.end; i++) {
              const midLine = currentState.doc.line(i)
              let blockPosition = 'middle'

              // Add placeholder class to the first middle line (second line of the block) only if it's empty
              // AND there are no other middle lines following it
              if (isFirstMiddle) {
                const lineContent = midLine.text.trim()
                const hasFollowingMiddleLines = i + 1 < block.end // Check if there are more lines before the end

                if (lineContent === '' && !hasFollowingMiddleLines) {
                  blockPosition = 'middle cm-prompt-placeholder'
                }
                isFirstMiddle = false
              }

              addEffects.push(
                addPromptEffect.of({
                  from: midLine.from,
                  blockPosition: blockPosition
                })
              )
            }

            // End line
            const endLine = currentState.doc.line(block.end)
            addEffects.push(
              addPromptEffect.of({
                from: endLine.from,
                blockPosition: 'end'
              })
            )

            // Add fence decoration for end line
            const endFenceMatch = endLine.text.match(/^(\s*)(:::)/)
            if (endFenceMatch) {
              const fenceStart = endLine.from + endFenceMatch[1].length
              const fenceEnd = fenceStart + 3
              addFenceEffects.push(
                addFenceEffect.of({
                  from: fenceStart,
                  to: fenceEnd
                })
              )
            }
          } else {
            // For an unclosed block, treat remaining lines as middle
            let isFirstMiddle = true
            const middleLines = []

            // First collect all middle lines
            for (let i = block.start + 1; i <= currentState.doc.lines; i++) {
              const line = state.doc.line(i)
              if (line.text.trim().startsWith(':::')) {
                break
              }
              middleLines.push({ lineNum: i, line: line })
            }

            // Then process them with knowledge of how many there are
            for (const { lineNum, line } of middleLines) {
              let blockPosition = 'middle'

              // Add placeholder class to the first middle line (second line of the block) only if it's empty
              // AND there are no other middle lines following it
              if (isFirstMiddle) {
                const lineContent = line.text.trim()
                const hasFollowingMiddleLines = middleLines.length > 1

                if (lineContent === '' && !hasFollowingMiddleLines) {
                  blockPosition = 'middle cm-prompt-placeholder'
                }
                isFirstMiddle = false
              }

              addEffects.push(
                addPromptEffect.of({
                  from: line.from,
                  blockPosition: blockPosition
                })
              )
            }
          }
        }

        // Dispatch combined effects
        this.view.dispatch({
          effects: [
            ...removeEffects,
            ...removeFenceEffects,
            ...addEffects,
            ...addFenceEffects
          ]
        })
      } finally {
        isHandlingChange = false
      }
    }

    // Identify all prompt blocks in the document
    identifyPromptBlocks(state) {
      return identifyPromptBlocksHelper(state)
    }
  }
)

// Range plugin for initial decorations
const promptRangePlugin = ViewPlugin.fromClass(
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

    // Build decorations for all lines in prompt blocks with strict pairing
    buildDecorations(state) {
      let decorations = []

      // Store blocks as {start, end} pairs
      let blocks = []

      // First pass - identify all blocks
      let inBlock = false
      let blockStart = 0

      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i)
        const trimmedText = line.text.trim()

        // Only consider lines that start with EXACTLY three colons as valid fences
        if (
          trimmedText.startsWith(':::') &&
          (trimmedText === ':::' || trimmedText.startsWith('::: '))
        ) {
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

      // Handle unclosed block if exists - but only if there's content after the opening fence
      if (inBlock) {
        // Check if there are any non-fence lines after the opening fence
        let hasContent = false
        for (let i = blockStart + 1; i <= state.doc.lines; i++) {
          const line = state.doc.line(i)
          const trimmedText = line.text.trim()
          if (!trimmedText.startsWith(':::') && trimmedText !== '') {
            hasContent = true
            break
          }
        }

        if (hasContent) {
          blocks.push({
            start: blockStart,
            end: null
          })
        }
        // If no content, don't treat it as a valid block (orphaned fence)
      }

      // Apply decorations based on strict block pairing
      for (const block of blocks) {
        // Start line
        const startLine = state.doc.line(block.start)
        decorations.push(this.createDecoration(startLine, 'start'))

        // Add fence decoration for start line
        const startFenceMatch = startLine.text.match(/^(\s*)(:::)/)
        if (startFenceMatch) {
          const fenceStart = startLine.from + startFenceMatch[1].length
          const fenceEnd = fenceStart + 3
          decorations.push(
            Decoration.mark({
              class: 'cm-prompt-fence'
            }).range(fenceStart, fenceEnd)
          )
        }

        // Middle lines with placeholder detection
        if (block.end) {
          let isFirstMiddle = true
          for (let i = block.start + 1; i < block.end; i++) {
            const midLine = state.doc.line(i)
            let position = 'middle'

            // Add placeholder class to the first middle line (second line of the block) only if it's empty
            // AND there are no other middle lines following it
            if (isFirstMiddle) {
              const lineContent = midLine.text.trim()
              const hasFollowingMiddleLines = i + 1 < block.end // Check if there are more lines before the end

              if (lineContent === '' && !hasFollowingMiddleLines) {
                position = 'middle cm-prompt-placeholder'
              }
              isFirstMiddle = false
            }

            decorations.push(this.createDecoration(midLine, position))
          }

          // End line
          const endLine = state.doc.line(block.end)
          decorations.push(this.createDecoration(endLine, 'end'))

          // Add the submit button widget - UPDATED LINE
          decorations.push(
            Decoration.widget({
              widget: new PromptSubmitButton(block.end), // Pass line number, not block
              side: 1, // Place after the line content
              block: false // Inline widget
            }).range(endLine.to)
          )

          // Add fence decoration for end line
          const endFenceMatch = endLine.text.match(/^(\s*)(:::)/)
          if (endFenceMatch) {
            const fenceStart = endLine.from + endFenceMatch[1].length
            const fenceEnd = fenceStart + 3
            decorations.push(
              Decoration.mark({
                class: 'cm-prompt-fence'
              }).range(fenceStart, fenceEnd)
            )
          }
        } else {
          // For an unclosed block, treat remaining lines as middle
          let isFirstMiddle = true
          const middleLines = []

          // First collect all middle lines
          for (let i = block.start + 1; i <= state.doc.lines; i++) {
            const line = state.doc.line(i)
            if (line.text.trim().startsWith(':::')) {
              break
            }
            middleLines.push({ lineNum: i, line: line })
          }

          // Then process them with knowledge of how many there are
          for (const { lineNum, line } of middleLines) {
            let position = 'middle'

            // Add placeholder class to the first middle line (second line of the block) only if it's empty
            // AND there are no other middle lines following it
            if (isFirstMiddle) {
              const lineContent = line.text.trim()
              const hasFollowingMiddleLines = middleLines.length > 1

              if (lineContent === '' && !hasFollowingMiddleLines) {
                position = 'middle cm-prompt-placeholder'
              }
              isFirstMiddle = false
            }

            decorations.push(this.createDecoration(line, position))
          }
        }
      }

      return RangeSet.of(decorations, true)
    }

    createDecoration(line, position) {
      // Line decorations must use zero-length ranges at the start of the line
      return Decoration.line({
        class: `cm-prompt cm-prompt-${position}`
      }).range(line.from, line.from) // Zero-length range at the start of the line
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

export function isInsidePromptBlock(state, pos) {
  let isInPrompt = false

  state.field(promptField, false)?.between(pos, pos, (from, to, value) => {
    if (value.spec.class && value.spec.class.includes('cm-prompt')) {
      isInPrompt = true
    }
  })

  return isInPrompt
}

// Combine all the prompt block extensions
export const promptExtensions = [
  promptTheme,
  promptField,
  promptInputHandler,
  promptEscapeHandler,
  promptClickHandler,
  createPromptKeymaps(promptField),
  promptTransactionFilter,
  promptPlugin,
  promptRangePlugin
]

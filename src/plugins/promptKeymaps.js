// promptKeymaps.js
// Updated arrow key navigation that handles visual line wrapping
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { handlePromptSubmit } from './promptSubmitWidget'
import {
  identifyPromptBlocksHelper,
  checkIsInPromptMiddle
} from './promptHelpers'

// Helper function to get visual line boundaries using DOM measurements
function getVisualLineBoundaries(view, pos) {
  try {
    // Get the DOM coordinates for the position
    const coords = view.coordsAtPos(pos)
    if (!coords) return null

    // Get the line at this position
    const line = view.state.doc.lineAt(pos)

    // Find the start of the visual line by looking for positions with the same y-coordinate
    let visualStart = line.from
    let visualEnd = line.to

    // Check positions from the start of the logical line to find visual line start
    for (let i = line.from; i <= pos; i++) {
      const testCoords = view.coordsAtPos(i)
      if (testCoords && Math.abs(testCoords.top - coords.top) < 2) {
        visualStart = i
        break
      }
    }

    // Check positions from current position to end of logical line to find visual line end
    for (let i = pos; i <= line.to; i++) {
      const testCoords = view.coordsAtPos(i)
      if (testCoords && Math.abs(testCoords.top - coords.top) > 2) {
        visualEnd = i - 1
        break
      }
    }

    return { from: visualStart, to: visualEnd, line: line }
  } catch (e) {
    // Fallback to logical line boundaries if DOM measurement fails
    const line = view.state.doc.lineAt(pos)
    return { from: line.from, to: line.to, line: line }
  }
}

// Helper function to check if cursor is at the visual start of a prompt block
function isAtVisualStartOfPrompt(view, cursor, block) {
  const state = view.state
  const firstMiddleLine = state.doc.line(block.start + 1)

  // Check if cursor is in the first middle line
  if (cursor < firstMiddleLine.from || cursor > firstMiddleLine.to) {
    return false
  }

  // Get the visual line boundaries
  const visualBounds = getVisualLineBoundaries(view, cursor)
  const firstLineVisualBounds = getVisualLineBoundaries(
    view,
    firstMiddleLine.from
  )

  if (!visualBounds || !firstLineVisualBounds) {
    // Fallback: check if we're at the logical start of the first middle line
    return cursor === firstMiddleLine.from
  }

  // Check if we're on the first visual line of the first middle line
  return visualBounds.from === firstLineVisualBounds.from
}

// Helper function to check if cursor is at the visual end of a prompt block
function isAtVisualEndOfPrompt(view, cursor, block) {
  const state = view.state

  // Find the last middle line
  let lastMiddleLineNum
  if (block.end) {
    lastMiddleLineNum = block.end - 1
  } else {
    // For unclosed blocks, find the actual last middle line
    lastMiddleLineNum = block.start
    for (let i = block.start + 1; i <= state.doc.lines; i++) {
      const line = state.doc.line(i)
      if (line.text.trim().startsWith(':::')) {
        break
      }
      lastMiddleLineNum = i
    }
  }

  const lastMiddleLine = state.doc.line(lastMiddleLineNum)

  // Check if cursor is in the last middle line
  if (cursor < lastMiddleLine.from || cursor > lastMiddleLine.to) {
    return false
  }

  // Get the visual line boundaries
  const visualBounds = getVisualLineBoundaries(view, cursor)
  const lastLineVisualBounds = getVisualLineBoundaries(view, lastMiddleLine.to)

  if (!visualBounds || !lastLineVisualBounds) {
    // Fallback: check if we're at the logical end of the last middle line
    return cursor === lastMiddleLine.to
  }

  // Check if we're on the last visual line of the last middle line
  return visualBounds.from === lastLineVisualBounds.from
}

// Helper function to select all middle lines content
function selectAllMiddleContent(view, promptField) {
  const state = view.state
  const cursor = state.selection.main.head
  const cursorLine = state.doc.lineAt(cursor)

  // Check if we're in a prompt middle line
  const isInPromptMiddle = checkIsInPromptMiddle(state, cursorLine, promptField)

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

// Create keymaps that accept promptField as a parameter
export function createPromptKeymaps(promptField) {
  // Helper function to select or delete prompt content
  function handlePromptContentAction(view, deleteIfEmpty = false) {
    const state = view.state
    const cursor = state.selection.main.head
    const cursorLine = state.doc.lineAt(cursor)

    // Check if there's already a selection (text is highlighted)
    const hasSelection = !state.selection.main.empty

    // If text is already selected, allow normal behavior (delete selection)
    if (hasSelection) {
      return false
    }

    const isInPromptMiddle = checkIsInPromptMiddle(
      state,
      cursorLine,
      promptField
    )

    if (isInPromptMiddle) {
      // Find the prompt block that contains this line
      const blocks = identifyPromptBlocksHelper(state)

      for (const block of blocks) {
        // Calculate first middle line number
        const firstMiddleLineNum = block.start + 1

        // Check if cursor line is within this block and is the first middle line
        if (
          cursorLine.number >= block.start &&
          (!block.end || cursorLine.number <= block.end) &&
          cursorLine.number === firstMiddleLineNum
        ) {
          // Check if cursor is at the start of the line
          if (cursor === cursorLine.from) {
            // Calculate the range of all text content in the prompt block
            const startLine = state.doc.line(block.start + 1) // First middle line
            let endLine = startLine

            // Find the last line with content
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

            // Check if there's actually text content to select
            let hasContent = false
            for (let i = block.start + 1; i <= endLine.number; i++) {
              const line = state.doc.line(i)
              if (line.text.trim() !== '') {
                hasContent = true
                break
              }
            }

            if (hasContent) {
              // Select all text content in the prompt block
              view.dispatch({
                selection: { anchor: startLine.from, head: endLine.to },
                userEvent: 'select.prompt'
              })

              return true
            } else if (deleteIfEmpty) {
              // No content - remove the entire prompt block
              const blockStartLine = state.doc.line(block.start)
              const blockEndLine = block.end
                ? state.doc.line(block.end)
                : endLine

              // Calculate range to delete
              let deleteFrom = blockStartLine.from
              let deleteTo = blockEndLine.to

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

              return true
            }
          }
        }
      }
    }

    // Allow normal behavior
    return false
  }

  // Arrow key keymap for prompt blocks with visual line support
  const promptArrowKeymap = keymap.of([
    {
      key: 'ArrowUp',
      run: (view) => {
        const state = view.state
        const cursor = state.selection.main.head
        const cursorLine = state.doc.lineAt(cursor)

        const isInPromptMiddle = checkIsInPromptMiddle(
          state,
          cursorLine,
          promptField
        )

        if (isInPromptMiddle) {
          // Find the prompt block that contains this line
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            // Check if cursor is within this block
            if (
              cursorLine.number >= block.start &&
              (!block.end || cursorLine.number <= block.end)
            ) {
              // Check if we're at the visual start of the prompt
              if (isAtVisualStartOfPrompt(view, cursor, block)) {
                // Check if there's a line above the opening fence
                const openingFenceLineNum = block.start
                if (openingFenceLineNum > 1) {
                  // There's a line above the opening fence, move cursor there
                  const lineAboveFence = state.doc.line(openingFenceLineNum - 1)

                  // Try to maintain horizontal cursor position or go to end of line
                  const visualBounds = getVisualLineBoundaries(view, cursor)
                  const horizontalOffset = visualBounds
                    ? cursor - visualBounds.from
                    : 0
                  const targetPos = Math.min(
                    lineAboveFence.from + horizontalOffset,
                    lineAboveFence.to
                  )

                  view.dispatch({
                    selection: { anchor: targetPos },
                    userEvent: 'select.arrow'
                  })

                  return true
                } else {
                  // No line above the opening fence, block the up arrow movement
                  return true
                }
              }
              // If not at visual start, allow normal arrow behavior within the prompt
              return false
            }
          }
        } else {
          // Check if cursor is on the line below a closing fence
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            // Only check blocks that have a closing fence
            if (block.end) {
              const closingFenceLineNum = block.end

              // Check if cursor is on the line immediately below the closing fence
              if (cursorLine.number === closingFenceLineNum + 1) {
                // Move cursor to the end of the last middle line
                const lastMiddleLineNum = block.end - 1
                const lastMiddleLine = state.doc.line(lastMiddleLineNum)

                // Try to maintain horizontal position on the last visual line
                const visualBounds = getVisualLineBoundaries(view, cursor)
                const horizontalOffset = visualBounds
                  ? cursor - visualBounds.from
                  : 0
                const lastLineVisualBounds = getVisualLineBoundaries(
                  view,
                  lastMiddleLine.to
                )
                const targetPos = Math.min(
                  lastLineVisualBounds.from + horizontalOffset,
                  lastMiddleLine.to
                )

                view.dispatch({
                  selection: { anchor: targetPos },
                  userEvent: 'select.arrow'
                })

                return true
              }
            }
          }
        }

        // Allow normal behavior
        return false
      }
    },
    {
      key: 'ArrowDown',
      run: (view) => {
        const state = view.state
        const cursor = state.selection.main.head
        const cursorLine = state.doc.lineAt(cursor)

        const isInPromptMiddle = checkIsInPromptMiddle(
          state,
          cursorLine,
          promptField
        )

        if (isInPromptMiddle) {
          // Find the prompt block that contains this line
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            // Check if cursor is within this block
            if (
              cursorLine.number >= block.start &&
              (!block.end || cursorLine.number <= block.end)
            ) {
              // Check if we're at the visual end of the prompt
              if (isAtVisualEndOfPrompt(view, cursor, block)) {
                // For closed blocks, check if there's a line below the closing fence
                if (block.end) {
                  const closingFenceLineNum = block.end
                  if (closingFenceLineNum < state.doc.lines) {
                    // There's a line below the closing fence, move cursor there
                    const lineBelowFence = state.doc.line(
                      closingFenceLineNum + 1
                    )

                    // Try to maintain horizontal cursor position
                    const visualBounds = getVisualLineBoundaries(view, cursor)
                    const horizontalOffset = visualBounds
                      ? cursor - visualBounds.from
                      : 0
                    const targetPos = Math.min(
                      lineBelowFence.from + horizontalOffset,
                      lineBelowFence.to
                    )

                    view.dispatch({
                      selection: { anchor: targetPos },
                      userEvent: 'select.arrow'
                    })

                    return true
                  } else {
                    // No line below the closing fence, block the down arrow movement
                    return true
                  }
                } else {
                  // For unclosed blocks, block the down arrow movement
                  return true
                }
              }
              // If not at visual end, allow normal arrow behavior within the prompt
              return false
            }
          }
        } else {
          // Check if cursor is on the line above an opening fence
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            const openingFenceLineNum = block.start

            // Check if cursor is on the line immediately above the opening fence
            if (cursorLine.number === openingFenceLineNum - 1) {
              // Move cursor to the start of the first middle line
              const firstMiddleLineNum = block.start + 1
              const firstMiddleLine = state.doc.line(firstMiddleLineNum)

              // Try to maintain horizontal position on the first visual line
              const visualBounds = getVisualLineBoundaries(view, cursor)
              const horizontalOffset = visualBounds
                ? cursor - visualBounds.from
                : 0
              const firstLineVisualBounds = getVisualLineBoundaries(
                view,
                firstMiddleLine.from
              )
              const targetPos = Math.min(
                firstLineVisualBounds.from + horizontalOffset,
                firstMiddleLine.to
              )

              view.dispatch({
                selection: { anchor: targetPos },
                userEvent: 'select.arrow'
              })

              return true
            }
          }
        }

        // Allow normal behavior
        return false
      }
    },
    {
      key: 'ArrowLeft',
      run: (view) => {
        const state = view.state
        const cursor = state.selection.main.head
        const cursorLine = state.doc.lineAt(cursor)

        const isInPromptMiddle = checkIsInPromptMiddle(
          state,
          cursorLine,
          promptField
        )

        if (isInPromptMiddle) {
          // Find the prompt block that contains this line
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            // Calculate first middle line number
            const firstMiddleLineNum = block.start + 1

            // Check if cursor line is within this block and is the first middle line
            if (
              cursorLine.number >= block.start &&
              (!block.end || cursorLine.number <= block.end) &&
              cursorLine.number === firstMiddleLineNum
            ) {
              // Check if cursor is at the start of the line
              if (cursor === cursorLine.from) {
                // Block the left arrow movement
                return true
              }
            }
          }
        } else {
          // Check if cursor is on the line below a closing fence
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            // Only check blocks that have a closing fence
            if (block.end) {
              const closingFenceLineNum = block.end

              // Check if cursor is on the line immediately below the closing fence
              if (cursorLine.number === closingFenceLineNum + 1) {
                // Check if cursor is at the start of the line
                if (cursor === cursorLine.from) {
                  // Move cursor to the end of the last middle line
                  const lastMiddleLineNum = block.end - 1
                  const lastMiddleLine = state.doc.line(lastMiddleLineNum)

                  view.dispatch({
                    selection: { anchor: lastMiddleLine.to },
                    userEvent: 'select.arrow'
                  })

                  return true
                }
              }
            }
          }
        }

        // Allow normal behavior
        return false
      }
    },
    {
      key: 'ArrowRight',
      run: (view) => {
        const state = view.state
        const cursor = state.selection.main.head
        const cursorLine = state.doc.lineAt(cursor)

        const isInPromptMiddle = checkIsInPromptMiddle(
          state,
          cursorLine,
          promptField
        )

        if (isInPromptMiddle) {
          // Find the prompt block that contains this line
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            // Calculate last middle line number
            let lastMiddleLineNum = block.end ? block.end - 1 : null

            // For unclosed blocks, find the actual last middle line
            if (!block.end) {
              let actualLastMiddle = block.start
              for (let i = block.start + 1; i <= state.doc.lines; i++) {
                const line = state.doc.line(i)
                if (line.text.trim().startsWith(':::')) {
                  break
                }
                actualLastMiddle = i
              }
              lastMiddleLineNum = actualLastMiddle
            }

            // Check if cursor line is within this block and is the last middle line
            if (
              cursorLine.number >= block.start &&
              (!block.end || cursorLine.number <= block.end) &&
              cursorLine.number === lastMiddleLineNum
            ) {
              // Check if cursor is at the end of the line
              if (cursor === cursorLine.to) {
                // Block the right arrow movement
                return true
              }
            }
          }
        } else {
          // Check if cursor is on the line above an opening fence
          const blocks = identifyPromptBlocksHelper(state)

          for (const block of blocks) {
            const openingFenceLineNum = block.start

            // Check if cursor is on the line immediately above the opening fence
            if (cursorLine.number === openingFenceLineNum - 1) {
              // Check if cursor is at the end of the line (no text after it)
              if (cursor === cursorLine.to) {
                // Move cursor to the start of the first middle line
                const firstMiddleLineNum = block.start + 1
                const firstMiddleLine = state.doc.line(firstMiddleLineNum)

                view.dispatch({
                  selection: { anchor: firstMiddleLine.from },
                  userEvent: 'select.arrow'
                })

                return true
              }
            }
          }
        }

        // Allow normal behavior
        return false
      }
    },
    {
      key: 'Mod-Enter', // Cmd+Enter on Mac, Ctrl+Enter on PC
      run: (view) => {
        const state = view.state
        const cursor = state.selection.main.head
        const cursorLine = state.doc.lineAt(cursor)

        // Check if we're in a prompt block
        const isInPromptMiddle = checkIsInPromptMiddle(
          state,
          cursorLine,
          promptField
        )

        if (isInPromptMiddle) {
          // Find the current prompt block
          const blocks = identifyPromptBlocksHelper(state)
          for (const block of blocks) {
            if (
              cursorLine.number >= block.start &&
              (!block.end || cursorLine.number <= block.end)
            ) {
              // Only submit if it's a closed block
              if (block.end) {
                handlePromptSubmit(view, block)
                return true
              }
            }
          }
        }

        return false
      }
    }
  ])

  // Backspace keymaps for prompt blocks
  const promptBackspaceKeymaps = keymap.of([
    {
      key: 'Backspace',
      run: (view) => handlePromptContentAction(view, true)
    },
    {
      key: 'Mod-Backspace', // Cmd+Backspace on Mac, Ctrl+Backspace on PC
      run: (view) => handlePromptContentAction(view, true)
    },
    {
      key: 'Alt-Backspace', // Option+Backspace on Mac, Alt+Backspace on PC
      run: (view) => handlePromptContentAction(view, true)
    }
  ])

  // Select All keymap for prompt blocks
  const promptSelectAllKeymap = keymap.of([
    {
      key: 'Mod-a', // Cmd+A on Mac, Ctrl+A on PC
      run: (view) => selectAllMiddleContent(view, promptField)
    }
  ])

  // Combined keymaps with proper precedence
  return Prec.highest([
    promptArrowKeymap,
    promptBackspaceKeymaps,
    promptSelectAllKeymap
  ])
}

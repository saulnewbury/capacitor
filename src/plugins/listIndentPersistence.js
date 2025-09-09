/**
 * listIndentPersistence.js
 *
 * This extension maintains list indentation during undo/redo operations in CodeMirror.
 *
 * Problem:
 * When typing several list items quickly followed by an undo, all list items are removed,
 * but on redo, the items are restored without their indentation. This happens because
 * indentation information is stored in a separate state field (listIndentState) that
 * CodeMirror's built-in history doesn't track in the same transactions as the text changes.
 *
 * Solution:
 * This extension maintains a separate history of document states paired with their
 * list indentation information. When an undo/redo occurs, we:
 *   1. Find the closest matching state from our history
 *   2. Apply indentation effects to restore the proper indentation levels
 *   3. Use line-based matching for better stability (rather than character positions)
 *
 * Key improvements that make this approach robust:
 *   - Line-based tracking instead of character positions (more stable during edits)
 *   - Smart hashing that focuses only on list item content
 *   - Multiple matching strategies with fallbacks
 *   - Single-transaction effect application to avoid flickering
 *   - Separate handling for paste operations with delayed capturing
 *   - Efficient storage with size limits for performance
 *
 * Usage:
 * Import and add to your editor extensions:
 *   createListIndentPersistence(listIndentState)
 */
import { EditorView } from '@codemirror/view'
import { restoreIndentEffect } from './listStructure'

export function createListIndentPersistence(listIndentState) {
  // Store history states
  const history = []
  const maxHistorySize = 200
  let currentHistoryIndex = -1

  // Map docHashes to states for faster lookup
  const docStateMap = new Map()

  /**
   * Creates a hash focusing only on list items
   * This makes matching more reliable during undo/redo
   * by ignoring non-list content changes
   */
  const hashDoc = (doc) => {
    let hash = 0
    const content = typeof doc === 'string' ? doc : doc.toString()
    // Only consider list items for the hash
    const listLines = content
      .split('\n')
      .filter((line) => /^[*-]\s/.test(line) || /^\d+[.)]\s/.test(line))

    // Create a hash from just the list items
    const listContent = listLines.join('\n')
    for (let i = 0; i < listContent.length; i++) {
      hash = (hash << 5) - hash + listContent.charCodeAt(i)
      hash |= 0 // Convert to 32bit integer
    }
    return hash
  }

  /**
   * Captures the current editor state and stores it in our history
   * This captures both document content and indentation information
   */
  const captureState = (view) => {
    try {
      const state = view.state
      const doc = state.doc
      const docHash = hashDoc(doc)

      // Get current indentation state
      const indentState = state.field(listIndentState, false)
      if (!indentState) return

      // Build a map of line numbers to indentation levels
      const indents = new Map()

      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i)
        // Check if this is a list item
        if (/^[*-]\s/.test(line.text) || /^\d+[.)]\s/.test(line.text)) {
          const indent = indentState.get(line.from) || 0
          // Store by line number for more stable matching during undo/redo
          indents.set(i, { pos: line.from, indent })
        }
      }

      // Only save if we found list items
      if (indents.size > 0) {
        // Create a unique state ID
        const stateId = Date.now() + Math.random().toString(36).substring(2, 9)

        // Create a state snapshot
        const snapshot = {
          id: stateId,
          docHash,
          docLength: doc.length,
          lineCount: doc.lines,
          indents,
          timestamp: Date.now()
        }

        // Track this state in our history and maps
        history.push(snapshot)
        docStateMap.set(docHash, snapshot)
        currentHistoryIndex = history.length - 1

        // Limit history size
        if (history.length > maxHistorySize) {
          const removed = history.shift()
          docStateMap.delete(removed.docHash)
        }
      }
    } catch (e) {
      console.error('Error capturing state:', e)
    }
  }

  /**
   * Finds the best matching state for the current document
   * Used during undo/redo to determine which indentation to restore
   */
  const findMatchingState = (doc) => {
    const docHash = hashDoc(doc)

    // First try exact hash match (fastest path)
    if (docStateMap.has(docHash)) {
      return docStateMap.get(docHash)
    }

    // Otherwise try finding a close match based on document properties
    let bestMatch = null
    let bestScore = Infinity

    for (const state of history) {
      // Calculate similarity score based on document properties
      const lengthDiff = Math.abs(state.docLength - doc.length)
      const lineDiff = Math.abs(state.lineCount - doc.lines)
      const score = lengthDiff + lineDiff * 10 // Weight line difference more

      if (score < bestScore) {
        bestScore = score
        bestMatch = state
      }
    }

    // Only return if reasonably similar
    return bestScore < 50 ? bestMatch : null
  }

  /**
   * Applies indentation effects to restore the proper list structure
   * Uses multiple strategies to match list items with their indentation
   */
  const applyIndentationEffects = (view, matchingState) => {
    if (!matchingState) return

    const state = view.state
    const effects = []

    // Process each line in the current document
    for (let i = 1; i <= state.doc.lines; i++) {
      try {
        const line = state.doc.line(i)
        // Check if this is a list item
        if (/^[*-]\s/.test(line.text) || /^\d+[.)]\s/.test(line.text)) {
          // Strategy 1: Try to match by exact line number
          if (matchingState.indents.has(i)) {
            const indentInfo = matchingState.indents.get(i)
            effects.push(
              restoreIndentEffect.of({
                pos: line.from,
                indent: indentInfo.indent
              })
            )
            continue
          }

          // Strategy 2: Look for nearby lines if no exact match
          let foundNearbyMatch = false
          for (let offset = 1; offset <= 3; offset++) {
            // Check lines above and below
            if (matchingState.indents.has(i - offset)) {
              effects.push(
                restoreIndentEffect.of({
                  pos: line.from,
                  indent: matchingState.indents.get(i - offset).indent
                })
              )
              foundNearbyMatch = true
              break
            }
            if (matchingState.indents.has(i + offset)) {
              effects.push(
                restoreIndentEffect.of({
                  pos: line.from,
                  indent: matchingState.indents.get(i + offset).indent
                })
              )
              foundNearbyMatch = true
              break
            }
          }

          // Strategy 3: Default to indent level 0 if no matches found
          if (!foundNearbyMatch) {
            effects.push(
              restoreIndentEffect.of({
                pos: line.from,
                indent: 0
              })
            )
          }
        }
      } catch (e) {
        console.error(`Error processing line ${i}:`, e)
      }
    }

    // Apply all effects in a single transaction to avoid flicker
    if (effects.length > 0) {
      requestAnimationFrame(() => {
        if (!view.destroyed) {
          view.dispatch({ effects })
        }
      })
    }
  }

  // Main update listener
  return EditorView.updateListener.of((update) => {
    // Skip if no document change
    if (!update.docChanged) return

    // Detect undo/redo operations
    const isUndoRedo = update.transactions.some(
      (tr) => tr.isUserEvent('undo') || tr.isUserEvent('redo')
    )

    if (isUndoRedo) {
      // Handle undo/redo by finding and applying a matching state
      const matchingState = findMatchingState(update.state.doc)
      if (matchingState) {
        applyIndentationEffects(update.view, matchingState)
      }
    } else {
      // For normal edits, capture the current state
      captureState(update.view)

      // For large changes (paste operations), capture again after a delay
      // This helps with complex changes that might happen in steps
      const hasLargeChange = update.transactions.some((tr) => {
        return (
          tr.changes && tr.changes.inserted.some((text) => text.length > 20)
        )
      })

      if (hasLargeChange) {
        setTimeout(() => {
          if (!update.view.destroyed) {
            captureState(update.view)
          }
        }, 10)
      }
    }
  })
}

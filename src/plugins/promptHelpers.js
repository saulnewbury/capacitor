// promptHelpers.js
// Shared helper functions to avoid circular dependencies

// Store delayed timeout IDs
export let pendingTimeouts = []

// Helper function to identify all prompt blocks in the document
export function identifyPromptBlocksHelper(state) {
  let blocks = []
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

  return blocks
}

// Helper function to check if cursor is in prompt middle
export function checkIsInPromptMiddle(state, cursorLine, promptField) {
  let isInPromptMiddle = false

  state
    .field(promptField, false)
    ?.between(cursorLine.from, cursorLine.from, (from, to, value) => {
      if (value.spec.class && value.spec.class.includes('cm-prompt-middle')) {
        isInPromptMiddle = true
      }
    })

  return isInPromptMiddle
}

// Helper function to find the prompt block containing a given line
export function findPromptBlockContainingLine(state, lineNum) {
  const blocks = identifyPromptBlocksHelper(state)
  return blocks.find(
    (block) => lineNum >= block.start && (!block.end || lineNum <= block.end)
  )
}

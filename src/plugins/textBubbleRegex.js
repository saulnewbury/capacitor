// textBubbleRegex.js - Text bubble pattern detection

// Text bubble regex - matches {{[text]}} pattern
export const TEXT_BUBBLE_REGEX = /\{\{\[([^\]]+)\]\}\}/g

// Helper function to detect if text just completed a text bubble pattern
export const detectCompletedTextBubble = (view, changeFrom, changeTo) => {
  console.log('Checking for completed text bubble at position:', changeTo)

  // Get the line that contains our change
  const line = view.state.doc.lineAt(changeTo)
  const lineText = line.text
  console.log('Line text:', lineText)

  // Reset regex and find all matches in this line
  TEXT_BUBBLE_REGEX.lastIndex = 0
  const matches = [...lineText.matchAll(TEXT_BUBBLE_REGEX)]

  if (matches.length > 0) {
    console.log(`Found ${matches.length} text bubble pattern(s) in line`)

    for (const match of matches) {
      const matchStart = line.from + match.index
      const matchEnd = matchStart + match[0].length
      const bubbleText = match[1]

      console.log('Checking match:', {
        bubbleText,
        matchStart,
        matchEnd,
        changeTo,
        pattern: match[0]
      })

      // Check if our change position is at the end of this pattern
      // This means the user just finished typing the closing }}}
      if (changeTo === matchEnd) {
        console.log('FOUND COMPLETED TEXT BUBBLE:', bubbleText)

        return {
          type: 'textBubble',
          text: bubbleText,
          fullMatch: match[0],
          position: {
            start: matchStart,
            end: matchEnd
          }
        }
      }
    }
  }

  return null
}

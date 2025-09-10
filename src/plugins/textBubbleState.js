// textBubbleState.js - Global state tracker for text bubbles

const textBubbleStates = new Map()

// Helper function to create a unique key for a text bubble
const createTextBubbleKey = (text) => `bubble::${text}`

// Helper function to set text bubble state
export const setTextBubbleState = (text, isBubble) => {
  const key = createTextBubbleKey(text)
  console.log(`Setting text bubble state: ${text} -> ${isBubble}`)
  if (isBubble) {
    textBubbleStates.set(key, true)
  } else {
    textBubbleStates.delete(key)
  }
}

// Helper function to get text bubble state
export const getTextBubbleState = (text) => {
  const key = createTextBubbleKey(text)
  const hasState = textBubbleStates.has(key)
  console.log(`Getting text bubble state for ${text}: ${hasState}`)
  return hasState
}

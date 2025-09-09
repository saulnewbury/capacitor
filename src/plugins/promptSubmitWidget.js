// promptSubmitWidget.js
import { WidgetType } from '@codemirror/view'
import { identifyPromptBlocksHelper } from './promptHelpers'

export class PromptSubmitButton extends WidgetType {
  constructor(endLineNumber) {
    super()
    this.endLineNumber = endLineNumber // Store the line number instead of the block
  }

  toDOM(view) {
    const button = document.createElement('button')
    button.className = 'cm-prompt-submit-button'
    button.setAttribute('aria-label', 'Submit prompt')
    button.setAttribute('title', 'Submit prompt (Cmd/Ctrl + Enter)')

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 19L12 5M12 5L5 12M12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `

    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Find the current block dynamically
      const state = view.state
      const blocks = identifyPromptBlocksHelper(state)

      // Find the block that ends at this line
      const currentBlock = blocks.find(
        (block) => block.end === this.endLineNumber
      )

      if (currentBlock) {
        handlePromptSubmit(view, currentBlock)
      } else {
        console.warn('Could not find prompt block for line', this.endLineNumber)
      }
    })

    return button
  }

  eq(other) {
    return (
      other instanceof PromptSubmitButton &&
      other.endLineNumber === this.endLineNumber
    )
  }

  ignoreEvent() {
    return false
  }
}

// Handler function for when the button is clicked
export function handlePromptSubmit(view, block) {
  const state = view.state

  // Extract the prompt content (middle lines)
  let promptContent = []
  for (let i = block.start + 1; i < block.end; i++) {
    const line = state.doc.line(i)
    promptContent.push(line.text)
  }

  const prompt = promptContent.join('\n').trim()

  // Don't submit empty prompts
  if (!prompt) {
    console.log('Empty prompt, not submitting')
    return
  }

  console.log('Submitting prompt:', prompt)
  console.log('Block details:', block) // This should now show the correct line numbers

  // Dispatch a custom event that your main app can listen to
  const event = new CustomEvent('cm-prompt-submit', {
    detail: {
      prompt,
      block,
      view,
      // You might want to include a callback for the response
      onResponse: (response) => {
        // This could be used to insert the AI response after the prompt block
        insertAIResponse(view, block, response)
      }
    },
    bubbles: true
  })

  view.dom.dispatchEvent(event)
}

// Helper function to insert AI response (optional)
function insertAIResponse(view, block, response) {
  const state = view.state
  const endLine = state.doc.line(block.end)

  // Insert the response after the closing :::
  const insertPos = endLine.to + 1 // After the newline

  view.dispatch({
    changes: {
      from: insertPos,
      to: insertPos,
      insert: `\n${response}\n`
    },
    userEvent: 'ai.response'
  })
}

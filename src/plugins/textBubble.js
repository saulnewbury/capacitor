// textBubble.js - Simple text bubble widget

import { WidgetType } from '@codemirror/view'

export class TextBubbleWidget extends WidgetType {
  constructor(bubbleInfo, view) {
    super()
    this.bubbleInfo = bubbleInfo
    this.view = view

    console.log('TextBubbleWidget created for:', bubbleInfo.text)
  }

  toDOM() {
    console.log('Creating text bubble DOM for:', this.bubbleInfo.text)

    // Simple span container
    const bubble = document.createElement('span')
    bubble.className = 'cm-text-bubble'
    bubble.style.cssText = `
      display: inline-block;
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      color: white;
      padding: 4px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
      margin: 0 2px;
      box-shadow: 0 1px 3px rgba(220, 38, 38, 0.3);
      user-select: none;
      -webkit-user-select: none;
    `

    bubble.textContent = this.bubbleInfo.text

    console.log('Text bubble DOM created successfully')
    return bubble
  }

  eq(other) {
    return (
      other instanceof TextBubbleWidget &&
      this.bubbleInfo.text === other.bubbleInfo.text
    )
  }

  ignoreEvent() {
    return false
  }
}

export const injectTextBubbleStyles = () => {
  // No additional styles needed for now
}

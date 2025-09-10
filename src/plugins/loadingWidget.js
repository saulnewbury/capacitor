// loadingWidget.js - Widget for showing loading state during transcript processing

import { WidgetType } from '@codemirror/view'

export class LoadingWidget extends WidgetType {
  constructor(view, url) {
    super()
    this.view = view
    this.url = url
    this.domElement = null
    this.currentState = 'retrieving' // 'retrieving', 'thinking', 'processing'
    this.timeoutId = null
  }

  toDOM() {
    const container = document.createElement('div')
    container.className = 'cm-loading-widget'
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 0;
      margin: 8px 0;
      margin-left: 5px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
    `

    // Create animated GIF container
    const gifContainer = document.createElement('div')
    gifContainer.className = 'loading-gif-container'
    gifContainer.style.cssText = `
      width: 20px;
      height: 20px;
      display: flex;
      background-color: #ff1f1fff;
      border-radius: 500px;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `

    // Create the actual GIF element
    const loadingGif = document.createElement('img')
    loadingGif.className = 'loading-gif'
    loadingGif.src =
      'http://192.168.0.22:8081/assets/webview/gif/thinking_bw.gif'
    loadingGif.alt = 'Loading...'
    loadingGif.style.cssText = `
      width: 20px;
      height: 20px;
      object-fit: contain;
    `

    // Fallback to CSS spinner if GIF fails to load
    loadingGif.onerror = () => {
      loadingGif.style.display = 'none'

      const fallbackSpinner = document.createElement('div')
      fallbackSpinner.className = 'loading-spinner-fallback'
      fallbackSpinner.style.cssText = `
        width: 20px;
        height: 20px;
        border: 2px solid #e5e7eb;
        border-top: 2px solid #6366f1;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      `

      // Add CSS animation for the fallback spinner
      if (!document.getElementById('loading-spinner-styles')) {
        const style = document.createElement('style')
        style.id = 'loading-spinner-styles'
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
        document.head.appendChild(style)
      }

      gifContainer.appendChild(fallbackSpinner)
    }

    gifContainer.appendChild(loadingGif)

    // Create text container
    const textContainer = document.createElement('div')
    textContainer.className = 'loading-text-container'
    textContainer.style.cssText = `
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
      font-style: italic;
    `

    // Initial text
    const loadingText = document.createElement('span')
    loadingText.className = 'loading-text'
    loadingText.textContent = 'Retrieving transcript...'
    textContainer.appendChild(loadingText)

    container.appendChild(gifContainer)
    container.appendChild(textContainer)

    // Store reference to DOM element
    this.domElement = container

    // Start the text progression
    this.startTextProgression()

    return container
  }

  startTextProgression() {
    // After 3 seconds, change to "Thinking..."
    this.timeoutId = setTimeout(() => {
      if (this.domElement && this.currentState === 'retrieving') {
        this.updateText('Thinking...')
        this.currentState = 'thinking'
      }
    }, 3000)
  }

  updateText(newText) {
    if (this.domElement) {
      const textElement = this.domElement.querySelector('.loading-text')
      if (textElement) {
        textElement.textContent = newText
      }
    }
  }

  // Method to be called when streaming begins
  onStreamingStart() {
    this.currentState = 'processing'
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    // Remove the text, leaving just the GIF
    if (this.domElement) {
      const textContainer = this.domElement.querySelector(
        '.loading-text-container'
      )
      if (textContainer) {
        textContainer.style.display = 'none'
      }
    }
  }

  // Method to be called when streaming is complete
  onStreamingComplete() {
    // This widget should be removed from the editor when streaming is complete
    // The removal will be handled by the parent component
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  eq(other) {
    return other instanceof LoadingWidget && this.url === other.url
  }

  ignoreEvent() {
    return false
  }

  destroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

export const createLoadingWidget = (view, url) => {
  return new LoadingWidget(view, url)
}

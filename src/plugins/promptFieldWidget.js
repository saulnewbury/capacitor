// promptFieldWidget.js - AI prompt field widget with auto-resizing textarea

import { WidgetType } from '@codemirror/view'

export class PromptFieldWidget extends WidgetType {
  constructor(view) {
    super()
    this.view = view
    this.domElement = null
    this.selectedSources = []
    this.availableSources = []
    this.isDropdownOpen = false
    this.textArea = null
    this.addContextButton = null // Store reference to the button
    this.submitButton = null // Store reference to submit button

    // Extract available sources from the document
    this.extractAvailableSources()
  }

  extractAvailableSources() {
    const docText = this.view.state.doc.toString()
    this.availableSources = []

    // Find sources with transcripts (YouTube links with summaries)
    const transcriptSources = []
    const lines = docText.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Look for YouTube links followed by summaries
      const youtubeMatch = line.match(
        /https?:\/\/(?:www\.)?(youtube\.com\/watch|youtu\.be)/i
      )
      if (youtubeMatch) {
        // Check if there's a summary following this link
        let hasTranscript = false
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (
            lines[j].includes('## Summary') ||
            lines[j].includes('#### TL;DR')
          ) {
            hasTranscript = true
            break
          }
        }

        if (hasTranscript) {
          transcriptSources.push({
            type: 'transcript',
            url: line.trim(),
            title: this.extractTitleForUrl(line.trim(), docText) || line.trim()
          })
        }
      }
    }

    // Find raw links (without summaries)
    const rawLinks = []
    const linkRegex = /https?:\/\/[^\s]+/gi
    const matches = docText.match(linkRegex) || []

    matches.forEach((url) => {
      const cleanUrl = url.replace(/[.,;!?)]*$/, '') // Remove trailing punctuation
      const isAlreadyTranscript = transcriptSources.some(
        (source) => source.url === cleanUrl
      )

      if (!isAlreadyTranscript) {
        rawLinks.push({
          type: 'raw_link',
          url: cleanUrl,
          title: this.extractTitleForUrl(cleanUrl, docText) || cleanUrl
        })
      }
    })

    // Combine sources: transcripts first, then raw links
    this.availableSources = [...transcriptSources, ...rawLinks]
    console.log('Available sources:', this.availableSources)
  }

  extractTitleForUrl(url, docText) {
    // Look for markdown link format [title](url)
    const markdownMatch = docText.match(
      new RegExp(
        `\\[([^\\]]+)\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
        'i'
      )
    )
    if (markdownMatch) {
      return markdownMatch[1]
    }

    // Look for titles in link previews or nearby headings
    const urlIndex = docText.indexOf(url)
    if (urlIndex !== -1) {
      const beforeUrl = docText.substring(Math.max(0, urlIndex - 200), urlIndex)

      // Check for heading before the URL
      const headingMatch = beforeUrl.match(/#+\s*([^#\n]+)\s*\n[^#]*$/)
      if (headingMatch) {
        return headingMatch[1].trim()
      }
    }

    return null
  }

  // Auto-resize function for textarea
  autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'

    // Calculate the new height based on scrollHeight
    const newHeight = Math.max(24, textarea.scrollHeight) // 24px minimum (roughly one line)

    // Set the new height
    textarea.style.height = newHeight + 'px'

    console.log('Textarea auto-resized to:', newHeight + 'px')
  }

  // Simple method to preserve textarea focus - with minimal scroll protection
  preserveFocus(callback) {
    const hadFocus = this.textArea === document.activeElement
    let cursorStart = 0
    let cursorEnd = 0

    if (hadFocus && this.textArea) {
      cursorStart = this.textArea.selectionStart
      cursorEnd = this.textArea.selectionEnd
    }

    // Store scroll position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop

    callback()

    // Restore focus after the action
    if (hadFocus && this.textArea) {
      setTimeout(() => {
        this.textArea.focus()
        this.textArea.setSelectionRange(cursorStart, cursorEnd)

        // Only restore scroll if it changed significantly (more than 10px)
        const newScrollTop =
          window.pageYOffset || document.documentElement.scrollTop
        if (Math.abs(newScrollTop - scrollTop) > 10) {
          window.scrollTo(0, scrollTop)
        }

        console.log('Focus restored to textarea')
      }, 0)
    }
  }

  createContextButton() {
    const button = document.createElement('button')
    button.className = 'prompt-add-context-button'

    // Create the SVG plus icon
    const iconSvg = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" flex-shrink: 0;">
      <path d="M6 0V12M0 6H12" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `

    // Create the text span
    const textSpan = document.createElement('span')
    textSpan.className = 'add-context-text'
    textSpan.textContent = 'Add context'
    textSpan.style.marginLeft = '6px'

    // Set the button content
    button.innerHTML = iconSvg
    button.appendChild(textSpan)

    button.style.cssText = `
    background: transparent;
    border: 1px solid #e9ecef;
    border-radius: 20px;
    padding: 0 12px;
    height: 32px;
    font-size: 14px;
    color: #6c757d;
    cursor: pointer;
    margin-right: 6px;
    margin-bottom: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-family: inherit;
  `

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#e9ecef'
    })

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent'
    })

    button.addEventListener('mousedown', (e) => {
      // Prevent the button from stealing focus from textarea
      e.preventDefault()
    })

    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      console.log('Add context button clicked')

      // Toggle dropdown without using preserveFocus wrapper
      this.toggleDropdown()
    })

    // Store reference to the button
    this.addContextButton = button

    return button
  }

  updateContextButtonText() {
    if (!this.addContextButton) return

    const textSpan = this.addContextButton.querySelector('.add-context-text')
    if (!textSpan) return

    // Show text if no sources are selected, hide if there are sources
    if (this.selectedSources.length === 0) {
      textSpan.style.display = 'inline'
    } else {
      textSpan.style.display = 'none'
    }
  }

  createSourcePill(source) {
    // Create container div instead of button
    const pill = document.createElement('div')
    pill.className = 'prompt-source-pill'
    pill.style.cssText = `margin-right: 0`

    const displayText =
      source.title.length > 30
        ? source.title.substring(0, 27) + '...'
        : source.title

    // Create separate interactive elements
    const removeButton = document.createElement('button')
    removeButton.className = 'source-remove-button'
    removeButton.style.cssText = `
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    color: inherit;
    transition: color 0.2s ease;
  `

    // X icon for remove button
    removeButton.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0; transform: rotate(45deg);">
      <path d="M6 0V12M0 6H12" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `

    const textSpan = document.createElement('span')
    textSpan.className = 'source-text-span'
    textSpan.textContent = displayText
    textSpan.style.cssText = `
    margin-left: 6px;
    cursor: pointer;
    flex: 1;
  `

    // Container styling
    pill.style.cssText = `
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 20px;
    padding: 0 12px;
    height: 32px;
    font-size: 14px;
    font-weight: 500;
    color: #6c757d;
    margin-right: 6px;
    margin-bottom: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-family: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
    vertical-align: top;
  `

    // Hover effects for the entire pill
    pill.addEventListener('mouseenter', () => {
      pill.style.backgroundColor = '#dc3545'
      pill.style.color = 'white'
      pill.style.borderColor = '#dc3545'
    })

    pill.addEventListener('mouseleave', () => {
      pill.style.backgroundColor = '#f8f9fa'
      pill.style.color = '#6c757d'
      pill.style.borderColor = '#e9ecef'
    })

    // Prevent focus stealing for the entire pill
    pill.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })

    // Remove button event handling
    removeButton.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })

    removeButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Store current focus state before the operation
      const hadFocus = this.textArea === document.activeElement
      let cursorStart = 0
      let cursorEnd = 0

      if (hadFocus && this.textArea) {
        cursorStart = this.textArea.selectionStart
        cursorEnd = this.textArea.selectionEnd
      }

      // Remove the source
      this.removeSource(source)

      // Manually restore focus if it was previously in the textarea
      if (hadFocus && this.textArea) {
        setTimeout(() => {
          this.textArea.focus()
          this.textArea.setSelectionRange(cursorStart, cursorEnd)
          console.log(
            'Focus manually restored to textarea after source removal'
          )
        }, 0)
      }
    })

    // Text span event handling (for future thumbnail functionality)
    textSpan.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })

    textSpan.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // TODO: Implement thumbnail/preview functionality
      console.log('Text span clicked for source:', source)
    })

    // Assemble the pill
    pill.appendChild(removeButton)
    pill.appendChild(textSpan)

    return pill
  }

  createDropdownMenu() {
    const dropdown = document.createElement('div')
    dropdown.className = 'prompt-context-dropdown'
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-height: 200px;
      overflow-y: auto;
      display: none;
    `

    // Add sources to dropdown
    if (this.availableSources.length === 0) {
      const noSources = document.createElement('div')
      noSources.style.cssText = `
        padding: 12px;
        color: #6c757d;
        font-size: 12px;
        text-align: center;
      `
      noSources.textContent = 'No content sources found'
      dropdown.appendChild(noSources)
    } else {
      // Group by type
      const transcriptSources = this.availableSources.filter(
        (s) => s.type === 'transcript'
      )
      const rawSources = this.availableSources.filter(
        (s) => s.type === 'raw_link'
      )

      if (transcriptSources.length > 0) {
        const transcriptHeader = document.createElement('div')
        transcriptHeader.style.cssText = `
          padding: 8px 12px 4px;
          font-size: 11px;
          font-weight: 600;
          color: #495057;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        `
        transcriptHeader.textContent = 'Sources with transcripts'
        dropdown.appendChild(transcriptHeader)

        transcriptSources.forEach((source) => {
          dropdown.appendChild(this.createDropdownItem(source))
        })
      }

      if (rawSources.length > 0) {
        const rawHeader = document.createElement('div')
        rawHeader.style.cssText = `
          padding: 8px 12px 4px;
          font-size: 11px;
          font-weight: 600;
          color: #495057;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        `
        rawHeader.textContent = 'Raw links'
        dropdown.appendChild(rawHeader)

        rawSources.forEach((source) => {
          dropdown.appendChild(this.createDropdownItem(source))
        })
      }
    }

    return dropdown
  }

  createDropdownItem(source) {
    const item = document.createElement('div')
    item.className = 'prompt-dropdown-item'

    const isSelected = this.selectedSources.some((s) => s.url === source.url)

    item.style.cssText = `
      padding: 12px;
      cursor: pointer;
      border-bottom: 1px solid #f1f3f4;
      transition: background-color 0.15s ease;
      ${isSelected ? 'background-color: #f0f8ff; opacity: 0.6;' : ''}
    `

    const title = document.createElement('div')
    title.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      color: #212529;
      margin-bottom: 2px;
      line-height: 1.3;
    `
    title.textContent = source.title

    const url = document.createElement('div')
    url.style.cssText = `
      font-size: 11px;
      color: #6c757d;
      line-height: 1.2;
    `
    url.textContent = source.url

    const typeIndicator = document.createElement('div')
    typeIndicator.style.cssText = `
      font-size: 10px;
      color: ${source.type === 'transcript' ? '#28a745' : '#ffc107'};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    `
    typeIndicator.textContent =
      source.type === 'transcript' ? 'Has transcript' : 'Raw link'

    item.appendChild(title)
    item.appendChild(url)
    item.appendChild(typeIndicator)

    if (!isSelected) {
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f8f9fa'
      })

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white'
      })

      item.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()

        this.preserveFocus(() => {
          this.selectSource(source)
        })
      })
    }

    return item
  }

  selectSource(source) {
    if (!this.selectedSources.some((s) => s.url === source.url)) {
      this.selectedSources.push(source)
      this.updateSourcesDisplay()
      this.closeDropdown()
    }
  }

  removeSource(source) {
    this.selectedSources = this.selectedSources.filter(
      (s) => s.url !== source.url
    )
    this.updateSourcesDisplay()
  }

  updateSourcesDisplay() {
    const sourcesContainer = this.domElement.querySelector(
      '.prompt-sources-container'
    )
    if (!sourcesContainer) return

    // Clear existing pills (except the add context button and dropdown)
    const pills = sourcesContainer.querySelectorAll('.prompt-source-pill')
    pills.forEach((pill) => pill.remove())

    // Add new pills before the dropdown
    const dropdown = sourcesContainer.querySelector('.prompt-context-dropdown')
    this.selectedSources.forEach((source) => {
      const pill = this.createSourcePill(source)
      sourcesContainer.insertBefore(pill, dropdown)
    })

    // Update the button text based on selected sources
    this.updateContextButtonText()
  }

  toggleDropdown() {
    console.log('toggleDropdown called, current state:', this.isDropdownOpen)

    const dropdown = this.domElement.querySelector('.prompt-context-dropdown')
    if (!dropdown) {
      console.error('Dropdown not found')
      return
    }

    if (this.isDropdownOpen) {
      this.closeDropdown()
    } else {
      this.openDropdown()
    }
  }

  openDropdown() {
    console.log('openDropdown called')

    const dropdown = this.domElement.querySelector('.prompt-context-dropdown')
    if (!dropdown) return

    // Hide CodeMirror cursor when dropdown opens
    this.hideCursor()

    // Show dropdown
    dropdown.style.display = 'block'
    this.isDropdownOpen = true
    console.log('Dropdown opened, display set to block')

    // Close dropdown when clicking outside
    const closeHandler = (e) => {
      if (!this.domElement.contains(e.target)) {
        console.log('Clicked outside dropdown, closing')
        this.closeDropdown()
        document.removeEventListener('click', closeHandler, true)
      }
    }

    // Delay adding the close handler to prevent immediate closure
    setTimeout(() => {
      document.addEventListener('click', closeHandler, true)
    }, 100)
  }

  closeDropdown() {
    console.log('closeDropdown called')

    const dropdown = this.domElement.querySelector('.prompt-context-dropdown')
    if (!dropdown) return

    // Restore cursor visibility when dropdown closes
    this.showCursor()

    dropdown.style.display = 'none'
    this.isDropdownOpen = false
    console.log('Dropdown closed, display set to none')
  }

  // Helper methods to hide/show cursor
  hideCursor() {
    // Target the native browser cursor via caret-color
    const contentElement = document.querySelector('.cm-content')
    if (contentElement) {
      contentElement.style.setProperty(
        'caret-color',
        'transparent',
        'important'
      )
      console.log('Native cursor hidden via caret-color')
    }

    // Also blur the editor as backup
    if (this.view && this.view.contentDOM) {
      this.view.contentDOM.blur()
      console.log('Editor blurred')
    }
  }

  showCursor() {
    // Restore the native browser cursor
    const contentElement = document.querySelector('.cm-content')
    if (contentElement) {
      contentElement.style.removeProperty('caret-color')
      console.log('Native cursor restored')
    }

    // Restore focus to textarea
    if (this.textArea) {
      setTimeout(() => {
        this.textArea.focus()
        console.log('Focus restored to textarea')
      }, 10)
    }
  }

  handleSubmit(text) {
    console.log('Handling submit with text:', text)
    console.log('Selected sources:', this.selectedSources)

    // Generate the text bubble syntax
    const textBubbleSyntax = this.generateTextBubbleSyntax(text)
    console.log('Generated text bubble syntax:', textBubbleSyntax)

    // Find the position of this widget in the document
    const widgetPosition = this.findWidgetPosition()
    if (widgetPosition !== null) {
      // First, remove this widget from the active tracking set
      if (window.activePromptWidgets) {
        window.activePromptWidgets.delete(this)
        console.log('Removed widget from tracking set')
      }

      // Create the removal effect if we have access to it
      let effects = []
      if (typeof window.removePromptFieldEffect === 'function') {
        effects.push(window.removePromptFieldEffect(this))
      }

      // Insert the text bubble syntax and optionally remove the widget
      this.view.dispatch({
        changes: {
          from: widgetPosition,
          to: widgetPosition,
          insert: textBubbleSyntax
        },
        effects: effects
      })

      console.log('Text bubble inserted:', textBubbleSyntax)
    } else {
      console.error('Could not find widget position in document')
    }
  }

  generateTextBubbleSyntax(text) {
    if (this.selectedSources.length === 0) {
      // No sources, just text
      return `{{[${text}]}}`
    } else {
      // Sources + text
      const sourceBrackets = this.selectedSources
        .map((source) => `[${source.title}]`)
        .join('')
      return `{{${sourceBrackets}[${text}]}}`
    }
  }

  findWidgetPosition() {
    // Find this widget's position in the document
    // We'll need to search through the prompt field decorations
    const promptFieldState = this.view.state.field(
      window.promptFieldState || null
    )
    if (!promptFieldState) return null

    let position = null
    promptFieldState.between(
      0,
      this.view.state.doc.length,
      (from, to, decoration) => {
        if (decoration.spec?.widget === this) {
          position = from
        }
      }
    )

    return position
  }

  updateSubmitButtonState() {
    if (!this.submitButton) return

    const text = this.textArea?.value?.trim() || ''
    const isEmpty = text.length === 0

    // Disable/enable button based on text content
    this.submitButton.disabled = isEmpty

    // Update visual state
    if (isEmpty) {
      this.submitButton.style.opacity = '0.6'
      this.submitButton.style.cursor = 'not-allowed'
      // this.submitButton.style.backgroundColor = '#94a3b8'
    } else {
      this.submitButton.style.opacity = '1'
      this.submitButton.style.cursor = 'pointer'
      this.submitButton.style.backgroundColor = '#ef4444'
    }
  }

  toDOM() {
    console.log('Creating PromptFieldWidget DOM')

    const container = document.createElement('div')
    container.className = 'cm-prompt-field-widget'
    container.style.cssText = `
      width: 100%;
      background: #ffffff;
      border: 1px solid #e9ecef;
      border-radius: 12px;
      padding: 10px 10px;
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `

    // First container: Context sources
    const sourcesContainer = document.createElement('div')
    sourcesContainer.className = 'prompt-sources-container'
    sourcesContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 0px;
      position: relative;
    `

    // Add context button
    const addContextButton = this.createContextButton()
    sourcesContainer.appendChild(addContextButton)

    // Dropdown menu
    const dropdown = this.createDropdownMenu()
    sourcesContainer.appendChild(dropdown)

    // Second container: Text area
    const textAreaContainer = document.createElement('div')
    textAreaContainer.style.cssText = `
      margin-bottom: 0px;
    `

    const textArea = document.createElement('textarea')
    textArea.className = 'prompt-text-area'
    textArea.placeholder = 'Ask ai...'
    textArea.rows = 1 // Start with exactly 1 row
    textArea.style.cssText = `
      width: 100%;
      max-height: 200px;
      border: none;
      outline: none;
      resize: none;
      font-size: 16px;
      line-height: 1.4;
      padding: 8px;
      background: transparent;
      color: #212529;
      font-family: inherit;
      overflow-y: hidden;
      box-sizing: border-box;
    `

    // Store reference to textarea
    this.textArea = textArea

    // Auto-resize event listeners
    const handleInput = () => {
      this.autoResizeTextarea(textArea)
      this.updateSubmitButtonState()
    }

    const handleKeyDown = (e) => {
      e.stopPropagation()

      // Handle Enter key for submission
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const text = textArea.value.trim()
        if (text) {
          this.handleSubmit(text)
        }
        return
      }

      // Trigger resize on Enter key (for Shift+Enter line breaks)
      if (e.key === 'Enter') {
        setTimeout(() => {
          this.autoResizeTextarea(textArea)
          this.updateSubmitButtonState()
        }, 0)
      }
    }

    textArea.addEventListener('input', handleInput)
    textArea.addEventListener('keydown', handleKeyDown)

    // Basic event handling
    textArea.addEventListener('keydown', (e) => {
      e.stopPropagation()
    })

    textArea.addEventListener('input', (e) => {
      e.stopPropagation()
    })

    // Simple blur handling to maintain focus within widget
    textArea.addEventListener('blur', (e) => {
      console.log('Textarea blur event')

      // If blur was caused by clicking within the widget, prevent it and restore focus
      setTimeout(() => {
        if (
          this.domElement &&
          this.domElement.contains(document.activeElement)
        ) {
          console.log('Refocusing textarea after internal widget click')
          textArea.focus()
        }
      }, 10)
    })

    textAreaContainer.appendChild(textArea)

    // Third container: Submit button
    const submitContainer = document.createElement('div')
    submitContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
    `

    const submitButton = document.createElement('button')
    submitButton.className = 'prompt-submit-button'
    submitButton.style.cssText = `
      background-color: #ef4444;
      border: none;
      border-radius: 50%;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      color: white;
    `

    // Store reference to submit button
    this.submitButton = submitButton

    // Submit button icon
    submitButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
        <path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z"></path>
      </svg>
    `

    // Submit button hover effects
    submitButton.addEventListener('mouseenter', () => {
      if (!submitButton.disabled) {
        submitButton.style.backgroundColor = '#c44949'
        submitButton.style.transform = 'scale(1.05)'
      }
    })

    submitButton.addEventListener('mouseleave', () => {
      if (!submitButton.disabled) {
        submitButton.style.backgroundColor = '#ef4444'
        submitButton.style.transform = 'scale(1)'
      }
    })

    submitButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const text = textArea.value.trim()
      if (text) {
        this.handleSubmit(text)
      }
    })

    submitContainer.appendChild(submitButton)

    // Assemble the widget
    container.appendChild(sourcesContainer)
    container.appendChild(textAreaContainer)
    container.appendChild(submitContainer)

    // Store reference to DOM element
    this.domElement = container

    // Focus the text area and set initial size after DOM is ready
    setTimeout(() => {
      console.log('Initial focus on textarea')
      textArea.focus()
      // Set initial height to one line
      this.autoResizeTextarea(textArea)
      // Update button text on initial load (should show "Add context" since no sources selected)
      this.updateContextButtonText()
      // Set initial submit button state (should be disabled since textarea is empty)
      this.updateSubmitButtonState()
    }, 50)

    return container
  }

  eq(other) {
    return other instanceof PromptFieldWidget
  }

  ignoreEvent() {
    return false
  }
}

export const createPromptFieldWidget = (view) => {
  return new PromptFieldWidget(view)
}

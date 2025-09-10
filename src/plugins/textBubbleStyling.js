// textBubbleStyling.js - Complete text bubble system with multiple source support

import { RangeSet } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType
} from '@codemirror/view'

// Enhanced text bubble regex - matches {{[source1][source2]...[text]}} patterns
const TEXT_BUBBLE_REGEX = /\{\{(\[[^\]]+\])+\}\}/g

// Helper function to parse bracket contents from a match
const parseBrackets = (matchText) => {
  // Remove outer {{ and }}
  const inner = matchText.slice(2, -2)

  // Find all [content] patterns
  const bracketRegex = /\[([^\]]+)\]/g
  const brackets = []
  let match

  while ((match = bracketRegex.exec(inner)) !== null) {
    brackets.push(match[1])
  }

  return brackets
}

// Enhanced text bubble widget that handles multiple sources
class TextBubbleWidget extends WidgetType {
  constructor(sources, bubbleText) {
    super()
    this.sources = sources || [] // Array of source texts
    this.bubbleText = bubbleText // The final bracket content (text)
    this.isExpanded = false // Track expansion state
  }

  toDOM() {
    const hasSources = this.sources.length > 0

    if (hasSources) {
      console.log(
        'Creating multi-source pill + text bubble for:',
        this.sources,
        '+',
        this.bubbleText
      )
    } else {
      console.log('Creating text bubble only for:', this.bubbleText)
    }

    // Parent container - stacked vertically when there are sources
    const container = document.createElement('span')
    container.style.cssText = `
      display: inline-flex;
      flex-direction: ${hasSources ? 'column' : 'row'};
      align-items: flex-start;
      gap: ${hasSources ? '5px' : '0px'};
      margin: 2px;
      vertical-align: ${hasSources ? 'top' : 'baseline'};
    `

    if (hasSources) {
      // Create source pill container
      const sourcePillContainer = this.createSourcePill()
      container.appendChild(sourcePillContainer)
    }

    // Text bubble (bottom element, or only element)
    const bubble = document.createElement('span')
    bubble.style.cssText = `
      display: inline-block;
      // border: 1px solid #e9ecef;
      background: #f4f4f4ff;
      color: #455966;
      padding: 12px 18px;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 500;
      user-select: none;
      -webkit-user-select: none;
    `
    bubble.textContent = this.bubbleText
    container.appendChild(bubble)

    return container
  }

  createSourcePill() {
    // Main pill element
    const pill = document.createElement('div')
    pill.style.cssText = `
      display: flex;
      flex-direction: column;
      // border: 1px solid #d6dae0ff;
      border: .5px solid #b5b9c1ff;
      color: #ef4444;
      background: transparent;
      padding: 4px 12px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.2;
      user-select: none;
      -webkit-user-select: none;
      cursor: ${this.sources.length > 1 ? 'pointer' : 'default'};
      transition: all 0.3s ease;
      overflow: hidden;
      max-width: fit-content;
    `

    if (this.sources.length === 1) {
      // Single source - just show the source
      pill.style.flexDirection = 'row'
      pill.style.cssText += `
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      `
      pill.textContent = this.sources[0]
    } else if (this.sources.length > 1) {
      // Multiple sources - create collapsible structure
      this.setupMultiSourcePill(pill)
    }

    return pill
  }

  setupMultiSourcePill(pill) {
    // Create the collapsed view (first source + count)
    const collapsedView = document.createElement('div')
    collapsedView.className = 'collapsed-view'
    collapsedView.style.cssText = `
      display: flex;
      align-items: center;
      white-space: nowrap;
    `

    const firstSource = document.createElement('span')
    firstSource.textContent = this.sources[0]
    collapsedView.appendChild(firstSource)

    const countSpan = document.createElement('span')
    countSpan.style.cssText = `
      margin-left: 4px;
      color: #94a3b8;
      font-weight: 300;
    `
    countSpan.textContent = ` +${this.sources.length - 1}`
    collapsedView.appendChild(countSpan)

    pill.appendChild(collapsedView)

    // Create the expanded view (all sources)
    const expandedView = document.createElement('div')
    expandedView.className = 'expanded-view'
    expandedView.style.cssText = `
      display: none;
      flex-direction: column;
      gap: 4px;
    `

    this.sources.forEach((source, index) => {
      const sourceItem = document.createElement('div')
      sourceItem.style.cssText = `
        padding: ${index === 0 ? '0' : '4px 0 0 0'};
        font-size: 14px;
        color: #ef4444;
        font-weight: 400;
        white-space: nowrap;
        ${index > 0 ? 'border-top: 1px solid #f1f5f9;' : ''}
      `
      sourceItem.textContent = source
      expandedView.appendChild(sourceItem)
    })

    pill.appendChild(expandedView)

    // Add hover effect
    pill.addEventListener('mouseenter', () => {
      if (!this.isExpanded) {
        // pill.style.backgroundColor = '#f8fafc'
      }
    })
    pill.addEventListener('mouseleave', () => {
      if (!this.isExpanded) {
        pill.style.backgroundColor = 'transparent'
      }
    })

    // Add click handler for expansion
    pill.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.togglePillExpansion(pill, collapsedView, expandedView)
    })
  }

  togglePillExpansion(pill, collapsedView, expandedView) {
    this.isExpanded = !this.isExpanded

    if (this.isExpanded) {
      // Switch to expanded view
      collapsedView.style.display = 'none'
      expandedView.style.display = 'flex'
      // pill.style.backgroundColor = '#f8fafc'
      // pill.style.borderColor = '#d1d5db'

      // Close on click outside
      const closeHandler = (e) => {
        if (!pill.contains(e.target)) {
          this.isExpanded = false
          collapsedView.style.display = 'flex'
          expandedView.style.display = 'none'
          document.removeEventListener('click', closeHandler)
        }
      }
      setTimeout(() => {
        document.addEventListener('click', closeHandler)
      }, 0)
    } else {
      // Switch back to collapsed view
      collapsedView.style.display = 'flex'
      expandedView.style.display = 'none'
    }
  }

  eq(other) {
    return (
      other instanceof TextBubbleWidget &&
      JSON.stringify(this.sources) === JSON.stringify(other.sources) &&
      this.bubbleText === other.bubbleText
    )
  }

  ignoreEvent() {
    return false
  }
}

// Input handler to detect when }} is typed to complete the pattern
const textBubbleInputHandler = EditorView.inputHandler.of(
  (view, from, to, text) => {
    console.log('Input handler triggered:', text, 'at position:', from)

    // Only handle closing bracket
    if (text !== '}') return false

    const state = view.state
    const line = state.doc.lineAt(from)
    const lineText = line.text

    // Check if we're potentially completing a text bubble pattern
    const beforeCursor = lineText.slice(0, from - line.from)
    console.log('Text before cursor:', beforeCursor)

    // If we just typed }, check if this completes }}
    if (beforeCursor.endsWith('}')) {
      const testLine =
        lineText.slice(0, from - line.from) +
        text +
        lineText.slice(from - line.from)
      console.log('Test line after input:', testLine)

      TEXT_BUBBLE_REGEX.lastIndex = 0
      const matches = [...testLine.matchAll(TEXT_BUBBLE_REGEX)]

      if (matches.length > 0) {
        console.log('Found completed text bubble pattern! Requesting redraw...')

        // Allow the character to be inserted first, then transform
        setTimeout(() => {
          view.requestMeasure()
        }, 10)
      }
    }

    return false // Allow normal input
  }
)

// Main plugin to handle text bubble rendering
const textBubblePlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      console.log('TextBubble plugin initialized')
      this.decorations = this.buildDecorations(view.state)
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        console.log('TextBubble plugin update triggered')
        this.decorations = this.buildDecorations(update.state)
      }
    }

    buildDecorations(state) {
      console.log('Building text bubble decorations...')
      const decorations = []

      // Process each line
      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i)
        const lineText = line.text

        // Find all text bubble patterns in this line
        TEXT_BUBBLE_REGEX.lastIndex = 0
        const matches = [...lineText.matchAll(TEXT_BUBBLE_REGEX)]

        if (matches.length > 0) {
          console.log(
            `Found ${matches.length} text bubble pattern(s) in line ${i}:`,
            lineText
          )
        }

        for (const match of matches) {
          const matchStart = line.from + match.index
          const matchEnd = matchStart + match[0].length

          // Parse all brackets from the match
          const brackets = parseBrackets(match[0])

          console.log('Parsed brackets:', brackets)

          if (brackets.length >= 1) {
            if (brackets.length === 1) {
              // Single bracket pattern: {{[text]}}
              console.log('Creating BUBBLE ONLY decoration:', brackets[0])
              decorations.push(
                Decoration.replace({
                  widget: new TextBubbleWidget([], brackets[0])
                }).range(matchStart, matchEnd)
              )
            } else {
              // Multiple bracket pattern: {{[source1][source2]...[text]}}
              const sources = brackets.slice(0, -1) // All but last
              const bubbleText = brackets[brackets.length - 1] // Last one

              console.log(
                'Creating MULTI-SOURCE + BUBBLE decoration:',
                sources,
                '+',
                bubbleText
              )
              decorations.push(
                Decoration.replace({
                  widget: new TextBubbleWidget(sources, bubbleText)
                }).range(matchStart, matchEnd)
              )
            }
          }
        }
      }

      console.log(`Created ${decorations.length} text bubble decorations`)
      return RangeSet.of(decorations, true)
    }
  },
  {
    decorations: (plugin) => plugin.decorations
  }
)

// Theme for text bubbles
const textBubbleTheme = EditorView.theme({
  '.cm-text-bubble': {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  '.source-list': {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }
})

// Export all extensions
export const textBubbleExtensions = [
  textBubbleTheme,
  textBubbleInputHandler,
  textBubblePlugin
]

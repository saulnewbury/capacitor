import { RangeSetBuilder, EditorState } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap
} from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { URL_REGEX, EMAIL_REGEX, MARKDOWN_LINK_REGEX } from './linkRegex.js'
import { linkClickHandler, highPriorityHandler } from './linkHandlers.js'
import { createEditLinkDialog } from './linkDialog.js'
import { LinkPreviewWidget, injectPreviewStyles } from './linkPreview.js'

// Global preview state tracker
const linkPreviewStates = new Map()

// Track replaced ranges for cursor navigation fixes
const replacedRanges = new WeakMap()

// Helper function to add a replaced range
const addReplacedRange = (view, start, end) => {
  if (!replacedRanges.has(view)) {
    replacedRanges.set(view, [])
  }
  replacedRanges.get(view).push({ start, end })
}

// Helper function to clear replaced ranges
const clearReplacedRanges = (view) => {
  replacedRanges.set(view, [])
}

// Helper function to set preview state
export const setLinkPreviewState = (linkText, url, isPreview) => {
  const key = `${linkText}::${url}`
  if (isPreview) {
    linkPreviewStates.set(key, true)
  } else {
    linkPreviewStates.delete(key)
  }
}

// Helper function to get preview state
export const getLinkPreviewState = (linkText, url) => {
  const key = `${linkText}::${url}`
  return linkPreviewStates.has(key)
}

// Theme for link styling
const linkTheme = EditorView.theme({
  '.cm-link': {
    color: '#dc2626', // Red color (Tailwind red-600)
    cursor: 'pointer'
  },
  '.cm-link:hover': {
    color: '#b91c1c' // Darker red on hover (Tailwind red-700)
  },
  '.cm-markdown-link-text': {
    color: '#dc2626', // Red color for the link text part
    cursor: 'pointer'
  },
  '.cm-markdown-link-url': {
    color: '#9ca3af', // Gray color for the URL part (Tailwind gray-400)
    fontSize: '0.9em'
  },
  '.cm-markdown-link-brackets': {
    color: '#6b7280', // Darker gray for brackets and parentheses (Tailwind gray-500)
    opacity: 0.7
  },
  '.cm-markdown-link-pencil': {
    color: '#dc262680',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '15px',
    height: '15px',
    verticalAlign: 'baseline',
    lineHeight: '1',
    transform: 'translateY(2.5px)', // Slight adjustment for better alignment
    marginLeft: '6px',
    marginRight: '4px' // Reduced right margin for better spacing
  },
  '.cm-markdown-link-pencil:hover': {
    color: '#b91c1c',
    borderRadius: '2px'
  },
  '.cm-markdown-link-url-hidden': {
    display: 'none'
  },
  '.fade-syntax': {
    opacity: 0.3,
    transition: 'opacity 0.2s ease'
  },
  // Preview card styles
  '.cm-link-preview-card': {
    display: 'inline-block !important',
    alignItems: 'end',
    margin: '8px 0',
    verticalAlign: 'bottom'
  }
})

// Custom widget for the pencil icon with proper cursor handling
class PencilWidget extends WidgetType {
  constructor(linkInfo, view) {
    super()
    this.linkInfo = linkInfo
    this.view = view
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-markdown-link-pencil'
    span.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M27.7664 6.3033C28.1569 6.69383 28.1569 7.32699 27.7664 7.71751L9.18198 26.3019C8.05676 27.4271 6.53064 28.0593 4.93934 28.0593H1C0.447715 28.0593 0 27.6115 0 27.0593V23.1199C0 21.5286 0.632141 20.0025 1.75736 18.8773L20.3417 0.292893C20.7323 -0.0976311 21.3654 -0.097631 21.756 0.292893L27.7664 6.3033ZM3.0948 21.0754C2.71379 21.4564 2.49973 21.9732 2.49973 22.512C2.49973 24.1951 3.86416 25.5595 5.54727 25.5595C6.0861 25.5595 6.60287 25.3455 6.98389 24.9645L18.574 13.3744C18.9645 12.9838 18.9645 12.3507 18.574 11.9602L16.0991 9.48528C15.7086 9.09476 15.0754 9.09476 14.6849 9.48528L3.0948 21.0754ZM17.8669 6.3033C17.4764 6.69383 17.4764 7.32699 17.8669 7.71751L20.3417 10.1924C20.7323 10.5829 21.3654 10.5829 21.756 10.1924L24.2308 7.71751C24.6214 7.32699 24.6214 6.69383 24.2308 6.3033L21.756 3.82843C21.3654 3.4379 20.7323 3.4379 20.3417 3.82843L17.8669 6.3033Z" fill="#dc262690"/>
        <path d="M27 25.5C27.5523 25.5 28 25.9477 28 26.5V27C28 27.5523 27.5523 28 27 28H16C15.4477 28 15 27.5523 15 27V26.5C15 25.9477 15.4477 25.5 16 25.5H27Z" fill="#dc2626" fill-opacity="0.29"/>
      </svg>
    `

    // Add click handler directly to the SVG
    span.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Pass current preview state to dialog
      const currentPreviewState = getLinkPreviewState(
        this.linkInfo.text,
        this.linkInfo.url
      )
      const linkInfoWithPreview = {
        ...this.linkInfo,
        isPreview: currentPreviewState
      }

      createEditLinkDialog(
        linkInfoWithPreview,
        this.view,
        (editedData) => {
          const { start, end } = this.linkInfo.position
          let newLinkText = ''

          // Update preview state
          setLinkPreviewState(
            editedData.title,
            editedData.address,
            editedData.showPreview
          )

          if (
            editedData.showPreview ||
            (editedData.title && editedData.title !== editedData.address)
          ) {
            const linkTitle = editedData.title || editedData.address
            newLinkText = `[${linkTitle}](${editedData.address})`
          } else {
            newLinkText = editedData.address
          }

          // Replace the text in the editor
          this.view.dispatch({
            changes: {
              from: start,
              to: end,
              insert: newLinkText
            }
          })
        },
        span
      )
    })

    return span
  }

  eq(other) {
    return (
      other instanceof PencilWidget &&
      this.linkInfo.url === other.linkInfo.url &&
      this.linkInfo.text === other.linkInfo.text
    )
  }

  ignoreEvent() {
    return false
  }

  destroy() {
    // Clean up if needed
  }
}

// Atomic URL replacement widget that includes both the URL and closing parenthesis
class UrlReplacementWidget extends WidgetType {
  constructor(linkInfo, view) {
    super()
    this.linkInfo = linkInfo
    this.view = view
  }

  toDOM() {
    const container = document.createElement('span')
    container.style.cssText = 'display: inline-flex; align-items: baseline;'

    // Create pencil icon
    const pencil = document.createElement('span')
    pencil.className = 'cm-markdown-link-pencil'
    pencil.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M27.7664 6.3033C28.1569 6.69383 28.1569 7.32699 27.7664 7.71751L9.18198 26.3019C8.05676 27.4271 6.53064 28.0593 4.93934 28.0593H1C0.447715 28.0593 0 27.6115 0 27.0593V23.1199C0 21.5286 0.632141 20.0025 1.75736 18.8773L20.3417 0.292893C20.7323 -0.0976311 21.3654 -0.097631 21.756 0.292893L27.7664 6.3033ZM3.0948 21.0754C2.71379 21.4564 2.49973 21.9732 2.49973 22.512C2.49973 24.1951 3.86416 25.5595 5.54727 25.5595C6.0861 25.5595 6.60287 25.3455 6.98389 24.9645L18.574 13.3744C18.9645 12.9838 18.9645 12.3507 18.574 11.9602L16.0991 9.48528C15.7086 9.09476 15.0754 9.09476 14.6849 9.48528L3.0948 21.0754ZM17.8669 6.3033C17.4764 6.69383 17.4764 7.32699 17.8669 7.71751L20.3417 10.1924C20.7323 10.5829 21.3654 10.5829 21.756 10.1924L24.2308 7.71751C24.6214 7.32699 24.6214 6.69383 24.2308 6.3033L21.756 3.82843C21.3654 3.4379 20.7323 3.4379 20.3417 3.82843L17.8669 6.3033Z" fill="#dc262690"/>
        <path d="M27 25.5C27.5523 25.5 28 25.9477 28 26.5V27C28 27.5523 27.5523 28 27 28H16C15.4477 28 15 27.5523 15 27V26.5C15 25.9477 15.4477 25.5 16 25.5H27Z" fill="#dc2626" fill-opacity="0.29"/>
      </svg>
    `

    // Create closing parenthesis with faded styling
    const closingParen = document.createElement('span')
    closingParen.className = 'cm-markdown-link-brackets fade-syntax'
    closingParen.textContent = ')'
    closingParen.style.marginLeft = '2px' // Small space between pencil and paren

    container.appendChild(pencil)
    container.appendChild(closingParen)

    // Add click handler to the pencil
    pencil.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const currentPreviewState = getLinkPreviewState(
        this.linkInfo.text,
        this.linkInfo.url
      )
      const linkInfoWithPreview = {
        ...this.linkInfo,
        isPreview: currentPreviewState
      }

      createEditLinkDialog(
        linkInfoWithPreview,
        this.view,
        (editedData) => {
          const { start, end } = this.linkInfo.position
          let newLinkText = ''

          setLinkPreviewState(
            editedData.title,
            editedData.address,
            editedData.showPreview
          )

          if (
            editedData.showPreview ||
            (editedData.title && editedData.title !== editedData.address)
          ) {
            const linkTitle = editedData.title || editedData.address
            newLinkText = `[${linkTitle}](${editedData.address})`
          } else {
            newLinkText = editedData.address
          }

          this.view.dispatch({
            changes: {
              from: start,
              to: end,
              insert: newLinkText
            }
          })
        },
        pencil
      )
    })

    return container
  }

  eq(other) {
    return (
      other instanceof UrlReplacementWidget &&
      this.linkInfo.url === other.linkInfo.url &&
      this.linkInfo.text === other.linkInfo.text
    )
  }

  ignoreEvent() {
    return false
  }
}

// Main link styling plugin
export const linkStyling = ViewPlugin.fromClass(
  class {
    constructor(view) {
      // Initialize preview styles
      injectPreviewStyles()
      this.decorations = this.buildDecorations(view)
      // Clear replaced ranges on construction
      clearReplacedRanges(view)
    }

    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder()
      const { state } = view
      const cursor = state.selection.main.head

      // Clear previous replaced ranges
      clearReplacedRanges(view)

      // Collect all decorations first, then sort them
      const decorations = []

      for (let { from, to } of view.visibleRanges) {
        let pos = from
        while (pos <= to) {
          const line = state.doc.lineAt(pos)
          const lineText = line.text

          // Process markdown links first (more specific)
          this.processMarkdownLinks(lineText, line, decorations, cursor, view)

          // Process plain URLs
          this.processPlainUrls(lineText, line, decorations, cursor)

          // Process email addresses
          this.processEmails(lineText, line, decorations, cursor)

          pos = line.to + 1
        }
      }

      // Sort decorations by position
      decorations.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from
        if (a.to !== b.to) return a.to - b.to
        return 0
      })

      // Add decorations to builder
      for (const { from, to, decoration } of decorations) {
        builder.add(from, to, decoration)
      }

      return builder.finish()
    }

    processMarkdownLinks(lineText, line, decorations, cursor, view) {
      const matches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]

      for (const match of matches) {
        const linkStart = line.from + match.index
        const linkEnd = linkStart + match[0].length
        const linkText = match[1]
        const linkUrl = match[2]

        // Check if this link has preview enabled
        const isPreviewLink = getLinkPreviewState(linkText, linkUrl)

        // Create link info for the pencil widget
        const linkInfo = {
          type: 'markdown',
          text: linkText,
          url: linkUrl,
          isPreview: isPreviewLink,
          position: {
            start: linkStart,
            end: linkEnd
          }
        }

        // Check if cursor is near this link (within the link boundaries)
        const isCursorNear = cursor >= linkStart && cursor <= linkEnd

        // Always show preview if preview is enabled, regardless of cursor position
        if (isPreviewLink) {
          // Replace entire link with preview widget when preview is enabled
          decorations.push({
            from: linkStart,
            to: linkEnd,
            decoration: Decoration.replace({
              widget: new LinkPreviewWidget(linkInfo, view)
            })
          })

          // Track the ENTIRE link range for cursor navigation and deletion fixes
          addReplacedRange(view, linkStart, linkEnd)
        } else {
          // Normal link processing when preview is not enabled
          // Calculate positions for different parts
          const textStart = linkStart + 1 // After opening [
          const textEnd = textStart + linkText.length
          const urlParenStart = textEnd + 2 // After ](
          const urlStart = urlParenStart
          const urlEnd = urlStart + linkUrl.length

          if (isCursorNear) {
            // Cursor is near - show syntax: [Link Text](url)

            // Style the opening bracket [ (faded)
            decorations.push({
              from: linkStart,
              to: linkStart + 1,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-brackets fade-syntax',
                inclusive: false
              })
            })

            // Style the link text (normal)
            decorations.push({
              from: textStart,
              to: textEnd,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-text',
                inclusive: false
              })
            })

            // Style the closing bracket and opening parenthesis ]( (faded)
            decorations.push({
              from: textEnd,
              to: textEnd + 2,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-brackets fade-syntax',
                inclusive: false
              })
            })

            // Replace URL and closing parenthesis with atomic widget
            decorations.push({
              from: urlStart,
              to: linkEnd,
              decoration: Decoration.replace({
                widget: new UrlReplacementWidget(linkInfo, view)
              })
            })

            // Track this replaced range for cursor navigation fixes
            addReplacedRange(view, urlStart, linkEnd)
          } else {
            // Cursor is away - conceal syntax: Link Text pencil

            // Hide the opening bracket [
            decorations.push({
              from: linkStart,
              to: linkStart + 1,
              decoration: Decoration.replace({})
            })

            // Style the link text (normal, clickable)
            decorations.push({
              from: textStart,
              to: textEnd,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-text',
                inclusive: false
              })
            })

            // Hide everything from ]( to the end ) - replace with just the pencil
            decorations.push({
              from: textEnd,
              to: linkEnd,
              decoration: Decoration.replace({
                widget: new PencilWidget(linkInfo, view)
              })
            })

            // Track this replaced range for cursor navigation fixes
            addReplacedRange(view, textEnd, linkEnd)
          }
        }
      }
    }

    processPlainUrls(lineText, line, decorations, cursor) {
      // Reset regex to ensure we start from the beginning
      URL_REGEX.lastIndex = 0

      let match
      while ((match = URL_REGEX.exec(lineText)) !== null) {
        const urlStart = line.from + match.index
        const urlEnd = urlStart + match[0].length

        // Check if this URL is already part of a markdown link
        const isPartOfMarkdownLink = this.isInsideMarkdownLink(
          lineText,
          match.index
        )

        if (!isPartOfMarkdownLink) {
          const isCursorInUrl = cursor >= urlStart && cursor <= urlEnd

          decorations.push({
            from: urlStart,
            to: urlEnd,
            decoration: Decoration.mark({
              class: `cm-link${isCursorInUrl ? ' cm-link-active' : ''}`,
              inclusive: false
            })
          })
        }
      }
    }

    processEmails(lineText, line, decorations, cursor) {
      // Reset regex to ensure we start from the beginning
      EMAIL_REGEX.lastIndex = 0

      let match
      while ((match = EMAIL_REGEX.exec(lineText)) !== null) {
        const emailStart = line.from + match.index
        const emailEnd = emailStart + match[0].length

        // Check if this email is already part of a markdown link
        const isPartOfMarkdownLink = this.isInsideMarkdownLink(
          lineText,
          match.index
        )

        if (!isPartOfMarkdownLink) {
          const isCursorInEmail = cursor >= emailStart && cursor <= emailEnd

          decorations.push({
            from: emailStart,
            to: emailEnd,
            decoration: Decoration.mark({
              class: `cm-link${isCursorInEmail ? ' cm-link-active' : ''}`,
              inclusive: false
            })
          })
        }
      }
    }

    isInsideMarkdownLink(lineText, position) {
      const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]

      for (const match of markdownMatches) {
        const linkStart = match.index
        const linkEnd = linkStart + match[0].length

        if (position >= linkStart && position < linkEnd) {
          return true
        }
      }

      return false
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    // Provide atomic ranges for preview widgets to ensure proper cursor behavior
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        const pluginInstance = view.plugin(plugin)
        if (!pluginInstance) return Decoration.none

        // Filter decorations to only include preview widgets (replace decorations)
        const builder = new RangeSetBuilder()

        pluginInstance.decorations.between(
          0,
          view.state.doc.length,
          (from, to, decoration) => {
            // Only add atomic ranges for replace decorations that contain preview widgets
            if (
              decoration.spec &&
              decoration.spec.widget instanceof LinkPreviewWidget
            ) {
              builder.add(from, to, {})
            }
          }
        )

        return builder.finish()
      })
  }
)

// Custom backspace command that handles preview widgets at line start
const customBackspaceCommand = (view) => {
  const cursor = view.state.selection.main.head
  const line = view.state.doc.lineAt(cursor)

  console.log('Custom backspace command called:', {
    cursor,
    lineFrom: line.from,
    isAtLineStart: cursor === line.from
  })

  // Only handle backspace at the beginning of a line
  if (cursor !== line.from) {
    return false // Let default backspace handle it
  }

  // Check if this line starts with a preview widget
  const lineText = line.text
  const matches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]

  for (const match of matches) {
    const linkStart = line.from + match.index
    const linkText = match[1]
    const linkUrl = match[2]

    // Check if this is a preview link at the beginning of the line
    const isPreviewLink = getLinkPreviewState(linkText, linkUrl)
    const isLinkAtLineStart = linkStart === line.from

    console.log('Found link at line start:', {
      linkText,
      linkUrl,
      isPreviewLink,
      isLinkAtLineStart
    })

    if (isPreviewLink && isLinkAtLineStart) {
      console.log('Handling backspace for preview widget at line start')

      // Check if there's a previous line to join with
      if (line.number > 1) {
        const prevLine = view.state.doc.line(line.number - 1)
        const prevLineText = prevLine.text

        console.log('Joining lines:', {
          prevLineNumber: prevLine.number,
          prevLineTo: prevLine.to,
          currentLineFrom: line.from,
          prevLineText: prevLineText,
          currentLineText: lineText
        })

        // CRITICAL FIX: Handle the atomic nature of preview widgets
        // We need to join lines in a way that preserves the preview widget

        // Strategy: Remove the line break and let the preview widget
        // re-render on the joined line
        const newContent = prevLineText + lineText

        view.dispatch({
          changes: {
            from: prevLine.from,
            to: line.to, // Remove both lines completely
            insert: newContent // Insert the joined content
          },
          selection: {
            anchor: prevLine.to, // Position cursor at the original end of prev line
            head: prevLine.to
          }
        })

        return true // Command handled
      }
    }
  }

  return false // Let default backspace handle it
}

// High-precedence keymap for custom backspace behavior
const customBackspaceKeymap = keymap.of([
  {
    key: 'Backspace',
    run: customBackspaceCommand
  }
])

const cursorNavigationFix = EditorView.domEventHandlers({
  keydown: (event, view) => {
    // IMPORTANT: Don't handle delete/backspace when typing in any input field
    const activeElement = document.activeElement
    const isTypingInInput =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        activeElement.closest('.edit-link-dialog-overlay'))

    if (
      isTypingInInput &&
      (event.key === 'Delete' || event.key === 'Backspace')
    ) {
      console.log('Ignoring delete/backspace - user is typing in input field')
      return false // Let the input field handle the key event
    }

    // Additional check for dialog overlay presence
    const isDialogOpen = document.querySelector('.edit-link-dialog-overlay')
    if (isDialogOpen && (event.key === 'Delete' || event.key === 'Backspace')) {
      console.log('Ignoring delete/backspace - dialog is open')
      return false // Let the dialog handle the key event
    }

    return false
  }
})

// Export the complete link extensions with cursor navigation fix
export const linkExtensions = [
  linkTheme,
  linkStyling,
  // Add custom backspace keymap with HIGHEST precedence to override atomic ranges
  Prec.highest(customBackspaceKeymap),
  // Add cursor navigation fix with MAXIMUM priority to override all other handlers
  Prec.highest(Prec.highest(Prec.highest(cursorNavigationFix))),
  // Add high priority handler
  highPriorityHandler,
  linkClickHandler
]

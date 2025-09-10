import { Prec, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap
} from '@codemirror/view'
import { createEditLinkDialog } from './linkDialog.js'
import { highPriorityHandler, linkClickHandler } from './linkHandlers.js'
import { LinkPreviewWidget, injectPreviewStyles } from './linkPreview.js'
import { EMAIL_REGEX, MARKDOWN_LINK_REGEX, URL_REGEX } from './linkRegex.js'

import { ICONS, createIcon } from './iconHelpers.js'

import { getLinkPreviewState, setLinkPreviewState } from './linkPreviewState.js'

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

// Theme for link styling
const linkTheme = EditorView.theme({
  '.cm-link': {
    color: '#dc2626',
    cursor: 'pointer',
    textDecoration: 'none'
  },
  '.cm-markdown-link-text': {
    color: '#dc2626',
    cursor: 'pointer',
    textDecoration: 'none'
  },
  '.cm-markdown-link-text:hover': {
    textDecoration: 'underline'
  },
  '.cm-markdown-link-url': {
    color: '#9ca3af',
    fontSize: '0.9em'
  },
  '.cm-markdown-link-brackets': {
    color: '#6b7280',
    opacity: 0.7
  },
  '.cm-markdown-link-pencil': {
    color: '#dc262680',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'baseline',
    lineHeight: '1',
    padding: '3px 3px', // Increased padding for larger touch target
    touchAction: 'none' // Prevent browser touch actions
  },
  '.cm-line:has(.cm-heading-1) .cm-markdown-link-pencil .icon': {
    fontSize: '1.6rem' // Match heading-1 font size
  },
  '.cm-line:has(.cm-heading-2) .cm-markdown-link-pencil .icon': {
    fontSize: '1.3rem' // Match heading-2 font size
  },
  '.cm-line:has(.cm-heading-3) .cm-markdown-link-pencil .icon': {
    fontSize: '1.15rem' // Match heading-3 font size
  },
  '.cm-line:has(.cm-heading-4) .cm-markdown-link-pencil .icon, .cm-line:has(.cm-heading-5) .cm-markdown-link-pencil .icon, .cm-line:has(.cm-heading-6) .cm-markdown-link-pencil .icon':
    {
      fontSize: '1rem' // Match heading-4, heading-5, heading-6 font size
    },
  '.fade-syntax': {
    opacity: 0.3,
    transition: 'opacity 0.2s ease'
  },
  '.cm-link-preview-card': {
    display: 'inline-block !important',
    alignItems: 'end',
    margin: '8px 0',
    verticalAlign: 'bottom'
  }
})

class PencilWidget extends WidgetType {
  constructor(linkInfo, view) {
    super()
    this.linkInfo = linkInfo
    this.view = view
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-markdown-link-pencil'

    // Use icon font
    const editIcon = createIcon(ICONS.EDIT)
    span.appendChild(editIcon)

    // Unified event handler for both click and touch
    const handleInteraction = (e) => {
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
        span
      )

      // Trigger haptic feedback for touch events
      if (e.type === 'touchstart' && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'HAPTIC_FEEDBACK',
            style: 'light'
          })
        )
      }
    }

    // Add both click and touchstart listeners
    span.addEventListener('click', handleInteraction)
    span.addEventListener('touchstart', handleInteraction)

    // Prevent long-press context menu on the pencil icon
    span.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    // Prevent touchmove from canceling the interaction
    span.addEventListener('touchmove', (e) => {
      e.stopPropagation()
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
}

// URL replacement widget that includes URL and closing parenthesis
class UrlReplacementWidget extends WidgetType {
  constructor(linkInfo, view) {
    super()
    this.linkInfo = linkInfo
    this.view = view
  }

  toDOM() {
    const container = document.createElement('span')
    container.style.cssText = 'display: inline-flex; align-items: baseline;'

    // Pencil icon
    const pencil = document.createElement('span')
    pencil.className = 'cm-markdown-link-pencil'

    // Use icon font
    const editIcon = createIcon(ICONS.EDIT)
    pencil.appendChild(editIcon)

    // Closing parenthesis
    const closingParen = document.createElement('span')
    closingParen.className = 'cm-markdown-link-brackets fade-syntax'
    closingParen.textContent = ')'
    closingParen.style.marginLeft = '2px'

    container.appendChild(pencil)
    container.appendChild(closingParen)

    // Unified event handler for both click and touch
    const handleInteraction = (e) => {
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

      // Trigger haptic feedback for touch events
      if (e.type === 'touchstart' && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'HAPTIC_FEEDBACK',
            style: 'light'
          })
        )
      }
    }

    // Add both click and touchstart listeners
    pencil.addEventListener('click', handleInteraction)
    pencil.addEventListener('touchstart', handleInteraction)

    // Prevent long-press context menu on the pencil icon
    pencil.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    // Prevent touchmove from canceling the interaction
    pencil.addEventListener('touchmove', (e) => {
      e.stopPropagation()
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
      injectPreviewStyles()
      this.decorations = this.buildDecorations(view)
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

      clearReplacedRanges(view)

      const decorations = []

      for (let { from, to } of view.visibleRanges) {
        let pos = from
        while (pos <= to) {
          const line = state.doc.lineAt(pos)
          const lineText = line.text

          this.processMarkdownLinks(lineText, line, decorations, cursor, view)
          this.processPlainUrls(lineText, line, decorations, cursor)
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

        const isPreviewLink = getLinkPreviewState(linkText, linkUrl)

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

        const isCursorNear = cursor >= linkStart && cursor <= linkEnd

        if (isPreviewLink) {
          // Show preview widget
          decorations.push({
            from: linkStart,
            to: linkEnd,
            decoration: Decoration.replace({
              widget: new LinkPreviewWidget(linkInfo, view)
            })
          })
          addReplacedRange(view, linkStart, linkEnd)
        } else {
          // Normal markdown link processing
          const textStart = linkStart + 1
          const textEnd = textStart + linkText.length
          const urlStart = textEnd + 2
          const urlEnd = urlStart + linkUrl.length

          if (isCursorNear) {
            // Show full syntax when cursor is near
            decorations.push({
              from: linkStart,
              to: linkStart + 1,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-brackets fade-syntax',
                inclusive: false
              })
            })

            decorations.push({
              from: textStart,
              to: textEnd,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-text',
                inclusive: false
              })
            })

            decorations.push({
              from: textEnd,
              to: textEnd + 2,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-brackets fade-syntax',
                inclusive: false
              })
            })

            decorations.push({
              from: urlStart,
              to: linkEnd,
              decoration: Decoration.replace({
                widget: new UrlReplacementWidget(linkInfo, view)
              })
            })

            addReplacedRange(view, urlStart, linkEnd)
          } else {
            // Conceal syntax when cursor is away
            decorations.push({
              from: linkStart,
              to: linkStart + 1,
              decoration: Decoration.replace({})
            })

            decorations.push({
              from: textStart,
              to: textEnd,
              decoration: Decoration.mark({
                class: 'cm-markdown-link-text',
                inclusive: false
              })
            })

            decorations.push({
              from: textEnd,
              to: linkEnd,
              decoration: Decoration.replace({
                widget: new PencilWidget(linkInfo, view)
              })
            })

            addReplacedRange(view, textEnd, linkEnd)
          }
        }
      }
    }

    processPlainUrls(lineText, line, decorations, cursor) {
      URL_REGEX.lastIndex = 0

      let match
      while ((match = URL_REGEX.exec(lineText)) !== null) {
        const urlStart = line.from + match.index
        const urlEnd = urlStart + match[0].length

        if (!this.isInsideMarkdownLink(lineText, match.index)) {
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
      EMAIL_REGEX.lastIndex = 0

      let match
      while ((match = EMAIL_REGEX.exec(lineText)) !== null) {
        const emailStart = line.from + match.index
        const emailEnd = emailStart + match[0].length

        if (!this.isInsideMarkdownLink(lineText, match.index)) {
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
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        const pluginInstance = view.plugin(plugin)
        if (!pluginInstance) return Decoration.none

        const builder = new RangeSetBuilder()

        pluginInstance.decorations.between(
          0,
          view.state.doc.length,
          (from, to, decoration) => {
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

// Custom backspace handler for preview widgets
const customBackspaceCommand = (view) => {
  const cursor = view.state.selection.main.head
  const line = view.state.doc.lineAt(cursor)

  if (cursor !== line.from) {
    return false
  }

  const lineText = line.text
  const matches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]

  for (const match of matches) {
    const linkStart = line.from + match.index
    const linkText = match[1]
    const linkUrl = match[2]

    const isPreviewLink = getLinkPreviewState(linkText, linkUrl)
    const isLinkAtLineStart = linkStart === line.from

    if (isPreviewLink && isLinkAtLineStart) {
      if (line.number > 1) {
        const prevLine = view.state.doc.line(line.number - 1)
        const prevLineText = prevLine.text
        const newContent = prevLineText + lineText

        view.dispatch({
          changes: {
            from: prevLine.from,
            to: line.to,
            insert: newContent
          },
          selection: {
            anchor: prevLine.to,
            head: prevLine.to
          }
        })

        return true
      }
    }
  }

  return false
}

// Keymap for custom backspace behavior
const customBackspaceKeymap = keymap.of([
  {
    key: 'Backspace',
    run: customBackspaceCommand
  }
])

// Cursor navigation fix for input fields
const cursorNavigationFix = EditorView.domEventHandlers({
  keydown: (event, view) => {
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
      return false
    }

    const isDialogOpen = document.querySelector('.edit-link-dialog-overlay')
    if (isDialogOpen && (event.key === 'Delete' || event.key === 'Backspace')) {
      return false
    }

    return false
  }
})

// Export complete link extensions
export const linkExtensions = [
  linkTheme,
  linkStyling,
  Prec.highest(customBackspaceKeymap),
  Prec.highest(Prec.highest(Prec.highest(cursorNavigationFix))),
  highPriorityHandler,
  linkClickHandler
]

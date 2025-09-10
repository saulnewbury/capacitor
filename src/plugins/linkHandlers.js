'use client'
// linkHandlers.js - Updated for Capacitor

import { Prec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createLinkSaveHandler, getCurrentDisplayedTitle } from './linkCore.js'
import { createEditLinkDialog } from './linkDialog.js'
import { getLinkPreviewState } from './linkPreviewState.js'
import {
  EMAIL_REGEX,
  MARKDOWN_LINK_REGEX,
  URL_REGEX,
  getLinkAtPosition,
  selectLinkText
} from './linkRegex.js'
import { safeOpenEmail, safeOpenUrl } from './linkUtils.js'

// Import Capacitor modules
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet'
import { Clipboard } from '@capacitor/clipboard'
import { Browser } from '@capacitor/browser'

// Global editor view storage
let currentEditorView = null

export const setCurrentEditorView = (view) => {
  currentEditorView = view
}

export const getCurrentEditorView = () => {
  return currentEditorView
}

// Helper function to check if click is on a preview card
const isClickOnPreviewCard = (event) => {
  const target = event.target
  return target.closest('.cm-link-preview-card') !== null
}

// Helper function to check if a position is within a preview widget range
const isPositionInPreviewWidget = (view, pos) => {
  const line = view.state.doc.lineAt(pos)
  const lineText = line.text
  const posInLine = pos - line.from

  const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
  for (const match of markdownMatches) {
    const linkText = match[1]
    const linkUrl = match[2]
    const linkStart = match.index
    const linkEnd = linkStart + match[0].length

    if (
      getLinkPreviewState(linkText, linkUrl) &&
      posInLine >= linkStart &&
      posInLine < linkEnd
    ) {
      return {
        isInWidget: true,
        linkStart: line.from + linkStart,
        linkEnd: line.from + linkEnd,
        linkText,
        linkUrl
      }
    }
  }

  return { isInWidget: false }
}

// Helper function to handle cursor placement near preview widgets
const handleCursorNearPreview = (view, pos, event) => {
  const line = view.state.doc.lineAt(pos)
  const lineText = line.text
  const posInLine = pos - line.from

  const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
  for (const match of markdownMatches) {
    const linkText = match[1]
    const linkUrl = match[2]
    const linkStart = match.index
    const linkEnd = linkStart + match[0].length
    const absoluteLinkStart = line.from + linkStart
    const absoluteLinkEnd = line.from + linkEnd

    if (getLinkPreviewState(linkText, linkUrl)) {
      if (posInLine >= linkStart - 2 && posInLine <= linkEnd + 2) {
        const distanceToStart = Math.abs(posInLine - linkStart)
        const distanceToEnd = Math.abs(posInLine - linkEnd)

        let targetPosition
        if (distanceToStart <= distanceToEnd) {
          targetPosition = absoluteLinkStart
        } else {
          targetPosition = absoluteLinkEnd
        }

        view.dispatch({
          selection: {
            anchor: targetPosition,
            head: targetPosition
          }
        })

        return true
      }
    }
  }

  return false
}

// Show context menu - fallback to custom menu if ActionSheet not available
const showLinkContextMenu = async (linkInfo, event, view) => {
  console.log('📱 Showing context menu for link', linkInfo)

  try {
    // Try using ActionSheet if available
    if (typeof ActionSheet !== 'undefined' && ActionSheet.showActions) {
      const buttons = []

      if (linkInfo.type === 'email') {
        buttons.push(
          { title: 'Open Email', style: ActionSheetButtonStyle.Default },
          { title: 'Copy Email Address', style: ActionSheetButtonStyle.Default }
        )
      } else {
        buttons.push(
          { title: 'Open Link', style: ActionSheetButtonStyle.Default },
          { title: 'Copy Link', style: ActionSheetButtonStyle.Default }
        )
      }

      buttons.push(
        { title: 'Edit Link', style: ActionSheetButtonStyle.Default },
        { title: 'Cancel', style: ActionSheetButtonStyle.Cancel }
      )

      const result = await ActionSheet.showActions({
        title: linkInfo.url,
        message: linkInfo.text !== linkInfo.url ? linkInfo.text : undefined,
        options: buttons
      })

      const selectedTitle = buttons[result.index]?.title

      switch (selectedTitle) {
        case 'Open Link':
          await Browser.open({ url: linkInfo.url })
          break

        case 'Open Email':
          safeOpenEmail(linkInfo.url)
          break

        case 'Copy Link':
        case 'Copy Email Address':
          await Clipboard.write({ string: linkInfo.url })
          break

        case 'Edit Link':
          handleEditLink(linkInfo, view)
          break
      }
    } else {
      // Fallback: Create a custom context menu UI
      showCustomContextMenu(linkInfo, event, view)
    }
  } catch (error) {
    console.error('Failed to show native context menu, using fallback:', error)
    // Fallback to custom menu
    showCustomContextMenu(linkInfo, event, view)
  }
}

// Custom HTML context menu as fallback
const showCustomContextMenu = (linkInfo, event, view) => {
  // Remove any existing menu
  const existingMenu = document.querySelector('.link-context-menu')
  if (existingMenu) {
    existingMenu.remove()
  }

  // Create menu container
  const menu = document.createElement('div')
  menu.className = 'link-context-menu'
  menu.style.cssText = `
    position: fixed;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 20px rgba(0,0,0,0.2);
    padding: 8px 0;
    z-index: 10000;
    min-width: 200px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `

  // Position menu
  const x = event.touches ? event.touches[0].clientX : event.clientX
  const y = event.touches ? event.touches[0].clientY : event.clientY

  menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`
  menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`

  // Create menu items
  const items = []

  if (linkInfo.type === 'email') {
    items.push(
      { label: 'Open Email', action: () => safeOpenEmail(linkInfo.url) },
      {
        label: 'Copy Email Address',
        action: async () => {
          await Clipboard.write({ string: linkInfo.url })
          console.log('Email copied to clipboard')
        }
      }
    )
  } else {
    items.push(
      {
        label: 'Open Link',
        action: async () => {
          if (Capacitor.isNativePlatform()) {
            await Browser.open({ url: linkInfo.url })
          } else {
            window.open(linkInfo.url, '_blank')
          }
        }
      },
      {
        label: 'Copy Link',
        action: async () => {
          await Clipboard.write({ string: linkInfo.url })
          console.log('Link copied to clipboard')
        }
      }
    )
  }

  items.push({
    label: 'Edit Link',
    action: () => handleEditLink(linkInfo, view)
  })

  // Add menu items
  items.forEach((item, index) => {
    const menuItem = document.createElement('div')
    menuItem.style.cssText = `
      padding: 12px 20px;
      cursor: pointer;
      color: #000;
      font-size: 17px;
      transition: background-color 0.2s;
    `
    menuItem.textContent = item.label

    menuItem.addEventListener('touchstart', (e) => {
      menuItem.style.backgroundColor = '#f0f0f0'
    })

    menuItem.addEventListener('touchend', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      menu.remove()
      await item.action()
    })

    menuItem.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      menu.remove()
      await item.action()
    })

    menu.appendChild(menuItem)

    if (index < items.length - 1) {
      const separator = document.createElement('div')
      separator.style.cssText = `
        height: 1px;
        background: #e5e5e5;
        margin: 0 20px;
      `
      menu.appendChild(separator)
    }
  })

  // Add dismiss handlers
  const dismissMenu = () => menu.remove()

  document.body.appendChild(menu)

  // Dismiss on outside tap
  setTimeout(() => {
    document.addEventListener('touchstart', dismissMenu, { once: true })
    document.addEventListener('click', dismissMenu, { once: true })
  }, 100)
}

// Handle edit link action
const handleEditLink = (linkInfo, view) => {
  console.log('✏️ Handling edit link', linkInfo)

  if (!view) {
    console.error('❌ No editor view available for edit action')
    return
  }

  const currentPreviewState =
    linkInfo.type === 'markdown'
      ? getLinkPreviewState(linkInfo.text, linkInfo.url)
      : false

  const currentDisplayedTitle = getCurrentDisplayedTitle(linkInfo, view)

  const linkInfoWithPreview = {
    ...linkInfo,
    text: currentDisplayedTitle,
    isPreview: currentPreviewState
  }

  createEditLinkDialog(
    linkInfoWithPreview,
    view,
    createLinkSaveHandler(linkInfo, view, null),
    null
  )
}

// Main click handler
export const linkClickHandler = EditorView.domEventHandlers({
  click: (event, view) => {
    setCurrentEditorView(view)

    if (event.button !== 0) return false

    if (isClickOnPreviewCard(event)) {
      console.log('👆 Click on preview card detected - skipping link handler')
      return false
    }

    const target = event.target
    let linkTextElement = null

    if (
      target.classList &&
      target.classList.contains('cm-markdown-link-text')
    ) {
      linkTextElement = target
    } else if (
      target.parentElement &&
      target.parentElement.classList &&
      target.parentElement.classList.contains('cm-markdown-link-text')
    ) {
      linkTextElement = target.parentElement
    } else {
      let currentElement = target
      while (currentElement && currentElement !== view.contentDOM) {
        if (
          currentElement.classList &&
          currentElement.classList.contains('cm-markdown-link-text')
        ) {
          linkTextElement = currentElement
          break
        }
        currentElement = currentElement.parentElement
      }
    }

    if (linkTextElement) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })

      if (pos !== null) {
        const line = view.state.doc.lineAt(pos)
        const lineText = line.text

        const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]

        for (const match of markdownMatches) {
          const linkStart = line.from + match.index
          const textStart = linkStart + 1
          const textEnd = textStart + match[1].length

          if (pos >= textStart && pos < textEnd) {
            const linkUrl = match[2]
            const linkText = match[1]

            const isPreview = getLinkPreviewState(linkText, linkUrl)

            if (!isPreview) {
              event.preventDefault()
              event.stopPropagation()

              if (
                linkUrl.match(
                  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/
                ) ||
                linkUrl.startsWith('mailto:')
              ) {
                safeOpenEmail(linkUrl.replace('mailto:', ''))
              } else {
                safeOpenUrl(linkUrl)
              }
              return true
            }
          }
        }
      }
    }

    const selection = view.state.selection.main
    if (!selection.empty || view._isSelecting) {
      return false
    }

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    const previewCheck = isPositionInPreviewWidget(view, pos)
    if (previewCheck.isInWidget) {
      if (handleCursorNearPreview(view, pos, event)) {
        event.preventDefault()
        event.stopPropagation()
        return true
      }
      return false
    }

    const line = view.state.doc.lineAt(pos)
    const lineText = line.text
    const posInLine = pos - line.from

    // Check for markdown links (for clicks on brackets or other syntax parts)
    const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
    for (const mdMatch of markdownMatches) {
      if (
        posInLine >= mdMatch.index &&
        posInLine < mdMatch.index + mdMatch[0].length
      ) {
        const linkUrl = mdMatch[2]
        event.preventDefault()
        event.stopPropagation()

        if (
          linkUrl.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/) ||
          linkUrl.startsWith('mailto:')
        ) {
          safeOpenEmail(linkUrl.replace('mailto:', ''))
        } else {
          safeOpenUrl(linkUrl)
        }
        return true
      }
    }

    // Check for plain URLs
    URL_REGEX.lastIndex = 0
    let match
    while ((match = URL_REGEX.exec(lineText)) !== null) {
      if (
        posInLine >= match.index &&
        posInLine < match.index + match[0].length
      ) {
        const isInMarkdownLink = markdownMatches.some(
          (mdMatch) =>
            match.index >= mdMatch.index &&
            match.index < mdMatch.index + mdMatch[0].length
        )

        if (!isInMarkdownLink) {
          event.preventDefault()
          event.stopPropagation()
          safeOpenUrl(match[0])
          return true
        }
      }
    }

    // Check for emails
    EMAIL_REGEX.lastIndex = 0
    while ((match = EMAIL_REGEX.exec(lineText)) !== null) {
      if (
        posInLine >= match.index &&
        posInLine < match.index + match[0].length
      ) {
        const isInMarkdownLink = markdownMatches.some(
          (mdMatch) =>
            match.index >= mdMatch.index &&
            match.index < mdMatch.index + mdMatch[0].length
        )

        if (!isInMarkdownLink) {
          event.preventDefault()
          event.stopPropagation()
          safeOpenEmail(match[0])
          return true
        }
      }
    }

    return false
  },

  mousedown: (event, view) => {
    setCurrentEditorView(view)
    if (isClickOnPreviewCard(event)) {
      return false
    }
    view._isSelecting = false
    view._mouseDownTime = Date.now()
    view._mouseDownPos = { x: event.clientX, y: event.clientY }
    return false
  },

  mousemove: (event, view) => {
    if (view._mouseDownTime && Date.now() - view._mouseDownTime > 50) {
      const moveDistance =
        Math.abs(event.clientX - view._mouseDownPos.x) +
        Math.abs(event.clientY - view._mouseDownPos.y)
      if (moveDistance > 5) {
        view._isSelecting = true
      }
    }
    return false
  },

  mouseup: (event, view) => {
    setTimeout(() => {
      view._isSelecting = false
      view._mouseDownTime = null
      view._mouseDownPos = null
    }, 10)
    return false
  }
})

// Context menu handler for right-click
export const contextMenuHandler = EditorView.domEventHandlers({
  contextmenu: (event, view) => {
    setCurrentEditorView(view)

    if (isClickOnPreviewCard(event)) {
      console.log(
        '👆 Right-click on preview card detected - skipping context menu handler'
      )
      return false
    }

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos !== null) {
      const linkInfo = getLinkAtPosition(view, pos)
      if (linkInfo) {
        console.log('🖱️ Right-click context menu on link', linkInfo)
        event.preventDefault()
        event.stopImmediatePropagation()

        selectLinkText(view, pos, linkInfo)
        showLinkContextMenu(linkInfo, event, view)
        return true
      }
    }
    return false
  }
})

// Touch handlers for mobile long press - WITH HAPTIC FEEDBACK
export const touchHandler = EditorView.domEventHandlers({
  touchstart: (event, view) => {
    setCurrentEditorView(view)
    view._touchStartTime = Date.now()
    view._touchStartPos = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    }
    view._hasMoved = false

    const target = event.target
    if (
      target &&
      (target.closest('.cm-markdown-link-pencil') ||
        target.classList.contains('cm-markdown-link-pencil'))
    ) {
      return false
    }

    if (isClickOnPreviewCard(event)) {
      return false
    }

    const pos = view.posAtCoords({
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    })

    if (pos !== null) {
      const linkInfo = getLinkAtPosition(view, pos)
      if (linkInfo) {
        view._potentialLinkTouch = linkInfo
        view._touchPos = pos
        event.preventDefault()

        view._hapticTimer = setTimeout(async () => {
          if (!view._hasMoved && view._potentialLinkTouch) {
            // Add Capacitor haptic feedback here
            if (Capacitor.isNativePlatform()) {
              try {
                await Haptics.impact({ style: ImpactStyle.Medium })
              } catch (error) {
                console.error('Haptic feedback failed:', error)
              }
            }
            view._hapticTriggered = true
          }
        }, 500)

        return false
      } else {
        // No link found - focus the editor
        view.focus()
      }
    }
  },

  touchmove: (event, view) => {
    if (view._touchStartPos) {
      const moveDistance =
        Math.abs(event.touches[0].clientX - view._touchStartPos.x) +
        Math.abs(event.touches[0].clientY - view._touchStartPos.y)
      if (moveDistance > 10) {
        view._hasMoved = true
        view._potentialLinkTouch = null
        if (view._hapticTimer) {
          clearTimeout(view._hapticTimer)
          view._hapticTimer = null
        }
      }
    }
    return false
  },

  touchend: async (event, view) => {
    if (view._hapticTimer) {
      clearTimeout(view._hapticTimer)
      view._hapticTimer = null
    }

    const touchDuration = Date.now() - (view._touchStartTime || 0)

    if (touchDuration >= 500 && !view._hasMoved && view._potentialLinkTouch) {
      event.preventDefault()
      event.stopPropagation()

      if (typeof window !== 'undefined' && window.getSelection) {
        window.getSelection().removeAllRanges()
      }

      view.focus()
      selectLinkText(view, view._touchPos, view._potentialLinkTouch)
      await showLinkContextMenu(view._potentialLinkTouch, event, view)

      view._touchStartTime = null
      view._touchStartPos = null
      view._hasMoved = false
      view._potentialLinkTouch = null
      view._touchPos = null
      view._hapticTriggered = false

      return true
    }

    if (touchDuration < 500 && !view._hasMoved && view._potentialLinkTouch) {
      const linkInfo = view._potentialLinkTouch

      if (
        linkInfo.type === 'markdown' &&
        !getLinkPreviewState(linkInfo.text, linkInfo.url)
      ) {
        event.preventDefault()
        event.stopPropagation()

        if (
          linkInfo.url.match(
            /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/
          ) ||
          linkInfo.url.startsWith('mailto:')
        ) {
          safeOpenEmail(linkInfo.url.replace('mailto:', ''))
        } else {
          safeOpenUrl(linkInfo.url)
        }

        view._touchStartTime = null
        view._touchStartPos = null
        view._hasMoved = false
        view._potentialLinkTouch = null
        view._touchPos = null
        view._hapticTriggered = false

        return true
      }
    }

    view._touchStartTime = null
    view._touchStartPos = null
    view._hasMoved = false
    view._potentialLinkTouch = null
    view._touchPos = null
    view._hapticTriggered = false
    return false
  }
})

// High priority handler combining context menu and touch
export const highPriorityHandler = Prec.highest([
  contextMenuHandler,
  touchHandler
])

console.log('highPriorityHandler includes:', highPriorityHandler) // Debug log

// Initialize module
if (typeof window !== 'undefined') {
  console.log('🚀 Initializing link handlers for Capacitor')

  // Log platform info
  if (Capacitor.isNativePlatform()) {
    console.log('✅ Running on native platform:', Capacitor.getPlatform())
  } else {
    console.log('🌐 Running in web browser')
  }
}

import { EditorView } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import {
  URL_REGEX,
  EMAIL_REGEX,
  MARKDOWN_LINK_REGEX,
  getLinkAtPosition,
  selectLinkText
} from './linkRegex.js'
import { safeOpenUrl, safeOpenEmail } from './linkUtils.js'
import { createEditLinkDialog } from './linkDialog.js'
import { setLinkPreviewState, getLinkPreviewState } from './linkStyling.js'
import { setCustomLinkTitle, getCustomLinkTitle } from './linkPreview.js'

// Helper function to get current displayed title from preview widget
const getCurrentDisplayedTitle = (linkInfo, view) => {
  // First check the global registry
  const customTitle = getCustomLinkTitle(linkInfo.url, linkInfo.text)
  if (customTitle) {
    return customTitle
  }

  // Find the preview widget for this link in the DOM
  const previewCards = document.querySelectorAll('.cm-link-preview-card')

  for (const card of previewCards) {
    const titleElement = card.querySelector('.preview-title')
    const domainElement = card.querySelector('.preview-url span')

    if (titleElement && domainElement) {
      // Simple heuristic: check if this card matches our link
      const cardDomain = domainElement.textContent
      const linkDomain = extractDomainFromUrl(linkInfo.url)

      if (
        cardDomain === linkDomain ||
        cardDomain.includes(linkDomain) ||
        linkDomain.includes(cardDomain)
      ) {
        return titleElement.textContent
      }
    }
  }

  // Fallback to original text
  return linkInfo.text
}

// Helper function to extract domain from URL
const extractDomainFromUrl = (url) => {
  try {
    const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`
    const domain = new URL(urlWithProtocol).hostname
    return domain.replace(/^www\./, '')
  } catch {
    return url.length > 25 ? url.substring(0, 22) + '...' : url
  }
}

// Updated save handler that stores custom titles
const createUpdatedSaveHandler = (linkInfo, view, targetElement = null) => {
  return (editedData) => {
    console.log('Edited data received:', editedData) // Debug log

    // Handle the edited link data
    if (linkInfo.position) {
      const { start, end } = linkInfo.position
      let newLinkText = ''

      // IMPORTANT: Store the custom title globally if it's different from the address
      if (editedData.title && editedData.title !== editedData.address) {
        setCustomLinkTitle(editedData.address, linkInfo.text, editedData.title)
      }

      if (linkInfo.type === 'markdown') {
        // Update preview state
        setLinkPreviewState(
          editedData.title,
          editedData.address,
          editedData.showPreview
        )

        // FIXED: Separate preview mode from title logic
        if (editedData.showPreview) {
          // Preview mode: always create markdown
          const linkTitle = editedData.title || editedData.address
          newLinkText = `[${linkTitle}](${editedData.address})`
        } else if (
          editedData.title &&
          editedData.title !== editedData.address
        ) {
          // Non-preview mode: only create markdown if title is different
          newLinkText = `[${editedData.title}](${editedData.address})`
        } else {
          // Non-preview mode: plain URL if no distinct title
          newLinkText = editedData.address
        }
      } else if (linkInfo.type === 'email') {
        // FIXED: Separate preview mode from title logic
        if (editedData.showPreview) {
          // Preview mode: always create markdown
          const linkTitle = editedData.title || editedData.address
          setLinkPreviewState(
            linkTitle,
            `mailto:${editedData.address}`,
            editedData.showPreview
          )
          newLinkText = `[${linkTitle}](mailto:${editedData.address})`
        } else if (
          editedData.title &&
          editedData.title !== editedData.address
        ) {
          // Non-preview mode: only create markdown if title is different
          const linkTitle = editedData.title
          setLinkPreviewState(linkTitle, `mailto:${editedData.address}`, false)
          newLinkText = `[${linkTitle}](mailto:${editedData.address})`
        } else {
          // Non-preview mode: plain email
          newLinkText = editedData.address
        }
      } else {
        // For plain URLs
        // FIXED: Separate preview mode from title logic
        if (editedData.showPreview) {
          // Preview mode: always create markdown
          const linkTitle = editedData.title || editedData.address
          setLinkPreviewState(
            linkTitle,
            editedData.address,
            editedData.showPreview
          )
          newLinkText = `[${linkTitle}](${editedData.address})`
        } else if (
          editedData.title &&
          editedData.title !== editedData.address
        ) {
          // Non-preview mode: only create markdown if title is different
          setLinkPreviewState(editedData.title, editedData.address, false)
          newLinkText = `[${editedData.title}](${editedData.address})`
        } else {
          // Non-preview mode: plain URL
          newLinkText = editedData.address
        }
      }

      console.log('Replacing text:', {
        from: start,
        to: end,
        insert: newLinkText
      }) // Debug log

      // Replace the text in the editor
      view.dispatch({
        changes: {
          from: start,
          to: end,
          insert: newLinkText
        }
      })
    }

    // Clean up temporary element if it exists
    if (targetElement && targetElement.parentNode) {
      targetElement.parentNode.removeChild(targetElement)
    }
  }
}

// Custom context menu for links (with your styling preferences)
export const createLinkContextMenu = (
  linkInfo,
  event,
  view,
  targetElement = null
) => {
  // Remove any existing context menu
  const existingMenu = document.querySelector('.link-context-menu')
  if (existingMenu) {
    existingMenu.remove()
  }

  // Create context menu element
  const menu = document.createElement('div')
  menu.className = 'link-context-menu'
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    // background: rgb(228, 228, 227);
    background: #bbbbbb78;
    border: .8px solid rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    padding: 4px 0;
    min-width: 180px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    color: #000;
    backdrop-filter: blur(10px);

  `

  // Helper function to create menu items
  const createMenuItem = (text, onClick) => {
    const item = document.createElement('div')
    item.className = 'context-menu-item'
    item.style.cssText = `
      padding: 2px 16px;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      display: block;
      color: #000;
      font-size: 13px;
    `
    item.textContent = text

    // Hover effects
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
    })
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent'
    })

    item.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onClick()
      menu.remove()
    })

    return item
  }

  // Add menu items based on link type
  if (linkInfo.type === 'email') {
    menu.appendChild(
      createMenuItem('Open Email Client', () => safeOpenEmail(linkInfo.url))
    )
    menu.appendChild(
      createMenuItem('Copy Email Address', () =>
        navigator.clipboard.writeText(linkInfo.url)
      )
    )
  } else {
    // URL or markdown link
    const url = linkInfo.url

    menu.appendChild(createMenuItem('Open Link', () => safeOpenUrl(url)))
    menu.appendChild(createMenuItem('Open in New Tab', () => safeOpenUrl(url)))
    menu.appendChild(
      createMenuItem('Copy Link Address', () => {
        // Ensure URL has protocol for copying
        let copyUrl = url
        if (!url.match(/^https?:\/\//i)) {
          copyUrl = url.startsWith('www.') ? `https://${url}` : `https://${url}`
        }
        navigator.clipboard.writeText(copyUrl)
      })
    )

    if (linkInfo.type === 'markdown') {
      menu.appendChild(
        createMenuItem('Copy Link Text', () =>
          navigator.clipboard.writeText(linkInfo.text)
        )
      )
    }
  }

  // Add a separator and additional custom actions
  const separator = document.createElement('div')
  separator.style.cssText = `
    height: 1px;
    background-color: rgba(0, 0, 0, 0.1);
    margin: 4px 0;
  `
  menu.appendChild(separator)

  // Edit Link action with dialog
  menu.appendChild(
    createMenuItem('Edit Link', () => {
      // Get current preview state
      const currentPreviewState =
        linkInfo.type === 'markdown'
          ? getLinkPreviewState(linkInfo.text, linkInfo.url)
          : false

      // Use current displayed title for preview links
      const currentDisplayedTitle = getCurrentDisplayedTitle(linkInfo, view)

      const linkInfoWithPreview = {
        ...linkInfo,
        text: currentDisplayedTitle, // Use current displayed title
        isPreview: currentPreviewState
      }

      createEditLinkDialog(
        linkInfoWithPreview,
        view,
        createUpdatedSaveHandler(linkInfo, view, targetElement),
        targetElement
      )
    })
  )

  // Add to document
  document.body.appendChild(menu)

  // Position adjustment to keep menu on screen
  const rect = menu.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    menu.style.left = `${event.clientX - rect.width}px`
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${event.clientY - rect.height}px`
  }

  // Close menu when clicking outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove()
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }

  // Close menu with Escape key
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      menu.remove()
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }

  // Add event listeners after a small delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
    document.addEventListener('keydown', handleKeyDown)
  }, 100)
}

// Click handler for links with selection detection
export const linkClickHandler = EditorView.domEventHandlers({
  click: (event, view) => {
    // Only handle left clicks, ignore right clicks and other buttons
    if (event.button !== 0) return false

    // Check if this was the end of a text selection drag
    const selection = view.state.selection.main
    if (!selection.empty) {
      // If there's a selection, don't treat this as a link click
      return false
    }

    // Check if the user is currently selecting text (mousedown + mousemove + mouseup)
    // We'll track this with a flag
    if (view._isSelecting) {
      return false
    }

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    // First, check if we clicked on a pencil icon widget
    const target = event.target
    if (
      target &&
      (target.closest('.cm-markdown-link-pencil') ||
        target.classList.contains('cm-markdown-link-pencil'))
    ) {
      // Find the link that contains this position
      const linkInfo = getLinkAtPosition(view, pos)
      if (linkInfo && linkInfo.type === 'markdown') {
        event.preventDefault()
        event.stopPropagation()

        // Get current preview state
        const currentPreviewState = getLinkPreviewState(
          linkInfo.text,
          linkInfo.url
        )

        // Use current displayed title for preview links
        const currentDisplayedTitle = getCurrentDisplayedTitle(linkInfo, view)

        const linkInfoWithPreview = {
          ...linkInfo,
          text: currentDisplayedTitle, // Use current displayed title
          isPreview: currentPreviewState
        }

        createEditLinkDialog(
          linkInfoWithPreview,
          view,
          createUpdatedSaveHandler(linkInfo, view, null)
        )
        return true
      }
    }

    const line = view.state.doc.lineAt(pos)
    const lineText = line.text
    const posInLine = pos - line.from

    // Check for markdown links first (highest priority)
    const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
    for (const mdMatch of markdownMatches) {
      if (
        posInLine >= mdMatch.index &&
        posInLine < mdMatch.index + mdMatch[0].length
      ) {
        const linkText = mdMatch[1]
        const linkUrl = mdMatch[2]

        // Calculate positions more precisely
        const textStart = mdMatch.index + 1 // After opening [
        const textEnd = textStart + linkText.length
        const urlStart = textEnd + 2 // After ](
        const urlEnd = urlStart + linkUrl.length

        // Determine what was clicked based on position in the raw text
        const clickedOnText = posInLine >= textStart && posInLine < textEnd
        const clickedOnUrl = posInLine >= urlStart && posInLine < urlEnd

        event.preventDefault()
        event.stopPropagation()

        if (clickedOnText || clickedOnUrl) {
          // Open URL when clicking on text or URL
          // Check if it's an email in the URL part
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
        }

        return true
      }
    }

    // Check for plain URLs (but not if they're part of markdown links)
    URL_REGEX.lastIndex = 0
    let match
    while ((match = URL_REGEX.exec(lineText)) !== null) {
      if (
        posInLine >= match.index &&
        posInLine < match.index + match[0].length
      ) {
        // Check if it's not part of a markdown link
        const isInMarkdownLink = markdownMatches.some(
          (mdMatch) =>
            match.index >= mdMatch.index &&
            match.index < mdMatch.index + mdMatch[0].length
        )

        if (!isInMarkdownLink) {
          // Check if this is a right-click (context menu) or regular click
          if (event.button === 2) {
            // Right-click - let the context menu handle it
            return false
          }

          event.preventDefault()
          event.stopPropagation()

          // Check if Ctrl/Cmd key is held (indicating edit intent)
          if (event.ctrlKey || event.metaKey) {
            // Create linkInfo for the plain URL
            const linkInfo = {
              type: 'url',
              url: match[0],
              text: match[0],
              position: {
                start: line.from + match.index,
                end: line.from + match.index + match[0].length
              }
            }

            // Get the DOM element that represents this URL for positioning
            const startCoords = view.coordsAtPos(line.from + match.index)
            const endCoords = view.coordsAtPos(
              line.from + match.index + match[0].length
            )

            if (startCoords && endCoords) {
              // Create a temporary element that spans the exact URL width
              const tempElement = document.createElement('span')
              tempElement.style.position = 'absolute'
              tempElement.style.left = `${startCoords.left}px`
              tempElement.style.top = `${startCoords.top}px`
              tempElement.style.width = `${
                endCoords.right - startCoords.left
              }px`
              tempElement.style.height = `${
                startCoords.bottom - startCoords.top
              }px`
              tempElement.style.pointerEvents = 'none'
              tempElement.style.visibility = 'hidden'
              document.body.appendChild(tempElement)

              createEditLinkDialog(
                linkInfo,
                view,
                createUpdatedSaveHandler(linkInfo, view, tempElement),
                tempElement
              )

              // Clean up the temporary element after a delay
              setTimeout(() => {
                if (tempElement.parentNode) {
                  tempElement.parentNode.removeChild(tempElement)
                }
              }, 100)
            } else {
              // Fallback to default positioning if coordinates not available
              createEditLinkDialog(
                linkInfo,
                view,
                createUpdatedSaveHandler(linkInfo, view, null),
                null
              )
            }
          } else {
            // Regular click - open the URL
            safeOpenUrl(match[0])
          }
          return true
        }
      }
    }

    // Check for emails (but not if they're part of markdown links)
    EMAIL_REGEX.lastIndex = 0
    while ((match = EMAIL_REGEX.exec(lineText)) !== null) {
      if (
        posInLine >= match.index &&
        posInLine < match.index + match[0].length
      ) {
        // Check if it's not part of a markdown link
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

  // Track when user starts selecting to prevent link clicks during selection
  mousedown: (event, view) => {
    // Reset the selection flag
    view._isSelecting = false
    view._mouseDownTime = Date.now()
    view._mouseDownPos = { x: event.clientX, y: event.clientY }
    return false
  },

  mousemove: (event, view) => {
    // If mouse is down and moving, user is likely selecting
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
    // Clear the mouse down tracking after a short delay
    setTimeout(() => {
      view._isSelecting = false
      view._mouseDownTime = null
      view._mouseDownPos = null
    }, 10)
    return false
  }
})

// High-priority event handler that captures events before other handlers
export const highPriorityLinkHandler = EditorView.domEventHandlers({
  contextmenu: (event, view) => {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos !== null) {
      const linkInfo = getLinkAtPosition(view, pos)
      if (linkInfo) {
        event.preventDefault()
        event.stopImmediatePropagation()

        // Select the full link text before showing context menu
        selectLinkText(view, pos, linkInfo)

        // For plain URLs, get positioning info
        let targetElement = null
        if (linkInfo.type === 'url') {
          const startCoords = view.coordsAtPos(linkInfo.position.start)
          const endCoords = view.coordsAtPos(linkInfo.position.end)
          if (startCoords && endCoords) {
            // Create a temporary element for positioning
            targetElement = document.createElement('span')
            targetElement.style.position = 'absolute'
            targetElement.style.left = `${startCoords.left}px`
            targetElement.style.top = `${startCoords.top}px`
            targetElement.style.width = `${
              endCoords.right - startCoords.left
            }px`
            targetElement.style.height = `${
              startCoords.bottom - startCoords.top
            }px`
            targetElement.style.pointerEvents = 'none'
            targetElement.style.visibility = 'hidden'
            document.body.appendChild(targetElement)
          }
        }

        createLinkContextMenu(linkInfo, event, view, targetElement)
        return true
      }
    }
    return false
  }
})

// Export high priority handler with precedence
export const highPriorityHandler = Prec.highest(highPriorityLinkHandler)

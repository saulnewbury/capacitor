// linkCore.js - Core utilities and shared functions

import { setLinkPreviewState } from './linkPreviewState.js'

// Global registry to track custom titles for links
const customTitleRegistry = new Map()

// Helper function to create a unique key for a link
const createLinkKey = (url, originalText) => `${url}::${originalText}`

// Helper function to set custom title globally
export const setCustomLinkTitle = (url, originalText, customTitle) => {
  const key = createLinkKey(url, originalText)
  customTitleRegistry.set(key, customTitle)

  // Update any existing preview widgets for this link
  const previewCards = document.querySelectorAll('.cm-link-preview-card')
  previewCards.forEach((card) => {
    const titleElement = card.querySelector('.preview-title')
    const domainElement = card.querySelector('.preview-url span')

    if (titleElement && domainElement) {
      // Simple heuristic to match the card to the link
      const cardDomain = domainElement.textContent
      const linkDomain = extractDomainFromUrl(url)

      if (
        cardDomain === linkDomain ||
        cardDomain.includes(linkDomain) ||
        linkDomain.includes(cardDomain)
      ) {
        titleElement.textContent = customTitle
      }
    }
  })
}

// Helper function to get custom title globally
export const getCustomLinkTitle = (url, originalText) => {
  const key = createLinkKey(url, originalText)
  return customTitleRegistry.get(key)
}

// Helper function to extract domain from URL
export const extractDomainFromUrl = (url) => {
  try {
    const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`
    const domain = new URL(urlWithProtocol).hostname
    return domain.replace(/^www\./, '')
  } catch {
    return url.length > 25 ? url.substring(0, 22) + '...' : url
  }
}

// Helper function to get current displayed title from preview widget
export const getCurrentDisplayedTitle = (linkInfo, view) => {
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

// Core save handler that both dialog and handlers can use
export const createLinkSaveHandler = (linkInfo, view, targetElement = null) => {
  return (editedData) => {
    console.log('Edited data received:', editedData)

    // Handle the edited link data
    if (linkInfo.position) {
      const { start, end } = linkInfo.position
      let newLinkText = ''

      // Store the custom title globally if it's different from the address
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

        // Separate preview mode from title logic
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
        // Separate preview mode from title logic
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
        // Separate preview mode from title logic
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
      })

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

export const createIcon = (iconName) => {
  const span = document.createElement('span')
  span.className = `icon icon-${iconName}`
  return span
}

// Icon constants for easy reference
export const ICONS = {
  EDIT: 'edit',
  HASH: 'hash',
  SEARCH: 'search'
}

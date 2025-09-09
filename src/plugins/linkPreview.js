import { WidgetType } from '@codemirror/view'
import { MetadataFetcher } from './metadataFetcher.js'

// Global metadata fetcher instance
const metadataFetcher = new MetadataFetcher()

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
const extractDomainFromUrl = (url) => {
  try {
    const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`
    const domain = new URL(urlWithProtocol).hostname
    return domain.replace(/^www\./, '')
  } catch {
    return url.length > 25 ? url.substring(0, 22) + '...' : url
  }
}

// Link Preview Widget for replacing links with preview cards
export class LinkPreviewWidget extends WidgetType {
  constructor(linkInfo, view) {
    super()
    this.linkInfo = linkInfo
    this.view = view
    this.previewData = this.generateInitialPreview(linkInfo.url)

    // Check if this link has a custom title in the global registry
    const customTitle = getCustomLinkTitle(linkInfo.url, linkInfo.text)
    if (customTitle) {
      this.hasCustomTitle = true
      this.previewData.title = customTitle
    } else if (linkInfo.text && linkInfo.text !== linkInfo.url) {
      // Check if this link already has a custom title (different from URL)
      this.hasCustomTitle = true
      this.previewData.title = linkInfo.text
      // Store it in the registry
      setCustomLinkTitle(linkInfo.url, linkInfo.text, linkInfo.text)
    } else {
      this.hasCustomTitle = false
    }

    // Start fetching real metadata to replace initial data
    this.fetchRealMetadata()
  }

  /**
   * Update the title and mark it as custom (manually edited)
   */
  setCustomTitle(newTitle) {
    this.hasCustomTitle = true
    this.previewData.title = newTitle

    // Update the DOM immediately if it exists
    if (this.domElement) {
      const titleElement = this.domElement.querySelector('.preview-title')
      if (titleElement) {
        titleElement.textContent = newTitle
      }
    }
  }

  /**
   * Get the current title displayed in the preview
   */
  getCurrentDisplayedTitle() {
    if (this.domElement) {
      const titleElement = this.domElement.querySelector('.preview-title')
      if (titleElement) {
        return titleElement.textContent
      }
    }
    // Fallback to preview data
    return this.previewData.title
  }

  /**
   * Fetch real metadata and update the preview
   */
  async fetchRealMetadata() {
    try {
      const realMetadata = await metadataFetcher.fetchMetadata(
        this.linkInfo.url
      )

      // Update the preview data, but preserve custom title if it exists
      this.previewData = {
        ...realMetadata,
        // Only use fetched title if we don't have a custom title
        title: this.hasCustomTitle ? this.previewData.title : realMetadata.title
      }

      // Find and update the existing DOM element if it exists
      if (this.domElement) {
        this.updateDOMWithRealData(this.previewData)
      }
    } catch (error) {
      console.warn(
        'Failed to fetch real metadata, keeping initial data:',
        error
      )
      // Keep using initial data if real fetch fails
    }
  }

  /**
   * Update the existing DOM element with real data
   */
  updateDOMWithRealData(data) {
    if (!this.domElement) return

    // Update title
    const titleElement = this.domElement.querySelector('.preview-title')
    if (titleElement) {
      titleElement.textContent = data.title
    }

    // Update domain
    const domainElement = this.domElement.querySelector('.preview-url span')
    if (domainElement) {
      domainElement.textContent = this.clampText(data.domain, 25)
    }

    // Update image and container styling based on image type
    const imgElement = this.domElement.querySelector(
      '.preview-image-container img'
    )
    const imageContainer = this.domElement.querySelector(
      '.preview-image-container'
    )
    const fallbackElement = this.domElement.querySelector(
      '.preview-image-fallback'
    )

    if (imageContainer && data.image) {
      // Show image, hide fallback
      if (imgElement) {
        imgElement.style.display = 'inline-block'
        imgElement.src = data.image
      }
      if (fallbackElement) {
        fallbackElement.style.display = 'none'
      }

      // Apply image-specific styling
      this.applyImageStyling(data, imgElement, imageContainer)
    } else if (fallbackElement) {
      // Hide image, show fallback
      if (imgElement) {
        imgElement.style.display = 'none'
      }
      fallbackElement.style.display = 'flex'
    }
  }

  /**
   * Apply styling based on image type and characteristics
   */
  applyImageStyling(data, imgElement, imageContainer) {
    // Check if this is a YouTube thumbnail
    const isYouTubeThumbnail =
      data.image.includes('img.youtube.com') ||
      data.type === 'youtube' ||
      data.type === 'youtube-short'

    // Check if this is likely a favicon (small icon)
    const isFavicon =
      data.image.includes('favicon') ||
      data.image.includes('icon') ||
      data.image.includes('apple-touch-icon') ||
      data.imageAspectRatio === 1 // Square images are often icons

    if (isYouTubeThumbnail) {
      // Style for YouTube thumbnails - full width with proper cropping
      imageContainer.style.padding = '0'
      imageContainer.style.height = '169px' // 300px * (9/16) = 168.75px
      imgElement.style.width = '100%'
      imgElement.style.height = '100%'
      imgElement.style.objectFit = 'cover'
    } else if (isFavicon) {
      // Style for favicon/icon
      imageContainer.style.padding = '20px'
      imageContainer.style.height = 'auto'
      imgElement.style.width = '30%'
      imgElement.style.height = '100%'
      imgElement.style.objectFit = 'cover'
    } else {
      // Style for regular images
      imageContainer.style.padding = '0'
      imageContainer.style.height = 'auto'
      imgElement.style.width = '50%'
      imgElement.style.height = '100%'
      imgElement.style.objectFit = 'cover'
    }
  }

  /**
   * Generate initial preview data based on URL patterns
   * Uses domain and URL structure to create meaningful placeholders
   */
  generateInitialPreview(url) {
    const domain = this.extractDomain(url)
    const normalizedUrl = url.toLowerCase()

    // Base preview structure
    const basePreview = {
      title: this.generateTitleFromUrl(url, domain),
      domain: domain,
      image: null, // No hardcoded images
      imageAspectRatio: 16 / 9 // Default aspect ratio
    }

    // YouTube video patterns
    if (
      normalizedUrl.includes('youtube.com/watch') ||
      normalizedUrl.includes('youtu.be/')
    ) {
      return {
        ...basePreview,
        type: 'youtube',
        imageAspectRatio: 16 / 9
      }
    }

    // YouTube Shorts
    if (normalizedUrl.includes('youtube.com/shorts/')) {
      return {
        ...basePreview,
        type: 'youtube-short',
        imageAspectRatio: 9 / 16
      }
    }

    // GitHub repositories
    if (normalizedUrl.includes('github.com/')) {
      return {
        ...basePreview,
        type: 'github',
        imageAspectRatio: 1 / 1
      }
    }

    // Documentation sites
    if (
      normalizedUrl.includes('docs.') ||
      normalizedUrl.includes('documentation')
    ) {
      return {
        ...basePreview,
        type: 'docs',
        imageAspectRatio: 1 / 1
      }
    }

    // Default website preview
    return {
      ...basePreview,
      type: 'website',
      imageAspectRatio: 1 / 1
    }
  }

  /**
   * Generate a meaningful title from the URL
   */
  generateTitleFromUrl(url, domain) {
    try {
      const urlObj = new URL(url.match(/^https?:\/\//) ? url : `https://${url}`)
      const pathname = urlObj.pathname

      // For root pages, use domain
      if (pathname === '/' || pathname === '') {
        return this.formatDomainAsTitle(domain)
      }

      // Extract meaningful parts from path
      const pathParts = pathname.split('/').filter((part) => part.length > 0)
      const lastPart = pathParts[pathParts.length - 1]

      // Remove file extensions and clean up
      const cleanPart = lastPart
        .replace(/\.[^.]+$/, '') // Remove file extension
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .replace(/\b\w/g, (l) => l.toUpperCase()) // Capitalize words

      return cleanPart || this.formatDomainAsTitle(domain)
    } catch {
      return this.formatDomainAsTitle(domain)
    }
  }

  /**
   * Format domain name as a title
   */
  formatDomainAsTitle(domain) {
    return domain
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  extractDomain(url) {
    try {
      // Handle URLs without protocol
      const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`
      const domain = new URL(urlWithProtocol).hostname
      return domain.replace(/^www\./, '')
    } catch {
      return url.length > 25 ? url.substring(0, 22) + '...' : url
    }
  }

  clampText(text, maxLength) {
    return text.length > maxLength
      ? text.substring(0, maxLength - 3) + '...'
      : text
  }

  /**
   * Create a simple text fallback
   */
  createFallbackIcon() {
    return this.previewData.domain.charAt(0).toUpperCase()
  }

  toDOM() {
    const container = document.createElement('span')
    container.className = 'cm-link-preview-card'
    container.style.cssText = `
      display: inline-block;
      width: 300px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      vertical-align: bottom;
      line-height: 1.4;
      padding-top: 8px;
      padding-bottom: 8px;
      margin: 0;
    `

    // Store reference for later updates
    this.domElement = container

    // Add global keydown listener for delete functionality
    const handleGlobalKeydown = (e) => {
      if (!document.contains(container)) {
        // Widget is no longer in DOM, remove listener
        document.removeEventListener('keydown', handleGlobalKeydown, true)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // IMPORTANT: Only ignore delete/backspace when ACTIVELY typing in dialog inputs
        const activeElement = document.activeElement
        const isTypingInDialogInput =
          activeElement &&
          activeElement.closest('.edit-link-dialog-overlay') &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA')

        if (isTypingInDialogInput) {
          console.log(
            'Preview widget ignoring delete/backspace - user is typing in dialog input field'
          )
          return // Let the dialog input handle the key event
        }

        // If we get here, it's a legitimate delete operation in the editor
        const cursor = this.view.state.selection.main.head
        const { start, end } = this.linkInfo.position

        console.log('Global keydown in preview widget:', {
          key: e.key,
          cursor,
          start,
          end,
          shouldDelete: cursor === start || cursor === end
        })

        // FIXED: Check if this is backspace at the beginning of a line with preview widget
        if (e.key === 'Backspace' && cursor === start) {
          const line = this.view.state.doc.lineAt(cursor)
          const isLinkAtLineStart = start === line.from

          if (isLinkAtLineStart) {
            console.log(
              'Preview widget at line start - allowing line joining behavior'
            )
            return // Don't intercept, let the custom keymap handle line joining
          }
        }

        if (cursor === start || cursor === end) {
          console.log(
            'Preview widget intercepting delete, removing entire link'
          )
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          this.view.dispatch({
            changes: {
              from: start,
              to: end,
              insert: ''
            },
            selection: { anchor: start, head: start }
          })
        }
      }
    }

    // Add the listener with capture=true to intercept before other handlers
    document.addEventListener('keydown', handleGlobalKeydown, true)

    // Create image container
    const imageContainer = document.createElement('div')
    imageContainer.className = 'preview-image-container'
    imageContainer.style.cssText = `
      overflow: hidden;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border-left: 1px solid #d1d5db;
      border-right: 1px solid #d1d5db;
      border-top: 1px solid #d1d5db;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      min-height: 120px;
    `

    // Create image element (initially hidden if no image)
    const img = document.createElement('img')
    img.alt = 'Preview'
    img.style.cssText = `
      width: 50%;
      height: 100%;
      object-fit: cover;
      display: ${this.previewData.image ? 'block' : 'none'};
    `

    if (this.previewData.image) {
      img.src = this.previewData.image
    }

    // Create fallback element
    const fallback = document.createElement('div')
    fallback.className = 'preview-image-fallback'
    fallback.style.cssText = `
      display: ${this.previewData.image ? 'none' : 'flex'};
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: #f3f4f6;
      color: #9ca3af;
      font-size: 32px;
      font-weight: 600;
      position: absolute;
      top: 0;
      left: 0;
    `
    fallback.textContent = this.createFallbackIcon()

    // Handle image load error
    img.onerror = () => {
      img.style.display = 'none'
      fallback.style.display = 'flex'
    }

    // Handle successful image load
    img.onload = () => {
      if (this.previewData.image) {
        img.style.display = 'block'
        fallback.style.display = 'none'
      }
    }

    imageContainer.appendChild(img)
    imageContainer.appendChild(fallback)

    // Create info section
    const infoSection = document.createElement('div')
    infoSection.className = 'preview-info'
    infoSection.style.cssText = `
      padding: 8px 10px 10px;
      background: white;
      border-left: 1px solid #d1d5db;
      border-right: 1px solid #d1d5db;
      border-bottom: 1px solid #d1d5db;
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
    `

    // Create title
    const title = document.createElement('div')
    title.className = 'preview-title'
    title.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    `
    title.textContent = this.previewData.title

    // Create URL section
    const urlSection = document.createElement('div')
    urlSection.className = 'preview-url'
    urlSection.style.cssText = `
      font-size: 12px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    `

    // Create domain text
    const domainText = document.createElement('span')
    domainText.textContent = this.clampText(this.previewData.domain, 25)

    // Create edit button with pencil SVG
    const editButton = document.createElement('button')
    editButton.className = 'preview-edit-button'
    editButton.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      transition: opacity 0.2s ease;
    `

    editButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M27.7664 6.3033C28.1569 6.69383 28.1569 7.32699 27.7664 7.71751L9.18198 26.3019C8.05676 27.4271 6.53064 28.0593 4.93934 28.0593H1C0.447715 28.0593 0 27.6115 0 27.0593V23.1199C0 21.5286 0.632141 20.0025 1.75736 18.8773L20.3417 0.292893C20.7323 -0.0976311 21.3654 -0.097631 21.756 0.292893L27.7664 6.3033ZM3.0948 21.0754C2.71379 21.4564 2.49973 21.9732 2.49973 22.512C2.49973 24.1951 3.86416 25.5595 5.54727 25.5595C6.0861 25.5595 6.60287 25.3455 6.98389 24.9645L18.574 13.3744C18.9645 12.9838 18.9645 12.3507 18.574 11.9602L16.0991 9.48528C15.7086 9.09476 15.0754 9.09476 14.6849 9.48528L3.0948 21.0754ZM17.8669 6.3033C17.4764 6.69383 17.4764 7.32699 17.8669 7.71751L20.3417 10.1924C20.7323 10.5829 21.3654 10.5829 21.756 10.1924L24.2308 7.71751C24.6214 7.32699 24.6214 6.69383 24.2308 6.3033L21.756 3.82843C21.3654 3.4379 20.7323 3.4379 20.3417 3.82843L17.8669 6.3033Z" fill="#9ca3af"/>
        <path d="M27 25.5C27.5523 25.5 28 25.9477 28 26.5V27C28 27.5523 27.5523 28 27 28H16C15.4477 28 15 27.5523 15 27V26.5C15 25.9477 15.4477 25.5 16 25.5H27Z" fill="#9ca3af" fill-opacity="0.29"/>
      </svg>
    `

    // Add hover effect
    editButton.addEventListener('mouseenter', () => {
      editButton.style.opacity = '1'
    })
    editButton.addEventListener('mouseleave', () => {
      editButton.style.opacity = '0.6'
    })

    // Add click handler to open edit dialog
    editButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Import and create edit link dialog
      import('./linkDialog.js').then(({ createEditLinkDialog }) => {
        import('./linkStyling.js').then(
          ({ getLinkPreviewState, setLinkPreviewState }) => {
            // Get current preview state
            const currentPreviewState = getLinkPreviewState(
              this.linkInfo.text,
              this.linkInfo.url
            )

            // FIXED: Use current displayed title instead of original linkInfo.text
            const currentDisplayedTitle = this.getCurrentDisplayedTitle()

            const linkInfoWithPreview = {
              ...this.linkInfo,
              text: currentDisplayedTitle, // Use the current displayed title
              isPreview: currentPreviewState
            }

            createEditLinkDialog(
              linkInfoWithPreview,
              this.view,
              (editedData) => {
                // Handle the edited link data
                if (this.linkInfo.position) {
                  const { start, end } = this.linkInfo.position
                  let newLinkText = ''

                  // Store the custom title globally if it's different from the address
                  if (
                    editedData.title &&
                    editedData.title !== editedData.address
                  ) {
                    setCustomLinkTitle(
                      editedData.address,
                      this.linkInfo.text,
                      editedData.title
                    )
                  }

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
                    // Non-preview mode: plain URL
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
                }
              },
              editButton
            )
          }
        )
      })
    })

    urlSection.appendChild(domainText)
    urlSection.appendChild(editButton)

    // Assemble the info section
    infoSection.appendChild(title)
    infoSection.appendChild(urlSection)

    // Assemble the container
    container.appendChild(imageContainer)
    container.appendChild(infoSection)

    // Add click handler to open the link
    container.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Import and use the safe URL opener
      import('./linkUtils.js').then(({ safeOpenUrl }) => {
        safeOpenUrl(this.linkInfo.url)
      })
    })

    // Add context menu support (right-click)
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Import and create context menu
      import('./linkHandlers.js').then(({ createLinkContextMenu }) => {
        createLinkContextMenu(this.linkInfo, e, this.view, container)
      })
    })

    return container
  }

  eq(other) {
    return (
      other instanceof LinkPreviewWidget &&
      this.linkInfo.url === other.linkInfo.url &&
      this.linkInfo.text === other.linkInfo.text
    )
  }

  ignoreEvent() {
    return false
  }
}

// Factory function to create preview widgets
export const createLinkPreview = (linkInfo, view) => {
  return new LinkPreviewWidget(linkInfo, view)
}

// Add CSS styles for the preview card
export const linkPreviewTheme = `
  .cm-link-preview-card {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  
  .cm-link-preview-card .preview-image-container img {
    transition: transform 0.2s ease;
  }
  
  .cm-link-preview-card:hover .preview-image-container img {
    transform: scale(1.02);
  }
  
  .cm-link-preview-card .preview-title {
    transition: color 0.2s ease;
  }
  
  .cm-link-preview-card:hover .preview-title {
    color: #dc2626;
  }
`

// Function to inject the preview styles into the document
export const injectPreviewStyles = () => {
  if (!document.getElementById('link-preview-styles')) {
    const style = document.createElement('style')
    style.id = 'link-preview-styles'
    style.textContent = linkPreviewTheme
    document.head.appendChild(style)
  }
}

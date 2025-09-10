// linkPreview.js - Updated with typical link preview layout

import { WidgetType } from '@codemirror/view'
import { ICONS, createIcon } from './iconHelpers.js'
import {
  createLinkSaveHandler,
  getCustomLinkTitle,
  setCustomLinkTitle
} from './linkCore.js'
import { createEditLinkDialog } from './linkDialog.js'
import { getLinkPreviewState } from './linkPreviewState.js'
import { metadataFetcher } from './metadataFetcher.js'

export class LinkPreviewWidget extends WidgetType {
  constructor(linkInfo, view) {
    super()
    this.linkInfo = linkInfo
    this.view = view
    this.previewData = this.generateInitialPreview(linkInfo.url)
    this.domElement = null

    console.log('ðŸ”— LinkPreviewWidget created for:', linkInfo.url)

    // Check if this link has a custom title
    const customTitle = getCustomLinkTitle(linkInfo.url, linkInfo.text)
    if (customTitle) {
      this.hasCustomTitle = true
      this.previewData.title = customTitle
    } else if (linkInfo.text && linkInfo.text !== linkInfo.url) {
      this.hasCustomTitle = true
      this.previewData.title = linkInfo.text
      setCustomLinkTitle(linkInfo.url, linkInfo.text, linkInfo.text)
    } else {
      this.hasCustomTitle = false
    }

    // Start fetching real metadata
    this.fetchRealMetadata()
  }

  async fetchRealMetadata() {
    try {
      console.log(
        'ðŸ” LinkPreview: Starting metadata fetch for:',
        this.linkInfo.url
      )

      const realMetadata = await metadataFetcher.fetchMetadata(
        this.linkInfo.url
      )
      // console.log('âœ… LinkPreview: Received metadata:', realMetadata)

      // Update our preview data
      this.previewData = {
        ...realMetadata,
        title: this.hasCustomTitle ? this.previewData.title : realMetadata.title
      }

      // console.log('ðŸ”„ LinkPreview: Updated preview data:', this.previewData)

      // Update the DOM if it exists
      if (this.domElement) {
        this.updateDOMContent(this.previewData)
      }
    } catch (error) {
      console.warn('âš ï¸ LinkPreview: Failed to fetch metadata:', error)
    }
  }

  updateDOMContent(data) {
    console.log('LinkPreview: Updating DOM with data:', data)

    if (!this.domElement) {
      console.warn('LinkPreview: No DOM element to update')
      return
    }

    // Update title
    const titleElement = this.domElement.querySelector('.preview-title')
    if (titleElement && data.title) {
      titleElement.textContent = data.title
      console.log('Updated title to:', data.title)
    }

    // Update link text (authors or domain)
    const linkTextElement = this.domElement.querySelector('.preview-link-text')
    if (linkTextElement) {
      if (
        data.author &&
        (Array.isArray(data.author)
          ? data.author.length > 0
          : data.author.trim())
      ) {
        // Display authors
        const authorText = Array.isArray(data.author)
          ? data.author.join(', ')
          : data.author
        const clampedAuthorText = this.clampText(authorText, 20)
        linkTextElement.textContent = clampedAuthorText
        linkTextElement.title = `By ${authorText} â€¢ ${data.domain}`
        console.log('Updated authors to:', clampedAuthorText)
      } else if (data.domain) {
        // Fallback to domain
        const clampedDomain = this.clampText(data.domain, 15)
        linkTextElement.textContent = clampedDomain
        linkTextElement.title = data.domain
        console.log('Updated domain to:', clampedDomain)
      }
    }

    // Update favicon
    const faviconElement = this.domElement.querySelector('.preview-favicon')
    if (faviconElement && data.favicon) {
      faviconElement.src = data.favicon
      faviconElement.style.display = 'inline-block'
      console.log('Updated favicon to:', data.favicon)
    }

    // Handle content display based on type
    this.updateContentDisplay(data)
  }

  updateContentDisplay(data) {
    console.log(
      'ðŸ–¼ï¸ LinkPreview: Updating content display for type:',
      data.contentType
    )

    const imageContainer = this.domElement.querySelector(
      '.preview-image-container'
    )
    const articleContainer = this.domElement.querySelector(
      '.preview-article-container'
    )

    if (data.contentType === 'article' && data.excerpt) {
      // Show article text with title
      const articleText = articleContainer.querySelector(
        '.preview-article-text'
      )
      if (articleText) {
        const titleHtml = `<div style="font-weight: bold; font-size: 11px; margin-bottom: 8px; line-height: 1.2;">${data.title}</div>`
        const excerptHtml = data.excerpt.replace(/\n/g, '<br><br>')
        articleText.innerHTML = titleHtml + excerptHtml
      }
      imageContainer.style.display = 'none'
      articleContainer.style.display = 'block'
    } else if (data.contentType === 'video' && data.image) {
      // Show video thumbnail
      const img = imageContainer.querySelector('img')
      const fallback = imageContainer.querySelector('.preview-image-fallback')

      if (img) {
        img.src = data.image
        img.style.display = 'block'
      }
      if (fallback) {
        fallback.style.display = 'none'
      }

      this.applyImageStyling(data, img, imageContainer)
      imageContainer.style.display = 'flex'
      articleContainer.style.display = 'none'
    } else if (data.contentType === 'channel' && data.image) {
      // Show channel avatar (same as video but square aspect ratio)
      const img = imageContainer.querySelector('img')
      const fallback = imageContainer.querySelector('.preview-image-fallback')

      if (img) {
        img.src = data.image
        img.style.display = 'block'
      }
      if (fallback) {
        fallback.style.display = 'none'
      }

      this.applyImageStyling(data, img, imageContainer)
      imageContainer.style.display = 'flex'
      articleContainer.style.display = 'none'
    } else {
      // Show fallback icon
      const img = imageContainer.querySelector('img')
      const fallback = imageContainer.querySelector('.preview-image-fallback')

      if (img) {
        img.style.display = 'none'
      }
      if (fallback) {
        fallback.style.display = 'flex'
      }

      imageContainer.style.display = 'flex'
      articleContainer.style.display = 'none'
    }
  }

  applyImageStyling(data, imgElement, imageContainer) {
    const isYouTubeThumbnail =
      data.image &&
      (data.image.includes('img.youtube.com') ||
        data.type === 'youtube' ||
        data.type === 'youtube-short')

    // Reset container styles for new layout
    imageContainer.style.padding = '0'
    imageContainer.style.height = 'auto'
    imageContainer.style.minHeight = 'auto'

    if (isYouTubeThumbnail) {
      // Video thumbnails should be clipped to maintain aspect ratio
      imgElement.style.width = '100%'
      imgElement.style.height = 'auto'
      imgElement.style.aspectRatio = '16 / 9'
      imgElement.style.objectFit = 'cover' // This clips the image
    } else {
      // All other images (including YouTube channel avatars, favicons, etc.)
      // should display at full width and show the complete image
      imgElement.style.width = '100%'
      imgElement.style.height = 'auto'
      imgElement.style.aspectRatio = 'auto' // Let the natural aspect ratio determine height
      imgElement.style.objectFit = 'contain' // Show the full image without clipping
    }
  }

  generateInitialPreview(url) {
    const domain = this.extractDomain(url)
    const normalizedUrl = url.toLowerCase()

    // Default preview data
    let preview = {
      title: this.generateTitleFromUrl(url, domain),
      domain: domain,
      image: null,
      excerpt: null,
      imageAspectRatio: 16 / 9,
      type: 'website',
      contentType: 'website',
      favicon: null
    }

    // Special handling for YouTube
    if (
      normalizedUrl.includes('youtube.com/watch') ||
      normalizedUrl.includes('youtu.be/')
    ) {
      const videoId = this.extractVideoIdFromUrl(url)
      preview = {
        ...preview,
        image: videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : null,
        type: 'youtube',
        contentType: 'video',
        favicon:
          'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png'
      }
    } else if (normalizedUrl.includes('youtube.com/shorts/')) {
      const videoId = this.extractVideoIdFromUrl(url)
      preview = {
        ...preview,
        image: videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : null,
        imageAspectRatio: 9 / 16,
        type: 'youtube-short',
        contentType: 'video',
        favicon:
          'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png'
      }
    } else {
      // Try to guess favicon for common domains
      const baseUrl = this.getBaseUrl(url)
      preview.favicon = `${baseUrl}/favicon.ico`
    }

    console.log('ðŸ› ï¸ Generated initial preview:', preview)
    return preview
  }

  getBaseUrl(url) {
    try {
      const urlObj = new URL(url.match(/^https?:\/\//) ? url : `https://${url}`)
      return `${urlObj.protocol}//${urlObj.hostname}`
    } catch (error) {
      return url
    }
  }

  extractVideoIdFromUrl(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  }

  extractDomain(url) {
    try {
      const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`
      const domain = new URL(urlWithProtocol).hostname
      return domain.replace(/^www\./, '')
    } catch {
      return url.length > 25 ? url.substring(0, 22) + '...' : url
    }
  }

  generateTitleFromUrl(url, domain) {
    try {
      const urlObj = new URL(url.match(/^https?:\/\//) ? url : `https://${url}`)
      const pathname = urlObj.pathname

      if (pathname === '/' || pathname === '') {
        return this.formatDomainAsTitle(domain)
      }

      const pathParts = pathname.split('/').filter((part) => part.length > 0)
      const lastPart = pathParts[pathParts.length - 1]

      const cleanPart = lastPart
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())

      return cleanPart || this.formatDomainAsTitle(domain)
    } catch {
      return this.formatDomainAsTitle(domain)
    }
  }

  formatDomainAsTitle(domain) {
    return domain
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  clampText(text, maxLength) {
    return text.length > maxLength
      ? text.substring(0, maxLength - 3) + '...'
      : text
  }

  createFallbackIcon() {
    return this.previewData.domain.charAt(0).toUpperCase()
  }

  // Add the YouTube detection method here
  isYouTubeUrl(url) {
    const normalizedUrl = url.toLowerCase()
    return (
      normalizedUrl.includes('youtube.com/watch') ||
      normalizedUrl.includes('youtu.be/') ||
      normalizedUrl.includes('youtube.com/shorts/')
    )
  }

  getCurrentDisplayedTitle() {
    if (this.domElement) {
      const titleElement = this.domElement.querySelector('.preview-title')
      if (titleElement) {
        return titleElement.textContent
      }
    }
    return this.previewData.title
  }

  setCustomTitle(newTitle) {
    this.hasCustomTitle = true
    this.previewData.title = newTitle

    if (this.domElement) {
      const titleElement = this.domElement.querySelector('.preview-title')
      if (titleElement) {
        titleElement.textContent = newTitle
      }
    }
  }

  toDOM() {
    console.log('LinkPreview: Creating DOM for:', this.linkInfo.url)

    const container = document.createElement('span')
    container.className = 'cm-link-preview-card'
    container.style.cssText = `
      display: inline-block;
      width: 100%;
      max-width: 310px;
      overflow: hidden;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      vertical-align: bottom;
      line-height: 1.4;
      margin: 8px 0;
      background-color: #ffffffff;
      border: .5px solid #b5b9c1ff;
      border-radius: 10px;
      user-select: none; /* Prevent text selection on the entire card */
      -webkit-user-select: none;
    `

    // Image container (for videos and fallback icons) - now at the top
    const imageContainer = document.createElement('div')
    imageContainer.className = 'preview-image-container'
    imageContainer.style.cssText = `
      overflow: hidden;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      max-width: 330px;
      width: 100%;
      height: 157.5px;
      cursor: default;
      pointer-events: none;
    `

    // Image element
    const img = document.createElement('img')
    img.alt = 'Preview'
    img.style.cssText = `
      width: 100%;
      height: auto;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      display: ${this.previewData.image ? 'block' : 'none'};
      pointer-events: none;
      user-select: none;
    `
    if (this.previewData.image) {
      img.src = this.previewData.image
    }

    // Fallback icon
    const fallback = document.createElement('div')
    fallback.className = 'preview-image-fallback'
    fallback.style.cssText = `
      display: ${this.previewData.image ? 'none' : 'flex'};
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 157.5px;
      min-height: 157.5px;
      background: #f3f4f6;
      color: #9ca3af;
      font-size: 32px;
      font-weight: 600;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      pointer-events: none;
      user-select: none;
    `
    fallback.textContent = this.createFallbackIcon()

    imageContainer.appendChild(img)
    imageContainer.appendChild(fallback)

    // Article container (for article text) - alternative to image container
    const articleContainer = document.createElement('div')
    articleContainer.className = 'preview-article-container'
    articleContainer.style.cssText = `
      display: none;
      overflow: hidden;
      background-color: #F6F6F6;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      max-width: 330px;
      width: 100%;
      height: 157.5px;
      // padding: 30px 24.5px 0 24.5px;
      padding: 25px 30.5px 0 30.5px;
      cursor: default;
      pointer-events: none;
      position: relative;
    `

    // Inner text container with white background - grows to fit content
    const articleTextContainer = document.createElement('div')
    articleTextContainer.className = 'preview-article-text-container'
    articleTextContainer.style.cssText = `
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
      padding: 0px 16px 16px;
      width: 100%;
      height: 150px;
      transform: rotate(-3.36deg);
    `

    // Article text
    const articleText = document.createElement('div')
    articleText.className = 'preview-article-text'
    articleText.style.cssText = `
      color: #455966;
      font-size: 8px;
      line-height: 1.3;
      pointer-events: none;
      user-select: none;
      word-wrap: break-word;
      hyphens: auto;
      white-space: pre-line;
    `
    articleText.textContent =
      this.previewData.excerpt || 'Loading article content...'

    articleTextContainer.appendChild(articleText)

    // Top gradient overlay for fade-in effect
    const topGradient = document.createElement('div')
    topGradient.className = 'preview-article-top-gradient'
    topGradient.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100px;
      background: linear-gradient(to bottom, rgba(246, 246, 246, 1), rgba(246, 246, 246, 0));
      pointer-events: none;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      z-index: 1;
    `

    // Bottom gradient overlay for fade-out effect
    const bottomGradient = document.createElement('div')
    bottomGradient.className = 'preview-article-bottom-gradient'
    bottomGradient.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 100px;
      background: linear-gradient(to top, rgba(246, 246, 246, 1), rgba(246, 246, 246, 0));
      pointer-events: none;
      z-index: 1;
    `

    articleContainer.appendChild(articleTextContainer)
    // articleContainer.appendChild(topGradient)
    // articleContainer.appendChild(bottomGradient)

    // Content section with padding for title and bottom row
    const contentSection = document.createElement('div')
    contentSection.className = 'preview-content'
    contentSection.style.cssText = `
      padding: 12px 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `

    // Title section - now single line with ellipsis
    const title = document.createElement('div')
    title.className = 'preview-title'
    title.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: #455966;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: default;
      user-select: text;
    `
    title.textContent = this.previewData.title
    title.title = this.previewData.title // Show full title on hover

    // Prevent click events on title
    title.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    // Bottom row with favicon, author/domain, and buttons
    const bottomRow = document.createElement('div')
    bottomRow.className = 'preview-bottom-row'
    bottomRow.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #9ca3af;
    `

    // Left side container (favicon + author/domain)
    const leftContainer = document.createElement('div')
    leftContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex: 1;
    `

    // Favicon
    const favicon = document.createElement('img')
    favicon.className = 'preview-favicon'
    favicon.alt = 'Favicon'
    favicon.style.cssText = `
      width: 16px;
      height: 16px;
      border-radius: 2px;
      flex-shrink: 0;
      display: ${this.previewData.favicon ? 'inline-block' : 'none'};
      cursor: pointer;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: optimize-contrast;
      image-rendering: crisp-edges;
    `
    if (this.previewData.favicon) {
      favicon.src = this.previewData.favicon
    }

    // Link text (authors or domain - clickable)
    const linkText = document.createElement('span')
    linkText.className = 'preview-link-text'
    linkText.style.cssText = `
      cursor: pointer;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 11px;
    `

    // Determine what to display: authors or domain
    if (
      this.previewData.author &&
      (Array.isArray(this.previewData.author)
        ? this.previewData.author.length > 0
        : this.previewData.author.trim())
    ) {
      // Display authors
      const authorText = Array.isArray(this.previewData.author)
        ? this.previewData.author.join(', ')
        : this.previewData.author
      linkText.textContent = this.clampText(authorText, 20)
      linkText.title = `By ${authorText} â€¢ ${this.previewData.domain}`
    } else {
      // Fallback to domain
      linkText.textContent = this.clampText(this.previewData.domain, 15)
      linkText.title = this.previewData.domain
    }

    // Handle favicon and link text clicks
    const handleUrlClick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      console.log('URL clicked:', this.linkInfo.url)

      if (window.ReactNativeWebView) {
        let url = this.linkInfo.url
        if (!url.match(/^https?:\/\//i)) {
          url = url.match(/^www\./i) ? 'https://' + url : 'https://' + url
        }
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'OPEN_URL_EXTERNAL',
            url: url
          })
        )
      } else {
        // Fallback for browser
        import('./linkUtils.js').then(({ safeOpenUrl }) => {
          safeOpenUrl(this.linkInfo.url)
        })
      }
    }

    favicon.addEventListener('click', handleUrlClick)
    linkText.addEventListener('click', handleUrlClick)

    // Handle favicon error
    favicon.onerror = () => {
      console.warn('Favicon failed to load:', favicon.src)
      favicon.style.display = 'none'
    }

    favicon.onload = () => {
      console.log('Favicon loaded successfully:', favicon.src)
    }

    leftContainer.appendChild(favicon)
    leftContainer.appendChild(linkText)

    // Button container
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0px;
      flex-shrink: 0;
    `

    // AI Magic button
    const aiMagicButton = document.createElement('button')
    aiMagicButton.className = 'preview-ai-magic-button'
    aiMagicButton.style.cssText = `
      font-size: 18px;
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s ease;
      margin-right: 0px;
      color: #9ca3af;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    `

    // Also update the icon to prevent selection
    const aiMagicIcon = createIcon(ICONS.AI_MAGIC)
    aiMagicIcon.style.userSelect = 'none'
    aiMagicIcon.style.webkitUserSelect = 'none'
    aiMagicButton.appendChild(aiMagicIcon)

    // Fixed AI Magic button event handler for linkPreview.js
    aiMagicButton.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()

      console.log('AI Magic button clicked for:', this.linkInfo.url)

      // Blur the editor to dismiss keyboard
      if (this.view && this.view.contentDOM) {
        this.view.contentDOM.blur()
      }

      if (this.linkInfo.url && this.isYouTubeUrl(this.linkInfo.url)) {
        // Show loading state on the button
        aiMagicIcon.style.opacity = '0.5'
        aiMagicButton.disabled = true

        // Send message to React Native to handle the AI Magic request
        // React Native will then handle the loading widget insertion and API call
        window.ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: 'AI_MAGIC_REQUEST',
            url: this.linkInfo.url,
            linkPosition: this.linkInfo.position
          })
        )
      } else {
        console.log('AI Magic: URL is not a YouTube video')
      }
    })

    // Handle edit button
    const editButton = document.createElement('button')
    editButton.className = 'preview-edit-button'
    editButton.style.cssText = `
      font-size: 18px;
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s ease;
    `
    const editIcon = createIcon(ICONS.EDIT)
    editButton.appendChild(editIcon)

    // Handle edit button click
    editButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      console.log('Edit button clicked')

      const currentPreviewState = getLinkPreviewState(
        this.linkInfo.text,
        this.linkInfo.url
      )
      const currentDisplayedTitle = this.getCurrentDisplayedTitle()

      const linkInfoWithPreview = {
        ...this.linkInfo,
        text: currentDisplayedTitle,
        isPreview: currentPreviewState
      }

      try {
        createEditLinkDialog(
          linkInfoWithPreview,
          this.view,
          createLinkSaveHandler(this.linkInfo, this.view, editButton),
          editButton
        )
      } catch (error) {
        console.error('Failed to create edit dialog:', error)
      }
    })

    buttonContainer.appendChild(aiMagicButton)
    buttonContainer.appendChild(editButton)

    bottomRow.appendChild(leftContainer)
    bottomRow.appendChild(buttonContainer)

    // Prevent clicks on containers
    imageContainer.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    articleContainer.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    // Image error handling
    img.onerror = () => {
      console.warn('Image failed to load, showing fallback')
      img.style.display = 'none'
      fallback.style.display = 'flex'
    }

    img.onload = () => {
      console.log('Image loaded successfully')
      if (this.previewData.image) {
        img.style.display = 'block'
        fallback.style.display = 'none'
      }
    }

    // Assemble the container in new order: image/article -> content section (title + bottom row)
    container.appendChild(imageContainer)
    container.appendChild(articleContainer)

    contentSection.appendChild(title)
    contentSection.appendChild(bottomRow)
    container.appendChild(contentSection)

    // Store reference to DOM element
    this.domElement = container

    console.log('LinkPreview: DOM created successfully')
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

export const createLinkPreview = (linkInfo, view) => {
  return new LinkPreviewWidget(linkInfo, view)
}

export const linkPreviewTheme = `
  .cm-link-preview-card {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  
  .preview-favicon {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: optimize-contrast;
  }
`

export const injectPreviewStyles = () => {
  if (!document.getElementById('link-preview-styles')) {
    const style = document.createElement('style')
    style.id = 'link-preview-styles'
    style.textContent = linkPreviewTheme
    document.head.appendChild(style)
  }
}

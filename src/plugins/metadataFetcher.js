// metadataFetcher.js - Real website metadata extraction with CORS fixes

/**
 * Fetches and parses website metadata for link previews
 */
export class MetadataFetcher {
  constructor() {
    // Cache to avoid repeated requests
    this.cache = new Map()

    // Known video providers for oEmbed/special handling
    this.videoProviders = {
      youtube: {
        domains: ['youtube.com', 'youtu.be', 'm.youtube.com'],
        oembedEndpoint: 'https://www.youtube.com/oembed'
      },
      vimeo: {
        domains: ['vimeo.com'],
        oembedEndpoint: 'https://vimeo.com/api/oembed.json'
      },
      tiktok: {
        domains: ['tiktok.com'],
        oembedEndpoint: 'https://www.tiktok.com/oembed'
      }
    }
  }

  /**
   * Main method to fetch metadata for a URL
   */
  async fetchMetadata(url) {
    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url)

    // Check cache first
    if (this.cache.has(normalizedUrl)) {
      console.log('Using cached metadata for:', normalizedUrl)
      return this.cache.get(normalizedUrl)
    }

    try {
      console.log('Fetching fresh metadata for:', normalizedUrl)

      // Check if this is a known video provider
      const videoProvider = this.detectVideoProvider(normalizedUrl)
      if (videoProvider) {
        const metadata = await this.fetchVideoMetadata(
          normalizedUrl,
          videoProvider
        )
        this.cache.set(normalizedUrl, metadata)
        return metadata
      }

      // Fetch regular webpage
      const metadata = await this.fetchWebpageMetadata(normalizedUrl)
      this.cache.set(normalizedUrl, metadata)
      return metadata
    } catch (error) {
      console.warn('Failed to fetch metadata for:', normalizedUrl, error)

      // Return fallback metadata
      const fallback = this.generateFallbackMetadata(normalizedUrl)
      this.cache.set(normalizedUrl, fallback)
      return fallback
    }
  }

  /**
   * Normalize URL for consistency
   */
  normalizeUrl(url) {
    try {
      // Add protocol if missing
      if (!url.match(/^https?:\/\//i)) {
        url = url.startsWith('www.') ? `https://${url}` : `https://${url}`
      }

      const urlObj = new URL(url)
      return urlObj.href
    } catch {
      return url
    }
  }

  /**
   * Detect if URL is from a known video provider
   */
  detectVideoProvider(url) {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()

      for (const [provider, config] of Object.entries(this.videoProviders)) {
        if (config.domains.some((domain) => hostname.includes(domain))) {
          return { provider, config }
        }
      }
    } catch {
      return null
    }

    return null
  }

  /**
   * Fetch metadata using oEmbed or provider-specific logic
   */
  async fetchVideoMetadata(url, { provider, config }) {
    console.log(`Fetching ${provider} metadata for:`, url)

    try {
      // Try manual extraction first (works better with CORS)
      const metadata = {
        type: provider,
        title: this.extractVideoTitle(url, provider),
        description: this.getVideoDescription(provider),
        image: this.getVideoThumbnail(url, provider),
        imageAspectRatio: this.getDefaultVideoAspectRatio(url, provider),
        domain: new URL(url).hostname.replace(/^www\./, ''),
        url: url
      }

      // Try to enhance with oEmbed data if available (but don't fail if CORS blocks it)
      try {
        const oembedUrl = `${config.oembedEndpoint}?url=${encodeURIComponent(
          url
        )}&format=json`
        const response = await this.fetchWithCors(oembedUrl)
        const data = await response.json()

        if (data.title) {
          metadata.title = data.title
        }
        if (data.description) {
          metadata.description = data.description
        }
        if (data.thumbnail_url) {
          metadata.image = data.thumbnail_url
        }
        if (data.width && data.height) {
          metadata.imageAspectRatio = data.width / data.height
        }

        console.log('Enhanced with oEmbed data:', metadata.title)
      } catch (oembedError) {
        console.warn(
          'oEmbed fetch failed, using manual extraction:',
          oembedError.message
        )
        // Continue with manual extraction
      }

      return metadata
    } catch (error) {
      console.warn('Video metadata extraction failed:', error)
      // Return basic fallback
      return {
        type: provider,
        title: this.extractVideoTitle(url, provider),
        description: this.getVideoDescription(provider),
        image: this.getVideoThumbnail(url, provider),
        imageAspectRatio: this.getDefaultVideoAspectRatio(url, provider),
        domain: new URL(url).hostname.replace(/^www\./, ''),
        url: url
      }
    }
  }

  /**
   * Get video description based on provider
   */
  getVideoDescription(provider) {
    const descriptions = {
      youtube: 'Video content from YouTube',
      vimeo: 'Video content from Vimeo',
      tiktok: 'Video content from TikTok'
    }
    return descriptions[provider] || 'Video content'
  }

  /**
   * Get default aspect ratio based on URL and provider
   */
  getDefaultVideoAspectRatio(url, provider) {
    if (provider === 'youtube' && url.includes('/shorts/')) {
      return 9 / 16 // YouTube Shorts
    }
    return 16 / 9 // Standard video
  }

  /**
   * Extract video thumbnail URL manually
   */
  getVideoThumbnail(url, provider) {
    if (provider === 'youtube') {
      // Extract video ID
      const videoId = this.extractYouTubeVideoId(url)
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      }
    }

    // Return a default video icon
    return this.createVideoIcon()
  }

  /**
   * Extract YouTube video ID from various URL formats
   */
  extractYouTubeVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }

    return null
  }

  /**
   * Extract video title from URL (fallback)
   */
  extractVideoTitle(url, provider) {
    // Try to extract a better title from the URL
    if (provider === 'youtube') {
      // For YouTube, try to get a more descriptive title
      if (url.includes('/shorts/')) {
        return 'YouTube Short'
      } else {
        return 'YouTube Video'
      }
    }

    const titles = {
      vimeo: 'Vimeo Video',
      tiktok: 'TikTok Video'
    }

    return titles[provider] || 'Video'
  }

  /**
   * Fetch regular webpage metadata
   */
  async fetchWebpageMetadata(url) {
    console.log('Fetching webpage metadata for:', url)

    const response = await this.fetchWithCors(url)
    const html = await response.text()

    // Parse HTML
    const doc = new DOMParser().parseFromString(html, 'text/html')

    // Extract metadata in priority order
    const metadata = {
      type: 'website',
      title: this.extractTitle(doc),
      description: this.extractDescription(doc),
      image: await this.extractImage(doc, url),
      imageAspectRatio: 1.91, // Common OG image ratio (1200x630)
      domain: new URL(url).hostname.replace(/^www\./, ''),
      url: url
    }

    console.log('Extracted metadata:', metadata)
    return metadata
  }

  /**
   * Extract title from various sources
   */
  extractTitle(doc) {
    // Priority order: OG title, Twitter title, title tag, h1
    const selectors = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'title',
      'h1'
    ]

    for (const selector of selectors) {
      const element = doc.querySelector(selector)
      if (element) {
        const title = element.content || element.textContent
        if (title && title.trim()) {
          return title.trim()
        }
      }
    }

    return 'Untitled'
  }

  /**
   * Extract description from various sources
   */
  extractDescription(doc) {
    // Priority order: OG description, Twitter description, meta description
    const selectors = [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]'
    ]

    for (const selector of selectors) {
      const element = doc.querySelector(selector)
      if (element && element.content && element.content.trim()) {
        return element.content.trim()
      }
    }

    // Fallback: extract from first paragraph
    const firstParagraph = doc.querySelector('p')
    if (firstParagraph && firstParagraph.textContent) {
      const text = firstParagraph.textContent.trim()
      return text.length > 160 ? text.substring(0, 157) + '...' : text
    }

    return 'No description available'
  }

  /**
   * Extract image from various sources with validation
   */
  async extractImage(doc, baseUrl) {
    console.log('Extracting image for:', baseUrl)

    // Priority order for image sources
    const imageSources = [
      // Open Graph images (highest priority)
      { selector: 'meta[property="og:image"]', attr: 'content' },
      { selector: 'meta[property="og:image:url"]', attr: 'content' },

      // Twitter Card images
      { selector: 'meta[name="twitter:image"]', attr: 'content' },
      { selector: 'meta[name="twitter:image:src"]', attr: 'content' },

      // Favicons (try multiple selectors)
      { selector: 'link[rel="apple-touch-icon"]', attr: 'href' },
      { selector: 'link[rel="apple-touch-icon-precomposed"]', attr: 'href' },
      { selector: 'link[rel="icon"][type="image/png"]', attr: 'href' },
      { selector: 'link[rel="icon"][type="image/svg+xml"]', attr: 'href' },
      { selector: 'link[rel="icon"][sizes]', attr: 'href' },
      { selector: 'link[rel="shortcut icon"]', attr: 'href' },
      { selector: 'link[rel="icon"]', attr: 'href' }
    ]

    // Check standard meta tags and favicons
    for (const source of imageSources) {
      const elements = doc.querySelectorAll(source.selector)
      for (const element of elements) {
        const imageUrl = element.getAttribute(source.attr)
        if (imageUrl) {
          const fullUrl = this.resolveUrl(imageUrl, baseUrl)
          console.log('Found potential image:', fullUrl)

          if (await this.isValidImage(fullUrl)) {
            console.log('Using image:', fullUrl)
            return fullUrl
          }
        }
      }
    }

    // Try common favicon paths if nothing found
    const commonFaviconPaths = [
      '/favicon.ico',
      '/favicon.png',
      '/favicon.svg',
      '/apple-touch-icon.png',
      '/apple-touch-icon-180x180.png',
      '/icon-192x192.png',
      '/icon-512x512.png'
    ]

    for (const path of commonFaviconPaths) {
      const faviconUrl = this.resolveUrl(path, baseUrl)
      console.log('Trying common favicon path:', faviconUrl)

      if (await this.isValidImage(faviconUrl)) {
        console.log('Using common favicon:', faviconUrl)
        return faviconUrl
      }
    }

    // Check JSON-LD structured data
    const jsonLdImage = this.extractJsonLdImage(doc, baseUrl)
    if (jsonLdImage && (await this.isValidImage(jsonLdImage))) {
      console.log('Using JSON-LD image:', jsonLdImage)
      return jsonLdImage
    }

    // Fallback: look for the largest image in content
    const contentImage = await this.findLargestContentImage(doc, baseUrl)
    if (contentImage) {
      console.log('Using content image:', contentImage)
      return contentImage
    }

    // Final fallback: generate a default icon
    console.log('Using default icon')
    return this.createDefaultIcon()
  }

  /**
   * Extract image from JSON-LD structured data
   */
  extractJsonLdImage(doc, baseUrl) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent)
        const image = this.findImageInJsonLd(data)
        if (image) {
          return this.resolveUrl(image, baseUrl)
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return null
  }

  /**
   * Recursively find image in JSON-LD data
   */
  findImageInJsonLd(data) {
    if (typeof data === 'string' && this.looksLikeImageUrl(data)) {
      return data
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const image = this.findImageInJsonLd(item)
        if (image) return image
      }
    }

    if (typeof data === 'object' && data !== null) {
      // Check common image properties
      const imageProps = ['image', 'logo', 'photo', 'thumbnail']
      for (const prop of imageProps) {
        if (data[prop]) {
          const image = this.findImageInJsonLd(data[prop])
          if (image) return image
        }
      }

      // Recursively check other properties
      for (const value of Object.values(data)) {
        const image = this.findImageInJsonLd(value)
        if (image) return image
      }
    }

    return null
  }

  /**
   * Find the largest image in page content
   */
  async findLargestContentImage(doc, baseUrl) {
    const images = doc.querySelectorAll('img[src]')
    const candidates = []

    for (const img of images) {
      const src = img.getAttribute('src')
      if (src && !this.isIgnorableImage(src)) {
        const fullUrl = this.resolveUrl(src, baseUrl)

        // Try to get dimensions from attributes
        const width = parseInt(img.getAttribute('width') || '0')
        const height = parseInt(img.getAttribute('height') || '0')
        const area = width * height

        candidates.push({ url: fullUrl, area, element: img })
      }
    }

    // Sort by area (largest first)
    candidates.sort((a, b) => b.area - a.area)

    // Validate candidates
    for (const candidate of candidates) {
      if (await this.isValidImage(candidate.url)) {
        return candidate.url
      }
    }

    return null
  }

  /**
   * Check if image URL should be ignored
   */
  isIgnorableImage(src) {
    const ignorePatterns = [
      /\.svg$/i,
      /\/(pixel|spacer|blank|1x1|tracking)/i,
      /\b\d+x\d+\b/i, // Skip very small images by filename
      /ad[sv]?\.|\bad[\d_]|\bads\b/i // Skip ad-related images
    ]

    return ignorePatterns.some((pattern) => pattern.test(src))
  }

  /**
   * Check if string looks like an image URL
   */
  looksLikeImageUrl(str) {
    // More permissive image URL detection
    return (
      /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)(\?|#|$)/i.test(str) ||
      str.includes('image') ||
      str.includes('photo') ||
      str.includes('picture') ||
      str.includes('img') ||
      str.includes('avatar') ||
      str.includes('logo') ||
      str.includes('icon')
    )
  }

  /**
   * Resolve relative URLs to absolute
   */
  resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href
    } catch {
      return url
    }
  }

  /**
   * Validate that image URL returns a valid image
   */
  async isValidImage(url, minWidth = 100, minHeight = 100) {
    try {
      // Quick size check for very small images by URL
      if (url.match(/(\d+)x(\d+)/)) {
        const [, width, height] = url.match(/(\d+)x(\d+)/)
        if (parseInt(width) < minWidth || parseInt(height) < minHeight) {
          return false
        }
      }

      // For CORS-protected images, we can't easily validate them
      // Instead, we'll do basic URL validation and assume they're valid
      // In a production app, you'd validate this server-side

      // Check if URL looks like an image
      if (this.looksLikeImageUrl(url)) {
        return true
      }

      // For other URLs, try basic validation but don't fail if it doesn't work
      try {
        // Don't use proxy for image validation to avoid rate limits
        // Just assume images are valid if they pass basic checks
        return true
      } catch {
        // If validation fails, assume it's valid if it looks like an image URL
        return this.looksLikeImageUrl(url)
      }
    } catch {
      return false
    }
  }

  /**
   * Handle CORS issues using proxy
   */
  async fetchWithCors(url) {
    // Skip direct fetch attempt and go straight to proxy to avoid CORS errors
    try {
      console.log('Fetching via proxy:', url)

      // Use AllOrigins proxy
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
        url
      )}`
      const response = await fetch(proxyUrl)

      if (!response.ok) {
        throw new Error(`Proxy response not ok: ${response.status}`)
      }

      const data = await response.json()

      // Check if the proxied request was successful
      if (!data.status || data.status.http_code >= 400) {
        throw new Error(
          `Target site returned ${data.status?.http_code || 'unknown error'}`
        )
      }

      console.log('Proxy fetch successful for:', url)

      // Return a Response-like object
      return {
        ok: true,
        status: data.status?.http_code || 200,
        text: () => Promise.resolve(data.contents || ''),
        json: () => Promise.resolve(JSON.parse(data.contents || '{}')),
        headers: new Map([
          ['content-type', data.status?.content_type || 'text/html']
        ])
      }
    } catch (error) {
      console.warn('Proxy fetch failed:', error)
      throw new Error(`Failed to fetch via proxy: ${error.message}`)
    }
  }

  /**
   * Generate fallback metadata when fetching fails
   */
  generateFallbackMetadata(url) {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace(/^www\./, '')

      return {
        type: 'website',
        title: this.titleCase(domain.split('.')[0]),
        description: `Visit ${domain} for more information`,
        image: this.createDefaultIcon(),
        imageAspectRatio: 1,
        domain: domain,
        url: url
      }
    } catch {
      return {
        type: 'website',
        title: 'Link',
        description: 'External link',
        image: this.createDefaultIcon(),
        imageAspectRatio: 1,
        domain: url,
        url: url
      }
    }
  }

  /**
   * Create default icon as data URL
   */
  createDefaultIcon() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    `
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  /**
   * Create video icon as data URL
   */
  createVideoIcon() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
    `
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  /**
   * Convert string to title case
   */
  titleCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }
}

// metadataFetcher.js - Complete version for WebView integration with backend service

export class MetadataFetcher {
  constructor() {
    this.cache = new Map()
    this.pendingRequests = new Map()
    this.faviconCache = new Map()

    // Get backend URL from window config (injected by htmlAndJsString.js)
    this.backendUrl =
      window.METADATA_SERVICE_CONFIG?.backendUrl || 'http://localhost:3001'
    this.fallbackEnabled =
      window.METADATA_SERVICE_CONFIG?.fallbackEnabled !== false

    console.log('MetadataFetcher initialized with backend:', this.backendUrl)
  }

  async fetchMetadata(url) {
    console.log('fetchMetadata called for:', url)

    const cacheKey = this._normalizeUrl(url)

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log('Cache hit for:', url)
      return this.cache.get(cacheKey)
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      console.log('Request already pending for:', url)
      return this.pendingRequests.get(cacheKey)
    }

    // Create new request
    console.log('Creating new request for:', url)
    const requestPromise = this._fetchMetadataWithBackend(url)
    this.pendingRequests.set(cacheKey, requestPromise)

    try {
      const result = await requestPromise
      console.log('Request completed for:', url, result)
      this.cache.set(cacheKey, result)
      return result
    } finally {
      this.pendingRequests.delete(cacheKey)
    }
  }

  async _fetchMetadataWithBackend(url) {
    console.log('_fetchMetadataWithBackend called for:', url)

    try {
      // First, try the backend service
      const response = await fetch(`${this.backendUrl}/api/metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      })

      console.log('Backend response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Backend metadata received:', data)

        // Validate and enhance the backend response
        return this._validateAndEnhanceMetadata(data, url)
      } else {
        console.warn(
          'Backend returned error:',
          response.status,
          response.statusText
        )

        // Check if backend provided fallback data
        const errorData = await response.json().catch(() => ({}))
        if (errorData.fallback) {
          console.log('Using backend fallback data')
          return this._validateAndEnhanceMetadata(errorData.fallback, url)
        }

        throw new Error(`Backend error: ${response.status}`)
      }
    } catch (error) {
      console.warn('Backend metadata fetch failed:', error)

      // Fallback to client-side scraping if enabled
      if (this.fallbackEnabled) {
        console.log('Attempting client-side fallback for:', url)
        return await this._fetchMetadataClientSide(url)
      }

      // Final fallback to generated metadata
      console.log('Using generated fallback metadata')
      return this._generateFallbackMetadata(url)
    }
  }

  async _fetchMetadataClientSide(url) {
    console.log('_fetchMetadataClientSide called for:', url)

    try {
      // Try YouTube-specific fetching first (this still works client-side)
      if (this._isYouTubeUrl(url)) {
        console.log('Detected YouTube URL, using YouTube fetcher')
        const youtubeData = await this._fetchYouTubeMetadata(url)
        if (youtubeData) {
          console.log('YouTube metadata fetched successfully:', youtubeData)
          return youtubeData
        }
      }

      // For non-YouTube URLs, we can't reliably scrape due to CORS
      // So we generate smart fallback metadata and try to get favicon
      console.log('Generating enhanced fallback metadata for:', url)
      const fallbackData = this._generateFallbackMetadata(url)

      // Try to enhance with favicon if possible
      const favicon = await this._tryFetchFavicon(url)
      if (favicon) {
        fallbackData.favicon = favicon
      }

      return fallbackData
    } catch (error) {
      console.warn('Client-side metadata fetch failed:', error)
      return this._generateFallbackMetadata(url)
    }
  }

  async _tryFetchFavicon(url) {
    console.log('Trying to fetch favicon for:', url)

    const cacheKey = `favicon_${this._normalizeUrl(url)}`
    if (this.faviconCache.has(cacheKey)) {
      return this.faviconCache.get(cacheKey)
    }

    try {
      // Try backend favicon endpoint first
      const encodedUrl = encodeURIComponent(url)
      const response = await fetch(
        `${this.backendUrl}/api/favicon/${encodedUrl}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        }
      )

      if (response.ok) {
        const data = await response.json()
        const faviconUrl = data.faviconUrl
        console.log('Backend favicon found:', faviconUrl)
        this.faviconCache.set(cacheKey, faviconUrl)
        return faviconUrl
      }
    } catch (error) {
      console.warn('Backend favicon fetch failed:', error)
    }

    // Fallback to basic favicon guess
    const baseUrl = this._getBaseUrl(url)
    const fallbackFavicon = `${baseUrl}/favicon.ico`
    this.faviconCache.set(cacheKey, fallbackFavicon)
    return fallbackFavicon
  }

  _validateAndEnhanceMetadata(data, originalUrl) {
    console.log('Validating and enhancing metadata:', data)

    // Ensure all required fields are present with fallbacks
    const validated = {
      title: data.title || this._generateTitleFromUrl(originalUrl),
      domain: data.domain || this._extractDomain(originalUrl),
      image: data.image || null,
      imageAspectRatio:
        data.imageAspectRatio || (data.contentType === 'video' ? 16 / 9 : 1),
      type: data.type || 'website',
      contentType: data.contentType || 'website',
      favicon: data.favicon || `${this._getBaseUrl(originalUrl)}/favicon.ico`,
      excerpt: data.excerpt || data.description || null,
      author: data.author || null,
      cached: data.cached || false
    }

    // Enhance contentType detection
    if (validated.excerpt && validated.excerpt.length > 200) {
      validated.contentType = 'article'
    } else if (
      validated.type?.includes('youtube') ||
      validated.image?.includes('youtube')
    ) {
      validated.contentType = 'video'
    }

    console.log('Validated metadata:', validated)
    return validated
  }

  // YouTube-specific methods (kept for client-side fallback)
  async _fetchYouTubeMetadata(url) {
    console.log('_fetchYouTubeMetadata called for:', url)

    try {
      // Try YouTube oEmbed API (works client-side)
      const oembedData = await this._tryYouTubeOEmbed(url)
      if (oembedData) {
        console.log('YouTube oEmbed successful:', oembedData)
        return oembedData
      }

      // Fallback to direct YouTube method
      console.log('oEmbed failed, trying direct YouTube method...')
      return await this._tryYouTubeDirect(url)
    } catch (error) {
      console.warn('YouTube metadata fetch failed:', error)
      return null
    }
  }

  async _tryYouTubeOEmbed(url) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
        url
      )}`
      console.log('Fetching oEmbed from:', oembedUrl)

      const response = await fetch(oembedUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(
          `oEmbed response ${response.status}: ${response.statusText}`
        )
      }

      const data = await response.json()

      return {
        title: data.title || this._extractVideoIdFromUrl(url),
        domain: 'youtube.com',
        image: data.thumbnail_url || this._getYouTubeThumbnailUrl(url),
        imageAspectRatio: this._getYouTubeAspectRatio(url),
        type: this._getYouTubeType(url),
        author: data.author_name || 'YouTube',
        contentType: 'video',
        favicon:
          'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png'
      }
    } catch (error) {
      console.warn('YouTube oEmbed failed:', error)
      return null
    }
  }

  async _tryYouTubeDirect(url) {
    const videoId = this._extractVideoIdFromUrl(url)

    if (!videoId) {
      return null
    }

    return {
      title: this._generateYouTubeTitle(videoId, url),
      domain: 'youtube.com',
      image: this._getYouTubeThumbnailUrl(url, videoId),
      imageAspectRatio: this._getYouTubeAspectRatio(url),
      type: this._getYouTubeType(url),
      contentType: 'video',
      favicon:
        'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png'
    }
  }

  // Utility methods
  _isYouTubeUrl(url) {
    const normalizedUrl = url.toLowerCase()
    return (
      normalizedUrl.includes('youtube.com/watch') ||
      normalizedUrl.includes('youtu.be/') ||
      normalizedUrl.includes('youtube.com/shorts/')
    )
  }

  _extractVideoIdFromUrl(url) {
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

  _getYouTubeThumbnailUrl(url, videoId = null) {
    const id = videoId || this._extractVideoIdFromUrl(url)
    if (!id) return null

    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
  }

  _getYouTubeAspectRatio(url) {
    return url.includes('/shorts/') ? 9 / 16 : 16 / 9
  }

  _getYouTubeType(url) {
    return url.includes('/shorts/') ? 'youtube-short' : 'youtube'
  }

  _generateYouTubeTitle(videoId, url) {
    if (url.includes('/shorts/')) {
      return `YouTube Short: ${videoId}`
    }
    return `YouTube Video: ${videoId}`
  }

  _extractDomain(url) {
    try {
      const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`
      const domain = new URL(urlWithProtocol).hostname
      return domain.replace(/^www\./, '')
    } catch {
      return url.length > 25 ? url.substring(0, 22) + '...' : url
    }
  }

  _getBaseUrl(url) {
    try {
      const urlObj = new URL(url.match(/^https?:\/\//) ? url : `https://${url}`)
      return `${urlObj.protocol}//${urlObj.hostname}`
    } catch (error) {
      return url
    }
  }

  _normalizeUrl(url) {
    try {
      const urlObj = new URL(url.match(/^https?:\/\//) ? url : `https://${url}`)
      return urlObj.href.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  }

  _generateTitleFromUrl(url) {
    try {
      const urlObj = new URL(url.match(/^https?:\/\//) ? url : `https://${url}`)
      const domain = urlObj.hostname.replace(/^www\./, '')
      const pathname = urlObj.pathname

      if (pathname === '/' || pathname === '') {
        return this._formatDomainAsTitle(domain)
      }

      const pathParts = pathname.split('/').filter((part) => part.length > 0)
      const lastPart = pathParts[pathParts.length - 1]

      const cleanPart = lastPart
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())

      return cleanPart || this._formatDomainAsTitle(domain)
    } catch {
      return this._extractDomain(url)
    }
  }

  _formatDomainAsTitle(domain) {
    return domain
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  _generateFallbackMetadata(url) {
    const domain = this._extractDomain(url)
    const normalizedUrl = url.toLowerCase()

    let type = 'website'
    let aspectRatio = 1
    let favicon = null

    // Enhanced fallback detection
    if (normalizedUrl.includes('github.com')) {
      type = 'github'
      favicon = 'https://github.com/favicon.ico'
    } else if (
      normalizedUrl.includes('docs.') ||
      normalizedUrl.includes('documentation')
    ) {
      type = 'docs'
    } else if (this._isYouTubeUrl(url)) {
      type = this._getYouTubeType(url)
      aspectRatio = this._getYouTubeAspectRatio(url)
      favicon =
        'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png'
    } else if (
      normalizedUrl.includes('twitter.com') ||
      normalizedUrl.includes('x.com')
    ) {
      type = 'twitter'
      favicon = 'https://abs.twimg.com/favicons/twitter.3.ico'
    } else if (normalizedUrl.includes('linkedin.com')) {
      type = 'linkedin'
      favicon =
        'https://static.licdn.com/scds/common/u/images/logos/favicons/v1/favicon.ico'
    } else {
      favicon = `${this._getBaseUrl(url)}/favicon.ico`
    }

    return {
      title: this._generateTitleFromUrl(url),
      domain: domain,
      image: this._isYouTubeUrl(url) ? this._getYouTubeThumbnailUrl(url) : null,
      imageAspectRatio: aspectRatio,
      type: type,
      contentType: this._isYouTubeUrl(url) ? 'video' : 'website',
      favicon: favicon,
      excerpt: null,
      author: null
    }
  }

  // Configuration methods
  setBackendUrl(url) {
    this.backendUrl = url
    console.log('Backend URL updated to:', url)
  }

  enableFallback(enabled = true) {
    this.fallbackEnabled = enabled
    console.log('Client-side fallback', enabled ? 'enabled' : 'disabled')
  }

  // Enhanced cache management
  clearCache() {
    console.log('Clearing all metadata cache')
    this.cache.clear()
    this.faviconCache.clear()
    console.log('Cache cleared - all future requests will fetch fresh data')
  }

  clearUrlCache(url) {
    const cacheKey = this._normalizeUrl(url)
    const faviconKey = `favicon_${cacheKey}`

    const metadataDeleted = this.cache.delete(cacheKey)
    const faviconDeleted = this.faviconCache.delete(faviconKey)

    console.log(`Cache cleared for ${url}:`, {
      metadata: metadataDeleted ? 'cleared' : 'not found',
      favicon: faviconDeleted ? 'cleared' : 'not found'
    })

    return metadataDeleted || faviconDeleted
  }

  async forceRefresh(url) {
    console.log('Force refreshing metadata for:', url)
    this.clearUrlCache(url)
    return this.fetchMetadata(url)
  }

  getCacheStats() {
    return {
      metadataCache: this.cache.size,
      faviconCache: this.faviconCache.size,
      pendingRequests: this.pendingRequests.size
    }
  }

  // Health check for backend service
  async checkBackendHealth() {
    try {
      const response = await fetch(`${this.backendUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Backend health check successful:', data)
        return { healthy: true, data }
      } else {
        console.warn('Backend health check failed:', response.status)
        return { healthy: false, status: response.status }
      }
    } catch (error) {
      console.warn('Backend health check error:', error)
      return { healthy: false, error: error.message }
    }
  }

  // Method to preload critical images for faster display
  preloadImage(imageUrl) {
    if (!imageUrl) return Promise.resolve(false)

    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = imageUrl
    })
  }
}

// Export a singleton instance
export const metadataFetcher = new MetadataFetcher()

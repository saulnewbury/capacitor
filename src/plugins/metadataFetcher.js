// metadataFetcher.js - Complete version for Capacitor
import { CapacitorHttp } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

export class MetadataFetcher {
  constructor() {
    this.cache = new Map()
    this.pendingRequests = new Map()
    this.faviconCache = new Map()

    // Use environment variable, fallback to localhost for development
    this.backendUrl =
      process.env.NEXT_PUBLIC_METADATA_SERVICE_URL || 'http://localhost:3001'
    this.fallbackEnabled = true

    console.log('MetadataFetcher initialized with backend:', this.backendUrl)
  }

  async fetchMetadata(url) {
    console.log('fetchMetadata called for:', url)

    // Ensure URL has protocol
    if (!url.match(/^https?:\/\//i)) {
      url = `https://${url}`
    }

    const cacheKey = this._normalizeUrl(url)

    if (this.cache.has(cacheKey)) {
      console.log('Cache hit for:', url)
      return this.cache.get(cacheKey)
    }

    if (this.pendingRequests.has(cacheKey)) {
      console.log('Request already pending for:', url)
      return this.pendingRequests.get(cacheKey)
    }

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
      // Use CapacitorHttp on native, fetch on web
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.post({
          url: `${this.backendUrl}/api/metadata`,
          headers: {
            'Content-Type': 'application/json'
          },
          data: { url },
          connectTimeout: 15000,
          readTimeout: 15000
        })

        console.log('Backend response status:', response.status)

        if (response.status === 200) {
          const data = response.data
          console.log('Backend metadata received:', data)
          return this._validateAndEnhanceMetadata(data, url)
        } else {
          console.warn('Backend returned error:', response.status)

          if (response.data?.fallback) {
            console.log('Using backend fallback data')
            return this._validateAndEnhanceMetadata(response.data.fallback, url)
          }

          throw new Error(`Backend error: ${response.status}`)
        }
      } else {
        // Web fallback using fetch
        const response = await fetch(`${this.backendUrl}/api/metadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(15000)
        })

        console.log('Backend response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('Backend metadata received:', data)
          return this._validateAndEnhanceMetadata(data, url)
        } else {
          console.warn(
            'Backend returned error:',
            response.status,
            response.statusText
          )

          const errorData = await response.json().catch(() => ({}))
          if (errorData.fallback) {
            console.log('Using backend fallback data')
            return this._validateAndEnhanceMetadata(errorData.fallback, url)
          }

          throw new Error(`Backend error: ${response.status}`)
        }
      }
    } catch (error) {
      console.warn('Backend metadata fetch failed:', error)

      if (this.fallbackEnabled) {
        console.log('Attempting client-side fallback for:', url)
        return await this._fetchMetadataClientSide(url)
      }

      console.log('Using generated fallback metadata')
      return this._generateFallbackMetadata(url)
    }
  }

  async _fetchMetadataClientSide(url) {
    console.log('_fetchMetadataClientSide called for:', url)

    try {
      // Try YouTube-specific fetching first
      if (this._isYouTubeUrl(url)) {
        console.log('Detected YouTube URL, using YouTube fetcher')
        const youtubeData = await this._fetchYouTubeMetadata(url)
        if (youtubeData) {
          console.log('YouTube metadata fetched successfully:', youtubeData)
          return youtubeData
        }
      }

      // For native platforms, we can try direct fetch
      if (Capacitor.isNativePlatform()) {
        try {
          console.log('Trying direct fetch for:', url)
          const response = await CapacitorHttp.get({
            url: url,
            connectTimeout: 10000,
            readTimeout: 10000
          })

          if (response.status === 200 && response.data) {
            const metadata = this._parseHtmlMetadata(response.data, url)
            if (metadata) {
              console.log('Successfully parsed HTML metadata')
              return metadata
            }
          }
        } catch (error) {
          console.warn('Direct page fetch failed:', error)
        }
      }

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

      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
          url: `${this.backendUrl}/api/favicon/${encodedUrl}`,
          connectTimeout: 5000,
          readTimeout: 5000
        })

        if (response.status === 200 && response.data?.faviconUrl) {
          const faviconUrl = response.data.faviconUrl
          console.log('Backend favicon found:', faviconUrl)
          this.faviconCache.set(cacheKey, faviconUrl)
          return faviconUrl
        }
      } else {
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

  async _fetchYouTubeMetadata(url) {
    console.log('_fetchYouTubeMetadata called for:', url)

    try {
      // Try YouTube oEmbed API
      const oembedData = await this._tryYouTubeOEmbed(url)
      if (oembedData) {
        console.log('YouTube oEmbed successful:', oembedData)
        return oembedData
      }

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

      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
          url: oembedUrl,
          headers: { Accept: 'application/json' },
          connectTimeout: 5000,
          readTimeout: 5000
        })

        if (response.status === 200) {
          const data = response.data
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
        }
      } else {
        const response = await fetch(oembedUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
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
        }
      }

      throw new Error('oEmbed request failed')
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

  _parseHtmlMetadata(html, url) {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      const title =
        doc
          .querySelector('meta[property="og:title"]')
          ?.getAttribute('content') ||
        doc.querySelector('title')?.textContent ||
        this._generateTitleFromUrl(url)

      const description =
        doc
          .querySelector('meta[property="og:description"]')
          ?.getAttribute('content') ||
        doc
          .querySelector('meta[name="description"]')
          ?.getAttribute('content') ||
        null

      const image =
        doc
          .querySelector('meta[property="og:image"]')
          ?.getAttribute('content') || null

      const author =
        doc.querySelector('meta[name="author"]')?.getAttribute('content') ||
        null

      return {
        title,
        domain: this._extractDomain(url),
        image,
        imageAspectRatio: image ? 16 / 9 : 1,
        type: 'website',
        contentType:
          description && description.length > 200 ? 'article' : 'website',
        favicon: `${this._getBaseUrl(url)}/favicon.ico`,
        excerpt: description,
        author
      }
    } catch (error) {
      console.warn('HTML parsing failed:', error)
      return null
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
      // Ensure URL has protocol
      if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`
      }
      const domain = new URL(url).hostname
      return domain.replace(/^www\./, '')
    } catch {
      return url.length > 25 ? url.substring(0, 22) + '...' : url
    }
  }

  _getBaseUrl(url) {
    try {
      // Ensure URL has protocol
      if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`
      }
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.hostname}`
    } catch {
      return url
    }
  }

  _normalizeUrl(url) {
    try {
      // Ensure URL has protocol
      if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`
      }
      const urlObj = new URL(url)
      return urlObj.href.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  }

  _generateTitleFromUrl(url) {
    try {
      // Ensure URL has protocol
      if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`
      }
      const urlObj = new URL(url)
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

  // Cache management
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
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
          url: `${this.backendUrl}/health`,
          connectTimeout: 5000,
          readTimeout: 5000
        })

        return {
          healthy: response.status === 200,
          data: response.data
        }
      } else {
        const response = await fetch(`${this.backendUrl}/health`, {
          signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
          const data = await response.json()
          return { healthy: true, data }
        }

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

// Export singleton instance with SSR safety
let metadataFetcherInstance

if (typeof window !== 'undefined') {
  metadataFetcherInstance = new MetadataFetcher()
} else {
  metadataFetcherInstance = null
}

export const metadataFetcher =
  typeof window !== 'undefined'
    ? metadataFetcherInstance
    : new Proxy(
        {},
        {
          get(target, prop) {
            if (!metadataFetcherInstance) {
              metadataFetcherInstance = new MetadataFetcher()
            }
            return metadataFetcherInstance[prop]
          }
        }
      )

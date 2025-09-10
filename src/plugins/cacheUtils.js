// cacheUtils.js - Utility functions for managing cache

import { metadataFetcher } from './metadataFetcher.js'

// Global functions for cache management that can be called from console
window.clearMetadataCache = () => {
  console.log('🔧 Manual cache clear requested...')
  metadataFetcher.clearCache()
  console.log('✅ All metadata cache cleared!')
}

window.clearUrlCache = (url) => {
  if (!url) {
    console.log('❌ Please provide a URL: clearUrlCache("https://example.com")')
    return
  }
  console.log('🔧 Manual URL cache clear requested for:', url)
  const wasCleared = metadataFetcher.clearUrlCache(url)
  console.log(wasCleared ? '✅ URL cache cleared!' : '⚠️ URL was not in cache')
}

window.clearYouTubeCache = () => {
  console.log('🔧 Manual YouTube cache clear requested...')
  const count = metadataFetcher.clearYouTubeFaviconCache()
  console.log(`✅ Cleared ${count} YouTube entries!`)
}

window.getCacheInfo = () => {
  const size = metadataFetcher.getCacheSize()
  console.log(`📊 Cache contains ${size} entries`)
  return size
}

window.refreshUrlPreview = async (url) => {
  if (!url) {
    console.log(
      '❌ Please provide a URL: refreshUrlPreview("https://example.com")'
    )
    return
  }
  console.log('🔄 Force refreshing preview for:', url)
  try {
    const newData = await metadataFetcher.forceRefresh(url)
    console.log('✅ Preview refreshed:', newData)
    return newData
  } catch (error) {
    console.error('❌ Failed to refresh:', error)
  }
}

console.log(`
🔧 Cache management utilities loaded!

Available commands:
- clearMetadataCache() - Clear all cached metadata
- clearUrlCache("url") - Clear cache for specific URL  
- clearYouTubeCache() - Clear all YouTube favicon cache
- getCacheInfo() - Show cache size
- refreshUrlPreview("url") - Force refresh a specific URL

Example: clearYouTubeCache()
`)

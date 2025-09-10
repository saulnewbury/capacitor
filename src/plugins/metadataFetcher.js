export const metadataFetcher = {
  async fetchMetadata(url) {
    // Basic implementation - you can enhance this later
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      return {
        title: domain,
        domain: domain,
        favicon: `https://${domain}/favicon.ico`,
        image: null,
        excerpt: null,
        author: null,
        contentType: 'website'
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error)
      return {
        title: 'Link',
        domain: url,
        favicon: null,
        image: null,
        excerpt: null,
        author: null,
        contentType: 'website'
      }
    }
  }
}

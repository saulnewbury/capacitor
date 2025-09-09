// Helper function to safely open URLs
export const safeOpenUrl = (url) => {
  try {
    // Ensure the URL has a protocol
    if (!url.match(/^https?:\/\//i)) {
      // If it starts with www., add https://
      if (url.match(/^www\./i)) {
        url = 'https://' + url
      } else {
        // For other cases, add https://
        url = 'https://' + url
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error) {
    console.error('Failed to open URL:', error)
  }
}

// Helper function to safely open email client
export const safeOpenEmail = (email) => {
  try {
    window.location.href = 'mailto:' + email
  } catch (error) {
    console.error('Failed to open email client:', error)
  }
}

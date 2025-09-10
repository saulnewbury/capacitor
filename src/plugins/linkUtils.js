// linkUtils.js - Updated for Capacitor
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

// Helper function to safely open URLs
export const safeOpenUrl = async (url) => {
  try {
    // Ensure the URL has a protocol
    if (!url.match(/^https?:\/\//i)) {
      if (url.match(/^www\./i)) {
        url = 'https://' + url
      } else {
        url = 'https://' + url
      }
    }

    // Use Capacitor Browser plugin for native platforms
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url })
    } else {
      // Fallback for web
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } catch (error) {
    console.error('Failed to open URL:', error)
  }
}

// Helper function to safely open email client
export const safeOpenEmail = (email) => {
  try {
    const mailtoUrl = 'mailto:' + email

    if (Capacitor.isNativePlatform()) {
      // On mobile, this will open the default email app
      window.location.href = mailtoUrl
    } else {
      // On web, open in same way
      window.location.href = mailtoUrl
    }
  } catch (error) {
    console.error('Failed to open email client:', error)
  }
}

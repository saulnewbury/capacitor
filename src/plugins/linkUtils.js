// linkUtils.js - Fully updated for Capacitor with external app opening
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

// Helper function to safely open URLs in external browser/apps
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

    console.log('Opening URL externally:', url)

    // Use Capacitor Browser plugin for all platforms
    // This opens in the system browser on mobile, not in-app
    if (Capacitor.isNativePlatform()) {
      // Browser.open() opens URLs in the system's default browser
      // presentationStyle: 'popover' opens in external browser on iOS
      // windowName: '_system' ensures external opening on Android
      await Browser.open({
        url,
        presentationStyle: 'popover',
        windowName: '_system'
      })
    } else {
      // On web, open in new tab
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } catch (error) {
    console.error('Failed to open URL:', error)

    // Fallback: Try using Capacitor App plugin to open URL
    try {
      if (Capacitor.isNativePlatform()) {
        await App.openUrl({ url })
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
    }
  }
}

// Helper function to safely open email client
export const safeOpenEmail = async (email) => {
  try {
    // Clean the email address
    email = email.replace('mailto:', '')
    const mailtoUrl = 'mailto:' + email

    console.log('Opening email client for:', email)

    if (Capacitor.isNativePlatform()) {
      // Use App.openUrl for mailto links on native platforms
      // This will open the default email app
      await App.openUrl({ url: mailtoUrl })
    } else {
      // On web, use location.href
      window.location.href = mailtoUrl
    }
  } catch (error) {
    console.error('Failed to open email client:', error)

    // Fallback to location.href even on native
    try {
      window.location.href = mailtoUrl
    } catch (fallbackError) {
      console.error('Email fallback also failed:', fallbackError)
    }
  }
}

// Helper function to determine if a URL should open in a specific app
export const getAppForUrl = (url) => {
  const normalizedUrl = url.toLowerCase()

  // YouTube
  if (
    normalizedUrl.includes('youtube.com') ||
    normalizedUrl.includes('youtu.be')
  ) {
    return 'youtube'
  }

  // Twitter/X
  if (
    normalizedUrl.includes('twitter.com') ||
    normalizedUrl.includes('x.com')
  ) {
    return 'twitter'
  }

  // Instagram
  if (normalizedUrl.includes('instagram.com')) {
    return 'instagram'
  }

  // LinkedIn
  if (normalizedUrl.includes('linkedin.com')) {
    return 'linkedin'
  }

  // Facebook
  if (
    normalizedUrl.includes('facebook.com') ||
    normalizedUrl.includes('fb.com')
  ) {
    return 'facebook'
  }

  return 'browser'
}

// Export a utility to check if we're on a native platform
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform()
}

// Export platform info
export const getPlatformInfo = () => {
  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    isIOS: Capacitor.getPlatform() === 'ios',
    isAndroid: Capacitor.getPlatform() === 'android',
    isWeb: Capacitor.getPlatform() === 'web'
  }
}

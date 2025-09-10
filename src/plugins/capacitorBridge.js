// capacitorBridge.js - Capacitor native bridge utilities

// Note: You'll need to install these Capacitor plugins:
// npm install @capacitor/browser @capacitor/haptics @capacitor/clipboard

let Browser, Haptics, ImpactStyle, Clipboard

// Lazy load Capacitor plugins only in browser environment
const loadCapacitorPlugins = async () => {
  if (typeof window === 'undefined') return false

  try {
    const [browserModule, hapticsModule, clipboardModule] = await Promise.all([
      import('@capacitor/browser'),
      import('@capacitor/haptics'),
      import('@capacitor/clipboard')
    ])

    Browser = browserModule.Browser
    Haptics = hapticsModule.Haptics
    ImpactStyle = hapticsModule.ImpactStyle
    Clipboard = clipboardModule.Clipboard

    return true
  } catch (error) {
    console.warn('Failed to load Capacitor plugins:', error)
    return false
  }
}

// Initialize plugins on first use
let pluginsLoaded = false
const ensurePluginsLoaded = async () => {
  if (!pluginsLoaded) {
    pluginsLoaded = await loadCapacitorPlugins()
  }
  return pluginsLoaded
}

export const openUrl = async (url) => {
  await ensurePluginsLoaded()

  if (!url) return

  // Ensure URL has protocol
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url
  }

  if (Browser) {
    // Use Capacitor Browser plugin
    await Browser.open({ url })
  } else {
    // Fallback for web
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export const openEmail = async (email) => {
  if (!email) return

  // Remove mailto: if it's already there
  email = email.replace(/^mailto:/i, '')

  // Use mailto: link (works on both mobile and web)
  window.location.href = `mailto:${email}`
}

export const hapticFeedback = async (style = 'medium') => {
  await ensurePluginsLoaded()

  if (!Haptics || !ImpactStyle) {
    console.log('Haptics not available')
    return
  }

  try {
    const impactStyle =
      {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      }[style] || ImpactStyle.Medium

    await Haptics.impact({ style: impactStyle })
  } catch (error) {
    console.warn('Haptic feedback failed:', error)
  }
}

export const copyToClipboard = async (text) => {
  await ensurePluginsLoaded()

  if (Clipboard) {
    // Use Capacitor Clipboard plugin
    await Clipboard.write({ string: text })
  } else {
    // Fallback for web
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }
}

// Context menu for links (you can extend this based on your needs)
export const showLinkContextMenu = async (linkInfo, coordinates) => {
  // For now, we'll use the browser's default context menu
  // You could implement a custom menu using a UI library
  console.log('Link context menu requested:', linkInfo, coordinates)

  // If you want to implement a custom context menu later,
  // you could dispatch a custom event that your React components listen to:
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('link-context-menu', {
        detail: { linkInfo, coordinates }
      })
    )
  }
}

// Message logging (useful for debugging)
export const logToNative = (level, message, data = {}) => {
  if (typeof window === 'undefined') return

  // In Capacitor, you can use console methods which will appear in native logs
  const logData = {
    timestamp: new Date().toISOString(),
    message,
    ...data
  }

  switch (level) {
    case 'error':
      console.error('[Native Log]', message, logData)
      break
    case 'warn':
      console.warn('[Native Log]', message, logData)
      break
    case 'info':
    default:
      console.log('[Native Log]', message, logData)
      break
  }
}

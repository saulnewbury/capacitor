// webview/plugins/linkPreviewState.js
// Global preview state tracker
const linkPreviewStates = new Map()

// Helper function to set preview state
export const setLinkPreviewState = (linkText, url, isPreview) => {
  const key = `${linkText}::${url}`
  if (isPreview) {
    linkPreviewStates.set(key, true)
  } else {
    linkPreviewStates.delete(key)
  }
}

// Helper function to get preview state
export const getLinkPreviewState = (linkText, url) => {
  const key = `${linkText}::${url}`
  return linkPreviewStates.has(key)
}

// plugins/iconHelpers.js - Icon helper for CodeMirror plugins

import iconConfig from '@/icons-config.json'

// Build the glyph map
const glyphMap = {}
iconConfig.glyphs.forEach((glyph) => {
  glyphMap[glyph.css] = String.fromCharCode(glyph.code)
})

// This creates DOM elements for use within CodeMirror widgets
export const createIcon = (iconName) => {
  const span = document.createElement('span')
  span.className = `icon icon-${iconName}`

  // Apply inline styles for the icon font
  span.style.cssText = `
    font-family: 'icons';
    font-style: normal;
    font-weight: normal;
    speak: none;
    display: inline-block;
    text-decoration: inherit;
    width: 1em;
    text-align: center;
    font-variant: normal;
    text-transform: none;
    line-height: 1em;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-size: 18px;
    color: currentColor;
  `

  // Set the icon character
  const iconChar = glyphMap[iconName]
  if (iconChar) {
    span.textContent = iconChar
  } else {
    console.warn(`Icon "${iconName}" not found in icon font`)
    span.textContent = '?'
  }

  return span
}

// Icon name constants - map to your actual icon names from icons-config.json
export const ICONS = {
  EDIT: 'edit', // You might need to map this to an appropriate icon
  HASH: 'hash',
  SEARCH: 'search',
  AI_MAGIC: 'ai-magic',
  ATTACHMENT: 'attachment',
  CAMERA: 'camera',
  GOOGLE_DOC: 'google-doc',
  SETTINGS: 'settings',
  TRASH: 'trash',
  COPY: 'copy',
  LINK: 'link'
  // Add more mappings as needed
}

// components/Icon.tsx - Custom Icon Component using your icon font

import React from 'react'
import iconConfig from '@/icons-config.json'

// Build the glyph map from your config
const glyphMap: Record<string, string> = {}
iconConfig.glyphs.forEach((glyph) => {
  glyphMap[glyph.css] = String.fromCharCode(glyph.code)
})

// Export available icon names for TypeScript autocomplete
export type IconName = keyof typeof glyphMap

interface IconProps {
  name: IconName
  size?: number | string
  color?: string
  className?: string
  style?: React.CSSProperties
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = 'currentColor',
  className = '',
  style = {}
}) => {
  const iconChar = glyphMap[name]

  if (!iconChar) {
    console.warn(`Icon "${name}" not found in icon font`)
    return null
  }

  return (
    <span
      className={`icon icon-${name} ${className}`}
      style={{
        fontFamily: 'icons',
        fontSize: typeof size === 'number' ? `${size}px` : size,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontStyle: 'normal',
        fontWeight: 'normal',
        textDecoration: 'inherit',
        width: '1em',
        textAlign: 'center',
        fontVariant: 'normal',
        textTransform: 'none',
        lineHeight: 1,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        ...style
      }}
      aria-hidden='true'
    >
      {iconChar}
    </span>
  )
}

export default Icon

// Export commonly used icon names as constants
export const ICONS = {
  HASH: 'hash' as IconName,
  SEARCH: 'search' as IconName,
  TOGGLE: 'toggle' as IconName,
  ELLIPSIS_VERTICAL: 'ellipsis-vertical' as IconName,
  BACK: 'back' as IconName,
  FORWARD: 'forward' as IconName,
  AI_CONTENT_GENERATOR: 'ai-content-generator' as IconName,
  AI_MAGIC: 'ai-magic' as IconName,
  BOX: 'box' as IconName,
  CAMERA: 'camera' as IconName,
  ATTACHMENT: 'attachment' as IconName,
  HELP_CIRCLE: 'help-circle' as IconName,
  PLAY_CIRCLE: 'play-circle' as IconName,
  SHARE: 'share' as IconName,
  SETTINGS: 'settings' as IconName,
  TRASH: 'trash' as IconName,
  PIN: 'pin' as IconName,
  COPY: 'copy' as IconName,
  LINK: 'link' as IconName,
  CALENDAR: 'calendar' as IconName,
  GOOGLE_DOC: 'google-doc' as IconName
  // Add more as needed
} as const

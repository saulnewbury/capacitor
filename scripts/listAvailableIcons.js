// scripts/listAvailableIcons.js - List all available icons from your config
import iconConfig from '../icons-config.json' assert { type: 'json' }

console.log('Available Icons in your font:')
console.log('============================\n')

// Sort alphabetically for easier reading
const sortedGlyphs = [...iconConfig.glyphs].sort((a, b) =>
  a.css.localeCompare(b.css)
)

sortedGlyphs.forEach((glyph, index) => {
  const hexCode = '0x' + glyph.code.toString(16).toUpperCase()
  console.log(`${index + 1}. ${glyph.css}`)
  console.log(`   Unicode: ${glyph.code} (${hexCode})`)
  console.log(`   Character: ${String.fromCharCode(glyph.code)}`)
  if (glyph.search && glyph.search.length > 0) {
    console.log(`   Search terms: ${glyph.search.join(', ')}`)
  }
  console.log('')
})

console.log(`\nTotal icons: ${iconConfig.glyphs.length}`)

// Check for specific icons needed by the plugins
console.log('\n\nChecking for required icons:')
console.log('============================')

const requiredIcons = [
  'edit',
  'pencil',
  'ai-magic',
  'hash',
  'search',
  'link',
  'copy',
  'trash'
]

requiredIcons.forEach((iconName) => {
  const found = iconConfig.glyphs.find(
    (g) =>
      g.css === iconName ||
      g.css.includes(iconName) ||
      g.search?.includes(iconName)
  )

  if (found) {
    console.log(`✓ ${iconName}: Found as "${found.css}"`)
  } else {
    console.log(`✗ ${iconName}: NOT FOUND - needs mapping or addition`)
  }
})

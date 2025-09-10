// // Complete iconExtension.js with proper event handling

// // plugins/iconExtension.js - Inline clickable icon widgets

// import { RangeSetBuilder } from '@codemirror/state'
// import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

// // Icon widget class
// export class IconWidget extends WidgetType {
//   constructor(iconName, position, view) {
//     super()
//     this.iconName = iconName
//     this.position = position
//     this.view = view
//   }

//   toDOM() {
//     const button = document.createElement('button')
//     button.className = 'cm-inline-icon-button'
//     button.style.cssText = `
//       background: none;
//       border: none;
//       cursor: pointer;
//       display: inline-flex;
//       align-items: center;
//       justify-content: center;
//       margin: 0 4px;
//       padding: 6px;
//       border-radius: 4px;
//       transition: all 0.2s ease;
//       vertical-align: middle;
//       min-width: 24px;
//       min-height: 24px;
//     `

//     // Create icon using your existing icon system
//     const icon = this.createIcon(this.iconName)
//     icon.style.color = '#9ca3af'
//     icon.style.fontSize = '24px'
//     icon.style.transition = 'color 0.2s ease'

//     button.appendChild(icon)

//     // Click handler with full event prevention
//     button.addEventListener('click', (e) => {
//       e.preventDefault()
//       e.stopPropagation()
//       e.stopImmediatePropagation() // Extra prevention
//       this.handleIconClick()
//       return false // Belt and suspenders
//     })

//     // Prevent mousedown from affecting selection
//     button.addEventListener('mousedown', (e) => {
//       e.preventDefault()
//       e.stopPropagation()
//       return false
//     })

//     // Prevent focus changes
//     button.addEventListener('focus', (e) => {
//       e.preventDefault()
//       // Return focus to the editor without changing selection
//       if (this.view && this.view.contentDOM) {
//         this.view.contentDOM.focus({ preventScroll: true })
//       }
//       return false
//     })

//     // Hover effects
//     button.addEventListener('mouseenter', () => {
//       // button.style.backgroundColor = '#f3f4f6'
//     })

//     button.addEventListener('mouseleave', () => {
//       // button.style.backgroundColor = 'transparent'
//     })

//     return button
//   }

//   createIcon(iconName) {
//     // Create icon element - adapt this to match your existing icon system
//     const icon = document.createElement('i')
//     icon.className = `icon-${iconName}`
//     return icon
//   }

//   handleIconClick() {
//     // Don't modify selection or scroll at all - just send the message
//     const currentScroll = window.view?.scrollDOM?.scrollTop || 0

//     console.log(`Icon clicked: ${this.iconName} at position ${this.position}`)
//     console.log('Scroll position at click:', currentScroll)

//     // Store scroll globally
//     window._iconClickScrollPosition = currentScroll

//     // Send message to React Native
//     if (window.ReactNativeWebView) {
//       window.ReactNativeWebView.postMessage(
//         JSON.stringify({
//           type: 'ICON_CLICKED',
//           iconName: this.iconName,
//           position: this.position,
//           scrollPosition: currentScroll
//         })
//       )
//     }

//     // Maintain scroll position during and after the click
//     if (window.view?.scrollDOM) {
//       const maintainScroll = () => {
//         if (
//           window.view?.scrollDOM &&
//           window._iconClickScrollPosition !== undefined
//         ) {
//           window.view.scrollDOM.scrollTop = window._iconClickScrollPosition
//         }
//       }

//       // Immediate preservation
//       maintainScroll()
//       requestAnimationFrame(maintainScroll)

//       // Continue preserving during animation
//       const interval = setInterval(maintainScroll, 10)
//       setTimeout(() => {
//         clearInterval(interval)
//       }, 300)
//     }
//   }

//   eq(other) {
//     return (
//       other instanceof IconWidget &&
//       this.iconName === other.iconName &&
//       this.position === other.position
//     )
//   }

//   ignoreEvent(event) {
//     // Tell CodeMirror to ignore all events on this widget
//     return true
//   }
// }

// // Plugin to detect and render icon syntax
// export const iconPlugin = ViewPlugin.fromClass(
//   class {
//     constructor(view) {
//       this.decorations = this.buildDecorations(view)
//     }

//     update(update) {
//       if (update.docChanged || update.viewportChanged) {
//         this.decorations = this.buildDecorations(update.view)
//       }
//     }

//     buildDecorations(view) {
//       const builder = new RangeSetBuilder()
//       const text = view.state.doc.toString()

//       // Regex to match [icon:icon-name] syntax
//       const iconRegex = /\[icon:([a-zA-Z0-9-]+)\]/g
//       let match

//       while ((match = iconRegex.exec(text)) !== null) {
//         const from = match.index
//         const to = match.index + match[0].length
//         const iconName = match[1]

//         // Create widget decoration
//         const widget = new IconWidget(iconName, from, view)
//         const deco = Decoration.replace({
//           widget,
//           inclusive: false,
//           block: false
//         })

//         builder.add(from, to, deco)
//       }

//       return builder.finish()
//     }
//   },
//   {
//     decorations: (v) => v.decorations
//   }
// )

// // Export the complete extension
// export const iconExtensions = [iconPlugin]

// // linkHandlers.js - Debug version to identify markdown link click issue

// import { Prec } from '@codemirror/state'
// import { EditorView } from '@codemirror/view'
// import { createLinkSaveHandler, getCurrentDisplayedTitle } from './linkCore.js'
// import { createEditLinkDialog } from './linkDialog.js'
// import { getLinkPreviewState } from './linkPreviewState.js'
// import {
//   EMAIL_REGEX,
//   MARKDOWN_LINK_REGEX,
//   URL_REGEX,
//   getLinkAtPosition,
//   selectLinkText
// } from './linkRegex.js'
// import { safeOpenEmail, safeOpenUrl } from './linkUtils.js'

// // Global editor view storage for native bridge communication
// let currentEditorView = null

// export const setCurrentEditorView = (view) => {
//   currentEditorView = view
// }

// export const getCurrentEditorView = () => {
//   return currentEditorView
// }

// // Helper function to check if click is on a preview card
// const isClickOnPreviewCard = (event) => {
//   const target = event.target
//   return target.closest('.cm-link-preview-card') !== null
// }

// // Helper function to check if a position is within a preview widget range
// const isPositionInPreviewWidget = (view, pos) => {
//   const line = view.state.doc.lineAt(pos)
//   const lineText = line.text
//   const posInLine = pos - line.from

//   // Check for markdown links that are in preview mode
//   const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
//   for (const match of markdownMatches) {
//     const linkText = match[1]
//     const linkUrl = match[2]
//     const linkStart = match.index
//     const linkEnd = linkStart + match[0].length

//     // If this is a preview link and position falls within its range
//     if (
//       getLinkPreviewState(linkText, linkUrl) &&
//       posInLine >= linkStart &&
//       posInLine < linkEnd
//     ) {
//       return {
//         isInWidget: true,
//         linkStart: line.from + linkStart,
//         linkEnd: line.from + linkEnd,
//         linkText,
//         linkUrl
//       }
//     }
//   }

//   return { isInWidget: false }
// }

// // Helper function to handle cursor placement near preview widgets
// const handleCursorNearPreview = (view, pos, event) => {
//   const line = view.state.doc.lineAt(pos)
//   const lineText = line.text
//   const posInLine = pos - line.from

//   // Check for markdown links that are in preview mode
//   const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
//   for (const match of markdownMatches) {
//     const linkText = match[1]
//     const linkUrl = match[2]
//     const linkStart = match.index
//     const linkEnd = linkStart + match[0].length
//     const absoluteLinkStart = line.from + linkStart
//     const absoluteLinkEnd = line.from + linkEnd

//     if (getLinkPreviewState(linkText, linkUrl)) {
//       // If clicking within or very close to the preview widget range
//       if (posInLine >= linkStart - 2 && posInLine <= linkEnd + 2) {
//         // Determine if click is closer to start or end of the widget
//         const distanceToStart = Math.abs(posInLine - linkStart)
//         const distanceToEnd = Math.abs(posInLine - linkEnd)

//         let targetPosition
//         if (distanceToStart <= distanceToEnd) {
//           // Place cursor before the link
//           targetPosition = absoluteLinkStart
//         } else {
//           // Place cursor after the link
//           targetPosition = absoluteLinkEnd
//         }

//         // Set the cursor position
//         view.dispatch({
//           selection: {
//             anchor: targetPosition,
//             head: targetPosition
//           }
//         })

//         return true
//       }
//     }
//   }

//   return false
// }

// // Send link context menu request to React Native
// const sendLinkContextMenuToNative = (linkInfo, event, view) => {
//   console.log('📱 Sending context menu request to React Native', linkInfo)

//   if (window.ReactNativeWebView) {
//     const message = {
//       type: 'SHOW_LINK_CONTEXT_MENU',
//       payload: {
//         linkInfo: {
//           type: linkInfo.type,
//           text: linkInfo.text,
//           url: linkInfo.url,
//           position: linkInfo.position
//         },
//         coordinates: {
//           x: event.clientX || 0,
//           y: event.clientY || 0
//         }
//       }
//     }

//     window.ReactNativeWebView.postMessage(JSON.stringify(message))
//   } else {
//     console.warn('⚠️ ReactNativeWebView not available')
//   }
// }

// // Handle edit link action from React Native
// const handleEditLinkFromNative = (linkInfo) => {
//   console.log('✏️ Handling edit link from native', linkInfo)

//   const view = getCurrentEditorView()

//   if (!view) {
//     console.error('❌ No editor view available for edit action')
//     return
//   }

//   // Get current preview state
//   const currentPreviewState =
//     linkInfo.type === 'markdown'
//       ? getLinkPreviewState(linkInfo.text, linkInfo.url)
//       : false

//   // Use current displayed title for preview links
//   const currentDisplayedTitle = getCurrentDisplayedTitle(linkInfo, view)

//   const linkInfoWithPreview = {
//     ...linkInfo,
//     text: currentDisplayedTitle,
//     isPreview: currentPreviewState
//   }

//   createEditLinkDialog(
//     linkInfoWithPreview,
//     view,
//     createLinkSaveHandler(linkInfo, view, null),
//     null
//   )
// }

// // Handle link actions sent from React Native
// const handleNativeLinkAction = (payload) => {
//   const { action, linkInfo } = payload
//   console.log(`🎯 Handling native link action: ${action}`, linkInfo)

//   switch (action) {
//     case 'open_email':
//       safeOpenEmail(linkInfo.url)
//       break

//     case 'open_url':
//       safeOpenUrl(linkInfo.url)
//       break

//     case 'copy_email':
//     case 'copy_url':
//     case 'copy_text':
//       console.log(`📋 Copy action handled natively: ${action}`)
//       break

//     case 'edit_link':
//       handleEditLinkFromNative(linkInfo)
//       break

//     default:
//       console.warn('❓ Unknown link action:', action)
//   }
// }

// // Setup native bridge listeners
// const setupNativeBridge = () => {
//   console.log('🌉 Setting up native bridge listeners')

//   window.addEventListener('message', (event) => {
//     try {
//       const data = JSON.parse(event.data)

//       if (data.type === 'LINK_ACTION') {
//         handleNativeLinkAction(data.payload)
//       }
//     } catch (error) {
//       console.warn('⚠️ Failed to parse message from React Native:', error)
//     }
//   })
// }

// // Main click handler with extensive debugging
// export const linkClickHandler = EditorView.domEventHandlers({
//   click: (event, view) => {
//     setCurrentEditorView(view)

//     // Only handle left clicks
//     if (event.button !== 0) return false

//     // Debug logging
//     console.log('=== CLICK DEBUG START ===')
//     console.log('Click event target:', event.target)
//     console.log('Target className:', event.target.className)
//     console.log('Target tagName:', event.target.tagName)
//     if (event.target.parentElement) {
//       console.log('Parent className:', event.target.parentElement.className)
//     }

//     // IMPORTANT: Skip if click is on a preview card
//     if (isClickOnPreviewCard(event)) {
//       console.log('👆 Click on preview card detected - skipping link handler')
//       return false
//     }

//     // Check if we clicked on an element with cm-markdown-link-text class
//     const target = event.target
//     let linkTextElement = null

//     if (
//       target.classList &&
//       target.classList.contains('cm-markdown-link-text')
//     ) {
//       linkTextElement = target
//       console.log('Found cm-markdown-link-text on target')
//     } else if (
//       target.parentElement &&
//       target.parentElement.classList &&
//       target.parentElement.classList.contains('cm-markdown-link-text')
//     ) {
//       linkTextElement = target.parentElement
//       console.log('Found cm-markdown-link-text on parent')
//     } else {
//       // Check if we're inside a span with the class
//       let currentElement = target
//       while (currentElement && currentElement !== view.contentDOM) {
//         if (
//           currentElement.classList &&
//           currentElement.classList.contains('cm-markdown-link-text')
//         ) {
//           linkTextElement = currentElement
//           console.log('Found cm-markdown-link-text by traversing up')
//           break
//         }
//         currentElement = currentElement.parentElement
//       }
//     }

//     if (linkTextElement) {
//       console.log('👆 Click on markdown link text element detected')

//       // Get the position and find the corresponding markdown link
//       const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
//       console.log('Position from coords:', pos)

//       if (pos !== null) {
//         const line = view.state.doc.lineAt(pos)
//         const lineText = line.text
//         console.log('Line text:', lineText)
//         console.log('Line from:', line.from, 'Line to:', line.to)

//         // Find which markdown link this click belongs to
//         const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
//         console.log('Found markdown matches:', markdownMatches.length)

//         for (const match of markdownMatches) {
//           const linkStart = line.from + match.index
//           const textStart = linkStart + 1 // After [
//           const textEnd = textStart + match[1].length // Before ]

//           console.log('Checking match:', {
//             text: match[1],
//             url: match[2],
//             linkStart,
//             textStart,
//             textEnd,
//             clickPos: pos
//           })

//           // Check if our click position falls within this link's text range
//           if (pos >= textStart && pos < textEnd) {
//             const linkUrl = match[2]
//             const linkText = match[1]

//             const isPreview = getLinkPreviewState(linkText, linkUrl)
//             console.log('Is preview link?', isPreview)

//             // Make sure this isn't a preview link (those handle clicks differently)
//             if (!isPreview) {
//               console.log('Opening markdown link:', linkUrl)
//               event.preventDefault()
//               event.stopPropagation()

//               // Open the URL
//               if (
//                 linkUrl.match(
//                   /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/
//                 ) ||
//                 linkUrl.startsWith('mailto:')
//               ) {
//                 safeOpenEmail(linkUrl.replace('mailto:', ''))
//               } else {
//                 safeOpenUrl(linkUrl)
//               }
//               return true
//             } else {
//               console.log('Skipping because it is a preview link')
//             }
//           }
//         }
//         console.log('No matching markdown link found for position')
//       }
//     } else {
//       console.log('Not a markdown link text element')
//     }

//     console.log('=== CLICK DEBUG END ===')

//     // Check for text selection
//     const selection = view.state.selection.main
//     if (!selection.empty || view._isSelecting) {
//       return false
//     }

//     const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
//     if (pos === null) return false

//     // Check if position is within a preview widget range
//     const previewCheck = isPositionInPreviewWidget(view, pos)
//     if (previewCheck.isInWidget) {
//       console.log(
//         '👆 Click position is within preview widget - handling cursor placement'
//       )

//       // Handle cursor placement near preview widgets
//       if (handleCursorNearPreview(view, pos, event)) {
//         event.preventDefault()
//         event.stopPropagation()
//         return true
//       }

//       return false
//     }

//     const line = view.state.doc.lineAt(pos)
//     const lineText = line.text
//     const posInLine = pos - line.from

//     // Check for markdown links (for clicks on brackets or other syntax parts)
//     const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
//     for (const mdMatch of markdownMatches) {
//       if (
//         posInLine >= mdMatch.index &&
//         posInLine < mdMatch.index + mdMatch[0].length
//       ) {
//         const linkUrl = mdMatch[2]
//         event.preventDefault()
//         event.stopPropagation()

//         // Single click opens the link
//         if (
//           linkUrl.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/) ||
//           linkUrl.startsWith('mailto:')
//         ) {
//           safeOpenEmail(linkUrl.replace('mailto:', ''))
//         } else {
//           safeOpenUrl(linkUrl)
//         }
//         return true
//       }
//     }

//     // Check for plain URLs
//     URL_REGEX.lastIndex = 0
//     let match
//     while ((match = URL_REGEX.exec(lineText)) !== null) {
//       if (
//         posInLine >= match.index &&
//         posInLine < match.index + match[0].length
//       ) {
//         const isInMarkdownLink = markdownMatches.some(
//           (mdMatch) =>
//             match.index >= mdMatch.index &&
//             match.index < mdMatch.index + mdMatch[0].length
//         )

//         if (!isInMarkdownLink) {
//           event.preventDefault()
//           event.stopPropagation()

//           // Double-click for edit, single click to open
//           if (event.detail === 2) {
//             const linkInfo = {
//               type: 'url',
//               url: match[0],
//               text: match[0],
//               position: {
//                 start: line.from + match.index,
//                 end: line.from + match.index + match[0].length
//               }
//             }
//             handleEditLinkFromNative(linkInfo)
//           } else {
//             safeOpenUrl(match[0])
//           }
//           return true
//         }
//       }
//     }

//     // Check for emails
//     EMAIL_REGEX.lastIndex = 0
//     while ((match = EMAIL_REGEX.exec(lineText)) !== null) {
//       if (
//         posInLine >= match.index &&
//         posInLine < match.index + match[0].length
//       ) {
//         const isInMarkdownLink = markdownMatches.some(
//           (mdMatch) =>
//             match.index >= mdMatch.index &&
//             match.index < mdMatch.index + mdMatch[0].length
//         )

//         if (!isInMarkdownLink) {
//           event.preventDefault()
//           event.stopPropagation()
//           safeOpenEmail(match[0])
//           return true
//         }
//       }
//     }

//     return false
//   },

//   // Mouse tracking for selection detection
//   mousedown: (event, view) => {
//     setCurrentEditorView(view)

//     // Skip if click is on a preview card
//     if (isClickOnPreviewCard(event)) {
//       return false
//     }

//     view._isSelecting = false
//     view._mouseDownTime = Date.now()
//     view._mouseDownPos = { x: event.clientX, y: event.clientY }
//     return false
//   },

//   mousemove: (event, view) => {
//     if (view._mouseDownTime && Date.now() - view._mouseDownTime > 50) {
//       const moveDistance =
//         Math.abs(event.clientX - view._mouseDownPos.x) +
//         Math.abs(event.clientY - view._mouseDownPos.y)
//       if (moveDistance > 5) {
//         view._isSelecting = true
//       }
//     }
//     return false
//   },

//   mouseup: (event, view) => {
//     setTimeout(() => {
//       view._isSelecting = false
//       view._mouseDownTime = null
//       view._mouseDownPos = null
//     }, 10)
//     return false
//   }
// })

// // Context menu handler for right-click
// export const contextMenuHandler = EditorView.domEventHandlers({
//   contextmenu: (event, view) => {
//     setCurrentEditorView(view)

//     // Skip if right-click is on a preview card
//     if (isClickOnPreviewCard(event)) {
//       console.log(
//         '👆 Right-click on preview card detected - skipping context menu handler'
//       )
//       return false
//     }

//     const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
//     if (pos !== null) {
//       const linkInfo = getLinkAtPosition(view, pos)
//       if (linkInfo) {
//         console.log('🖱️ Right-click context menu on link', linkInfo)
//         event.preventDefault()
//         event.stopImmediatePropagation()

//         // Select the full link text
//         selectLinkText(view, pos, linkInfo)

//         // Send to React Native
//         sendLinkContextMenuToNative(linkInfo, event, view)
//         return true
//       }
//     }
//     return false
//   }
// })

// // Touch handlers for mobile long press - WITH HAPTIC FEEDBACK
// export const touchHandler = EditorView.domEventHandlers({
//   touchstart: (event, view) => {
//     setCurrentEditorView(view)
//     view._touchStartTime = Date.now()
//     view._touchStartPos = {
//       x: event.touches[0].clientX,
//       y: event.touches[0].clientY
//     }
//     view._hasMoved = false

//     // Check if we're touching a pencil icon
//     const target = event.target
//     if (
//       target &&
//       (target.closest('.cm-markdown-link-pencil') ||
//         target.classList.contains('cm-markdown-link-pencil'))
//     ) {
//       // Let the PencilWidget or UrlReplacementWidget handle the touch event
//       return false
//     }

//     // Skip if touch is on a preview card
//     if (isClickOnPreviewCard(event)) {
//       console.log('👆 Touch on preview card detected - skipping touch handler')
//       return false
//     }

//     // Continue with existing touch handling for links
//     const pos = view.posAtCoords({
//       x: event.touches[0].clientX,
//       y: event.touches[0].clientY
//     })

//     if (pos !== null) {
//       const linkInfo = getLinkAtPosition(view, pos)
//       if (linkInfo) {
//         view._potentialLinkTouch = linkInfo
//         view._touchPos = pos

//         console.log('👆 Touch started on link - preventing default selection')
//         // Prevent iOS text selection for links
//         event.preventDefault()

//         // Set up haptic feedback timer
//         view._hapticTimer = setTimeout(() => {
//           if (!view._hasMoved && view._potentialLinkTouch) {
//             console.log(
//               '👆 Long press threshold reached - triggering haptic feedback'
//             )

//             if (window.ReactNativeWebView) {
//               window.ReactNativeWebView.postMessage(
//                 JSON.stringify({
//                   type: 'HAPTIC_FEEDBACK',
//                   style: 'medium'
//                 })
//               )
//             }

//             view._hapticTriggered = true
//           }
//         }, 500)
//       }
//     }

//     return false
//   },

//   touchmove: (event, view) => {
//     if (view._touchStartPos) {
//       const moveDistance =
//         Math.abs(event.touches[0].clientX - view._touchStartPos.x) +
//         Math.abs(event.touches[0].clientY - view._touchStartPos.y)
//       if (moveDistance > 10) {
//         view._hasMoved = true
//         // Clear potential link touch and haptic timer if we've moved too much
//         view._potentialLinkTouch = null
//         if (view._hapticTimer) {
//           clearTimeout(view._hapticTimer)
//           view._hapticTimer = null
//         }
//       }
//     }
//     return false
//   },

//   touchend: (event, view) => {
//     // Clear the haptic timer if it's still running
//     if (view._hapticTimer) {
//       clearTimeout(view._hapticTimer)
//       view._hapticTimer = null
//     }

//     const touchDuration = Date.now() - (view._touchStartTime || 0)

//     // Long press detection (500ms+ and minimal movement)
//     if (touchDuration >= 500 && !view._hasMoved && view._potentialLinkTouch) {
//       console.log('👆 Long press detected on link', touchDuration)

//       event.preventDefault()
//       event.stopPropagation()

//       // Clear any iOS default selection that might have started
//       if (window.getSelection) {
//         window.getSelection().removeAllRanges()
//       }

//       // Ensure editor focus and select the link text
//       view.focus()
//       selectLinkText(view, view._touchPos, view._potentialLinkTouch)

//       // Send to React Native
//       sendLinkContextMenuToNative(view._potentialLinkTouch, event, view)

//       // Reset tracking
//       view._touchStartTime = null
//       view._touchStartPos = null
//       view._hasMoved = false
//       view._potentialLinkTouch = null
//       view._touchPos = null
//       view._hapticTriggered = false

//       return true
//     }

//     // NEW: Handle regular tap on markdown link
//     if (touchDuration < 500 && !view._hasMoved && view._potentialLinkTouch) {
//       console.log('👆 Regular tap on link detected', touchDuration)

//       const linkInfo = view._potentialLinkTouch

//       // Check if it's a markdown link that's not in preview mode
//       if (
//         linkInfo.type === 'markdown' &&
//         !getLinkPreviewState(linkInfo.text, linkInfo.url)
//       ) {
//         console.log('Opening markdown link from tap:', linkInfo.url)
//         event.preventDefault()
//         event.stopPropagation()

//         // Open the URL
//         if (
//           linkInfo.url.match(
//             /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/
//           ) ||
//           linkInfo.url.startsWith('mailto:')
//         ) {
//           safeOpenEmail(linkInfo.url.replace('mailto:', ''))
//         } else {
//           safeOpenUrl(linkInfo.url)
//         }

//         // Reset tracking
//         view._touchStartTime = null
//         view._touchStartPos = null
//         view._hasMoved = false
//         view._potentialLinkTouch = null
//         view._touchPos = null
//         view._hapticTriggered = false

//         return true
//       }
//     }

//     // Reset tracking
//     view._touchStartTime = null
//     view._touchStartPos = null
//     view._hasMoved = false
//     view._potentialLinkTouch = null
//     view._touchPos = null
//     view._hapticTriggered = false
//     return false
//   }
// })

// // High priority handler combining context menu and touch
// export const highPriorityHandler = Prec.highest([
//   contextMenuHandler,
//   touchHandler
// ])

// // Initialize native bridge on module load
// console.log('🚀 Initializing link handlers with native bridge')
// setupNativeBridge()

// // Test native bridge connection
// setTimeout(() => {
//   if (window.ReactNativeWebView) {
//     console.log('✅ ReactNativeWebView detected')
//     window.ReactNativeWebView.postMessage(
//       JSON.stringify({
//         type: 'console',
//         level: 'info',
//         message: 'Link handlers initialized successfully',
//         timestamp: new Date().toISOString()
//       })
//     )
//   } else {
//     console.log('⚠️ ReactNativeWebView not detected - running in browser mode')
//   }
// }, 1000)

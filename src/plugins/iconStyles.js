// // plugins/iconStyles.js - Styling for icon widgets

// import { EditorView } from '@codemirror/view'

// export const iconStyles = EditorView.theme({
//   '.cm-inline-icon-button': {
//     '&:hover': {
//       // backgroundColor: '#f3f4f6 !important',
//       transform: 'scale(1.05)'
//     },
//     '&:active': {
//       // backgroundColor: '#e5e7eb !important',
//       transform: 'scale(0.95)'
//     },
//     '&:focus': {
//       // outline: '2px solid #3b82f6',
//       outlineOffset: '2px'
//     }
//   },

//   // Ensure icons don't break text flow
//   '.cm-line': {
//     '& .cm-inline-icon-button': {
//       verticalAlign: 'middle',
//       lineHeight: '1'
//     }
//   },

//   // Style for different icon types
//   '.cm-inline-icon-button[data-icon="google-doc"]': {
//     '& i': {
//       color: '#059669' // Green color for document icons
//     },
//     '&:hover i': {
//       color: '#047857'
//     }
//   }
// })

// // Add to your main extensions array
// export const iconExtensionsWithStyles = [iconStyles, ...iconExtensions]

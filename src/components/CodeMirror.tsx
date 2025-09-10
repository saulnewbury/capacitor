'use client'

import React, { useEffect, useRef } from 'react'

// CodeMirror core
import { EditorState, EditorSelection, Extension } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorView, drawSelection, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'

// Language support
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { LanguageDescription } from '@codemirror/language' // Add this line

// Custom code block extensions
import { codeBlockExtensions } from '@/plugins/codeBlockExtension'

// Other plugins
import { gistLight } from '@/themes/gistLight'
import { commonStyles } from '@/themes/commonStyles'
import { createTextFont, createCodeFont } from '@/themes/fonts'

import { headingStyling } from '@/plugins/headingStyling'
import { headingBackspace } from '@/plugins/headingBackspace'
import { headingContentBackspace } from '@/plugins/headingContentBackspace'
import { headingOnEnter } from '@/plugins/headingOnEnter'
import { headingLeftGuard } from '@/plugins/headingLeftGuard'
import { headingShortcuts } from '@/plugins/headingShortcut'
import { headingCmdLeft } from '@/plugins/headingCmdLeft'
import { headingSelectionDelete } from '@/plugins/headingSelectionDelete'
import { headingSelectionGuard } from '@/plugins/headingSelectionGuard'
import { headingVerticalGuard } from '@/plugins/headingVerticalGuard'
import { headingClickGuard } from '@/plugins/headingClickGuard'

import { syntaxConceal } from '@/plugins/syntaxConceal'
import { richTextStyling } from '@/plugins/richTextStyling'
import { tagExtensions } from '@/plugins/tagStyling'

import { listCopyTransform } from '@/plugins/listCopyTransform'
import { listPasteTransform } from '@/plugins/listPasteTransform'
import { listVerticalNavigation } from '@/plugins/listVerticalNavigation'
import { listItemBackspace } from '@/plugins/listItemBackspace'
import { skipWidgetBufferKeymap } from '@/plugins/listSkipPastBullet'
import { createListIndentPersistence } from '@/plugins/listIndentPersistence'
import { renumberOrderedLists } from '@/plugins/listRenumbering'
import {
  smartListKeymap,
  listStructureDecoration,
  listIndentState
} from '@/plugins/listStructure'

// General
import { lineStartNavigation } from '@/plugins/lineStartNavigation'
import { smartTabHandler } from '@/plugins/smartTabHandler'
import { tabNavigation } from '@/plugins/tabNavigation'
import { tabEnterHandler } from '@/plugins/tabEnterHandler'

import { linkExtensions } from '@/plugins/linkStyling'

import { promptFieldExtensions } from '@/plugins/promptFieldExtension'
import { textBubbleExtensions } from '@/plugins/textBubbleStyling'

export default function CodeMirror(): JSX.Element {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const iOSKeyboardExtension = EditorView.contentAttributes.of({
    autocorrect: 'on',
    autocapitalize: 'sentences',
    spellcheck: 'true',
    'data-gramm': 'false', // Disable Grammarly if present
    inputmode: 'text'
  })

  const iOSAttributeHandler = EditorView.domEventHandlers({
    focus: (event, view) => {
      // Ensure the contenteditable element has the right attributes
      const contentDOM = view.contentDOM
      if (contentDOM) {
        contentDOM.setAttribute('autocorrect', 'on')
        contentDOM.setAttribute('autocapitalize', 'sentences')
        contentDOM.setAttribute('spellcheck', 'true')
        contentDOM.setAttribute('inputmode', 'text')
      }
      return false
    }
  })

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return

    try {
      // Define supported languages for code blocks
      const supportedLanguages: LanguageDescription[] = [
        LanguageDescription.of({
          name: 'javascript',
          alias: ['js', 'javascript'],
          support: javascript()
        }),
        LanguageDescription.of({
          name: 'python',
          alias: ['py', 'python'],
          support: python()
        })
        // Add more languages as needed
      ]

      const extensions: Extension[] = [
        // 1. Markdown parser with properly configured code languages
        markdown({
          codeLanguages: supportedLanguages,
          defaultCodeLanguage: javascript()
        }),

        iOSKeyboardExtension,
        iOSAttributeHandler,

        // 2. Context menu extension
        // contextMenuExtension,

        // 3. Loading widget field (add early in extensions)
        // loadingWidgetField,

        // 4. Code block extensions
        codeBlockExtensions,

        // 5. Prompt extensions
        ...promptFieldExtensions,
        ...textBubbleExtensions,
        // ...iconExtensions,

        // 6. Conceal and rich-text styling
        syntaxConceal,
        richTextStyling,

        // 7. Tag styling
        tagExtensions,

        // linkExtensions,

        // 8. Heading-related extensions
        headingStyling,
        ...headingClickGuard,
        Prec.high(headingSelectionDelete),
        Prec.high(tabEnterHandler),
        Prec.high(headingBackspace),
        Prec.high(headingOnEnter),
        Prec.high(headingShortcuts),
        Prec.high(headingContentBackspace),
        Prec.high(headingCmdLeft),

        // 9. List-handling extensions
        Prec.high(listItemBackspace),
        Prec.high(lineStartNavigation),
        Prec.high(tabNavigation),
        Prec.high(smartTabHandler),
        Prec.high(listVerticalNavigation),

        // 10. Line wrapping
        EditorView.lineWrapping,

        // 11. Keymaps
        Prec.high(smartListKeymap),
        Prec.high(skipWidgetBufferKeymap),
        keymap.of([...defaultKeymap, ...historyKeymap]),

        // 12. List transforms and persistence
        listIndentState,
        listStructureDecoration,
        // listWrappingStyles,
        // listTextWrappingDecoration,
        listPasteTransform(),
        listCopyTransform(),
        createListIndentPersistence(listIndentState),
        renumberOrderedLists(),

        // drawSelection({ cursorBlinkRate: 800, drawRangeCursor: true }),

        // 13. History, theme UI, and selection styling
        history(),
        commonStyles,
        createCodeFont('monospace'),
        createTextFont('Nunito Sans'),
        gistLight

        // 14. Update listener
        // EditorView.updateListener.of((update) => {
        //   if (update.docChanged) {
        //     const content = update.state.doc.toString()
        //     window.ReactNativeWebView?.postMessage(
        //       JSON.stringify({ type: 'content', content })
        //     )
        //   }
        // })
      ]

      // Initial document content
      const initialDoc = '# '

      // Position cursor after the heading marker
      const startState = EditorState.create({
        doc: initialDoc,
        selection: EditorSelection.cursor(2),
        extensions
      })

      viewRef.current = new EditorView({
        state: startState,
        parent: editorRef.current
      })

      viewRef.current.focus()
    } catch (error) {
      console.error('Error creating editor:', error)
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [])

  return (
    <div className='w-full h-full relative overflow-hidden'>
      <div
        className='absolute inset-0 px-[30px] overflow-y-scroll overflow-x-hidden'
        style={{
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div ref={editorRef} className='min-h-full w-full markdown-editor' />
      </div>
    </div>
  )
}

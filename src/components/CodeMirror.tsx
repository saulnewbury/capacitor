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
import { promptExtensions } from '@/plugins/promptExtension'

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

export default function CodeMirror(): JSX.Element {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

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

        // 2. Code block extensions
        codeBlockExtensions,

        // 3. Prompt extensions
        promptExtensions,

        // 4. Conceal and rich-text styling
        syntaxConceal,
        richTextStyling,

        // 5. Tag styling
        tagExtensions,

        linkExtensions,

        // 6. Heading-related extensions
        headingStyling,
        ...headingClickGuard,
        Prec.high(tabEnterHandler),
        Prec.high(headingOnEnter),
        Prec.high(headingShortcuts),
        Prec.high(headingContentBackspace),
        Prec.high(headingCmdLeft),

        // 7. List-handling extensions
        Prec.high(listItemBackspace),
        Prec.high(lineStartNavigation),
        Prec.high(tabNavigation),
        Prec.high(smartTabHandler),
        Prec.high(listVerticalNavigation),

        // 8. Line wrapping
        EditorView.lineWrapping,

        // 9. Keymaps
        Prec.high(smartListKeymap),
        Prec.high(skipWidgetBufferKeymap),
        keymap.of([...defaultKeymap, ...historyKeymap]),

        // 10. List transforms and persistence
        listIndentState,
        listStructureDecoration,
        listPasteTransform(),
        listCopyTransform(),
        createListIndentPersistence(listIndentState),
        renumberOrderedLists(),

        // 11. History, theme UI, and selection styling
        history(),
        commonStyles,
        gistLight,
        createCodeFont('monospace'),
        createTextFont('Nunito Sans'),
        drawSelection({ cursorBlinkRate: 800, drawRangeCursor: true }),

        // 12. Update listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString()
            // console.log('Content:', content)
          }
        })
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
    <div className='w-full'>
      <div
        ref={editorRef}
        className='h-full w-[100%] overflow-visible markdown-editor outline-none'
      />
    </div>
  )
}

// plugins/headingStyling.js
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin } from '@codemirror/view'
import { isInsidePromptBlock } from './promptExtension'

export const headingStyling = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view)
    }
    update(update) {
      // Always rebuild decorations on update, even if no specific changes
      this.decorations = this.buildDecorations(update.view)
    }
    buildDecorations(view) {
      const builder = new RangeSetBuilder()
      const tree = syntaxTree(view.state)
      const doc = view.state.doc

      tree.iterate({
        enter: ({ name, from }) => {
          if (!name.startsWith('ATXHeading')) return

          const line = doc.lineAt(from)

          // Skip heading styling if inside a prompt block
          if (isInsidePromptBlock(view.state, line.from)) {
            return
          }

          const text = line.text
          const m = text.match(/^(#{1,6})\s/)
          if (!m) return

          const level = m[1].length
          const prefixLen = level + 1
          const hideEnd = line.from + prefixLen
          const contentEnd = line.to
          const selection = view.state.selection.main

          // Only treat “focused” when the editor itself has browser focus
          const editorHasBrowserFocus = view.hasFocus

          const isFocused =
            editorHasBrowserFocus &&
            ((selection.empty &&
              selection.head >= line.from &&
              selection.head <= contentEnd) ||
              (!selection.empty &&
                selection.from <= contentEnd &&
                selection.to >= line.from))

          builder.add(
            line.from,
            contentEnd,
            Decoration.mark({
              class:
                `cm-heading-${level} cm-heading` +
                (isFocused ? ' cm-heading-focused' : ''),
              inclusive: true
            })
          )

          // Hide the hashes+space
          builder.add(line.from, hideEnd, Decoration.replace({}))
        }
      })

      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations }
)

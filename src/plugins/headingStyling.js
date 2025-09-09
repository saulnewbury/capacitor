// plugins/headingStyling.js
import { ViewPlugin, Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { isInsidePromptBlock } from './promptExtension'

export const headingStyling = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view)
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
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
          const head = view.state.selection.main.head

          // 1) Mark the entire heading span, and only tag as "focused"
          //    when cursor is between col 0 and end‑of‑line
          const isFocused = head >= line.from && head <= contentEnd

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

          // 2) Hide the hashes+space
          builder.add(line.from, hideEnd, Decoration.replace({}))
        }
      })

      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations }
)

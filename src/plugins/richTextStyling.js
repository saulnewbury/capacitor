import { ViewPlugin, Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

export const richTextStyling = ViewPlugin.fromClass(
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

      tree.iterate({
        enter: ({ name, from, to }) => {
          if (name === 'Emphasis') {
            builder.add(from, to, Decoration.mark({ class: 'cm-em' }))
          }

          if (name === 'StrongEmphasis') {
            builder.add(from, to, Decoration.mark({ class: 'cm-strong' }))
          }
        }
      })

      return builder.finish()
    }
  },
  {
    decorations: (plugin) => plugin.decorations
  }
)

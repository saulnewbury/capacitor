import { ViewPlugin, Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

export const syntaxConceal = ViewPlugin.fromClass(
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
      const cursor = view.state.selection.main.head

      // Track processed ranges to avoid duplicate processing of nested elements
      const processedRanges = new Set()

      tree.iterate({
        enter: ({ name, from, to, node }) => {
          // Handle StrongEmphasis, Emphasis, and their combination
          if (name === 'StrongEmphasis' || name === 'Emphasis') {
            const isCursorNear = cursor >= from && cursor <= to // near the whole span

            // Process all marker nodes (StrongMark, EmphasisMark) within this element
            node.cursor().iterate((child) => {
              if (
                child.name === 'StrongMark' ||
                child.name === 'EmphasisMark'
              ) {
                const markerFrom = child.from
                const markerTo = child.to

                // Create a unique key for this range to avoid duplicate processing
                const rangeKey = `${markerFrom}-${markerTo}`

                // Skip if we've already processed this exact range
                if (processedRanges.has(rangeKey)) return
                processedRanges.add(rangeKey)

                if (isCursorNear) {
                  builder.add(
                    markerFrom,
                    markerTo,
                    Decoration.mark({ class: 'fade-syntax' })
                  )
                } else {
                  builder.add(markerFrom, markerTo, Decoration.replace({}))
                }
              }
            })
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

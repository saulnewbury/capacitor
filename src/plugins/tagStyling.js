import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin } from '@codemirror/view'

// Regular expression to match #tagName patterns (including forward slashes)
// Don't match if there's a # immediately before or after, or if this # is followed by content and then ##
const TAG_REGEX = /(?<![#])#[a-zA-Z0-9_\/-]+(?!#)(?![^#\n]*##)/g

// Regex to match closed tags: #content# where:
// - Content cannot start with a space
// - Content cannot end with a space
// - No ## sequence within the tag
// - No # immediately after the closing #
// This prevents matching things like "# #" or "#content #" or "# content#"
const CLOSED_TAG_REGEX = /#[^#\s][^#\n]*[^#\s]#(?!#)|#[^#\s]#(?!#)/g

// Regex for validating a tag character after a hash
const VALID_TAG_CHAR_REGEX = /[a-zA-Z0-9_\/-]/

// Effect to track active tag creation
export const setActiveTagEffect = StateEffect.define()

// State field to track active tagging status
export const activeTagState = StateField.define({
  create() {
    return {
      active: false,
      from: null,
      allowSpaces: false // Track if this tag allows spaces (closed tag)
    }
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setActiveTagEffect)) {
        return effect.value
      }
    }
    if (tr.docChanged && value.active) {
      const newFrom = tr.changes.mapPos(value.from)
      const head = tr.selection?.main.head || tr.newSelection?.main.head
      if (head) {
        const line = tr.newDoc.lineAt(head)
        const beforeCursor = tr.newDoc.sliceString(newFrom, head)
        if (beforeCursor.startsWith('#')) {
          const tagContent = beforeCursor.substring(1)
          if (value.allowSpaces) {
            // For tags that allow spaces, just check it's not empty and doesn't end with space
            if (tagContent.length > 0 && !tagContent.endsWith(' ')) {
              return { active: true, from: newFrom, allowSpaces: true }
            }
          } else {
            // Original logic for simple tags
            if (
              tagContent.length > 0 &&
              /^[a-zA-Z0-9_\/-]+$/.test(tagContent)
            ) {
              return { active: true, from: newFrom, allowSpaces: false }
            }
          }
        }
      }
      return { active: false, from: null, allowSpaces: false }
    }
    return value
  }
})

// Helper function to find all tags (both simple and closed) at cursor position
function findAllTagsAtCursor(state, pos) {
  const line = state.doc.lineAt(pos)
  const lineText = line.text

  // Check closed tags first (more specific)
  const closedMatches = [...lineText.matchAll(CLOSED_TAG_REGEX)]
  for (const match of closedMatches) {
    const tagStart = line.from + match.index
    const tagEnd = tagStart + match[0].length
    if (pos > tagStart && pos <= tagEnd) {
      return { start: tagStart, end: tagEnd, type: 'closed' }
    }
  }

  // Check simple tags
  const simpleMatches = [...lineText.matchAll(TAG_REGEX)]
  for (const match of simpleMatches) {
    const tagStart = line.from + match.index
    const tagEnd = tagStart + match[0].length
    if (pos > tagStart && pos <= tagEnd) {
      return { start: tagStart, end: tagEnd, type: 'simple' }
    }
  }

  return null
}

// Main styling plugin
export const tagStyling = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view)
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }
    // Replace the buildDecorations method in your tagStyling.js with this updated version:

    buildDecorations(view) {
      const builder = new RangeSetBuilder()
      const { state } = view
      const cursor = state.selection.main.head
      const activeTag = state.field(activeTagState)

      // Collect all decorations first, then sort them
      const decorations = []

      for (let { from, to } of view.visibleRanges) {
        let pos = from
        while (pos <= to) {
          const line = state.doc.lineAt(pos)
          const lineText = line.text

          // Track all tag ranges to avoid overlaps
          const processedRanges = []

          // Find all ## sequences in the line to create exclusion zones
          const doubleHashPositions = []
          let searchStart = 0
          while (true) {
            const doubleHashIndex = lineText.indexOf('##', searchStart)
            if (doubleHashIndex === -1) break
            doubleHashPositions.push(doubleHashIndex)
            searchStart = doubleHashIndex + 2
          }

          // Helper function to check if a position is in an exclusion zone
          const isInExclusionZone = (startPos, endPos) => {
            for (const doubleHashPos of doubleHashPositions) {
              // Find the start of the problematic tag (look backwards for #)
              let problemTagStart = doubleHashPos
              while (
                problemTagStart > 0 &&
                lineText.charAt(problemTagStart - 1) !== ' ' &&
                lineText.charAt(problemTagStart - 1) !== '\n'
              ) {
                problemTagStart--
                if (lineText.charAt(problemTagStart) === '#') {
                  break
                }
              }

              // Find the end of the problematic sequence (look forwards past ##)
              let problemEnd = doubleHashPos + 2
              while (
                problemEnd < lineText.length &&
                lineText.charAt(problemEnd) !== ' ' &&
                lineText.charAt(problemEnd) !== '\n'
              ) {
                problemEnd++
              }

              // Check if our tag overlaps with this problematic area
              const tagStartInLine = startPos - line.from
              const tagEndInLine = endPos - line.from

              if (
                !(
                  tagEndInLine <= problemTagStart ||
                  tagStartInLine >= problemEnd
                )
              ) {
                return true
              }
            }
            return false
          }

          // Handle active tag being created
          if (
            activeTag.active &&
            line.from <= activeTag.from &&
            line.to >= activeTag.from
          ) {
            let tagEnd = activeTag.from
            for (let i = activeTag.from - line.from; i < lineText.length; i++) {
              const char = lineText.charAt(i)
              if (!activeTag.allowSpaces) {
                if (
                  char === ' ' ||
                  (!VALID_TAG_CHAR_REGEX.test(char) && char !== '#')
                ) {
                  tagEnd = line.from + i
                  break
                }
              } else {
                if (char !== '#' || i === activeTag.from - line.from) {
                  continue
                }
                if (i > activeTag.from - line.from + 1) {
                  const prevChar = lineText.charAt(i - 1)
                  if (prevChar !== ' ') {
                    tagEnd = line.from + i + 1
                    break
                  }
                }
              }
              if (i === lineText.length - 1) {
                tagEnd = line.to
              }
            }

            // Only process active tag if it's not in an exclusion zone
            if (!isInExclusionZone(activeTag.from, tagEnd)) {
              processedRanges.push({ start: activeTag.from, end: tagEnd })

              decorations.push({
                from: activeTag.from,
                to: tagEnd,
                decoration: Decoration.mark({
                  class: 'cm-tag cm-tag-active',
                  inclusive: true
                })
              })

              decorations.push({
                from: activeTag.from,
                to: activeTag.from + 1,
                decoration: Decoration.mark({
                  class: 'cm-hash cm-hash-active',
                  inclusive: true
                })
              })

              if (activeTag.allowSpaces && tagEnd > activeTag.from + 1) {
                const lastChar = state.doc.sliceString(tagEnd - 1, tagEnd)
                const prevChar = state.doc.sliceString(tagEnd - 2, tagEnd - 1)
                if (lastChar === '#' && prevChar !== ' ') {
                  decorations.push({
                    from: tagEnd - 1,
                    to: tagEnd,
                    decoration: Decoration.mark({
                      class: 'cm-hash cm-hash-active',
                      inclusive: true
                    })
                  })
                }
              }
            }
          }

          // First, find all closed tags and add them to processed ranges
          const closedMatches = [...lineText.matchAll(CLOSED_TAG_REGEX)]
          for (const match of closedMatches) {
            const tagStart = line.from + match.index
            const tagEnd = tagStart + match[0].length

            const overlapsWithActive =
              activeTag.active &&
              !(
                tagEnd <= activeTag.from ||
                tagStart >= activeTag.from + (cursor - activeTag.from)
              )

            if (overlapsWithActive) continue

            // Skip if in exclusion zone
            if (isInExclusionZone(tagStart, tagEnd)) continue

            processedRanges.push({ start: tagStart, end: tagEnd })

            const isCursorInTag = cursor >= tagStart && cursor <= tagEnd

            decorations.push({
              from: tagStart,
              to: tagEnd,
              decoration: Decoration.mark({
                class: `cm-tag${isCursorInTag ? ' cm-tag-active' : ''}`,
                inclusive: true
              })
            })

            decorations.push({
              from: tagStart,
              to: tagStart + 1,
              decoration: Decoration.mark({
                class: `cm-hash${isCursorInTag ? ' cm-hash-active' : ''}`,
                inclusive: true
              })
            })

            decorations.push({
              from: tagEnd - 1,
              to: tagEnd,
              decoration: Decoration.mark({
                class: `cm-hash${isCursorInTag ? ' cm-hash-active' : ''}`,
                inclusive: true
              })
            })
          }

          // Then handle simple tags, but skip any that overlap with closed tags, active tag, or exclusion zones
          const simpleMatches = [...lineText.matchAll(TAG_REGEX)]
          for (const match of simpleMatches) {
            const tagStart = line.from + match.index
            const tagEnd = tagStart + match[0].length

            if (
              tagStart > line.from &&
              lineText.charAt(tagStart - line.from - 1) === '#'
            ) {
              console.log(
                `Skipping tag ${match[0]} at ${tagStart} due to preceding #`
              )
              continue
            }

            const overlapsWithProcessed = processedRanges.some(
              (range) => !(tagEnd <= range.start || tagStart >= range.end)
            )

            if (overlapsWithProcessed) continue

            // Skip if in exclusion zone
            if (isInExclusionZone(tagStart, tagEnd)) continue

            const isCursorInTag = cursor >= tagStart && cursor <= tagEnd

            decorations.push({
              from: tagStart,
              to: tagEnd,
              decoration: Decoration.mark({
                class: `cm-tag${isCursorInTag ? ' cm-tag-active' : ''}`,
                inclusive: true
              })
            })

            decorations.push({
              from: tagStart,
              to: tagStart + 1,
              decoration: Decoration.mark({
                class: `cm-hash${isCursorInTag ? ' cm-hash-active' : ''}`,
                inclusive: true
              })
            })
          }

          pos = line.to + 1
        }
      }

      decorations.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from
        if (a.to !== b.to) return a.to - b.to
        return 0
      })

      for (const { from, to, decoration } of decorations) {
        builder.add(from, to, decoration)
      }

      return builder.finish()
    }
  },
  {
    decorations: (plugin) => plugin.decorations
  }
)

// Helper function to find the current tag at cursor position
function findTagAtCursor(state, pos) {
  return findAllTagsAtCursor(state, pos)
}

// New function to handle closing hash
function handleClosingHash(state, view, from, content) {
  if (content !== '#') return false

  const line = state.doc.lineAt(from)
  const textBefore = state.doc.sliceString(line.from, from)

  const tagRegex = /#[\w/-]+/g
  const simpleMatches = [...textBefore.matchAll(tagRegex)]

  if (simpleMatches.length === 0) return false

  const lastMatch = simpleMatches[simpleMatches.length - 1]
  const tagStart = line.from + lastMatch.index
  const tagEnd = tagStart + lastMatch[0].length

  const spaceCheck = state.doc.sliceString(tagEnd, tagEnd + 3)
  if (spaceCheck !== '   ') return false

  const textAfterSpaces = state.doc.sliceString(tagEnd + 3, from)

  if (textAfterSpaces.endsWith(' ')) {
    return false
  }

  if (textAfterSpaces.length === 0) {
    return false
  }

  const tagText = state.doc.sliceString(tagStart, tagEnd)
  const newContent = tagText + ' ' + textAfterSpaces + '#'

  view.dispatch({
    changes: { from: tagStart, to: from, insert: newContent },
    selection: { anchor: tagStart + newContent.length },
    effects: setActiveTagEffect.of({
      active: false,
      from: null,
      allowSpaces: false
    }),
    userEvent: 'input.type'
  })

  return true
}

// Helper function to check if position is 3 spaces after a tag
function isThreeSpacesAfterTag(state, hashPos) {
  if (hashPos < 3) return false

  const threeCharsBefore = state.doc.sliceString(hashPos - 3, hashPos)
  if (threeCharsBefore !== '   ') return false

  const line = state.doc.lineAt(hashPos)
  const textUpToSpaces = state.doc.sliceString(line.from, hashPos - 3)

  const closedMatches = [...textUpToSpaces.matchAll(CLOSED_TAG_REGEX)]
  if (closedMatches.length > 0) {
    const lastClosedMatch = closedMatches[closedMatches.length - 1]
    const tagEnd = line.from + lastClosedMatch.index + lastClosedMatch[0].length
    if (tagEnd === hashPos - 3) return true
  }

  const simpleMatches = [...textUpToSpaces.matchAll(TAG_REGEX)]
  if (simpleMatches.length > 0) {
    const lastSimpleMatch = simpleMatches[simpleMatches.length - 1]
    const tagEnd = line.from + lastSimpleMatch.index + lastSimpleMatch[0].length
    if (tagEnd === hashPos - 3) return true
  }

  return false
}

function isImmediatelyAfterSpaces(state, pos) {
  if (pos === 0) return true

  const line = state.doc.lineAt(pos)
  if (pos === line.from) return true

  const charBefore = state.doc.sliceString(pos - 1, pos)
  if (charBefore === ' ') return true

  const textBefore = state.doc.sliceString(line.from, pos)

  const simpleMatches = [...textBefore.matchAll(TAG_REGEX)]
  if (simpleMatches.length > 0) {
    const lastMatch = simpleMatches[simpleMatches.length - 1]
    const tagEnd = line.from + lastMatch.index + lastMatch[0].length
    if (tagEnd === pos) return true
  }

  const closedMatches = [...textBefore.matchAll(CLOSED_TAG_REGEX)]
  if (closedMatches.length > 0) {
    const lastMatch = closedMatches[closedMatches.length - 1]
    const tagEnd = line.from + lastMatch.index + lastMatch[0].length
    if (tagEnd === pos) return true
  }

  return false
}

// Replace the tagCharacterHandler in your tagStyling.js with this updated version:

export const tagCharacterHandler = EditorView.inputHandler.of(
  (view, from, to, content) => {
    const { state } = view
    const activeTag = state.field(activeTagState)

    if (content === ' ' && activeTag.active) {
      // If user typed space immediately after the hash
      if (from === activeTag.from + 1) {
        const twoBefore = state.doc.sliceString(
          activeTag.from - 2,
          activeTag.from
        )
        if (twoBefore === '  ') {
          view.dispatch({
            changes: {
              // Remove the two spaces and the hash+typed space
              from: activeTag.from - 2,
              to: from,
              // Re-insert broken hash + space
              insert: '# '
            },
            selection: { anchor: activeTag.from - 1 },
            effects: setActiveTagEffect.of({
              active: false,
              from: null,
              allowSpaces: false
            }),
            userEvent: 'delete'
          })
          return true
        }
      }
    }

    const line = state.doc.lineAt(from)
    const pos = from - line.from

    if (handleClosingHash(state, view, from, content)) {
      return true
    }

    if (pos > 0 && line.text.charAt(pos - 1) === '#') {
      console.log(
        'Character after # detected:',
        content,
        'line text:',
        line.text,
        'pos:',
        pos
      )

      const lineText = line.text
      const closedMatches = [...lineText.matchAll(CLOSED_TAG_REGEX)]

      console.log('Closed matches found:', closedMatches.length, closedMatches)

      // Check if this # is actually the closing hash of a valid closed tag
      let isValidClosingHash = false
      for (const match of closedMatches) {
        const tagEnd = match.index + match[0].length
        console.log('Checking match:', match[0], 'tagEnd:', tagEnd, 'pos:', pos)
        if (tagEnd === pos) {
          isValidClosingHash = true

          if (content === '#') {
            console.log(
              'Hash after closing hash detected - inserting normally to break syntax'
            )

            view.dispatch({
              changes: { from, to, insert: '#' },
              selection: { anchor: from + 1 },
              effects: setActiveTagEffect.of({
                active: false,
                from: null,
                allowSpaces: false
              }),
              userEvent: 'input.type'
            })

            setTimeout(() => {
              view.dispatch({
                effects: setActiveTagEffect.of({
                  active: false,
                  from: null,
                  allowSpaces: false
                })
              })
            }, 0)

            return true
          }

          console.log('Input after closing hash detected:', content)
          view.dispatch({
            changes: { from, to, insert: '  ' + content },
            selection: { anchor: from + 3 },
            userEvent: 'input.type'
          })
          return true
        }
      }

      // If this # is not a valid closing hash, check if it's part of a ## sequence
      if (!isValidClosingHash) {
        const hashPosInLine = pos - 1 // pos of the #

        // Check if there's another # immediately before this one (creating ##)
        if (hashPosInLine > 0 && lineText.charAt(hashPosInLine - 1) === '#') {
          console.log(
            'Hash is part of ## sequence (## detected), treating as plain text'
          )
          view.dispatch({
            changes: { from, to, insert: content },
            selection: { anchor: from + content.length },
            effects: setActiveTagEffect.of({
              active: false,
              from: null,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
          return true
        }

        // Check if there's a space immediately before this #
        if (hashPosInLine > 0 && lineText.charAt(hashPosInLine - 1) === ' ') {
          console.log(
            'Hash has space before it, can potentially start a new tag'
          )
          // Fall through to regular tag initialization logic below
        } else {
          console.log(
            'Hash is not a closing hash and has no space before, treating as potential tag continuation'
          )
          // Fall through to regular tag initialization logic below
        }
      }
    }

    if (
      pos > 1 &&
      line.text.charAt(pos - 1) === ' ' &&
      line.text.charAt(pos - 2) === '#'
    ) {
      console.log(
        'Character one space after # detected:',
        content,
        'line text:',
        line.text,
        'pos:',
        pos
      )

      const lineText = line.text
      const closedMatches = [...lineText.matchAll(CLOSED_TAG_REGEX)]

      console.log(
        'Closed matches found (one space after):',
        closedMatches.length,
        closedMatches
      )

      // Check if the # two positions back is actually the closing hash of a valid closed tag
      for (const match of closedMatches) {
        const tagEnd = match.index + match[0].length
        console.log(
          'Checking match (one space after):',
          match[0],
          'tagEnd:',
          tagEnd,
          'pos - 1:',
          pos - 1
        )
        if (tagEnd === pos - 1) {
          console.log('Input one space after closing hash detected:', content)
          view.dispatch({
            changes: { from, to, insert: ' ' + content },
            selection: { anchor: from + 2 },
            userEvent: 'input.type'
          })
          return true
        }
      }
    }

    if (content === '#') {
      const charAfterCursor =
        to < state.doc.length ? state.doc.sliceString(to, to + 1) : ''
      const charBeforeCursor =
        from > 0 ? state.doc.sliceString(from - 1, from) : ''

      console.log(
        'Typing #, charBefore:',
        JSON.stringify(charBeforeCursor),
        'charAfter:',
        JSON.stringify(charAfterCursor)
      )

      // Check if this # would be immediately adjacent to another # (creating ##)
      const wouldCreateDoubleHash =
        charBeforeCursor === '#' || charAfterCursor === '#'

      if (wouldCreateDoubleHash) {
        console.log('Typing # would create ##, inserting as plain text')
        view.dispatch({
          changes: { from, to, insert: '#' },
          selection: { anchor: from + 1 },
          effects: setActiveTagEffect.of({
            active: false,
            from: null,
            allowSpaces: false
          }),
          userEvent: 'input.type'
        })
        return true
      }

      if (VALID_TAG_CHAR_REGEX.test(charAfterCursor)) {
        const hashPosInLine = from - line.from
        const needsIndentLineStart = hashPosInLine === 0
        const needsIndentAfterTag = isThreeSpacesAfterTag(state, from)
        const needsSpacingAfterText =
          from > 0 && !isImmediatelyAfterSpaces(state, from)

        // Check if there's exactly one space before the cursor
        const hasOneSpaceBefore = charBeforeCursor === ' '

        console.log(
          'VALID_TAG_CHAR case:',
          'needsSpacingAfterText:',
          needsSpacingAfterText,
          'hasOneSpaceBefore:',
          hasOneSpaceBefore,
          'needsIndentLineStart:',
          needsIndentLineStart,
          'needsIndentAfterTag:',
          needsIndentAfterTag
        )

        const needsIndent = needsIndentLineStart || needsIndentAfterTag
        const needsThreeSpaces = needsSpacingAfterText || hasOneSpaceBefore

        if (needsThreeSpaces) {
          console.log(
            'Applying three spaces logic, hasOneSpaceBefore:',
            hasOneSpaceBefore
          )
          const insertText = hasOneSpaceBefore ? '  #' : '   #'
          const deleteFrom = hasOneSpaceBefore ? from - 1 : from
          view.dispatch({
            changes: { from: deleteFrom, to: from, insert: insertText },
            selection: { anchor: deleteFrom + insertText.length },
            effects: setActiveTagEffect.of({
              active: true,
              from: deleteFrom + insertText.length - 1,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
          return true
        } else if (needsIndent) {
          view.dispatch({
            changes: { from, to, insert: '  #' },
            selection: { anchor: from + 3 },
            effects: setActiveTagEffect.of({
              active: true,
              from: from + 2,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
          return true
        } else {
          view.dispatch({
            changes: { from, to, insert: '#' },
            selection: { anchor: from + 1 },
            effects: setActiveTagEffect.of({
              active: true,
              from: from,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
          return true
        }
      } else if (
        charAfterCursor &&
        charAfterCursor !== ' ' &&
        charAfterCursor !== '\n'
      ) {
        const hashPosInLine = from - line.from
        const needsIndentLineStart = hashPosInLine === 0
        const needsIndentAfterTag = isThreeSpacesAfterTag(state, from)
        const needsSpacingAfterText =
          from > 0 && !isImmediatelyAfterSpaces(state, from)

        // Check if there's exactly one space before the cursor
        const hasOneSpaceBefore = charBeforeCursor === ' '

        console.log(
          'NON-VALID_TAG_CHAR case:',
          'needsSpacingAfterText:',
          needsSpacingAfterText,
          'hasOneSpaceBefore:',
          hasOneSpaceBefore,
          'needsIndentLineStart:',
          needsIndentLineStart,
          'needsIndentAfterTag:',
          needsIndentAfterTag
        )

        const needsIndent = needsIndentLineStart || needsIndentAfterTag
        const needsThreeSpaces = needsSpacingAfterText || hasOneSpaceBefore

        if (needsThreeSpaces) {
          console.log(
            'Applying three spaces logic (spaced tag), hasOneSpaceBefore:',
            hasOneSpaceBefore
          )
          const insertText = hasOneSpaceBefore ? '  #' : '   #'
          const deleteFrom = hasOneSpaceBefore ? from - 1 : from
          view.dispatch({
            changes: { from: deleteFrom, to: from, insert: insertText },
            selection: { anchor: deleteFrom + insertText.length },
            effects: setActiveTagEffect.of({
              active: true,
              from: deleteFrom + insertText.length - 1,
              allowSpaces: true
            }),
            userEvent: 'input.type'
          })
          return true
        } else if (needsIndent) {
          view.dispatch({
            changes: { from, to, insert: '  #' },
            selection: { anchor: from + 3 },
            effects: setActiveTagEffect.of({
              active: true,
              from: from + 2,
              allowSpaces: true
            }),
            userEvent: 'input.type'
          })
          return true
        } else {
          view.dispatch({
            changes: { from, to, insert: '#' },
            selection: { anchor: from + 1 },
            effects: setActiveTagEffect.of({
              active: true,
              from: from,
              allowSpaces: true
            }),
            userEvent: 'input.type'
          })
          return true
        }
      }
      return false
    }

    if (content === ' ' || content === '#') return false

    if (pos > 0 && line.text.charAt(pos - 1) === '#') {
      const hashPos = from - 1

      const charBeforeHash =
        hashPos > line.from ? state.doc.sliceString(hashPos - 1, hashPos) : ''
      if (charBeforeHash === '#') {
        console.log(
          'Hash preceded by another hash, preventing tag initialization'
        )
        view.dispatch({
          changes: { from, to, insert: content },
          selection: { anchor: from + content.length },
          effects: setActiveTagEffect.of({
            active: false,
            from: null,
            allowSpaces: false
          }),
          userEvent: 'input.type'
        })
        return true
      }

      // Check if this hash is preceded by a space (indicating it could start a new tag)
      const hashPosInLine = hashPos - line.from
      const charBeforeHashInLine =
        hashPosInLine > 0 ? line.text.charAt(hashPosInLine - 1) : ''

      console.log(
        'Character before hash:',
        JSON.stringify(charBeforeHashInLine),
        'at pos:',
        hashPosInLine
      )

      if (charBeforeHashInLine === ' ') {
        console.log('Hash is preceded by space, can start new tag')
        // This hash can potentially start a new tag, continue with normal logic
      } else if (hashPosInLine === 0) {
        console.log('Hash is at line start, can start new tag')
        // Hash at line start, can start a new tag
      } else {
        console.log(
          'Hash is not preceded by space or at start, checking for tag continuation'
        )
        // Need to check if this is a valid tag continuation or if we should prevent it
      }

      const hashPosInLine2 = hashPos - line.from
      const needsIndentLineStart = hashPosInLine2 === 0
      const needsIndentAfterTag = isThreeSpacesAfterTag(state, hashPos)
      const needsSpacingAfterText =
        hashPos > 0 && !isImmediatelyAfterSpaces(state, hashPos)
      const needsSpacingTwoSpacesAfter = isTwoSpacesAfterLastCharacter(
        state,
        hashPos
      )

      // Check if there's exactly one space before the hash
      const hasOneSpaceBeforeHash =
        hashPosInLine > 0 && line.text.charAt(hashPosInLine - 1) === ' '

      console.log(
        'Character after hash detected:',
        content,
        'needsSpacingAfterText:',
        needsSpacingAfterText,
        'needsSpacingTwoSpacesAfter:',
        needsSpacingTwoSpacesAfter,
        'hasOneSpaceBeforeHash:',
        hasOneSpaceBeforeHash,
        'hashPos:',
        hashPos
      )

      const needsIndent = needsIndentLineStart || needsIndentAfterTag
      const needsThreeSpaces =
        needsSpacingAfterText ||
        needsSpacingTwoSpacesAfter ||
        hasOneSpaceBeforeHash

      if (VALID_TAG_CHAR_REGEX.test(content)) {
        if (needsThreeSpaces) {
          let insertText, deleteFrom
          if (hasOneSpaceBeforeHash) {
            // Replace the single space before hash with three spaces
            insertText = '   #' + content
            deleteFrom = hashPos - 1
          } else {
            insertText = '   #' + content
            deleteFrom = hashPos
          }

          console.log(
            'Applying three spaces for character after hash, hasOneSpaceBeforeHash:',
            hasOneSpaceBeforeHash
          )

          view.dispatch({
            changes: { from: deleteFrom, to: from, insert: insertText },
            selection: { anchor: deleteFrom + insertText.length },
            effects: setActiveTagEffect.of({
              active: true,
              from: deleteFrom + 3, // Always 3 spaces before the #
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
        } else if (needsIndent) {
          view.dispatch({
            changes: { from: hashPos, to: from, insert: '  #' + content },
            selection: { anchor: hashPos + 4 },
            effects: setActiveTagEffect.of({
              active: true,
              from: hashPos + 2,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
        } else {
          view.dispatch({
            changes: { from, to, insert: content },
            selection: { anchor: from + content.length },
            effects: setActiveTagEffect.of({
              active: true,
              from: hashPos,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
        }
        return true
      } else {
        if (needsThreeSpaces) {
          let insertText, deleteFrom
          if (hasOneSpaceBeforeHash) {
            // Replace the single space before hash with three spaces
            insertText = '   #' + content
            deleteFrom = hashPos - 1
          } else {
            insertText = '   #' + content
            deleteFrom = hashPos
          }

          console.log(
            'Applying three spaces for character after hash (allowSpaces), hasOneSpaceBeforeHash:',
            hasOneSpaceBeforeHash
          )

          view.dispatch({
            changes: { from: deleteFrom, to: from, insert: insertText },
            selection: { anchor: deleteFrom + insertText.length },
            effects: setActiveTagEffect.of({
              active: true,
              from: deleteFrom + 3, // Always 3 spaces before the #
              allowSpaces: true
            }),
            userEvent: 'input.type'
          })
        } else if (needsIndent) {
          view.dispatch({
            changes: { from: hashPos, to: from, insert: '  #' + content },
            selection: { anchor: hashPos + 4 },
            effects: setActiveTagEffect.of({
              active: true,
              from: hashPos + 2,
              allowSpaces: true
            }),
            userEvent: 'input.type'
          })
        } else {
          view.dispatch({
            changes: { from, to, insert: content },
            selection: { anchor: from + content.length },
            effects: setActiveTagEffect.of({
              active: true,
              from: hashPos,
              allowSpaces: true
            }),
            userEvent: 'input.type'
          })
        }
        return true
      }
    }

    if (activeTag.active || findTagAtCursor(state, from)) {
      const tagStart = activeTag.active
        ? activeTag.from
        : findTagAtCursor(state, from).start
      const tagEnd = activeTag.active ? from : findTagAtCursor(state, from).end

      if (
        activeTag.allowSpaces ||
        (findTagAtCursor(state, from) &&
          findTagAtCursor(state, from).type === 'closed')
      ) {
        if (content === '#') {
          if (!activeTag.active) {
            const prevChar = state.doc.sliceString(from - 1, from)
            if (prevChar === ' ') {
              view.dispatch({
                changes: { from, to, insert: content },
                selection: { anchor: from + content.length },
                effects: setActiveTagEffect.of({
                  active: true,
                  from: from,
                  allowSpaces: false
                }),
                userEvent: 'input.type'
              })
              return true
            }
            return false
          }
        } else if (content === ' ' && from === tagStart + 1) {
          return false
        } else {
          view.dispatch({
            changes: { from, to, insert: content },
            selection: { anchor: from + content.length },
            userEvent: 'input.type'
          })
          return true
        }
      } else {
        if (VALID_TAG_CHAR_REGEX.test(content)) {
          view.dispatch({
            changes: { from, to, insert: content },
            selection: { anchor: from + content.length },
            effects: activeTag.active
              ? undefined
              : setActiveTagEffect.of({
                  active: true,
                  from: tagStart,
                  allowSpaces: false
                }),
            userEvent: 'input.type'
          })
          return true
        } else if (content !== ' ') {
          const insert = '   ' + content
          const insertPos = tagEnd
          view.dispatch({
            changes: { from: insertPos, to: insertPos, insert },
            selection: { anchor: insertPos + insert.length },
            effects: setActiveTagEffect.of({
              active: false,
              from: null,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
          return true
        }
      }
      return false
    }

    if (activeTag.active && activeTag.allowSpaces && content === '#') {
      const beforeCursor = state.doc.sliceString(activeTag.from, from)
      if (beforeCursor.length > 1 && !beforeCursor.endsWith(' ')) {
        view.dispatch({
          changes: { from, to, insert: content },
          selection: { anchor: from + content.length },
          effects: setActiveTagEffect.of({
            active: false,
            from: null,
            allowSpaces: false
          }),
          userEvent: 'input.type'
        })
        return true
      }
    }

    return false
  }
)

// Replace the handleTagBackspaceKey function in your tagStyling.js with this version:

function handleTagBackspaceKey(view) {
  const { state } = view
  const head = state.selection.main.head
  const tagAtCursor = findTagAtCursor(state, head)

  if (
    tagAtCursor &&
    tagAtCursor.type === 'closed' &&
    head === tagAtCursor.end
  ) {
    const line = state.doc.lineAt(head)
    const tagContent = state.doc.sliceString(
      tagAtCursor.start,
      tagAtCursor.end - 1
    )
    const firstSpaceIndex = tagContent.indexOf(' ', 1)

    if (firstSpaceIndex !== -1) {
      const tagPrefix = tagContent.substring(0, firstSpaceIndex + 1)
      const tagText = tagContent.substring(firstSpaceIndex + 1)
      const newContent = tagPrefix + '  ' + tagText

      view.dispatch({
        changes: {
          from: tagAtCursor.start,
          to: tagAtCursor.end,
          insert: newContent
        },
        selection: { anchor: tagAtCursor.start + newContent.length },
        userEvent: 'delete'
      })
      return true
    } else {
      view.dispatch({
        changes: { from: tagAtCursor.end - 1, to: tagAtCursor.end, insert: '' },
        selection: { anchor: tagAtCursor.end - 1 },
        userEvent: 'delete'
      })
      return true
    }
  }

  // NEW 4-SPACE DELETION LOGIC - Check this first before normal 2-space logic
  if (head >= 2) {
    const line = state.doc.lineAt(head)
    const lineText = line.text
    const pos = head - line.from

    if (pos >= 2 && lineText.substring(pos - 2, pos) === '  ') {
      console.log('=== BACKSPACE HANDLER: 2 spaces before cursor detected ===')
      console.log('Current line:', JSON.stringify(lineText))
      console.log('Cursor position in line:', pos)
      console.log(
        'Text before cursor:',
        JSON.stringify(lineText.substring(0, pos))
      )
      console.log('Text after cursor:', JSON.stringify(lineText.substring(pos)))

      const textBeforeSpaces = lineText.substring(0, pos - 2)

      // Check if there are also 2 spaces ahead of cursor (total of 4 spaces between tags)
      const textAfterCursor = lineText.substring(pos)
      const hasTwoSpacesAhead = textAfterCursor.startsWith('  ')

      console.log('Has two spaces ahead:', hasTwoSpacesAhead)

      if (hasTwoSpacesAhead) {
        console.log('=== 4-SPACE SCENARIO DETECTED ===')

        // Check if there's a tag immediately after the 2 spaces ahead
        const textAfterTwoSpaces = lineText.substring(pos + 2)
        console.log(
          'Text after two spaces ahead:',
          JSON.stringify(textAfterTwoSpaces)
        )
        const hasTagAfterSpaces = textAfterTwoSpaces.match(/^#[a-zA-Z0-9_\/-]/)

        console.log('Has tag after spaces:', !!hasTagAfterSpaces)

        if (hasTagAfterSpaces) {
          console.log('Tag found after spaces, checking for tag before spaces')

          // Check what type of tag comes after the spaces
          const tagAfterMatch = textAfterTwoSpaces.match(
            /^#[^#\n]*#(?!#)|^#[a-zA-Z0-9_\/-]+/
          )
          const isClosedTagAfter = textAfterTwoSpaces.match(
            /^#[^#\s][^#\n]*[^#\s]#(?!#)|^#[^#\s]#(?!#)/
          )
          const isSimpleTagAfter =
            textAfterTwoSpaces.match(/^#[a-zA-Z0-9_\/-]+/)

          console.log(
            'Tag after spaces match:',
            tagAfterMatch ? tagAfterMatch[0] : null
          )
          console.log('Is closed tag after:', !!isClosedTagAfter)
          console.log('Is simple tag after:', !!isSimpleTagAfter)

          // Check for closed or simple tag before the 4 spaces
          const closedMatches = [...textBeforeSpaces.matchAll(CLOSED_TAG_REGEX)]
          console.log('Closed matches before spaces:', closedMatches.length)

          if (closedMatches.length > 0) {
            const lastMatch = closedMatches[closedMatches.length - 1]
            const tagEnd = lastMatch.index + lastMatch[0].length
            console.log(
              'Last closed tag ends at:',
              tagEnd,
              'spaces start at:',
              pos - 2
            )

            if (tagEnd === pos - 2) {
              if (isClosedTagAfter) {
                console.log(
                  '*** EXECUTING 4-SPACE DELETION: CLOSED -> CLOSED, converting second to spaced tag ***'
                )
                const closedTagAfter = isClosedTagAfter[0]
                const tagContent = closedTagAfter.slice(1, -1) // Remove # from both ends
                const newSpacedTag = `#   ${tagContent}#`

                console.log(
                  'Original closed tag:',
                  JSON.stringify(closedTagAfter)
                )
                console.log('Extracted content:', JSON.stringify(tagContent))
                console.log('New spaced tag:', JSON.stringify(newSpacedTag))
                console.log(
                  'Delete range: from',
                  head - 2,
                  'to',
                  head + 2 + closedTagAfter.length
                )

                view.dispatch({
                  changes: {
                    from: head - 2,
                    to: head + 2 + closedTagAfter.length,
                    insert: newSpacedTag
                  },
                  selection: { anchor: head - 2 },
                  userEvent: 'delete'
                })
              } else if (isSimpleTagAfter) {
                console.log(
                  '*** EXECUTING 4-SPACE DELETION: CLOSED -> SIMPLE, converting second to spaced tag ***'
                )
                const simpleTagAfter = isSimpleTagAfter[0]
                const tagContent = simpleTagAfter.slice(1) // Remove # from start
                const newSpacedTag = `#   ${tagContent}#`

                console.log(
                  'Original simple tag:',
                  JSON.stringify(simpleTagAfter)
                )
                console.log('Extracted content:', JSON.stringify(tagContent))
                console.log('New spaced tag:', JSON.stringify(newSpacedTag))
                console.log(
                  'Delete range: from',
                  head - 2,
                  'to',
                  head + 2 + simpleTagAfter.length
                )

                view.dispatch({
                  changes: {
                    from: head - 2,
                    to: head + 2 + simpleTagAfter.length,
                    insert: newSpacedTag
                  },
                  selection: { anchor: head - 2 },
                  userEvent: 'delete'
                })
              } else {
                console.log(
                  '*** EXECUTING 4-SPACE DELETION FOR CLOSED TAG (no conversion) ***'
                )
                console.log('Deleting from', head - 2, 'to', head + 2)
                view.dispatch({
                  changes: { from: head - 2, to: head + 2, insert: '' },
                  selection: { anchor: head - 2 },
                  userEvent: 'delete'
                })
              }
              return true
            }
          }

          const simpleMatches = [...textBeforeSpaces.matchAll(TAG_REGEX)]
          console.log('Simple matches before spaces:', simpleMatches.length)

          if (simpleMatches.length > 0) {
            const lastMatch = simpleMatches[simpleMatches.length - 1]
            const tagEnd = lastMatch.index + lastMatch[0].length
            console.log(
              'Last simple tag ends at:',
              tagEnd,
              'spaces start at:',
              pos - 2
            )

            if (tagEnd === pos - 2) {
              if (isClosedTagAfter) {
                console.log(
                  '*** EXECUTING 4-SPACE DELETION: SIMPLE -> CLOSED, converting second to spaced tag ***'
                )
                const closedTagAfter = isClosedTagAfter[0]
                const tagContent = closedTagAfter.slice(1, -1) // Remove # from both ends
                const newSpacedTag = `#   ${tagContent}#`

                console.log(
                  'Original closed tag:',
                  JSON.stringify(closedTagAfter)
                )
                console.log('Extracted content:', JSON.stringify(tagContent))
                console.log('New spaced tag:', JSON.stringify(newSpacedTag))
                console.log(
                  'Delete range: from',
                  head - 2,
                  'to',
                  head + 2 + closedTagAfter.length
                )

                view.dispatch({
                  changes: {
                    from: head - 2,
                    to: head + 2 + closedTagAfter.length,
                    insert: newSpacedTag
                  },
                  selection: { anchor: head - 2 },
                  userEvent: 'delete'
                })
              } else if (isSimpleTagAfter) {
                console.log(
                  '*** EXECUTING 4-SPACE DELETION: SIMPLE -> SIMPLE, converting second to spaced tag ***'
                )
                const simpleTagAfter = isSimpleTagAfter[0]
                const tagContent = simpleTagAfter.slice(1) // Remove # from start
                const newSpacedTag = `#   ${tagContent}#`

                console.log(
                  'Original simple tag:',
                  JSON.stringify(simpleTagAfter)
                )
                console.log('Extracted content:', JSON.stringify(tagContent))
                console.log('New spaced tag:', JSON.stringify(newSpacedTag))
                console.log(
                  'Delete range: from',
                  head - 2,
                  'to',
                  head + 2 + simpleTagAfter.length
                )

                view.dispatch({
                  changes: {
                    from: head - 2,
                    to: head + 2 + simpleTagAfter.length,
                    insert: newSpacedTag
                  },
                  selection: { anchor: head - 2 },
                  userEvent: 'delete'
                })
              } else {
                console.log(
                  '*** EXECUTING 4-SPACE DELETION FOR SIMPLE TAG (no conversion) ***'
                )
                console.log('Deleting from', head - 2, 'to', head + 2)
                view.dispatch({
                  changes: { from: head - 2, to: head + 2, insert: '' },
                  selection: { anchor: head - 2 },
                  userEvent: 'delete'
                })
              }
              return true
            }
          }
        }
      }

      console.log(
        '=== NOT 4-SPACE SCENARIO, PROCEEDING WITH NORMAL 2-SPACE DELETION ==='
      )

      // Original logic for normal 2-space deletion (when not between two tags)
      const closedMatches = [...textBeforeSpaces.matchAll(CLOSED_TAG_REGEX)]
      if (closedMatches.length > 0) {
        const lastMatch = closedMatches[closedMatches.length - 1]
        const tagEnd = lastMatch.index + lastMatch[0].length

        if (tagEnd === pos - 2) {
          console.log(
            'Found closed tag ending before 2 spaces, deleting both spaces'
          )
          view.dispatch({
            changes: { from: head - 2, to: head, insert: '' },
            selection: { anchor: head - 2 },
            userEvent: 'delete'
          })
          return true
        }
      }

      const simpleMatches = [...textBeforeSpaces.matchAll(TAG_REGEX)]
      if (simpleMatches.length > 0) {
        const lastMatch = simpleMatches[simpleMatches.length - 1]
        const tagEnd = lastMatch.index + lastMatch[0].length

        if (tagEnd === pos - 2) {
          console.log(
            'Found simple tag ending before 2 spaces, deleting both spaces'
          )
          view.dispatch({
            changes: { from: head - 2, to: head, insert: '' },
            selection: { anchor: head - 2 },
            userEvent: 'delete'
          })
          return true
        }
      }
    }
  }

  // Rest of the original function continues...
  if (head >= 3) {
    const line = state.doc.lineAt(head)
    const lineText = line.text
    const pos = head - line.from

    if (pos >= 2 && lineText.substring(pos - 2, pos) === '  ') {
      console.log(
        'Two spaces before cursor detected, checking for preceding closed tag'
      )

      const textBeforeSpaces = lineText.substring(0, pos - 2)
      const closedMatches = [...textBeforeSpaces.matchAll(CLOSED_TAG_REGEX)]

      if (closedMatches.length > 0) {
        const lastMatch = closedMatches[closedMatches.length - 1]
        const tagEnd = lastMatch.index + lastMatch[0].length

        if (tagEnd === pos - 2) {
          console.log(
            'Found closed tag ending before 2 spaces, deleting spaces + closing hash'
          )

          const afterCursor = lineText.substring(pos)
          if (
            afterCursor.length > 0 &&
            !afterCursor.startsWith(' ') &&
            !afterCursor.startsWith('#')
          ) {
            view.dispatch({
              changes: { from: head - 3, to: head, insert: '' },
              selection: { anchor: head - 3 },
              userEvent: 'delete'
            })
            return true
          }
        }
      }
    }
  }

  // Continue with the rest of the original function...
  if (head >= 2) {
    const line = state.doc.lineAt(head)
    const lineText = line.text
    const pos = head - line.from

    if (pos >= 2 && lineText.substring(pos - 2, pos) === '  ') {
      console.log(
        'Two spaces before cursor detected, checking for preceding tag'
      )

      const textBeforeSpaces = lineText.substring(0, pos - 2)
      const simpleMatches = [...textBeforeSpaces.matchAll(TAG_REGEX)]

      if (simpleMatches.length > 0) {
        const lastMatch = simpleMatches[simpleMatches.length - 1]
        const tagEnd = lastMatch.index + lastMatch[0].length

        if (tagEnd === pos - 2) {
          console.log(
            'Found simple tag ending before 2 spaces, deleting both spaces'
          )

          const afterCursor = lineText.substring(pos)
          if (
            afterCursor.length > 0 &&
            !afterCursor.startsWith(' ') &&
            !afterCursor.startsWith('#')
          ) {
            view.dispatch({
              changes: { from: head - 2, to: head, insert: '' },
              selection: { anchor: head - 2 },
              userEvent: 'delete'
            })
            return true
          }
        }
      }
    }
  }

  if (head > 0) {
    const charToDelete = state.doc.sliceString(head - 1, head)
    if (charToDelete === '#') {
      if (head >= 3) {
        const twoSpacesBefore = state.doc.sliceString(head - 3, head - 1)
        if (twoSpacesBefore === '  ') {
          const line = state.doc.lineAt(head)
          const afterHash = state.doc.sliceString(head, line.to)
          const spaceIndex = afterHash.search(/\s/)
          const tagContent =
            spaceIndex === -1 ? afterHash : afterHash.substring(0, spaceIndex)

          console.log(
            'Backspace after hash - afterHash:',
            JSON.stringify(afterHash)
          )
          console.log(
            'Backspace after hash - tagContent:',
            JSON.stringify(tagContent)
          )
          console.log(
            'Backspace after hash - tagContent.length:',
            tagContent.length
          )

          if (tagContent.length > 0 && tagContent.match(/^[a-zA-Z0-9_\/-]/)) {
            console.log('Valid tag detected, proceeding with special deletion')
            const tagEnd = head + tagContent.length

            view.dispatch({
              changes: { from: head - 3, to: tagEnd, insert: tagContent },
              selection: { anchor: head - 3 },
              userEvent: 'delete'
            })
            return true
          } else {
            console.log('Not a valid tag, falling back to normal hash deletion')
          }
        }
      }
      view.dispatch({
        changes: { from: head - 1, to: head, insert: '' },
        selection: { anchor: head - 1 },
        userEvent: 'delete'
      })
      return true
    }
  }

  const activeTag = state.field(activeTagState)
  if (activeTag.active && head > activeTag.from) {
    const tagContent = state.doc.sliceString(activeTag.from, head)

    if (tagContent.length === 2 && tagContent.startsWith('#')) {
      if (activeTag.from >= 2) {
        const twoSpacesBefore = state.doc.sliceString(
          activeTag.from - 2,
          activeTag.from
        )
        if (twoSpacesBefore === '  ') {
          view.dispatch({
            changes: { from: activeTag.from - 2, to: head, insert: '#' },
            selection: { anchor: activeTag.from - 2 + 1 },
            effects: setActiveTagEffect.of({
              active: false,
              from: null,
              allowSpaces: false
            }),
            userEvent: 'delete'
          })
          return true
        }
      }
    }
  }

  if (tagAtCursor && tagAtCursor.type === 'simple') {
    const tagContent = state.doc.sliceString(tagAtCursor.start, tagAtCursor.end)

    if (tagContent.length === 2 && head === tagAtCursor.end) {
      if (tagAtCursor.start >= 2) {
        const twoSpacesBefore = state.doc.sliceString(
          tagAtCursor.start - 2,
          tagAtCursor.start
        )
        if (twoSpacesBefore === '  ') {
          view.dispatch({
            changes: {
              from: tagAtCursor.start - 2,
              to: tagAtCursor.end,
              insert: '#'
            },
            selection: { anchor: tagAtCursor.start - 2 + 1 },
            userEvent: 'delete'
          })
          return true
        }
      }
    }
  }

  return false
}

function isImmediatelyAfterTagWithNoSpaces(state, pos) {
  const line = state.doc.lineAt(pos)
  const textBefore = state.doc.sliceString(line.from, pos)
  const trimmedText = textBefore.trimEnd()
  if (trimmedText.length !== textBefore.length) {
    return false
  }

  const simpleMatches = [...trimmedText.matchAll(TAG_REGEX)]
  if (simpleMatches.length > 0) {
    const lastMatch = simpleMatches[simpleMatches.length - 1]
    const tagEnd = line.from + lastMatch.index + lastMatch[0].length
    if (tagEnd === pos) return true
  }

  const closedMatches = [...trimmedText.matchAll(CLOSED_TAG_REGEX)]
  if (closedMatches.length > 0) {
    const lastMatch = closedMatches[closedMatches.length - 1]
    const tagEnd = line.from + lastMatch.index + lastMatch[0].length
    if (tagEnd === pos) return true
  }

  return false
}

function isAfterTagWithThreeSpaces(state, pos) {
  if (pos < 3) return false
  const threeCharsBefore = state.doc.sliceString(pos - 3, pos)
  if (threeCharsBefore !== '   ') return false
  const line = state.doc.lineAt(pos)
  const textUpToSpaces = state.doc.sliceString(line.from, pos - 3)

  const simpleMatches = [...textUpToSpaces.matchAll(TAG_REGEX)]
  if (simpleMatches.length > 0) {
    const lastMatch = simpleMatches[simpleMatches.length - 1]
    const tagEnd = line.from + lastMatch.index + lastMatch[0].length
    if (tagEnd === pos - 3) return true
  }

  const closedMatches = [...textUpToSpaces.matchAll(CLOSED_TAG_REGEX)]
  if (closedMatches.length > 0) {
    const lastMatch = closedMatches[closedMatches.length - 1]
    const tagEnd = line.from + lastMatch.index + lastMatch[0].length
    if (tagEnd === pos - 3) return true
  }

  return false
}

function handleTagSpaceKey(view) {
  const { state } = view
  const activeTag = state.field(activeTagState)
  const head = state.selection.main.head
  const tagAtCursor = findTagAtCursor(state, head)

  if (head > 0) {
    const charBefore = state.doc.sliceString(head - 1, head)
    if (charBefore === '#') {
      const line = state.doc.lineAt(head)
      const lineText = line.text
      const posInLine = head - line.from

      const closedMatches = [...lineText.matchAll(CLOSED_TAG_REGEX)]
      for (const match of closedMatches) {
        const tagEnd = match.index + match[0].length
        if (tagEnd === posInLine) {
          view.dispatch({
            changes: { from: head, to: head, insert: '   ' },
            selection: { anchor: head + 3 },
            userEvent: 'input.type'
          })
          return true
        }
      }
    }
  }

  if (activeTag.active && head === activeTag.from + 1) {
    if (activeTag.from >= 2) {
      const twoSpacesBefore = state.doc.sliceString(
        activeTag.from - 2,
        activeTag.from
      )
      if (twoSpacesBefore === '  ') {
        const line = state.doc.lineAt(head)
        const afterCursor = state.doc.sliceString(head, line.to)
        const spaceIndex = afterCursor.search(/\s/)
        const tagContent =
          spaceIndex === -1 ? afterCursor : afterCursor.substring(0, spaceIndex)

        const newContent = '# ' + tagContent
        view.dispatch({
          changes: {
            from: activeTag.from - 2,
            to: head + tagContent.length,
            insert: newContent
          },
          selection: { anchor: activeTag.from - 2 + 2 },
          effects: setActiveTagEffect.of({
            active: false,
            from: null,
            allowSpaces: false
          }),
          userEvent: 'input.type'
        })
        return true
      }
    }
    return false
  }

  if (tagAtCursor && tagAtCursor.type === 'closed') {
    if (head === tagAtCursor.start + 1) {
      return false
    }
    view.dispatch({
      changes: { from: head, to: head, insert: ' ' },
      selection: { anchor: head + 1 },
      userEvent: 'input.type'
    })
    return true
  }

  if (activeTag.active) {
    const line = state.doc.lineAt(head)
    const beforeCursor = state.doc.sliceString(activeTag.from, head)

    if (beforeCursor.startsWith('#') && beforeCursor.length > 1) {
      if (activeTag.allowSpaces) {
        if (head === activeTag.from + 1) {
          return false
        }
        view.dispatch({
          changes: { from: head, to: head, insert: ' ' },
          selection: { anchor: head + 1 },
          userEvent: 'input.type'
        })
        return true
      } else {
        const tagContent = beforeCursor.substring(1)
        if (/^[a-zA-Z0-9_\/-]+$/.test(tagContent)) {
          view.dispatch({
            changes: { from: head, to: head, insert: '   ' },
            selection: { anchor: head + 3 },
            effects: setActiveTagEffect.of({
              active: false,
              from: null,
              allowSpaces: false
            }),
            userEvent: 'input.type'
          })
          return true
        }
      }
    }
  } else if (isImmediatelyAfterTagWithNoSpaces(state, head)) {
    view.dispatch({
      changes: { from: head, to: head, insert: '   ' },
      selection: { anchor: head + 3 },
      userEvent: 'input.type'
    })
    return true
  }

  return false
}

function handleTagSlashKey(view) {
  const { state } = view
  const activeTag = state.field(activeTagState)
  if (!activeTag.active) return false
  const head = state.selection.main.head
  view.dispatch({
    changes: { from: head, to: head, insert: '/' },
    selection: { anchor: head + 1 },
    userEvent: 'input.type'
  })
  return true
}

function isTwoSpacesAfterLastCharacter(state, pos) {
  if (pos < 2) return false

  const line = state.doc.lineAt(pos)
  const lineText = line.text
  const posInLine = pos - line.from

  if (posInLine < 2 || lineText.substring(posInLine - 2, posInLine) !== '  ') {
    return false
  }

  const beforeSpaces = posInLine - 2
  if (beforeSpaces === 0) return false

  const textBeforeSpaces = lineText.substring(0, beforeSpaces)

  const closedMatches = [...textBeforeSpaces.matchAll(CLOSED_TAG_REGEX)]
  if (closedMatches.length > 0) {
    const lastMatch = closedMatches[closedMatches.length - 1]
    const tagEnd = lastMatch.index + lastMatch[0].length
    if (tagEnd === beforeSpaces) return true
  }

  const simpleMatches = [...textBeforeSpaces.matchAll(TAG_REGEX)]
  if (simpleMatches.length > 0) {
    const lastMatch = simpleMatches[simpleMatches.length - 1]
    const tagEnd = lastMatch.index + lastMatch[0].length
    if (tagEnd === beforeSpaces) return true
  }

  const lastChar = textBeforeSpaces.charAt(textBeforeSpaces.length - 1)
  if (lastChar && lastChar !== ' ' && lastChar !== '#') {
    return true
  }

  return false
}

function handleTagLeftArrow(view) {
  const { state } = view
  const head = state.selection.main.head

  if (head === 0) return false

  const line = state.doc.lineAt(head)
  const pos = head - line.from

  if (pos > 0 && line.text.charAt(pos - 1) === '#') {
    console.log(
      'Left arrow after hash detected, pos:',
      pos,
      'line text:',
      line.text
    )

    if (pos >= 3 && line.text.substring(pos - 3, pos - 1) === '  ') {
      console.log('Found 2 spaces before hash')
      const newPos = head - 3
      console.log('Jumping to position:', newPos)
      view.dispatch({
        selection: { anchor: newPos },
        userEvent: 'select'
      })
      return true
    }
  }

  if (pos >= 2 && line.text.substring(pos - 2, pos) === '  ') {
    console.log(
      'Left arrow with 2 spaces before cursor detected, pos:',
      pos,
      'line text:',
      line.text
    )

    const lineText = line.text
    const textBeforeSpaces = lineText.substring(0, pos - 2)

    const closedMatches = [...textBeforeSpaces.matchAll(CLOSED_TAG_REGEX)]
    if (closedMatches.length > 0) {
      const lastMatch = closedMatches[closedMatches.length - 1]
      const tagEnd = lastMatch.index + lastMatch[0].length

      if (tagEnd === pos - 2) {
        console.log(
          'Found closed tag ending before 2 spaces, jumping over spaces'
        )
        const newPos = head - 2
        view.dispatch({
          selection: { anchor: newPos },
          userEvent: 'select'
        })
        return true
      }
    }

    const simpleMatches = [...textBeforeSpaces.matchAll(TAG_REGEX)]
    if (simpleMatches.length > 0) {
      const lastMatch = simpleMatches[simpleMatches.length - 1]
      const tagEnd = lastMatch.index + lastMatch[0].length

      if (tagEnd === pos - 2) {
        console.log(
          'Found simple tag ending before 2 spaces, jumping over spaces'
        )
        const newPos = head - 2
        view.dispatch({
          selection: { anchor: newPos },
          userEvent: 'select'
        })
        return true
      }
    }
  }

  return false
}

function handleTagRightArrow(view) {
  const { state } = view
  const head = state.selection.main.head

  if (head >= state.doc.length) return false

  const line = state.doc.lineAt(head)
  const pos = head - line.from
  const lineText = line.text

  if (
    pos + 3 <= lineText.length &&
    lineText.substring(pos, pos + 3).match(/^  #/)
  ) {
    const hashPos = pos + 2
    console.log('Right arrow before spaced hash detected, hashPos:', hashPos)

    const charAfterHash =
      hashPos + 1 < lineText.length ? lineText.charAt(hashPos + 1) : ''

    if (
      charAfterHash &&
      (charAfterHash.match(/[a-zA-Z0-9_\/-]/) || charAfterHash !== ' ')
    ) {
      const newPos = head + 3
      console.log('Jumping to position:', newPos)
      view.dispatch({
        selection: { anchor: newPos },
        userEvent: 'select'
      })
      return true
    }
  }

  const closedMatches = [...lineText.matchAll(CLOSED_TAG_REGEX)]
  for (const match of closedMatches) {
    const tagStart = match.index
    const tagEnd = tagStart + match[0].length
    if (pos === tagEnd) {
      console.log('Right arrow at end of closed tag detected')
      const newPos = head + 2
      view.dispatch({
        selection: { anchor: newPos },
        userEvent: 'select'
      })
      return true
    }
  }

  const simpleMatches = [...lineText.matchAll(TAG_REGEX)]
  for (const match of simpleMatches) {
    const tagStart = match.index
    const tagEnd = tagStart + match[0].length
    if (pos === tagEnd) {
      console.log('Right arrow at end of simple tag detected')
      const newPos = head + 2
      view.dispatch({
        selection: { anchor: newPos },
        userEvent: 'select'
      })
      return true
    }
  }

  return false
}

export const tagExtensions = [
  activeTagState,
  tagStyling,
  tagCharacterHandler,
  keymap.of([
    { key: 'Space', run: handleTagSpaceKey },
    { key: '/', run: handleTagSlashKey },
    { key: 'Backspace', run: handleTagBackspaceKey },
    { key: 'Alt-Backspace', run: handleTagBackspaceKey },
    { key: 'ArrowLeft', run: handleTagLeftArrow },
    { key: 'ArrowRight', run: handleTagRightArrow }
  ])
]

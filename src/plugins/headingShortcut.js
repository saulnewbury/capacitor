// plugins/headingShortcuts.js
import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

function makeHeadingShortcut(level) {
  return function (view) {
    const { state, dispatch } = view
    const { head } = state.selection.main
    const line = state.doc.lineAt(head)
    const text = line.text

    // 1) Remove any existing ATX prefix (1–6 hashes + space)
    const m = text.match(/^(#{1,6}\s)/)
    const changes = []
    if (m) {
      changes.push({
        from: line.from,
        to: line.from + m[1].length,
        insert: ''
      })
    }

    // 2) Insert the new prefix (“#…# ”) at start‑of‑line
    const prefix = '#'.repeat(level) + ' '
    changes.push({
      from: line.from,
      to: line.from,
      insert: prefix
    })

    // 3) Dispatch and place cursor just after the space
    dispatch(
      state.update({
        changes,
        selection: EditorSelection.cursor(line.from + prefix.length),
        userEvent: 'input'
      })
    )
    return true
  }
}

export const headingShortcuts = keymap.of([
  { key: 'Mod-1', run: makeHeadingShortcut(1) },
  { key: 'Mod-2', run: makeHeadingShortcut(2) },
  { key: 'Mod-3', run: makeHeadingShortcut(3) },
  { key: 'Mod-4', run: makeHeadingShortcut(4) },
  { key: 'Mod-5', run: makeHeadingShortcut(5) },
  { key: 'Mod-6', run: makeHeadingShortcut(6) }
])

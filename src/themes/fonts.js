import { EditorView } from '@codemirror/view'

// Font for editor text
export function createTextFont(fontFamily) {
  return EditorView.theme({
    '.cm-content, .cm-prompt': { fontFamily } // Apply font to editor content
  })
}

// Font for code block
export function createCodeFont(fontFamily) {
  return EditorView.theme({
    '.cm-content .cm-code-block': { fontFamily }
  })
}

// Regular expressions for different types of links
// This regex matches both http/https URLs and www. URLs
export const URL_REGEX =
  /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)+(?::\d{1,5})?(?:\/[^\s]*)?/gi

export const EMAIL_REGEX =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g

// Simple markdown link regex - no special markers needed
export const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g

// Helper function to select the full link text
export const selectLinkText = (view, pos, linkInfo) => {
  const line = view.state.doc.lineAt(pos)
  const lineText = line.text
  const posInLine = pos - line.from

  let selectionStart, selectionEnd

  if (linkInfo.type === 'markdown') {
    // For markdown links, find the exact position of the full [text](url) construct
    const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
    for (const match of markdownMatches) {
      if (
        posInLine >= match.index &&
        posInLine < match.index + match[0].length
      ) {
        selectionStart = line.from + match.index
        selectionEnd = line.from + match.index + match[0].length
        break
      }
    }
  } else if (linkInfo.type === 'email') {
    // For emails, find the exact email boundaries
    EMAIL_REGEX.lastIndex = 0
    let match
    while ((match = EMAIL_REGEX.exec(lineText)) !== null) {
      if (
        posInLine >= match.index &&
        posInLine < match.index + match[0].length
      ) {
        selectionStart = line.from + match.index
        selectionEnd = line.from + match.index + match[0].length
        break
      }
    }
  } else if (linkInfo.type === 'url') {
    // For plain URLs, find the exact URL boundaries
    // But first check if this URL is actually part of an email
    EMAIL_REGEX.lastIndex = 0
    let emailMatch
    while ((emailMatch = EMAIL_REGEX.exec(lineText)) !== null) {
      if (
        posInLine >= emailMatch.index &&
        posInLine < emailMatch.index + emailMatch[0].length
      ) {
        // This click is actually within an email address, select the whole email
        selectionStart = line.from + emailMatch.index
        selectionEnd = line.from + emailMatch.index + emailMatch[0].length
        return
      }
    }

    // If not part of an email, treat as regular URL
    URL_REGEX.lastIndex = 0
    let match
    while ((match = URL_REGEX.exec(lineText)) !== null) {
      if (
        posInLine >= match.index &&
        posInLine < match.index + match[0].length
      ) {
        selectionStart = line.from + match.index
        selectionEnd = line.from + match.index + match[0].length
        break
      }
    }
  }

  // Apply the selection if we found valid boundaries
  if (selectionStart !== undefined && selectionEnd !== undefined) {
    view.dispatch({
      selection: { anchor: selectionStart, head: selectionEnd },
      userEvent: 'select'
    })
  }
}

// Helper function to get link at position - FIXED WITH PREVIEW DETECTION
export const getLinkAtPosition = (view, pos) => {
  const line = view.state.doc.lineAt(pos)
  const lineText = line.text
  const posInLine = pos - line.from

  // Check for markdown links first (highest priority)
  const markdownMatches = [...lineText.matchAll(MARKDOWN_LINK_REGEX)]
  for (const mdMatch of markdownMatches) {
    if (
      posInLine >= mdMatch.index &&
      posInLine < mdMatch.index + mdMatch[0].length
    ) {
      const linkText = mdMatch[1]
      const linkUrl = mdMatch[2]

      // Check if this is a preview link (starts with 📋)
      const isPreviewLink = linkUrl.startsWith('📋 ')
      const actualUrl = isPreviewLink ? linkUrl.substring(2) : linkUrl

      console.log('Found markdown link:', {
        linkText,
        linkUrl,
        isPreviewLink,
        actualUrl
      }) // Debug log

      return {
        type: 'markdown',
        text: linkText,
        url: actualUrl,
        isPreview: isPreviewLink,
        fullMatch: mdMatch[0],
        position: {
          start: line.from + mdMatch.index,
          end: line.from + mdMatch.index + mdMatch[0].length
        }
      }
    }
  }

  // Check for emails SECOND (before URLs)
  EMAIL_REGEX.lastIndex = 0
  let match
  while ((match = EMAIL_REGEX.exec(lineText)) !== null) {
    if (posInLine >= match.index && posInLine < match.index + match[0].length) {
      // Check if it's not part of a markdown link
      const isInMarkdownLink = markdownMatches.some(
        (mdMatch) =>
          match.index >= mdMatch.index &&
          match.index < mdMatch.index + mdMatch[0].length
      )

      if (!isInMarkdownLink) {
        return {
          type: 'email',
          url: match[0],
          text: match[0],
          position: {
            start: line.from + match.index,
            end: line.from + match.index + match[0].length
          }
        }
      }
    }
  }

  // Check for plain URLs LAST (lowest priority)
  URL_REGEX.lastIndex = 0
  while ((match = URL_REGEX.exec(lineText)) !== null) {
    if (posInLine >= match.index && posInLine < match.index + match[0].length) {
      // Check if it's not part of a markdown link
      const isInMarkdownLink = markdownMatches.some(
        (mdMatch) =>
          match.index >= mdMatch.index &&
          match.index < mdMatch.index + mdMatch[0].length
      )

      // Also check if it's not part of an email address
      EMAIL_REGEX.lastIndex = 0
      let emailMatch
      let isPartOfEmail = false
      while ((emailMatch = EMAIL_REGEX.exec(lineText)) !== null) {
        if (
          match.index >= emailMatch.index &&
          match.index < emailMatch.index + emailMatch[0].length
        ) {
          // This URL is part of an email, skip it
          isPartOfEmail = true
          break
        }
      }

      if (!isInMarkdownLink && !isPartOfEmail) {
        return {
          type: 'url',
          url: match[0],
          text: match[0],
          position: {
            start: line.from + match.index,
            end: line.from + match.index + match[0].length
          }
        }
      }
    }
  }

  return null
}

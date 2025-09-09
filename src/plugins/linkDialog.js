// Function to create the Edit Link dialog
export const createEditLinkDialog = (
  linkInfo,
  view,
  onSave,
  targetElement = null
) => {
  // Remove any existing dialog
  const existingDialog = document.querySelector('.edit-link-dialog-overlay')
  if (existingDialog) {
    existingDialog.remove()
  }

  // Add animation styles to document if not already present
  if (!document.getElementById('link-dialog-styles')) {
    const style = document.createElement('style')
    style.id = 'link-dialog-styles'
    style.textContent = `
      .edit-link-dialog-enter {
        transform: scale(0.5) !important;
        opacity: 0 !important;
      }
      .edit-link-dialog-enter-active {
        transform: scale(1) !important;
        opacity: 1 !important;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out !important;
      }
    `
    document.head.appendChild(style)
  }

  // Create overlay (now just a positioning container, no background)
  const overlay = document.createElement('div')
  overlay.className = 'edit-link-dialog-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    pointer-events: none;
  `

  // Create dialog box
  const dialog = document.createElement('div')
  dialog.className = 'edit-link-dialog edit-link-dialog-enter'
  dialog.style.cssText = `
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    padding: 16px;
    min-width: 300px;
    max-width: 450px;
    position: relative;
    pointer-events: auto;
  `

  // Determine initial values based on linkInfo
  let initialTitle = ''
  let initialAddress = ''
  let initialPreview = false

  if (linkInfo.type === 'markdown') {
    initialTitle = linkInfo.text || ''
    initialAddress = linkInfo.url || ''
    // Check if preview is enabled for this specific link
    initialPreview = linkInfo.isPreview || false
  } else {
    // For plain URLs and emails
    initialTitle = ''
    initialAddress = linkInfo.url || ''
    initialPreview = false
  }

  console.log('Dialog initialization:', {
    linkInfo,
    initialTitle,
    initialAddress,
    initialPreview
  })

  // Create dialog content
  dialog.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px;">
      <h2 style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">Edit Link</h2>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px;">
      <input 
        type="text" 
        id="link-title-input" 
        placeholder="Title"
        value="${initialTitle}"
        style="
          padding: 6px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 12px;
          outline: none;
          transition: border-color 0.2s;
        "
      />
      <input 
        type="text" 
        id="link-address-input" 
        placeholder="Address"
        value="${initialAddress}"
        style="
          padding: 6px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 12px;
          outline: none;
          transition: border-color 0.2s;
        "
      />
    </div>
    
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #374151; cursor: pointer;">
        <input 
          type="checkbox" 
          id="show-preview-checkbox"
          ${initialPreview ? 'checked' : ''}
          style="margin: 0;"
        />
        Show Preview
      </label>
      
      <div style="display: flex; gap: 12px;">
        <button 
          id="cancel-button"
          style="
            padding: 4px 14px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            color: #374151;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          "
        >
          Cancel
        </button>
        <button 
          id="done-button"
          style="
            padding: 4px 14px;
            border: none;
            border-radius: 6px;
            background: #dc2626;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          "
        >
          Done
        </button>
      </div>
    </div>
  `

  overlay.appendChild(dialog)
  document.body.appendChild(overlay)

  // Position the dialog relative to the target element if provided
  if (targetElement) {
    // Temporarily remove animation class to measure at full size
    dialog.classList.remove('edit-link-dialog-enter')

    const targetRect = targetElement.getBoundingClientRect()
    const dialogRect = dialog.getBoundingClientRect()

    // Calculate center points
    const targetCenterX = targetRect.left + targetRect.width / 2

    // Position dialog below the target, centered horizontally
    const dialogLeft = targetCenterX - dialogRect.width / 2
    const dialogTop = targetRect.bottom + 10 // 10px gap below target

    // Ensure dialog stays within viewport bounds
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let finalLeft = Math.max(
      10,
      Math.min(dialogLeft, viewportWidth - dialogRect.width - 10)
    )
    let finalTop = Math.max(
      10,
      Math.min(dialogTop, viewportHeight - dialogRect.height - 10)
    )

    // If dialog would be cut off at the bottom, position it above the target instead
    if (dialogTop + dialogRect.height > viewportHeight - 10) {
      finalTop = targetRect.top - dialogRect.height - 10
      // Ensure it doesn't go above viewport
      finalTop = Math.max(10, finalTop)
    }

    // Remove centering styles and position absolutely
    overlay.style.alignItems = 'flex-start'
    overlay.style.justifyContent = 'flex-start'
    dialog.style.position = 'absolute'
    dialog.style.left = `${finalLeft}px`
    dialog.style.top = `${finalTop}px`

    // Re-add animation class
    dialog.classList.add('edit-link-dialog-enter')
  }

  // Force reflow to ensure the enter class is applied
  dialog.offsetHeight

  // Trigger animation by adding active class
  setTimeout(() => {
    dialog.classList.add('edit-link-dialog-enter-active')
  }, 10)

  // Get references to elements
  const titleInput = dialog.querySelector('#link-title-input')
  const addressInput = dialog.querySelector('#link-address-input')
  const previewCheckbox = dialog.querySelector('#show-preview-checkbox')
  const cancelButton = dialog.querySelector('#cancel-button')
  const doneButton = dialog.querySelector('#done-button')

  // REMOVED: Real-time preview update functions that were causing conflicts
  // The real-time updates were interfering with the editor's state management
  // We'll only update when the user clicks "Done"

  // Add hover effects
  const addHoverEffects = () => {
    // Input focus effects
    ;[titleInput, addressInput].forEach((input) => {
      input.addEventListener('focus', () => {
        input.style.borderColor = '#dc2626'
        input.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)'
      })
      input.addEventListener('blur', () => {
        input.style.borderColor = '#d1d5db'
        input.style.boxShadow = 'none'
      })
    })

    // Button hover effects
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.backgroundColor = '#f9fafb'
      cancelButton.style.borderColor = '#9ca3af'
    })
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.backgroundColor = 'white'
      cancelButton.style.borderColor = '#d1d5db'
    })

    doneButton.addEventListener('mouseenter', () => {
      doneButton.style.backgroundColor = '#b91c1c'
    })
    doneButton.addEventListener('mouseleave', () => {
      doneButton.style.backgroundColor = '#dc2626'
    })
  }

  addHoverEffects()

  // Focus the title input after animation
  setTimeout(() => titleInput.focus(), 300)

  // Event handlers
  const closeDialog = () => {
    overlay.remove()
  }

  const handleSave = () => {
    const newTitle = titleInput.value.trim()
    const newAddress = addressInput.value.trim()
    const showPreview = previewCheckbox.checked

    console.log('Dialog save data:', {
      newTitle,
      newAddress,
      showPreview,
      originalLinkInfo: linkInfo
    })

    if (newAddress) {
      onSave({
        title: newTitle,
        address: newAddress,
        showPreview: showPreview,
        originalLinkInfo: linkInfo
      })
    }

    closeDialog()
  }

  // Button event listeners
  cancelButton.addEventListener('click', closeDialog)
  doneButton.addEventListener('click', handleSave)

  // Handle Enter and Escape keys
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeDialog()
    }
  }

  dialog.addEventListener('keydown', handleKeyDown)

  return overlay
}

export const createEditLinkDialog = (
  linkInfo,
  view,
  onSave,
  targetElement = null
) => {
  // IMMEDIATE DEBUG - log what we receive and trace the call
  console.log('=== DIALOG CREATION DEBUG ===')
  console.log('targetElement received:', targetElement)
  console.log('targetElement type:', typeof targetElement)
  console.log('targetElement is null:', targetElement === null)
  console.log('targetElement classList:', targetElement?.classList)
  console.log('targetElement tagName:', targetElement?.tagName)
  console.log('Call stack trace:', new Error().stack)
  console.log('=== END DIALOG CREATION DEBUG ===')

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
        transform: translateY(200%) !important;
        opacity: 1 !important;
      }
      .edit-link-dialog-enter-active {
        transform: translateY(0%) !important;
        opacity: 1 !important;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      
      /* React Native-style Switch Styles - Fixed */
        .switch {
          position: relative;
          display: inline-block;
          width: 51px;
          height: 31px;
          margin: 0;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .switch-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #e5e7eb;
          border-radius: 31px;
          transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
        }

        .switch-slider:before {
          position: absolute;
          content: "";
          height: 27px;
          width: 27px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          border-radius: 50%;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                      box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .switch input:checked + .switch-slider {
          background-color: #dc2626;
        }

        .switch input:checked + .switch-slider:before {
          transform: translateX(20px);
        }

        .switch input:disabled + .switch-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Additional fix: Prevent any outline/focus ring */
        .switch input:focus + .switch-slider {
          outline: none;
        }

        /* Prevent any webkit tap highlight */
        .switch {
          -webkit-tap-highlight-color: transparent;
        }

        .switch-slider {
          -webkit-tap-highlight-color: transparent;
        }
    `
    document.head.appendChild(style)
  }

  // Create overlay with semi-transparent backdrop
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
    padding: 10px;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    // background: rgba(0, 0, 0, 0.21);
    pointer-events: auto;
  `

  // Create dialog box with fixed width
  const dialog = document.createElement('div')
  dialog.className = 'edit-link-dialog edit-link-dialog-enter'
  dialog.style.cssText = `
    background: white;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    padding: 16px;
    width: 350px;
    position: relative;
    pointer-events: auto;
    box-sizing: border-box;
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
      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">Edit Link</h2>
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
          font-size: 16px;
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
          font-size: 16px;
          outline: none;
          transition: border-color 0.2s;
        "
      />
    </div>
    
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
      <label style="display: flex; width: 100%; align-items: center; margin-bottom: 20px; justify-content: space-between; gap: 5px; font-size: 16px; color: #374151; cursor: pointer;">
        <span>Show Link Preview</span>
        <label class="switch">
          <input 
              type="checkbox"
              id="show-preview-checkbox"
              tabindex="-1"
              ${initialPreview ? 'checked' : ''}
          />
          <span class="switch-slider"></span>
        </label>
      </label>
      
      <div style="display: flex; gap: 8px; width: 100%;">
        <button 
          id="cancel-button"
          style="
            flex: 1;
            padding: 10px 14px;
            // border: 1px solid #d1d5db;
            border-radius: 8px;
            background: rgb(255, 244, 244);
            color: #dc2626;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
          "
        >
          Cancel
        </button>
        <button 
          id="done-button"
          style="
            flex: 1;
            padding: 10px 14px;
            border: none;
            border-radius: 8px;
            background: #dc2626;
            color: white;
            font-weight: 600;
            font-size: 16px;
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

  // Get references to elements BEFORE positioning
  const titleInput = dialog.querySelector('#link-title-input')
  const addressInput = dialog.querySelector('#link-address-input')
  const previewCheckbox = dialog.querySelector('#show-preview-checkbox')
  const cancelButton = dialog.querySelector('#cancel-button')
  const doneButton = dialog.querySelector('#done-button')

  previewCheckbox.setAttribute('tabindex', '-1')
  // if iOS still focuses it, immediately bounce focus back to the title input
  previewCheckbox.addEventListener('focus', (e) => {
    e.preventDefault()
    titleInput.focus({ preventScroll: true })
  })

  // FOCUS THE INPUT IMMEDIATELY - before any animations or positioning
  // Use preventScroll to avoid page jumping when focus is applied
  titleInput.focus({ preventScroll: true })

  // Apply focus styles immediately since event listeners aren't set up yet
  titleInput.style.borderColor = '#dc2626'
  titleInput.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)'

  // Force reflow to ensure the dialog is rendered
  dialog.offsetHeight

  // Position the dialog intelligently after a brief delay to ensure proper rendering
  setTimeout(() => {
    console.log('About to check targetElement...', targetElement)

    // Always switch to absolute positioning mode when we have specific placement needs
    overlay.style.alignItems = 'flex-start'
    overlay.style.justifyContent = 'flex-start'
    dialog.style.position = 'absolute'

    // Use the actual measured dialog width for more accurate positioning
    const dialogWidth = dialog.offsetWidth || 350 // Use measured width, fallback to 350
    const dialogHeight = dialog.offsetHeight || 200 // Fallback height

    // Always use safe positioning relative to bottom of viewport to clear keyboard
    console.log('Using safe positioning relative to bottom of viewport')

    // Position from bottom: keyboard height (~300px) + dialog height + safety margin
    const keyboardClearance = 300 // Estimated iOS keyboard height
    const safetyMargin = 110 // Extra margin for safety
    const distanceFromBottom = keyboardClearance + dialogHeight + safetyMargin

    // Calculate top position: viewport height minus our distance from bottom
    const safeTop = window.innerHeight - distanceFromBottom

    // Ensure we don't go above the top of the viewport (minimum 20px from top)
    const finalTop = Math.max(20, safeTop)

    const centerLeft = (window.innerWidth - dialogWidth) / 2
    dialog.style.top = `${finalTop}px`
    dialog.style.left = `${centerLeft}px`
    dialog.style.transform = 'none'

    if (targetElement) {
      console.log(
        `Target element present - positioned at top: ${finalTop} (${distanceFromBottom}px from bottom), centered at left: ${centerLeft}`
      )
    } else {
      console.log(
        `No target element - positioned at top: ${finalTop} (${distanceFromBottom}px from bottom), centered at left: ${centerLeft}`
      )
    }
  }, 10)

  // Force reflow to ensure the enter class is applied
  dialog.offsetHeight

  // Trigger animation by adding active class
  setTimeout(() => {
    dialog.classList.add('edit-link-dialog-enter-active')
  }, 10)

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

  // Prevent touchmove from scrolling page
  overlay.addEventListener('touchmove', (e) => {
    e.preventDefault()
  })

  return overlay
}

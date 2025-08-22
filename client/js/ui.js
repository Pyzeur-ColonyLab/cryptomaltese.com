/**
 * UI utility functions for the incident reporting application
 */

class UIManager {
    constructor() {
        this.loadingOverlay = document.getElementById('loading-overlay')
        this.toastContainer = document.getElementById('toast-container')
        this.submitTabPanel = document.getElementById('tab-submit')
        this.visualizeTabPanel = document.getElementById('tab-visualize')
        this.formSection = document.querySelector('.form-section')
        this.successSection = document.getElementById('success-section')
        
        this.toastTimeouts = new Map()
    }

    /**
     * Show loading overlay with message
     * @param {string} message - Loading message
     * @param {string} subtext - Loading subtext
     */
    showLoading(message = 'Processing...', subtext = '') {
        const loadingText = this.loadingOverlay.querySelector('.loading-text')
        const loadingSubtext = this.loadingOverlay.querySelector('.loading-subtext')
        
        loadingText.textContent = message
        loadingSubtext.textContent = subtext
        loadingSubtext.style.display = subtext ? 'block' : 'none'
        
        this.loadingOverlay.style.display = 'flex'
        document.body.style.overflow = 'hidden'
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.loadingOverlay.style.display = 'none'
        document.body.style.overflow = ''
    }

    /**
     * Show toast notification
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    showToast(title, message, type = 'info', duration = 5000) {
        const toast = this.createToastElement(title, message, type)
        this.toastContainer.appendChild(toast)

        // Auto-remove after duration
        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                this.removeToast(toast)
            }, duration)
            
            this.toastTimeouts.set(toast, timeoutId)
        }

        // Allow manual close
        toast.addEventListener('click', () => {
            this.removeToast(toast)
        })

        return toast
    }

    /**
     * Create toast element
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @returns {HTMLElement} Toast element
     */
    createToastElement(title, message, type) {
        const toast = document.createElement('div')
        toast.className = `toast ${type}`
        toast.setAttribute('role', 'alert')
        toast.setAttribute('aria-live', 'polite')
        
        toast.innerHTML = `
            <div class="toast-title">${this.escapeHtml(title)}</div>
            <div class="toast-message">${this.escapeHtml(message)}</div>
        `

        return toast
    }

    /**
     * Remove toast notification
     * @param {HTMLElement} toast - Toast element to remove
     */
    removeToast(toast) {
        // Clear timeout if exists
        if (this.toastTimeouts.has(toast)) {
            clearTimeout(this.toastTimeouts.get(toast))
            this.toastTimeouts.delete(toast)
        }

        // Animate out
        toast.style.transform = 'translateX(100%)'
        toast.style.opacity = '0'
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast)
            }
        }, 300)
    }

    /**
     * Clear all toast notifications
     */
    clearAllToasts() {
        const toasts = this.toastContainer.querySelectorAll('.toast')
        toasts.forEach(toast => this.removeToast(toast))
    }

    /**
     * Show success notification
     * @param {string} message - Success message
     * @param {string} title - Success title
     */
    showSuccess(message, title = 'Success') {
        this.showToast(title, message, 'success')
    }

    /**
     * Show error notification
     * @param {string} message - Error message
     * @param {string} title - Error title
     */
    showError(message, title = 'Error') {
        this.showToast(title, message, 'error', 8000) // Longer duration for errors
    }

    /**
     * Show warning notification
     * @param {string} message - Warning message
     * @param {string} title - Warning title
     */
    showWarning(message, title = 'Warning') {
        this.showToast(title, message, 'warning')
    }

    /**
     * Show info notification
     * @param {string} message - Info message
     * @param {string} title - Info title
     */
    showInfo(message, title = 'Info') {
        this.showToast(title, message, 'info')
    }

    /**
     * Show success page with incident details
     * @param {Object} incidentData - Incident data from API
     */
    showSuccessPage(incidentData) {
        // Hide form section
        this.formSection.style.display = 'none'
        
        // Update success section content
        const incidentIdElement = document.getElementById('incident-id')
        incidentIdElement.textContent = incidentData.incidentId || 'Unknown'
        
        // Show success section
        this.successSection.style.display = 'block'
        
        // Scroll to top of success section
        this.successSection.scrollIntoView({ behavior: 'smooth' })
        
        // Focus on the success section for accessibility
        this.successSection.setAttribute('tabindex', '-1')
        this.successSection.focus()
    }

    /**
     * Show form and hide success page
     */
    showForm() {
        this.successSection.style.display = 'none'
        this.formSection.style.display = 'block'
        
        // Ensure we're on the submit tab
        if (window.tabManager && window.tabManager.getActiveTabId() !== 'submit') {
            window.tabManager.activateTabById('submit')
        }
        
        // Focus on first form field
        const firstField = document.getElementById('wallet-address')
        if (firstField) {
            firstField.focus()
        }
    }

    /**
     * Scroll to element smoothly
     * @param {string|HTMLElement} element - Element or selector to scroll to
     * @param {number} offset - Offset from top in pixels
     */
    scrollTo(element, offset = 0) {
        const target = typeof element === 'string' 
            ? document.querySelector(element) 
            : element

        if (target) {
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            })
        }
    }

    /**
     * Show validation errors on form
     * @param {Object} errors - Validation errors object
     * @param {FormValidator} formValidator - Form validator instance
     */
    showValidationErrors(errors, formValidator) {
        Object.entries(errors).forEach(([field, message]) => {
            formValidator.showFieldError(field, message)
        })

        // Show toast notification
        this.showError('Please correct the highlighted fields', 'Validation Error')
        
        // Focus on first error field
        const firstErrorField = Object.keys(errors)[0]
        if (firstErrorField) {
            const fieldElement = formValidator.fields[firstErrorField]
            if (fieldElement) {
                fieldElement.focus()
                this.scrollTo(fieldElement, 100)
            }
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} unsafe - Unsafe string
     * @returns {string} Safe HTML string
     */
    escapeHtml(unsafe) {
        const div = document.createElement('div')
        div.textContent = unsafe
        return div.innerHTML
    }

    /**
     * Format date for display
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        const dateObj = typeof date === 'string' ? new Date(date) : date
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    /**
     * Format transaction hash for display (shortened)
     * @param {string} hash - Full transaction hash
     * @returns {string} Shortened hash
     */
    formatTransactionHash(hash) {
        if (!hash || hash.length < 10) return hash
        return `${hash.slice(0, 6)}...${hash.slice(-4)}`
    }

    /**
     * Format wallet address for display (shortened)
     * @param {string} address - Full wallet address
     * @returns {string} Shortened address
     */
    formatWalletAddress(address) {
        if (!address || address.length < 10) return address
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text)
                return true
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea')
                textArea.value = text
                textArea.style.position = 'fixed'
                textArea.style.left = '-999999px'
                textArea.style.top = '-999999px'
                document.body.appendChild(textArea)
                textArea.focus()
                textArea.select()
                
                const success = document.execCommand('copy')
                document.body.removeChild(textArea)
                return success
            }
        } catch (error) {
            console.error('Failed to copy text:', error)
            return false
        }
    }

    /**
     * Add copy functionality to element
     * @param {HTMLElement} element - Element to add copy functionality to
     * @param {string} textToCopy - Text to copy when clicked
     * @param {string} successMessage - Message to show on successful copy
     */
    addCopyFunctionality(element, textToCopy, successMessage = 'Copied to clipboard') {
        element.style.cursor = 'pointer'
        element.setAttribute('title', 'Click to copy')
        
        element.addEventListener('click', async () => {
            const success = await this.copyToClipboard(textToCopy)
            if (success) {
                this.showSuccess(successMessage)
            } else {
                this.showError('Failed to copy to clipboard')
            }
        })
    }

    /**
     * Animate element entrance
     * @param {HTMLElement} element - Element to animate
     * @param {string} animation - Animation type
     */
    animateIn(element, animation = 'fadeIn') {
        element.style.opacity = '0'
        element.style.transform = 'translateY(20px)'
        
        requestAnimationFrame(() => {
            element.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
            element.style.opacity = '1'
            element.style.transform = 'translateY(0)'
        })
    }

    /**
     * Check if user prefers reduced motion
     * @returns {boolean} True if user prefers reduced motion
     */
    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    /**
     * Focus trap for modal/overlay accessibility
     * @param {HTMLElement} container - Container to trap focus within
     */
    trapFocus(container) {
        const focusableElements = container.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        
        const firstFocusable = focusableElements[0]
        const lastFocusable = focusableElements[focusableElements.length - 1]

        container.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus()
                        e.preventDefault()
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus()
                        e.preventDefault()
                    }
                }
            }
        })

        // Focus first element
        if (firstFocusable) {
            firstFocusable.focus()
        }
    }
}

// Create global UI manager instance
window.uiManager = new UIManager()

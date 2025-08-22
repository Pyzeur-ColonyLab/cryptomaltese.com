/**
 * Main application JavaScript file
 * Coordinates the incident reporting form functionality
 */

class IncidentReportApp {
    constructor() {
        this.form = document.getElementById('incident-form')
        this.reportAnotherButton = document.getElementById('report-another')
        
        this.formValidator = null
        this.isSubmitting = false
        
        this.init()
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupFormValidator()
        this.setupEventListeners()
        this.initializeTabManager()
        this.performHealthCheck()
        
        console.log('Incident Report App initialized')
    }

    /**
     * Set up form validation
     */
    setupFormValidator() {
        this.formValidator = new FormValidator(this.form)
    }

    /**
     * Initialize tab manager
     */
    initializeTabManager() {
        if (window.TabManager) {
            window.tabManager = new TabManager()
            
            // Listen to tab change events
            document.addEventListener('tabchange', (event) => {
                console.log('Tab changed to:', event.detail.tabId)
                this.handleTabChange(event.detail.tabId, event.detail.panelId)
            })
        } else {
            console.warn('TabManager not available')
        }
    }

    /**
     * Handle tab change events
     * @param {string} tabId - ID of the activated tab
     * @param {string} panelId - ID of the activated panel
     */
    handleTabChange(tabId, panelId) {
        // Handle any tab-specific logic here
        switch (tabId) {
            case 'submit':
                // Ensure form validation is working
                if (this.formValidator) {
                    this.formValidator.refresh()
                }
                break
            
            case 'visualize':
                // Future: Initialize visualization components
                break
            
            default:
                console.log('Unknown tab:', tabId)
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault()
            this.handleFormSubmit()
        })

        // Report another incident button
        this.reportAnotherButton.addEventListener('click', () => {
            this.resetForm()
        })

        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.handleBrowserNavigation()
        })

        // Handle visibility change (tab focus/blur)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isSubmitting) {
                // User returned to tab during submission, show appropriate UI
                uiManager.showLoading('Processing incident report...', 'Retrieving blockchain data')
            }
        })

        // Global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason)
            uiManager.showError('An unexpected error occurred. Please try again.')
            event.preventDefault()
        })

        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error)
            if (!event.error.message?.includes('Script error')) {
                uiManager.showError('An unexpected error occurred. Please refresh the page and try again.')
            }
        })
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit() {
        if (this.isSubmitting) {
            return // Prevent double submission
        }

        try {
            // Validate form
            const validation = this.formValidator.validateForm()
            if (!validation.isValid) {
                uiManager.showValidationErrors(validation.errors, this.formValidator)
                return
            }

            this.isSubmitting = true
            
            // Set loading state
            this.formValidator.setLoading(true)
            uiManager.showLoading('Processing incident report...', 'Retrieving blockchain data')

            // Get form data
            const formData = this.formValidator.getFormData()
            
            // Prepare API payload
            const payload = {
                walletAddress: formData.walletAddress.trim(),
                transactionHash: formData.transactionHash.trim(),
                description: formData.description.trim()
            }

            console.log('Submitting incident report:', { ...payload, description: '[REDACTED]' })

            // Submit to API
            const response = await incidentAPI.submitIncident(payload)
            console.log('Incident submitted successfully:', response.data.incidentId)

            // Handle success
            await this.handleSubmissionSuccess(response)

        } catch (error) {
            console.error('Error submitting incident:', error)
            await this.handleSubmissionError(error)
        } finally {
            this.isSubmitting = false
            this.formValidator.setLoading(false)
            uiManager.hideLoading()
        }
    }

    /**
     * Handle successful form submission
     * @param {Object} response - API response
     */
    async handleSubmissionSuccess(response) {
        const incidentData = ResponseHelper.extractIncidentData(response)
        
        // Show success page
        uiManager.showSuccessPage(incidentData)
        
        // Add copy functionality to incident ID
        const incidentIdElement = document.getElementById('incident-id')
        uiManager.addCopyFunctionality(
            incidentIdElement, 
            incidentData.incidentId,
            'Incident ID copied to clipboard'
        )

        // Update browser history
        history.pushState({ page: 'success', incidentId: incidentData.incidentId }, '', '#success')

        // Show success toast
        uiManager.showSuccess('Your incident has been reported successfully!')

        // Analytics (if implemented)
        this.trackEvent('incident_submitted', {
            incident_id: incidentData.incidentId,
            wallet_address: incidentData.walletAddress,
            transaction_count: incidentData.transactionCount
        })
    }

    /**
     * Handle form submission error
     * @param {Error} error - The error that occurred
     */
    async handleSubmissionError(error) {
        const formattedError = ResponseHelper.formatError(error)
        
        if (error instanceof APIError) {
            if (error.isValidationError()) {
                // Handle server-side validation errors
                const validationErrors = error.getValidationErrors()
                if (validationErrors) {
                    this.handleServerValidationErrors(validationErrors)
                    return
                }
            }
            
            if (error.isDuplicateError()) {
                // Handle duplicate transaction error
                uiManager.showWarning(
                    'This transaction has already been reported. Each transaction can only be reported once.',
                    'Duplicate Report'
                )
                return
            }
        }

        // Show general error
        uiManager.showError(formattedError.message, formattedError.title)

        // Analytics (if implemented)
        this.trackEvent('incident_submission_error', {
            error_type: formattedError.type,
            error_message: formattedError.message
        })
    }

    /**
     * Handle server-side validation errors
     * @param {Array} errors - Validation errors from server
     */
    handleServerValidationErrors(errors) {
        const errorMap = {}
        
        errors.forEach(error => {
            const field = this.mapServerFieldToClientField(error.field)
            if (field) {
                errorMap[field] = error.message
            }
        })

        if (Object.keys(errorMap).length > 0) {
            uiManager.showValidationErrors(errorMap, this.formValidator)
        } else {
            uiManager.showError('Please check your input and try again.', 'Validation Error')
        }
    }

    /**
     * Map server field names to client field names
     * @param {string} serverField - Server field name
     * @returns {string|null} Client field name
     */
    mapServerFieldToClientField(serverField) {
        const fieldMap = {
            'walletAddress': 'walletAddress',
            'transactionHash': 'transactionHash',
            'description': 'description'
        }
        
        return fieldMap[serverField] || null
    }

    /**
     * Reset form to initial state
     */
    resetForm() {
        // Clear form
        this.formValidator.clearForm()
        this.formValidator.clearErrors()
        
        // Show form section
        uiManager.showForm()
        
        // Update browser history
        history.pushState({ page: 'form' }, '', '/')
        
        // Clear any existing toasts
        uiManager.clearAllToasts()
        
        console.log('Form reset to initial state')
    }

    /**
     * Handle browser navigation (back/forward buttons)
     */
    handleBrowserNavigation() {
        const state = history.state
        
        if (state?.page === 'success') {
            // User navigated back to success page
            const incidentData = { incidentId: state.incidentId }
            uiManager.showSuccessPage(incidentData)
        } else {
            // User navigated back to form
            uiManager.showForm()
        }
    }

    /**
     * Perform API health check
     */
    async performHealthCheck() {
        try {
            await incidentAPI.checkHealth()
            console.log('API health check passed')
        } catch (error) {
            console.warn('API health check failed:', error)
            uiManager.showWarning(
                'Unable to verify server connection. Some features may not work properly.',
                'Connection Warning'
            )
        }
    }

    /**
     * Track analytics event (placeholder for future implementation)
     * @param {string} eventName - Event name
     * @param {Object} properties - Event properties
     */
    trackEvent(eventName, properties = {}) {
        // Placeholder for analytics implementation
        console.log('Analytics event:', eventName, properties)
        
        // Example: Google Analytics 4
        // if (typeof gtag !== 'undefined') {
        //     gtag('event', eventName, properties)
        // }
        
        // Example: Mixpanel
        // if (typeof mixpanel !== 'undefined') {
        //     mixpanel.track(eventName, properties)
        // }
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + Enter to submit form
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            if (uiManager.formSection.style.display !== 'none') {
                event.preventDefault()
                this.handleFormSubmit()
            }
        }
        
        // Escape to clear form or close success page
        if (event.key === 'Escape') {
            if (uiManager.successSection.style.display !== 'none') {
                this.resetForm()
            } else {
                this.formValidator.clearForm()
            }
        }
    }

    /**
     * Initialize keyboard shortcuts
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event)
        })
    }

    /**
     * Show debug information (development only)
     */
    showDebugInfo() {
        if (process?.env?.NODE_ENV === 'development') {
            console.group('Debug Information')
            console.log('Form validator:', this.formValidator)
            console.log('Current form data:', this.formValidator.getFormData())
            console.log('Form validation:', this.formValidator.validateForm())
            console.log('UI manager:', uiManager)
            console.log('API client:', incidentAPI)
            console.groupEnd()
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new IncidentReportApp()
    
    // Initialize keyboard shortcuts
    window.app.initKeyboardShortcuts()
    
    // Add debug helper (development only)
    if (process?.env?.NODE_ENV === 'development') {
        window.debug = () => window.app.showDebugInfo()
    }
})

// Service Worker registration (for future PWA features)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Uncomment when service worker is implemented
            // const registration = await navigator.serviceWorker.register('/sw.js')
            // console.log('Service Worker registered:', registration)
        } catch (error) {
            console.log('Service Worker registration failed:', error)
        }
    })
}

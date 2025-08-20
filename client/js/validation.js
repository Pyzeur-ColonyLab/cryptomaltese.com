/**
 * Client-side validation module for incident reporting form
 */

// Validation patterns
const PATTERNS = {
    ethereumAddress: /^0x[a-fA-F0-9]{40}$/,
    transactionHash: /^0x[a-fA-F0-9]{64}$/
}

// Validation messages
const MESSAGES = {
    required: 'This field is required',
    ethereumAddress: 'Please enter a valid Ethereum address (0x followed by 40 hex characters)',
    transactionHash: 'Please enter a valid transaction hash (0x followed by 64 hex characters)',
    descriptionMin: 'Description must be at least 10 characters long',
    descriptionMax: 'Description cannot exceed 1000 characters'
}

/**
 * Validation utility functions
 */
const Validator = {
    /**
     * Validate Ethereum address format
     * @param {string} address - The address to validate
     * @returns {Object} Validation result
     */
    validateEthereumAddress(address) {
        if (!address || address.trim() === '') {
            return { isValid: false, message: MESSAGES.required }
        }
        
        const trimmed = address.trim()
        if (!PATTERNS.ethereumAddress.test(trimmed)) {
            return { isValid: false, message: MESSAGES.ethereumAddress }
        }
        
        return { isValid: true, message: '' }
    },

    /**
     * Validate transaction hash format
     * @param {string} hash - The transaction hash to validate
     * @returns {Object} Validation result
     */
    validateTransactionHash(hash) {
        if (!hash || hash.trim() === '') {
            return { isValid: false, message: MESSAGES.required }
        }
        
        const trimmed = hash.trim()
        if (!PATTERNS.transactionHash.test(trimmed)) {
            return { isValid: false, message: MESSAGES.transactionHash }
        }
        
        return { isValid: true, message: '' }
    },

    /**
     * Validate incident description
     * @param {string} description - The description to validate
     * @returns {Object} Validation result
     */
    validateDescription(description) {
        if (!description || description.trim() === '') {
            return { isValid: false, message: MESSAGES.required }
        }
        
        const trimmed = description.trim()
        
        if (trimmed.length < 10) {
            return { isValid: false, message: MESSAGES.descriptionMin }
        }
        
        if (trimmed.length > 1000) {
            return { isValid: false, message: MESSAGES.descriptionMax }
        }
        
        return { isValid: true, message: '' }
    },

    /**
     * Validate entire form
     * @param {Object} formData - Form data to validate
     * @returns {Object} Validation result with field-specific errors
     */
    validateForm(formData) {
        const errors = {}
        let hasErrors = false

        // Validate wallet address
        const walletResult = this.validateEthereumAddress(formData.walletAddress)
        if (!walletResult.isValid) {
            errors.walletAddress = walletResult.message
            hasErrors = true
        }

        // Validate transaction hash
        const hashResult = this.validateTransactionHash(formData.transactionHash)
        if (!hashResult.isValid) {
            errors.transactionHash = hashResult.message
            hasErrors = true
        }

        // Validate description
        const descResult = this.validateDescription(formData.description)
        if (!descResult.isValid) {
            errors.description = descResult.message
            hasErrors = true
        }

        return {
            isValid: !hasErrors,
            errors
        }
    }
}

/**
 * Real-time form validation class
 */
class FormValidator {
    constructor(formElement) {
        this.form = formElement
        this.fields = {
            walletAddress: formElement.querySelector('#wallet-address'),
            transactionHash: formElement.querySelector('#transaction-hash'),
            description: formElement.querySelector('#description')
        }
        this.submitButton = formElement.querySelector('#submit-button')
        this.characterCounter = formElement.querySelector('#description-counter')
        
        this.init()
    }

    init() {
        this.setupEventListeners()
        this.updateCharacterCounter()
        this.validateForm()
    }

    setupEventListeners() {
        // Real-time validation on input
        Object.entries(this.fields).forEach(([fieldName, field]) => {
            field.addEventListener('input', () => {
                this.validateField(fieldName)
                this.validateForm()
            })

            field.addEventListener('blur', () => {
                this.validateField(fieldName)
                this.validateForm()
            })
        })

        // Character counter for description
        this.fields.description.addEventListener('input', () => {
            this.updateCharacterCounter()
        })
    }

    validateField(fieldName) {
        const field = this.fields[fieldName]
        const value = field.value
        let result

        switch (fieldName) {
            case 'walletAddress':
                result = Validator.validateEthereumAddress(value)
                break
            case 'transactionHash':
                result = Validator.validateTransactionHash(value)
                break
            case 'description':
                result = Validator.validateDescription(value)
                break
            default:
                return
        }

        this.displayFieldValidation(fieldName, result)
        return result
    }

    displayFieldValidation(fieldName, result) {
        const field = this.fields[fieldName]
        const errorElement = document.getElementById(`${fieldName.replace(/([A-Z])/g, '-$1').toLowerCase()}-error`)

        // Remove existing validation classes
        field.classList.remove('error', 'success')

        if (result.isValid) {
            // Show success state only if field has content
            if (field.value.trim()) {
                field.classList.add('success')
            }
            errorElement.textContent = ''
        } else {
            field.classList.add('error')
            errorElement.textContent = result.message
        }
    }

    validateForm() {
        const formData = this.getFormData()
        const validation = Validator.validateForm(formData)
        
        // Enable/disable submit button
        this.submitButton.disabled = !validation.isValid
        
        return validation
    }

    getFormData() {
        return {
            walletAddress: this.fields.walletAddress.value,
            transactionHash: this.fields.transactionHash.value,
            description: this.fields.description.value
        }
    }

    updateCharacterCounter() {
        const description = this.fields.description.value
        const currentLength = description.length
        const maxLength = 1000
        
        const currentSpan = this.characterCounter.querySelector('.current')
        currentSpan.textContent = currentLength

        // Remove existing classes
        this.characterCounter.classList.remove('warning', 'error')

        // Add warning/error classes based on length
        if (currentLength > maxLength * 0.9) {
            this.characterCounter.classList.add('warning')
        }
        if (currentLength > maxLength) {
            this.characterCounter.classList.add('error')
        }
    }

    clearForm() {
        Object.values(this.fields).forEach(field => {
            field.value = ''
            field.classList.remove('error', 'success')
        })

        // Clear error messages
        this.form.querySelectorAll('.form-error').forEach(error => {
            error.textContent = ''
        })

        this.updateCharacterCounter()
        this.validateForm()
    }

    setLoading(isLoading) {
        this.submitButton.classList.toggle('loading', isLoading)
        this.submitButton.disabled = isLoading
        
        // Disable all form inputs during loading
        Object.values(this.fields).forEach(field => {
            field.disabled = isLoading
        })
    }

    showFieldError(fieldName, message) {
        const field = this.fields[fieldName]
        const errorElement = document.getElementById(`${fieldName.replace(/([A-Z])/g, '-$1').toLowerCase()}-error`)
        
        field.classList.add('error')
        errorElement.textContent = message
    }

    clearErrors() {
        Object.keys(this.fields).forEach(fieldName => {
            const field = this.fields[fieldName]
            const errorElement = document.getElementById(`${fieldName.replace(/([A-Z])/g, '-$1').toLowerCase()}-error`)
            
            field.classList.remove('error')
            errorElement.textContent = ''
        })
    }
}

// Export for use in other modules
window.FormValidator = FormValidator
window.Validator = Validator

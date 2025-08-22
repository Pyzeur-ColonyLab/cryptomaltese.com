/**
 * Tab Manager for handling tab navigation
 * Provides keyboard navigation and ARIA compliance
 */

class TabManager {
    constructor() {
        this.tabs = []
        this.tabPanels = []
        this.currentTab = null
        
        this.init()
    }

    /**
     * Initialize the tab manager
     */
    init() {
        this.setupTabs()
        this.setupEventListeners()
        this.initializeFromHash()
        
        console.log('TabManager initialized')
    }

    /**
     * Set up tab elements and panels
     */
    setupTabs() {
        this.tabs = Array.from(document.querySelectorAll('[role="tab"]'))
        this.tabPanels = Array.from(document.querySelectorAll('[role="tabpanel"]'))
        
        if (this.tabs.length === 0) {
            console.warn('No tabs found')
            return
        }

        // Set initial tab indexes
        this.tabs.forEach((tab, index) => {
            tab.setAttribute('tabindex', index === 0 ? '0' : '-1')
        })
    }

    /**
     * Set up event listeners for tab interactions
     */
    setupEventListeners() {
        // Click events
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault()
                this.activateTab(tab)
            })
        })

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e)
        })

        // Handle browser navigation
        window.addEventListener('popstate', () => {
            this.initializeFromHash()
        })
    }

    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeydown(event) {
        // Only handle if focus is on a tab
        if (!this.tabs.includes(event.target)) return

        const currentIndex = this.tabs.indexOf(event.target)
        let targetIndex = currentIndex

        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault()
                targetIndex = currentIndex > 0 ? currentIndex - 1 : this.tabs.length - 1
                break
            
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault()
                targetIndex = currentIndex < this.tabs.length - 1 ? currentIndex + 1 : 0
                break
            
            case 'Home':
                event.preventDefault()
                targetIndex = 0
                break
            
            case 'End':
                event.preventDefault()
                targetIndex = this.tabs.length - 1
                break
            
            case 'Enter':
            case ' ':
                event.preventDefault()
                this.activateTab(event.target)
                return
            
            default:
                return
        }

        // Focus and activate the target tab
        this.tabs[targetIndex].focus()
        this.activateTab(this.tabs[targetIndex])
    }

    /**
     * Activate a specific tab
     * @param {HTMLElement} tab - Tab element to activate
     */
    activateTab(tab) {
        if (!tab || this.currentTab === tab) return

        const tabId = tab.getAttribute('data-tab')
        const panelId = tab.getAttribute('aria-controls')

        // Update tab states
        this.tabs.forEach((t, index) => {
            const isActive = t === tab
            
            t.setAttribute('aria-selected', isActive)
            t.setAttribute('tabindex', isActive ? '0' : '-1')
            
            if (isActive) {
                t.classList.add('tab-active')
            } else {
                t.classList.remove('tab-active')
            }
        })

        // Update panel visibility
        this.tabPanels.forEach(panel => {
            if (panel.id === panelId) {
                panel.classList.remove('hidden')
                panel.setAttribute('tabindex', '0')
            } else {
                panel.classList.add('hidden')
                panel.setAttribute('tabindex', '-1')
            }
        })

        this.currentTab = tab

        // Update URL hash
        this.updateURL(tabId)

        // Dispatch custom event
        this.dispatchTabChangeEvent(tabId, panelId)

        console.log(`Activated tab: ${tabId}`)
    }

    /**
     * Activate tab by ID
     * @param {string} tabId - Tab ID to activate
     */
    activateTabById(tabId) {
        const tab = this.tabs.find(t => t.getAttribute('data-tab') === tabId)
        if (tab) {
            this.activateTab(tab)
        }
    }

    /**
     * Get the currently active tab ID
     * @returns {string|null} Active tab ID
     */
    getActiveTabId() {
        return this.currentTab ? this.currentTab.getAttribute('data-tab') : null
    }

    /**
     * Initialize tab based on URL hash
     */
    initializeFromHash() {
        const hash = window.location.hash.slice(1) // Remove #
        let targetTabId = hash

        // Map hash to tab IDs
        if (hash === 'visualize' || hash === 'visualization') {
            targetTabId = 'visualize'
        } else {
            targetTabId = 'submit' // Default to submit tab
        }

        // Find and activate the appropriate tab
        const targetTab = this.tabs.find(tab => 
            tab.getAttribute('data-tab') === targetTabId
        )

        if (targetTab) {
            this.activateTab(targetTab)
        } else {
            // Fallback to first tab
            if (this.tabs.length > 0) {
                this.activateTab(this.tabs[0])
            }
        }
    }

    /**
     * Update URL hash
     * @param {string} tabId - Tab ID
     */
    updateURL(tabId) {
        const hash = `#${tabId}`
        
        // Only update if different from current hash
        if (window.location.hash !== hash) {
            // Use replaceState for initial load, pushState for user interactions
            const method = this.currentTab ? 'pushState' : 'replaceState'
            history[method](
                { tab: tabId }, 
                '', 
                hash
            )
        }
    }

    /**
     * Dispatch custom tab change event
     * @param {string} tabId - Tab ID
     * @param {string} panelId - Panel ID
     */
    dispatchTabChangeEvent(tabId, panelId) {
        const event = new CustomEvent('tabchange', {
            detail: { tabId, panelId },
            bubbles: true
        })
        document.dispatchEvent(event)
    }

    /**
     * Focus the active tab (useful for programmatic focus management)
     */
    focusActiveTab() {
        if (this.currentTab) {
            this.currentTab.focus()
        }
    }

    /**
     * Get tab element by ID
     * @param {string} tabId - Tab ID
     * @returns {HTMLElement|null} Tab element
     */
    getTabById(tabId) {
        return this.tabs.find(tab => tab.getAttribute('data-tab') === tabId) || null
    }

    /**
     * Get panel element by tab ID
     * @param {string} tabId - Tab ID
     * @returns {HTMLElement|null} Panel element
     */
    getPanelByTabId(tabId) {
        const tab = this.getTabById(tabId)
        if (!tab) return null
        
        const panelId = tab.getAttribute('aria-controls')
        return document.getElementById(panelId)
    }

    /**
     * Check if a tab exists
     * @param {string} tabId - Tab ID to check
     * @returns {boolean} True if tab exists
     */
    hasTab(tabId) {
        return this.getTabById(tabId) !== null
    }

    /**
     * Disable/enable a tab
     * @param {string} tabId - Tab ID
     * @param {boolean} disabled - Whether to disable the tab
     */
    setTabDisabled(tabId, disabled) {
        const tab = this.getTabById(tabId)
        if (!tab) return

        if (disabled) {
            tab.setAttribute('aria-disabled', 'true')
            tab.setAttribute('tabindex', '-1')
            tab.classList.add('tab-disabled')
        } else {
            tab.removeAttribute('aria-disabled')
            tab.classList.remove('tab-disabled')
            
            // Update tabindex based on whether it's active
            const isActive = tab.classList.contains('tab-active')
            tab.setAttribute('tabindex', isActive ? '0' : '-1')
        }
    }

    /**
     * Destroy the tab manager and remove event listeners
     */
    destroy() {
        // Remove event listeners
        this.tabs.forEach(tab => {
            tab.removeEventListener('click', this.handleTabClick)
        })
        
        document.removeEventListener('keydown', this.handleKeydown)
        window.removeEventListener('popstate', this.initializeFromHash)
        
        // Clear references
        this.tabs = []
        this.tabPanels = []
        this.currentTab = null
        
        console.log('TabManager destroyed')
    }
}

// Create global tab manager instance (will be initialized by app.js)
window.TabManager = TabManager

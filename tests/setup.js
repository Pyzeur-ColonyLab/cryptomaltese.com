/**
 * Jest test setup file
 * This file runs before each test file
 */

// Mock DOM APIs for client-side code testing
global.document = {
  createElement: jest.fn(() => ({
    textContent: '',
    innerHTML: '',
    style: {},
    setAttribute: jest.fn(),
    addEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
  })),
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  addEventListener: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    style: {}
  }
}

global.window = {
  location: {
    origin: 'http://localhost:3000'
  },
  matchMedia: jest.fn(() => ({
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn()
  })),
  scrollTo: jest.fn(),
  addEventListener: jest.fn(),
  isSecureContext: true
}

global.navigator = {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
}

// Mock fetch for API testing
global.fetch = jest.fn()

// Mock console methods to reduce noise in tests
const originalConsole = global.console
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}

// Restore console for specific tests if needed
global.restoreConsole = () => {
  global.console = originalConsole
}

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.ETHERSCAN_API_KEY = 'test_api_key'

// Increase timeout for integration tests
jest.setTimeout(30000)

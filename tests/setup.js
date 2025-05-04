/**
 * StayCrest Test Setup
 * 
 * Global setup for Jest tests.
 */

// Setup DOM environment globals
if (typeof window !== 'object') {
  global.window = {};
}

// Setup localStorage mock
if (!global.localStorage) {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
}

// Setup document mock if not in jsdom environment
if (!global.document) {
  global.document = {
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
      setAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
        contains: jest.fn(() => false)
      },
      appendChild: jest.fn()
    })),
    documentElement: {
      setAttribute: jest.fn(),
      style: {
        setProperty: jest.fn()
      }
    },
    body: {
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
        contains: jest.fn(() => false)
      }
    },
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    getElementById: jest.fn(() => null)
  };
}

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}; 
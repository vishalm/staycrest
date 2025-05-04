/**
 * Jest Configuration for StayCrest Tests
 */

module.exports = {
  // The test environment for running tests
  testEnvironment: 'jsdom',
  
  // Automatically clear mock calls, instances and results before every test
  clearMocks: true,
  
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    'js/**/*.js',
    'server.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  
  // The paths to modules that run some code to configure or set up the testing framework before each test
  setupFiles: ['<rootDir>/tests/setup.js'],
  
  // A list of paths to modules that Jest should use to mock resources
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },
  
  // A list of paths to directories that Jest should use to search for files in
  roots: [
    '<rootDir>/tests/',
    '<rootDir>/js/',
    '<rootDir>/'
  ],
  
  // The test match pattern
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Indicates whether we should show console output
  silent: false,
  
  // Transform files with babel-jest for ES modules support
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Set test timeout in milliseconds
  testTimeout: 10000
}; 
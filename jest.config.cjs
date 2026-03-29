module.exports = {
  testEnvironment: 'node',
  verbose: true,
  setupFiles: ['<rootDir>/tests/setup/testEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  clearMocks: true,
};

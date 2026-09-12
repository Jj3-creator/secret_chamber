/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  // expo-crypto needs a real native runtime; swap in a Node-crypto-backed
  // mock so the module under test can run inside plain Jest.
  moduleNameMapper: {
    '^expo-crypto$': '<rootDir>/src/services/__mocks__/expo-crypto.ts',
  },
};

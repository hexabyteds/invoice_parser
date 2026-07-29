module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/api/**/*.test.js"],
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  setupFiles: ["<rootDir>/tests/setup/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/testLifecycle.js"],
  testTimeout: 20000,
  verbose: true,
};

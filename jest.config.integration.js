require("dotenv").config();

module.exports = {
  displayName: "end2end-tests",
  setupFilesAfterEnv: ["<rootDir>/test/jest-setup.ts"],
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  clearMocks: true,
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  transformIgnorePatterns: ["<rootDir>/node_modules/"]
};

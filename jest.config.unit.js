require("dotenv").config();

module.exports = {
  displayName: "unit-tests",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  clearMocks: true,
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  transformIgnorePatterns: ["<rootDir>/node_modules/"]
};

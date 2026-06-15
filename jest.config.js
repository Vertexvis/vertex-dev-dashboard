module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.test.{ts,tsx}",
    "!src/pages/_app.tsx",
    "!src/pages/_document.tsx",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  preset: "ts-jest",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  testMatch: ["**/?(*.)+(test).ts", "**/?(*.)+(test).tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
};

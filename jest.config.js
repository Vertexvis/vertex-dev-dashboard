const coverageConfig = {
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
};

const projectConfig = {
  preset: "ts-jest",
  transform: {
    "^.+\\.(ts|tsx|js|jsx|mjs)$": [
      "ts-jest",
      { tsconfig: "tsconfig.jest.json" },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@mswjs|@open-draft|msw|rettime|until-async|headers-polyfill|is-node-process|outvariant|strict-event-emitter|path-to-regexp)/)",
  ],
};

module.exports = {
  ...coverageConfig,
  projects: [
    {
      ...projectConfig,
      displayName: "browser",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      testEnvironment: "jest-fixed-jsdom",
      testEnvironmentOptions: {
        customExportConditions: [""],
      },
      testMatch: [
        "**/?(*.)+(test).tsx",
        "**/?(*.)+(test).ts",
        "!**/src/__tests__/pages/api/**/*.test.ts",
      ],
      testPathIgnorePatterns: ["/src/__tests__/pages/api/"],
    },
    {
      ...projectConfig,
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["**/src/__tests__/pages/api/**/*.test.ts"],
    },
  ],
};

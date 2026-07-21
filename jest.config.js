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
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/.worktrees/",
    "<rootDir>/.codex[^/]*/",
    "/src/__tests__/pages/api/",
  ],
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
    },
    {
      ...projectConfig,
      displayName: "node",
      setupFilesAfterEnv: ["<rootDir>/test/msw/setupNode.ts"],
      testEnvironment: "node",
      testMatch: ["**/src/__tests__/pages/api/**/*.test.ts"],
    },
  ],
};

const coverageConfig = {
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};

// Directories that can appear inside the repo root depending on workflow
// (git worktrees created in-tree, codex temp dirs, stray sibling checkouts).
// Jest scans from rootDir, so without these ignores it would discover and run
// their test files, causing spurious local failures. Applied to every project.
const nestedCheckoutIgnorePatterns = [
  '/node_modules/',
  '<rootDir>/.worktrees/',
  '<rootDir>/.claude/',
  '<rootDir>/.codex[^/]*/',
  '<rootDir>/vertex-web-sdk/',
];

const projectConfig = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@mswjs|@open-draft|msw|rettime|until-async|headers-polyfill|is-node-process|outvariant|strict-event-emitter|path-to-regexp)/)',
  ],
  testPathIgnorePatterns: nestedCheckoutIgnorePatterns,
};

module.exports = {
  ...coverageConfig,
  projects: [
    {
      ...projectConfig,
      displayName: 'browser',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      testEnvironment: 'jest-fixed-jsdom',
      testEnvironmentOptions: {
        customExportConditions: [''],
      },
      testMatch: [
        '**/?(*.)+(test).tsx',
        '**/?(*.)+(test).ts',
        '!**/src/__tests__/pages/api/**/*.test.ts',
      ],
      testPathIgnorePatterns: [
        ...nestedCheckoutIgnorePatterns,
        '/src/__tests__/pages/api/',
      ],
    },
    {
      ...projectConfig,
      displayName: 'node',
      setupFilesAfterEnv: ['<rootDir>/test/msw/setupNode.ts'],
      testEnvironment: 'node',
      testMatch: ['**/src/__tests__/pages/api/**/*.test.ts'],
    },
  ],
};

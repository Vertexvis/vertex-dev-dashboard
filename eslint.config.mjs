import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import vertexvisTypescript from '@vertexvis/eslint-config-vertexvis-typescript';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// eslint-config-next is legacy-format-only and extends
// 'plugin:react-hooks/recommended'. With eslint-plugin-react-hooks forced to
// v6 (whose `recommended` is a flat-format config), FlatCompat cannot
// translate that entry. Strip it and register react-hooks v6 natively below.
const nextConfig = require('eslint-config-next');
// Maintenance hazard: on future eslint-config-next bumps, react-hooks rules
// added directly under its `rules` key (rather than via extends) would bypass
// this filter and resolve against the pinned v6 plugin — re-verify the shape.
const nextWithoutReactHooks = {
  ...nextConfig,
  parser: require.resolve('eslint-config-next/parser'),
  extends: [
    ...nextConfig.extends.filter((name) => !name.includes('react-hooks')),
    'plugin:@next/next/core-web-vitals',
  ],
};

const TEST_FILES = [
  'src/__tests__/**/*.{ts,tsx}',
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  'test/**/*.{ts,tsx}',
  'jest.setup.ts',
];

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'out/**',
      'public/**',
      'playwright/**',
      '**/*.d.ts',
      '.yarn/**',
      '.codex*/**',
      '.worktrees/**',
    ],
  },
  ...vertexvisTypescript,
  ...compat.config(nextWithoutReactHooks),
  ...compat.extends('prettier'),
  // react-hooks v6 (flat) — sole registration of the 'react-hooks' namespace.
  ...reactHooks.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      'prefer-const': 'error',
      'no-var': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  // Testing Library rules for test files.
  {
    files: TEST_FILES,
    plugins: {
      'testing-library': testingLibrary,
    },
    rules: {
      'testing-library/await-async-events': 'error',
      'testing-library/no-await-sync-events': 'error',
      'testing-library/no-wait-for-multiple-assertions': 'error',
      'testing-library/no-wait-for-side-effects': 'error',
      'testing-library/no-unnecessary-act': 'error',
    },
  },
  // TEMP(PLAT-9101 stack): re-enabled in layer 2
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];

export default config;

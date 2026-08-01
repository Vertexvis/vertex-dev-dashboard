import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import nextPlugin from '@next/eslint-plugin-next';
import vertexvisTypescript from '@vertexvis/eslint-config-vertexvis-typescript';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';

const __dirname = dirname(fileURLToPath(import.meta.url));

// eslint-config-next 15.5.22 ships legacy (eslintrc) format only and its
// loader requires @rushstack/eslint-patch, which hard-fails on ESLint 10.
// We therefore no longer load it (directly or via FlatCompat). Instead we
// recompose its exact contribution natively below:
//   - plugin:@next/next/core-web-vitals  -> nextPlugin.flatConfig.coreWebVitals
//   - plugin:react/recommended           -> react.configs.flat.recommended
//   - its explicit rules overrides       -> the nextCompatRules entry below
//   - plugin:react-hooks/recommended     -> registered separately (see below)
// Dropped relative to eslint-config-next (documented deltas):
//   - the Babel parser for plain JS files (only 4 root config .js files are
//     linted; espree handles them),
//   - eslint-plugin-import resolver settings (no enabled rule needs module
//     resolution; only import/no-anonymous-default-export is on),
//   - env browser/node globals (no enabled rule consults globals; no-undef is
//     not enabled by our config surface).
// Maintenance hazard: when next/eslint-config-next is upgraded, re-verify
// eslint-config-next's composition and mirror any changes here.
//
// eslint-plugin-react 7.37.5, eslint-plugin-jsx-a11y 6.10.2 and
// eslint-plugin-import 2.32.0 all cap their eslint peer range at ^9 and call
// context APIs removed in ESLint 10 (e.g. context.getFilename). Wrap them with
// @eslint/compat's fixup helpers, the documented bridge for pre-v10 plugins.
const nextCompatRules = {
  plugins: {
    'jsx-a11y': fixupPluginRules(jsxA11y),
    import: fixupPluginRules(importPlugin),
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'import/no-anonymous-default-export': 'warn',
    'react/no-unknown-property': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-no-target-blank': 'off',
    'jsx-a11y/alt-text': [
      'warn',
      {
        elements: ['img'],
        img: ['Image'],
      },
    ],
    'jsx-a11y/aria-props': 'warn',
    'jsx-a11y/aria-proptypes': 'warn',
    'jsx-a11y/aria-unsupported-elements': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'warn',
    'jsx-a11y/role-supports-aria-props': 'warn',
  },
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
  ...fixupConfigRules(react.configs.flat.recommended),
  nextPlugin.flatConfig.coreWebVitals,
  nextCompatRules,
  prettier,
  // react-hooks v7 — sole registration of the 'react-hooks' namespace.
  // v7 moved the flat preset to configs.flat.recommended (configs.recommended
  // reverted to legacy format) and its recommended set now enables the full
  // compiler rule suite. We register the plugin and enable only the rules we
  // had under v6 recommended plus our explicit additions, to keep the enforced
  // surface identical (v6 recommended = rules-of-hooks, exhaustive-deps).
  {
    plugins: {
      'react-hooks': reactHooks,
    },
  },
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
  // React source files: react-hooks/immutability (compiler-backed rule).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/immutability': 'error',
    },
  },
  // Production .tsx: prohibit `let`. Tests and all .ts files are exempt.
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/__tests__/**', '**/*.test.tsx', '**/*.spec.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "VariableDeclaration[kind='let']",
          message:
            'Use const with immutable bindings in production .tsx files; refactor control flow instead of let.',
        },
      ],
    },
  },
  // Type-aware rules for all TypeScript (src, tests, scripts, test helpers —
  // root tsconfig.json includes **/*.ts(x), so projectService covers them all).
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
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
];

export default config;

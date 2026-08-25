const { defineConfig } = require('eslint/config');
const globals = require('globals');
const expoConfig = require('eslint-config-expo/flat');
const unusedImports = require('eslint-plugin-unused-imports');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '**/*.d.ts',
      'coverage/*',
      '.expo/*',
      'android/*',
      'ios/*',
    ],
  },
  {
    files: ['jest.setup.js', '**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    // Platform-specific modules (App.native.tsx / App.web.tsx,
    // lib/stripe-terminal.native.ts / .web.ts) are only resolvable by
    // extension-suffix search — the default resolver extension list doesn't
    // include the platform suffixes, so this reproduces it with them added.
    settings: {
      'import/resolver': {
        node: {
          extensions: [
            '.native.ts',
            '.native.tsx',
            '.web.ts',
            '.web.tsx',
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.json',
          ],
        },
        typescript: {
          extensions: [
            '.native.ts',
            '.native.tsx',
            '.web.ts',
            '.web.tsx',
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.json',
          ],
        },
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],

      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },
]);

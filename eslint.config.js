import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['dist', 'node_modules', '_*.py'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/purity': 'error',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'error',
      'react-hooks/error-boundaries': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-useless-escape': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      // Group order: builtins/externals first, then a blank line, then
      // relative imports. We don't alphabetize within groups since the
      // existing code clusters imports by topic (theme, format, snapshots,
      // …) and an alphabetical sort would scramble those clusters.
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
        },
      ],
      'import/no-unresolved': 'off',
      'import/no-named-as-default-member': 'off',
      ...prettier.rules,
    },
  },
];

import react from 'eslint-plugin-react';
import globals from 'globals';
export default [
  { ignores: ['node_modules/**', '**/dist/**', '**/uploads/**'] },
  {
    files: ['frontend/**/*.{js,jsx}', 'backend/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }], 'no-unreachable': 'error', 'no-constant-condition': 'error', 'react/jsx-uses-vars': 'error', 'react/jsx-uses-react': 'error', 'react/jsx-key': 'error' },
  },
];

/* eslint-env node */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-native/all',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      createClass: 'createReactClass',
      pragma: 'React',
      fragment: 'Fragment',
      version: 'detect',
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-native'],
  root: true,
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-native/no-color-literals': 'off',
    'react-hooks/exhaustive-deps': 'error',
  },
};

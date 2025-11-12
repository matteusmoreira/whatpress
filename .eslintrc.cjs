module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['dist/', 'build/', 'node_modules/', 'supabase/.temp/'],
  overrides: [
    {
      files: ['**/tests/**/*.ts', '**/tests/**/*.tsx', 'src/test/**/*.ts', 'src/tests/**/*.ts', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-empty': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-extra-semi': 'off',
      },
    },
    {
      files: ['src/pages/**/*.ts', 'src/pages/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['src/components/**/*.ts', 'src/components/**/*.tsx', 'src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['src/lib/api/**/*.ts', 'src/lib/api/**/*.tsx', 'api/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['src/lib/**/*.ts', 'src/lib/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-hooks/rules-of-hooks': 'off',
    'no-case-declarations': 'off',
    'no-empty': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'no-unexpected-multiline': 'off',
    'no-useless-escape': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/prefer-as-const': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    'react-refresh/only-export-components': 'off',
  },
};

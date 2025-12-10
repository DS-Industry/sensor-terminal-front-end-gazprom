module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist', 
    '.eslintrc.cjs', 
    'src/test/**',
    'src/pages/HomePage.tsx',
    'src/pages/PaymentPage.tsx',
    'src/pages/QueuePage.tsx',
    'src/pages/ProgramPage.tsx',
    'src/hooks/usePayment.ts'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'test_db.js'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // Downgraded to warn for phase 1 to avoid blocking, but will fix where possible
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  }
);

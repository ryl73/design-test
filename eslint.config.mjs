import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.superpowers/**'] },
  { files: ['**/*.ts', '**/*.tsx'], extends: [js.configs.recommended, ...tseslint.configs.recommended], rules: { 'no-undef': 'off' } },
);

import js from '@eslint/js';
import securityPlugin from 'eslint-plugin-security';

export default [
  js.configs.recommended,
  securityPlugin.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        THREE: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        console: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestAnimationFrame: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        global: 'readonly',
        Event: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'security/detect-object-injection': 'off',
      'no-undef': 'error'
    }
  }
];

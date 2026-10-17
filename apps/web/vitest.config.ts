import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'], passWithNoTests: false } });

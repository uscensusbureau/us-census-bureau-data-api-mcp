import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Global ignores
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
    ],
  },

  // TypeScript configuration for /tests directory
  {
    files: ["tests/**/*.{ts,js}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        // Vitest globals
        describe: "readonly",
        it: "readonly", 
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
        test: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-expressions": "off", // Allow expect().toBe()
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // CommonJS configuration for /migrations directory  
  {
    files: ["migrations/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        exports: "writable",
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "camelcase": "off", // Database columns use snake_case
      "no-unused-vars": ["error", { argsIgnorePattern: "^_|^pgm" }],
      "no-console": "off", // Allow console in migrations
      "prefer-const": "error",
      "no-var": "error",
      "quotes": ["error", "single"],
      "semi": ["error", "always"],
    },
  },
]);
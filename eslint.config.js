import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-*", "dev-dist", "coverage", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["scripts/**", "*.config.{js,ts}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // DEVELOPMENT.md §2 principle 1: the banjo and music core is pure. No DOM, audio,
    // storage, UI or platform access, so it stays unit- and property-testable.
    files: ["src/core/**/*.ts"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "fetch",
        "AudioContext",
        "performance",
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["preact", "preact/*", "@preact/*"], message: "core must not import UI code" },
            { group: ["idb"], message: "core must not touch storage" },
            {
              group: ["**/platform/**", "**/ui/**", "**/audio/**", "**/render/**", "**/chaos/**"],
              message: "core may only import from core",
            },
          ],
        },
      ],
    },
  },
);

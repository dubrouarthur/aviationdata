// Lint for the site's browser code, the Vite config and the build-time partials (Node).
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "dist-artifact/**", "public/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      // narrow no-break spaces (U+202F) are deliberate in French strings and number formats
      "no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true, skipRegExps: true, skipComments: true }],
    },
  },
  {
    files: ["vite.config.js", "eslint.config.js", "scripts/**/*.mjs", "src/site/partials.js", "src/site/data-page.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["src/**/*.test.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];

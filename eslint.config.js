import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/",
      "node_modules/",
      "public/",
      ".claude/",
      ".worktrees/",
      ".omc/",
      "test-results/",
      "tasks/",
    ],
  },
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["src/pages/EstimatePage/__tests__/fixtures/generate-fixtures.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
      },
    },
  },
  {
    files: ["e2e/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        window: "readonly",
        localStorage: "readonly",
      },
    },
  },
  {
    rules: {
      "no-control-regex": "off",
      "no-irregular-whitespace": "off",
      "no-useless-escape": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-unused-vars": [
        "off",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  }
);

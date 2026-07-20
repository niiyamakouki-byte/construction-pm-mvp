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
      ".vercel/",
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
    // bead laporta-beads-058d4: フォームid/name監査スクリプト (node実行)
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },
  {
    // dc-666t: run #650 lint失敗修正 — SaaS公開前検証スクリプト(node/playwright実行)にNode/ブラウザglobalsを許可
    files: ["e2e/**/*.mjs", "docs/saas-launch-verify-20260721/**/*.mjs"],
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

import tsParser from "@typescript-eslint/parser";
import dsGuardrail from "./.better-design/eslint-design-system.mjs"; // better-design-guardrail

export default [
  { ignores: ["dist/**"] },
  ...dsGuardrail.map((entry) => ({
    ...entry,
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  })),
];

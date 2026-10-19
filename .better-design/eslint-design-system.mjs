const banned = [
  { selector: "JSXOpeningElement[name.name='button']", message: "Use the installed Button component." },
  { selector: "JSXOpeningElement[name.name='table']", message: "Use the installed Table component." },
  { selector: "JSXOpeningElement[name.name='input']", message: "Use the installed Input component." },
  { selector: "JSXOpeningElement[name.name='textarea']", message: "Use the installed Textarea component." },
];

export default [
  {
    files: ["src/**/*.{tsx,jsx}"],
    ignores: ["src/components/ui/**", "**/*.{test,spec}.{tsx,jsx}", "**/__tests__/**"],
    rules: { "no-restricted-syntax": ["warn", ...banned] },
  },
];

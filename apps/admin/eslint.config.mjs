import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "next.config.ts",
      "wrangler.toml",
      "vercel.json",
      "vitest.config.ts",
      "playwright.config.ts",
      "postcss.config.mjs",
      "sentry.*.config.ts",
    ],
  },
];

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone services (not Next.js)
    "wallet-service/**",
    "sms-worker/**",
    "email-worker/**",
    "shortcuts/**",
    "join-app/**",
    "dash-app/**",
    "supabase/**",
  ]),
]);

export default eslintConfig;

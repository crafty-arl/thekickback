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
  // React Three Fiber (R3F) components use imperative patterns (camera mutation,
  // useFrame, Math.random in useMemo) that are incompatible with React compiler rules.
  {
    files: ["src/components/skybox.tsx"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

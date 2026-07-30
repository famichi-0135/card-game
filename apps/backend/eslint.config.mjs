import { config } from "@disastar/eslint-config/base";

export default [
  { ignores: ["worker-configuration.d.ts"] },
  ...config,
  {
    languageOptions: { globals: { process: "readonly" } },
  },
];

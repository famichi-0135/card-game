import { config } from "@disastar/eslint-config/base";

export default [...config, { ignores: ["worker-configuration.d.ts"] }];

import { config } from "@disastar/eslint-config/react-internal";

export default [...config, { ignores: ["worker-configuration.d.ts"] }];

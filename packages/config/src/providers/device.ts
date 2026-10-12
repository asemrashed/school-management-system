import type { Env } from "../env";

/**
 * Device control (env-driven limits per role/user) is a Phase 4 feature.
 * The factory exists now so env wiring follows the same pattern as the
 * other providers; the implementation is added when Phase 4 starts.
 */
export interface DeviceProvider {
  enabled: boolean;
}

export function createDeviceProvider(env: Env): DeviceProvider {
  return { enabled: env.DEVICE_CONTROL_ENABLED };
}

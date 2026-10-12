import { z } from "zod";
import { roleSchema } from "./roles";

export const deviceLimitDtoSchema = z.object({
  role: roleSchema,
  maxSessions: z.number().int().min(1).max(20),
});
export type DeviceLimitDto = z.infer<typeof deviceLimitDtoSchema>;

/** Only meaningful when DEVICE_CONTROL_ENABLED=true (packages/config env) —
 * the API ignores these limits entirely when that env flag is off. */
export const setDeviceLimitSchema = z.object({
  role: roleSchema,
  maxSessions: z.number().int().min(1).max(20),
});
export type SetDeviceLimitInput = z.infer<typeof setDeviceLimitSchema>;

import { z } from "zod";
import { roleSchema } from "./roles";

export const userDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: roleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: roleSchema,
  password: z.string().min(8),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const schoolDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
});
export type SchoolDto = z.infer<typeof schoolDtoSchema>;

// Class / section / shift / room contracts live in setup.ts.

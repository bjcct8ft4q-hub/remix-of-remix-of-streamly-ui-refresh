import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9_]+$/, "Use letters, numbers and underscores.");
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
export const signupSchema = z.object({ username: usernameSchema, password: passwordSchema, email: z.union([z.literal(""), z.string().trim().email().max(254)]).default("") });
export const recoverySchema = z.object({ username: usernameSchema, code: z.string().trim().min(20).max(80), password: passwordSchema });
export const usernameEmail = (username: string) => `${usernameSchema.parse(username)}@username.streamly.invalid`;

export function formatBold(body: string): { text: string; bold: boolean }[] {
  return body.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => ({ text: part.startsWith("**") && part.endsWith("**") ? part.slice(2, -2) : part, bold: part.startsWith("**") && part.endsWith("**") }));
}
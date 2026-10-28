import { describe, expect, it } from "vitest";
import { signupSchema, usernameEmail, recoverySchema, formatBold } from "@/lib/account-schema";
import { hashCode } from "@/lib/accounts.server";

describe("Username accounts", () => {
  it("allows signup without an email", () => {
    expect(signupSchema.parse({ username: "morgan07", password: "a-strong-password" }).email).toBe("");
  });
  it("keeps the same login identifier when username casing changes", () => {
    expect(usernameEmail("Morgan07")).toBe("morgan07@username.streamly.invalid");
  });
  it("rejects role-like fields from accepted signup data", () => {
    expect(signupSchema.parse({ username: "morgan07", password: "a-strong-password", role: "admin" })).not.toHaveProperty("role");
  });
  it("requires a code to reset a password", () => {
    expect(recoverySchema.safeParse({ username: "morgan07", password: "a-strong-password", code: "" }).success).toBe(false);
  });
  it("hashes code separators consistently", async () => {
    expect(await hashCode("abcd1234-efab5678-abcd1234-efab5678")).toBe(await hashCode("abcd1234efab5678abcd1234efab5678"));
  });
  it("formats marked text as bold while leaving surrounding text intact", () => {
    expect(formatBold("hello **world**")).toEqual([{ text: "hello ", bold: false }, { text: "world", bold: true }]);
  });
});
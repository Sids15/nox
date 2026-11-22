import { describe, expect, test } from "bun:test";
import { isPublicSupabaseKey } from "./key-guard";

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=+$/, "")}.sig`;

describe("isPublicSupabaseKey", () => {
  test("accepts the anon JWT and publishable keys", () => {
    expect(isPublicSupabaseKey(jwt("anon"))).toBe(true);
    expect(isPublicSupabaseKey("sb_publishable_abc123")).toBe(true);
  });
  test("refuses service_role JWTs and secret keys", () => {
    expect(isPublicSupabaseKey(jwt("service_role"))).toBe(false);
    expect(isPublicSupabaseKey("sb_secret_abc123")).toBe(false);
  });
});

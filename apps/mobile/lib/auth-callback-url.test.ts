import { describe, expect, test } from "bun:test";

import { parseAuthCallbackUrl } from "./auth-callback-url";

describe("parseAuthCallbackUrl", () => {
  test("reads a PKCE code from the query", () => {
    expect(parseAuthCallbackUrl("nox://auth-callback?code=abc123")).toEqual({
      kind: "code",
      code: "abc123",
    });
  });

  test("reads implicit tokens from the fragment", () => {
    const result = parseAuthCallbackUrl(
      "nox://auth-callback#access_token=at&refresh_token=rt&token_type=bearer",
    );
    expect(result).toEqual({
      kind: "tokens",
      accessToken: "at",
      refreshToken: "rt",
      recovery: false,
    });
  });

  test("flags a recovery link so the reset screen is reachable", () => {
    const result = parseAuthCallbackUrl(
      "nox://auth-callback#access_token=at&refresh_token=rt&type=recovery",
    );
    expect(result).toMatchObject({ kind: "tokens", recovery: true });
  });

  test("errors in the fragment win over everything else", () => {
    expect(
      parseAuthCallbackUrl("nox://auth-callback#error=access_denied&error_code=otp_expired"),
    ).toEqual({ kind: "error", errorCode: "otp_expired" });
  });

  test("an error without a machine-readable code still reports as an error", () => {
    expect(parseAuthCallbackUrl("nox://auth-callback#error=access_denied")).toEqual({
      kind: "error",
      errorCode: "unknown",
    });
  });

  test("handles the Expo Go scheme, which nests the path under /--/", () => {
    expect(parseAuthCallbackUrl("exp://192.168.1.5:8081/--/auth-callback?code=xyz")).toEqual({
      kind: "code",
      code: "xyz",
    });
  });

  test("handles an http origin, where the browser target lands", () => {
    expect(parseAuthCallbackUrl("http://localhost:8081/auth-callback?code=xyz")).toEqual({
      kind: "code",
      code: "xyz",
    });
  });

  test("merges query and fragment, so a mixed redirect still resolves", () => {
    expect(
      parseAuthCallbackUrl("nox://auth-callback?code=abc#type=recovery"),
    ).toEqual({ kind: "code", code: "abc" });
  });

  test("tokens need BOTH halves — a lone access_token is not a session", () => {
    expect(parseAuthCallbackUrl("nox://auth-callback#access_token=at")).toMatchObject({
      kind: "none",
    });
  });

  test("reports parameter NAMES only when nothing is actionable, never values", () => {
    const result = parseAuthCallbackUrl("nox://auth-callback?state=xyz&secret=hunter2");
    expect(result).toEqual({ kind: "none", keys: ["state", "secret"] });
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });

  test("a bare url with no query or fragment is inert", () => {
    expect(parseAuthCallbackUrl("nox://auth-callback")).toEqual({ kind: "none", keys: [] });
  });
});

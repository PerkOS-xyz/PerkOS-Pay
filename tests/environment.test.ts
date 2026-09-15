import { describe, expect, it } from "vitest";

import { assertEnvironmentBinding, environmentFor, sessionsAllowedFor } from "../lib/environment";

describe("payment environment isolation", () => {
  it("defaults to the safe test environment", () => {
    expect(environmentFor(undefined)).toEqual({
      name: "test",
      origin: "https://test.pay.perkos.xyz",
      stripeMode: "test",
      cryptoMode: "testnet",
    });
  });

  it("binds production to live Stripe and mainnet", () => {
    expect(environmentFor("production")).toMatchObject({
      origin: "https://pay.perkos.xyz",
      stripeMode: "live",
      cryptoMode: "mainnet",
    });
  });

  it("rejects a test session on the production origin", () => {
    expect(() =>
      assertEnvironmentBinding({
        environment: environmentFor("test"),
        requestOrigin: "https://pay.perkos.xyz",
      }),
    ).toThrow(/origin/);
  });

  it("rejects live Stripe events in test", () => {
    expect(() =>
      assertEnvironmentBinding({
        environment: environmentFor("test"),
        requestOrigin: "https://test.pay.perkos.xyz",
        stripeLivemode: true,
      }),
    ).toThrow(/Stripe mode/);
  });

  it("allows localhost only as an explicit test origin", () => {
    expect(environmentFor("test", "http://localhost:3000").origin).toBe(
      "http://localhost:3000",
    );
    expect(() => environmentFor("test", "https://evil.example")).toThrow(
      /allowlisted/,
    );
  });
});

describe("which deployment may serve billing sessions", () => {
  const prod = environmentFor("production");
  const test = environmentFor("test");

  it("lets production serve its own sessions", () => {
    expect(sessionsAllowedFor({ environment: prod, apiUrl: "http://perkos-api:8080" })).toEqual({ ok: true });
  });

  it("lets the test site serve the dev API's sessions", () => {
    // This is the real deployment: test.pay.perkos.xyz talks to dev.api.
    expect(sessionsAllowedFor({ environment: test, apiUrl: "https://dev.api.perkos.xyz" })).toEqual({ ok: true });
  });

  it("refuses a test deployment aimed at the production API, public or in-cluster", () => {
    for (const apiUrl of ["https://api.perkos.xyz", "http://perkos-api:8080"]) {
      const out = sessionsAllowedFor({ environment: test, apiUrl });
      expect(out.ok).toBe(false);
      expect(out).toMatchObject({ reason: expect.stringMatching(/production billing sessions/) });
    }
  });

  it("refuses rather than guesses when the API origin is not a URL", () => {
    expect(sessionsAllowedFor({ environment: test, apiUrl: "" }).ok).toBe(false);
  });
});

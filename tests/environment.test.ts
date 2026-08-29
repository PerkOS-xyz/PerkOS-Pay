import { describe, expect, it } from "vitest";

import { assertEnvironmentBinding, environmentFor } from "../lib/environment";

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
});


import { describe, expect, it } from "vitest";

import { getCreditPack } from "../lib/catalog";

describe("credit-pack catalog", () => {
  it("resolves authoritative server-side prices", () => {
    expect(getCreditPack("credits_25")).toEqual({
      id: "credits_25",
      credits: 25,
      amountCents: 2500,
    });
  });

  it("rejects arbitrary client prices", () => {
    expect(() => getCreditPack("credits_25_for_one_cent")).toThrow();
  });
});

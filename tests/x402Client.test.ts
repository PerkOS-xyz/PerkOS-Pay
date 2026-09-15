import { describe, expect, it } from "vitest";

import {
  buildAuthorization,
  chainFor,
  encodePaymentHeader,
  explorerTx,
  quotedUsd,
  randomNonce,
  typedDataFor,
  type PaymentRequirements,
} from "../lib/x402Client";

const req: PaymentRequirements = {
  scheme: "exact",
  network: "base",
  maxAmountRequired: "5000000",
  resource: "https://api.perkos.xyz/billing/deposit/x402",
  description: "PerkOS credits top-up, 5 USDC",
  payTo: "0x3f0d000000000000000000000000000000000000",
  maxTimeoutSeconds: 120,
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  extra: { name: "USD Coin", version: "2" },
};
const payer = "0x00000000000000000000000000000000deadbeef";

describe("x402 client payload", () => {
  it("signs against the token's real EIP-712 domain on the quoted chain", () => {
    const auth = buildAuthorization(req, payer, 1_700_000_000, "0x" + "11".repeat(32));
    const typed = typedDataFor(req, chainFor("base")!.chainId, auth);
    expect(typed.domain).toEqual({ name: "USD Coin", version: "2", chainId: 8453, verifyingContract: req.asset });
    expect(typed.primaryType).toBe("TransferWithAuthorization");
    expect(typed.message).toEqual({
      from: payer,
      to: req.payTo,
      value: "5000000",
      validAfter: "0",
      validBefore: "1700000120",
      nonce: "0x" + "11".repeat(32),
    });
  });

  it("encodes the x402 v1 exact payload the API's decodePaymentHeader expects", () => {
    const auth = buildAuthorization(req, payer, 1_700_000_000, "0x" + "22".repeat(32));
    const header = encodePaymentHeader(req, auth, "0xsig");
    expect(JSON.parse(Buffer.from(header, "base64").toString("utf8"))).toEqual({
      x402Version: 1,
      scheme: "exact",
      network: "base",
      payload: { signature: "0xsig", authorization: auth },
    });
  });

  it("makes 32-byte nonces and reads the quote back in dollars", () => {
    expect(randomNonce()).toMatch(/^0x[0-9a-f]{64}$/);
    expect(randomNonce(new Uint8Array(32))).toBe("0x" + "00".repeat(32));
    expect(quotedUsd(req)).toBe(5);
    expect(explorerTx("base", "0xabc")).toBe("https://basescan.org/tx/0xabc");
    expect(chainFor("solana")).toBeNull();
  });
});

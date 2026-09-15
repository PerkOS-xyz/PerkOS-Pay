import { generateKeyPairSync } from "node:crypto";

import { decodeProtectedHeader, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import {
  CDP_HOST,
  ONRAMP_TOKEN_PATH,
  importCdpKey,
  onrampTokenBody,
  onrampUrl,
  signCdpJwt,
} from "../lib/cdpToken";

const KEY_ID = "organizations/11111111/apiKeys/22222222";
const WALLET = "0x00000000000000000000000000000000deadbeef";

function ecKeys(type: "pkcs8" | "sec1") {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    pem: privateKey.export({ format: "pem", type }).toString(),
    publicKey,
  };
}

/** CDP hands Ed25519 secrets out as base64 of (32-byte seed || 32-byte public). */
function ed25519Secret() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return { secret: Buffer.concat([seed, pub]).toString("base64"), publicKey };
}

describe("CDP key import", () => {
  it("reads the SEC1 PEM that CDP hands out, not just PKCS8", () => {
    expect(importCdpKey(ecKeys("sec1").pem).alg).toBe("ES256");
    expect(importCdpKey(ecKeys("pkcs8").pem).alg).toBe("ES256");
  });

  it("reads a base64 Ed25519 secret", () => {
    expect(importCdpKey(ed25519Secret().secret).alg).toBe("EdDSA");
  });

  it("tolerates a PEM whose newlines survived an env file as \\n", () => {
    const pem = ecKeys("sec1").pem.replace(/\n/g, "\\n");
    expect(importCdpKey(pem).alg).toBe("ES256");
  });

  it("refuses a secret that is neither shape", () => {
    expect(() => importCdpKey("not-a-key")).toThrow(/neither a PEM/);
  });
});

describe("CDP request JWT", () => {
  it("scopes the token to the one endpoint it authorises", async () => {
    const { pem, publicKey } = ecKeys("sec1");
    const jwt = await signCdpJwt({
      credentials: { keyId: KEY_ID, keySecret: pem },
      method: "POST",
      host: CDP_HOST,
      path: ONRAMP_TOKEN_PATH,
      now: 1_700_000_000,
      nonce: "ab".repeat(16),
    });

    // The token is pinned to a fixed instant, so verify from inside its window.
    const { payload } = await jwtVerify(jwt, publicKey, {
      currentDate: new Date(1_700_000_060 * 1000),
    });
    expect(payload.iss).toBe("cdp");
    expect(payload.sub).toBe(KEY_ID);
    expect(payload.uris).toEqual(["POST api.developer.coinbase.com/onramp/v1/token"]);
    // Two minutes; a leaked token is useless almost immediately.
    expect(payload.nbf).toBe(1_700_000_000);
    expect(payload.exp).toBe(1_700_000_120);
  });

  it("carries kid and a nonce in the header so CDP can route and de-duplicate it", async () => {
    const { pem } = ecKeys("sec1");
    const jwt = await signCdpJwt({
      credentials: { keyId: KEY_ID, keySecret: pem },
      method: "POST",
      host: CDP_HOST,
      path: ONRAMP_TOKEN_PATH,
    });
    const header = decodeProtectedHeader(jwt);
    expect(header).toMatchObject({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
    expect(header.nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("signs Ed25519 keys as EdDSA", async () => {
    const { secret, publicKey } = ed25519Secret();
    const jwt = await signCdpJwt({
      credentials: { keyId: KEY_ID, keySecret: secret },
      method: "POST",
      host: CDP_HOST,
      path: ONRAMP_TOKEN_PATH,
    });
    expect(decodeProtectedHeader(jwt).alg).toBe("EdDSA");
    await expect(jwtVerify(jwt, publicKey)).resolves.toBeTruthy();
  });

  it("gives each token a fresh nonce", async () => {
    const { pem } = ecKeys("sec1");
    const credentials = { keyId: KEY_ID, keySecret: pem };
    const args = { credentials, method: "POST", host: CDP_HOST, path: ONRAMP_TOKEN_PATH };
    const [a, b] = await Promise.all([signCdpJwt(args), signCdpJwt(args)]);
    expect(decodeProtectedHeader(a).nonce).not.toBe(decodeProtectedHeader(b).nonce);
  });
});

describe("Onramp token body", () => {
  it("buys into the wallet it is given and nothing else", () => {
    expect(onrampTokenBody(WALLET, "base", ["USDC"])).toEqual({
      addresses: [{ address: WALLET, blockchains: ["base"] }],
      assets: ["USDC"],
    });
  });

  it("refuses anything that is not an address, so a bad session cannot mint a token", () => {
    expect(() => onrampTokenBody("", "base", ["USDC"])).toThrow(/not an address/);
    expect(() => onrampTokenBody("0xnope", "base", ["USDC"])).toThrow(/not an address/);
    expect(() => onrampTokenBody(`${WALLET} `, "base", ["USDC"])).toThrow(/not an address/);
  });
});

describe("Onramp URL", () => {
  it("carries the session token", () => {
    const url = new URL(onrampUrl("tok_123"));
    expect(url.origin + url.pathname).toBe("https://pay.coinbase.com/buy/select-asset");
    expect(url.searchParams.get("sessionToken")).toBe("tok_123");
    expect(url.searchParams.get("presetFiatAmount")).toBeNull();
  });

  it("presets the amount in USD when one was chosen", () => {
    const url = new URL(onrampUrl("tok_123", 25));
    expect(url.searchParams.get("presetFiatAmount")).toBe("25");
    expect(url.searchParams.get("fiatCurrency")).toBe("USD");
  });

  it("ignores a nonsense amount rather than passing it on", () => {
    expect(new URL(onrampUrl("tok_123", 0)).searchParams.get("presetFiatAmount")).toBeNull();
    expect(new URL(onrampUrl("tok_123", -5)).searchParams.get("presetFiatAmount")).toBeNull();
  });
});

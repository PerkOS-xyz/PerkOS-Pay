import { createPrivateKey, randomBytes, type KeyObject } from "node:crypto";

import { SignJWT } from "jose";

/**
 * Coinbase Developer Platform request signing, kept apart from the env and
 * network half in `cdp.ts` so it can be tested directly (same split as
 * `x402Client.ts` next to `session.ts`).
 *
 * jose does the signing rather than @coinbase/cdp-sdk on purpose: the SDK
 * pulls viem, axios and the Solana kit in to sign one JWT, and this app's
 * whole dependency list is next/react/stripe/zod.
 */

export const CDP_HOST = "api.developer.coinbase.com";
export const ONRAMP_TOKEN_PATH = "/onramp/v1/token";

/** Ed25519 PKCS8 DER prefix; the 32-byte seed is appended to it. */
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export type CdpCredentials = { keyId: string; keySecret: string };

/**
 * CDP issues two key shapes and both are still in circulation: the newer
 * Ed25519 keys arrive as a base64 64-byte blob (32-byte seed + 32-byte public
 * key), the older ECDSA ones as a PEM. Detect rather than make the operator
 * declare which one they pasted.
 */
export function importCdpKey(keySecret: string): { key: KeyObject; alg: "ES256" | "EdDSA" } {
  if (keySecret.includes("BEGIN")) {
    // createPrivateKey reads SEC1 ("BEGIN EC PRIVATE KEY") and PKCS8 alike;
    // jose's importPKCS8 would reject the SEC1 form CDP hands out.
    return { key: createPrivateKey(keySecret.replace(/\\n/g, "\n")), alg: "ES256" };
  }

  const raw = Buffer.from(keySecret, "base64");
  if (raw.length !== 64) {
    throw new Error("CDP_API_KEY_SECRET is neither a PEM nor a 64-byte base64 Ed25519 key");
  }
  const der = Buffer.concat([ED25519_PKCS8_PREFIX, raw.subarray(0, 32)]);
  return { key: createPrivateKey({ key: der, format: "der", type: "pkcs8" }), alg: "EdDSA" };
}

/**
 * A CDP request JWT. It lives two minutes and is scoped to the one method and
 * path named in `uris`, so it cannot be replayed against another endpoint.
 */
export async function signCdpJwt(input: {
  credentials: CdpCredentials;
  method: string;
  host: string;
  path: string;
  now?: number;
  nonce?: string;
}): Promise<string> {
  const { key, alg } = importCdpKey(input.credentials.keySecret);
  const issuedAt = input.now ?? Math.floor(Date.now() / 1000);

  return new SignJWT({
    iss: "cdp",
    sub: input.credentials.keyId,
    uris: [`${input.method} ${input.host}${input.path}`],
  })
    .setProtectedHeader({
      alg,
      kid: input.credentials.keyId,
      typ: "JWT",
      nonce: input.nonce ?? randomBytes(16).toString("hex"),
    })
    .setNotBefore(issuedAt)
    .setExpirationTime(issuedAt + 120)
    .sign(key);
}

export type OnrampTokenBody = {
  addresses: { address: string; blockchains: string[] }[];
  assets: string[];
};

/**
 * The destination is always the session's own wallet. Callers pass the wallet
 * PerkOS API put on the session, never anything read off the request body, so
 * a session link can never route bought funds to a third address.
 */
export function onrampTokenBody(wallet: string, network: string, assets: string[]): OnrampTokenBody {
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error("Session wallet is not an address");
  return { addresses: [{ address: wallet, blockchains: [network] }], assets };
}

/** Hosted Onramp URL for a minted session token. */
export function onrampUrl(sessionToken: string, presetFiatAmount?: number): string {
  const url = new URL("https://pay.coinbase.com/buy/select-asset");
  url.searchParams.set("sessionToken", sessionToken);
  if (presetFiatAmount && presetFiatAmount > 0) {
    url.searchParams.set("presetFiatAmount", String(presetFiatAmount));
    url.searchParams.set("fiatCurrency", "USD");
  }
  return url.toString();
}

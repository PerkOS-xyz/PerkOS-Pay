import "server-only";

import {
  CDP_HOST,
  ONRAMP_TOKEN_PATH,
  onrampTokenBody,
  signCdpJwt,
  type CdpCredentials,
  type OnrampTokenBody,
} from "./cdpToken";

export { onrampUrl } from "./cdpToken";
export type { CdpCredentials } from "./cdpToken";

/**
 * Coinbase Developer Platform, used only to mint Onramp session tokens.
 *
 * The API key never leaves this server and the browser never sees it: the
 * client calls our own origin, we call Coinbase, and only the resulting
 * session token goes back down. Signing lives in `cdpToken.ts`.
 */

/** Server-only credentials. Returns null when Onramp is not provisioned yet. */
export function cdpCredentials(): CdpCredentials | null {
  const keyId = process.env.CDP_API_KEY_ID?.trim();
  const keySecret = process.env.CDP_API_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export type OnrampTokenResult =
  | { ok: true; sessionToken: string }
  | { ok: false; status: number; error: string };

/** Exchange a short-lived request JWT for a one-shot Onramp session token. */
export async function createOnrampSessionToken(input: {
  credentials: CdpCredentials;
  wallet: string;
  network: string;
  assets: string[];
}): Promise<OnrampTokenResult> {
  let body: OnrampTokenBody;
  try {
    body = onrampTokenBody(input.wallet, input.network, input.assets);
  } catch {
    return { ok: false, status: 500, error: "session wallet is unusable" };
  }

  const jwt = await signCdpJwt({
    credentials: input.credentials,
    method: "POST",
    host: CDP_HOST,
    path: ONRAMP_TOKEN_PATH,
  });

  const res = await fetch(`https://${CDP_HOST}${ONRAMP_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !payload.token) {
    // Coinbase's message can name the key or the org; keep it out of the browser.
    console.error("cdp onramp token failed", { status: res.status });
    return { ok: false, status: 502, error: "onramp unavailable" };
  }
  return { ok: true, sessionToken: payload.token };
}

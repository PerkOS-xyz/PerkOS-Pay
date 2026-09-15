import "server-only";

/**
 * Billing sessions: a client that holds a PerkOS bearer (PerkOS Floor) mints a
 * session on PerkOS API and sends the person here with its id in the URL. The
 * id is the capability; this server never sees a bearer. Everything below is
 * server-side against PERKOS_API_URL, so the browser talks only to this origin.
 *
 * Pay never credits anything: the API's Stripe webhook credits by the wallet
 * the API itself put in the checkout metadata, and the x402 route credits the
 * settled payer.
 */

const SESSION_ID_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_RE.test(value);
}

export function apiBase(): string {
  return (process.env.PERKOS_API_URL?.trim() || "https://api.perkos.xyz").replace(/\/+$/, "");
}

export type BillingSession = {
  sessionId: string;
  status: "open" | "expired";
  wallet: string;
  source: string;
  expiresAt: string;
  creditsUsd: number;
  infra: { allowed: boolean; reason: string };
  card: { available: boolean; amountsUsd: number[] };
  stablecoin: { networks: string[]; endpoint: string };
};

export async function fetchBillingSession(
  id: string,
): Promise<{ status: number; session: BillingSession | null }> {
  if (!isSessionId(id)) return { status: 404, session: null };
  const res = await fetch(`${apiBase()}/billing/sessions/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { status: res.status, session: null };
  return { status: 200, session: (await res.json()) as BillingSession };
}

export async function startSessionCheckout(
  id: string,
  amount: number,
): Promise<{ status: number; url?: string; error?: string }> {
  if (!isSessionId(id)) return { status: 404, error: "session not found" };
  const res = await fetch(`${apiBase()}/billing/sessions/${encodeURIComponent(id)}/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ amount }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok) return { status: res.status, error: body.error?.message ?? `checkout failed (${res.status})` };
  return { status: 200, url: body.url };
}

/**
 * Same-origin relay for the x402 deposit: the browser signs, this server
 * forwards body + X-PAYMENT to the API and hands back status + JSON verbatim.
 * The API credits the address that signed, never anything from the body.
 */
export async function forwardX402(input: {
  body: unknown;
  payment: string | null;
}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${apiBase()}/billing/deposit/x402`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(input.payment ? { "x-payment": input.payment } : {}),
    },
    body: JSON.stringify(input.body ?? {}),
    // Settlement waits for an on-chain transfer through Stack.
    signal: AbortSignal.timeout(90_000),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Coupon → credit through the API's ledger. Returns the API's error code on refusal. */
export async function redeemSessionCoupon(
  id: string,
  code: string,
): Promise<{ ok: boolean; amountUsd?: number; creditsUsd?: number; code?: string }> {
  if (!isSessionId(id)) return { ok: false, code: "not_found" };
  const res = await fetch(`${apiBase()}/billing/sessions/${encodeURIComponent(id)}/coupon`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean; amountUsd?: number; creditsUsd?: number; error?: { code?: string };
  };
  if (!res.ok || !body.ok) return { ok: false, code: (body.error?.code ?? `http_${res.status}`).toLowerCase() };
  return { ok: true, amountUsd: body.amountUsd, creditsUsd: body.creditsUsd };
}

export function shortWallet(wallet: string): string {
  return wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

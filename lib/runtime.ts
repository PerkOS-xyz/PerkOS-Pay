import { environmentFor, sessionsAllowedFor } from "./environment";

export function getRuntimeConfig() {
  const environment = environmentFor(
    process.env.PERKOS_PAY_ENV,
    process.env.PERKOS_PAY_ORIGIN,
  );
  const paymentsEnabled = process.env.PERKOS_PAYMENTS_ENABLED === "true";
  const apiUrl = (process.env.PERKOS_API_URL?.trim() || "https://api.perkos.xyz").replace(/\/+$/, "");

  return {
    environment,
    paymentsEnabled,
    apiUrl,
  } as const;
}

/**
 * Guard for the billing-session routes. Sessions belong to the API this
 * deployment is bound to, so the test site may serve its own dev sessions; only
 * a test deployment aimed at the production API is refused.
 */
export function sessionsAllowed(): { ok: true } | { ok: false; reason: string } {
  const { environment, apiUrl } = getRuntimeConfig();
  return sessionsAllowedFor({ environment, apiUrl });
}

/**
 * Coinbase Onramp delivers real mainnet assets, whichever API minted the
 * session, and there is no testnet onramp. So it is gated on the chain mode
 * rather than on the session binding.
 */
export function onrampAllowed(): boolean {
  return getRuntimeConfig().environment.cryptoMode === "mainnet";
}

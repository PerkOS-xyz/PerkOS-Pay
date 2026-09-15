import { NextResponse } from "next/server";

import { cdpCredentials, createOnrampSessionToken, onrampUrl } from "@/lib/cdp";
import { getRuntimeConfig } from "@/lib/runtime";
import { fetchBillingSession, isSessionId } from "@/lib/session";

export const runtime = "nodejs";

/** Networks this deployment will deliver bought USDC on. */
const NETWORKS = new Set(["base"]);
const MAX_PRESET_USD = 500;

/**
 * Coinbase Onramp for a billing session: mints a session token server-side and
 * hands back the hosted URL. This is the path for someone who has a card but no
 * stablecoins; the USDC lands in their own wallet, and they then fund credits
 * with it through the x402 route next door.
 *
 * The destination is the wallet PerkOS API put on the session, never an address
 * from the request body, so a session link cannot be used to buy into someone
 * else's wallet. CDP credentials stay on this server.
 */
export async function POST(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  if (!isSessionId(sessionId)) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (getRuntimeConfig().environment.name !== "production") {
    return NextResponse.json({ error: "Sessions are served on pay.perkos.xyz" }, { status: 403 });
  }

  const credentials = cdpCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Onramp is not enabled on this deployment" }, { status: 503 });
  }

  const { session } = await fetchBillingSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "open") return NextResponse.json({ error: "Session expired" }, { status: 410 });

  const body = (await request.json().catch(() => ({}))) as { network?: unknown; amount?: unknown };
  const network = typeof body.network === "string" ? body.network : "base";
  if (!NETWORKS.has(network)) return NextResponse.json({ error: "Unsupported network" }, { status: 400 });

  const requested = Number(body.amount);
  const preset =
    Number.isFinite(requested) && requested > 0 && requested <= MAX_PRESET_USD ? requested : undefined;

  const token = await createOnrampSessionToken({
    credentials,
    wallet: session.wallet,
    network,
    assets: ["USDC"],
  });
  if (!token.ok) return NextResponse.json({ error: token.error }, { status: token.status });

  return NextResponse.json({ url: onrampUrl(token.sessionToken, preset) });
}

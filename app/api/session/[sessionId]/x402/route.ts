import { NextResponse } from "next/server";

import { sessionsAllowed } from "@/lib/runtime";
import { fetchBillingSession, forwardX402, isSessionId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Same-origin relay to PerkOS API's x402 deposit. Two calls from the browser:
 * without X-PAYMENT → the 402 with paymentRequirements; with it → settle via
 * Stack and credit the signer. The session only has to exist and be open; the
 * API credits whoever signed, so a session can never route funds elsewhere.
 */
export async function POST(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  if (!isSessionId(sessionId)) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const allowed = sessionsAllowed();
  if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: 403 });
  const { session } = await fetchBillingSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "open") return NextResponse.json({ error: "Session expired" }, { status: 410 });

  const body = (await request.json().catch(() => ({}))) as { network?: unknown; amount?: unknown };
  const network = typeof body.network === "string" ? body.network : "base";
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  const out = await forwardX402({
    body: { network, amount },
    payment: request.headers.get("x-payment"),
  });
  return NextResponse.json(out.body, { status: out.status });
}

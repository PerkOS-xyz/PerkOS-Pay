import { NextResponse } from "next/server";

import { getRuntimeConfig } from "@/lib/runtime";
import { isSessionId, startSessionCheckout } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Card top-up for a billing session: the browser posts an amount, PerkOS API
 * creates the hosted Stripe checkout for the SESSION's wallet, we redirect.
 * Nothing about Stripe lives on this server for this path.
 */
export async function POST(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  if (!isSessionId(sessionId)) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  // Sessions are minted against the production API; the test site must not
  // open live checkouts for them.
  if (getRuntimeConfig().environment.name !== "production") {
    return NextResponse.json({ error: "Sessions are served on pay.perkos.xyz" }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const amount = Number(form?.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  const out = await startSessionCheckout(sessionId, amount);
  if (!out.url) {
    const back = new URL(`/s/${sessionId}`, request.url);
    back.searchParams.set("error", out.status === 410 ? "expired" : "checkout");
    return NextResponse.redirect(back, 303);
  }
  return NextResponse.redirect(out.url, 303);
}

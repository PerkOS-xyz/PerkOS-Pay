import { NextResponse } from "next/server";

import { getRuntimeConfig } from "@/lib/runtime";
import { isSessionId, redeemSessionCoupon } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Coupon on a billing session: the code posts here, PerkOS API credits the
 * session's wallet through its ledger, we come back to the session page with
 * the outcome in the query. No balance is touched on this server.
 */
export async function POST(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  if (!isSessionId(sessionId)) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (getRuntimeConfig().environment.name !== "production") {
    return NextResponse.json({ error: "Sessions are served on pay.perkos.xyz" }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const code = String(form?.get("code") ?? "").trim();
  const back = new URL(`/s/${sessionId}`, request.url);
  if (!code) {
    back.searchParams.set("coupon", "invalid");
    return NextResponse.redirect(back, 303);
  }
  const out = await redeemSessionCoupon(sessionId, code);
  back.searchParams.set("coupon", out.ok ? "ok" : out.code ?? "failed");
  return NextResponse.redirect(back, 303);
}

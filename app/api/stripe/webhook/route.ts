import Stripe from "stripe";

import { recordVerifiedPayment, verifiedPaymentFromEvent } from "@/lib/payment-events";
import { getRuntimeConfig } from "@/lib/runtime";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );
  } catch {
    return Response.json({ error: "Invalid webhook" }, { status: 400 });
  }

  try {
    const payment = verifiedPaymentFromEvent(event, getRuntimeConfig().environment);
    if (!payment) return Response.json({ received: true, handled: false });
    const result = await recordVerifiedPayment(payment);
    return Response.json({ received: true, handled: true, ...result });
  } catch {
    return Response.json({ error: "Webhook rejected" }, { status: 400 });
  }
}

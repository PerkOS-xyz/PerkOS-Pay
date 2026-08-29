import { createHash } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";

import type Stripe from "stripe";

import { getCreditPack } from "./catalog";
import { assertEnvironmentBinding, type PayEnvironment } from "./environment";

export type VerifiedPayment = {
  eventId: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  packId: string;
  credits: number;
  amountTotal: number;
  currency: string;
  status: "verified_pending_credit";
  verifiedAt: string;
};

export function verifiedPaymentFromEvent(
  event: Stripe.Event,
  environment: PayEnvironment,
): VerifiedPayment | null {
  assertEnvironmentBinding({
    environment,
    requestOrigin: environment.origin,
    stripeLivemode: event.livemode,
  });
  if (event.type !== "checkout.session.completed") return null;

  const session = event.data.object;
  if (session.payment_status !== "paid") return null;
  if (session.metadata?.environment !== environment.name) {
    throw new Error("Checkout environment metadata does not match");
  }

  const pack = getCreditPack(session.metadata.packId);
  if (session.amount_total !== pack.amountCents || session.currency !== "usd") {
    throw new Error("Checkout amount does not match the credit pack");
  }

  return {
    eventId: event.id,
    checkoutSessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    packId: pack.id,
    credits: pack.credits,
    amountTotal: pack.amountCents,
    currency: "usd",
    status: "verified_pending_credit",
    verifiedAt: new Date().toISOString(),
  };
}

export async function recordVerifiedPayment(
  payment: VerifiedPayment,
  directory = process.env.PAYMENT_EVENT_STORE ?? "/data/payment-events",
) {
  await mkdir(directory, { recursive: true });
  const filename = `${createHash("sha256").update(payment.eventId).digest("hex")}.json`;
  const filepath = path.join(directory, filename);

  try {
    const file = await open(filepath, "wx", 0o600);
    try {
      await file.writeFile(`${JSON.stringify(payment)}\n`, "utf8");
    } finally {
      await file.close();
    }
    return { recorded: true } as const;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return { recorded: false } as const;
    }
    throw error;
  }
}

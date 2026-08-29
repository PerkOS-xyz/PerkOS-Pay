import Stripe from "stripe";

import { getRuntimeConfig } from "./runtime";

export function getStripe() {
  const { environment, paymentsEnabled } = getRuntimeConfig();
  if (!paymentsEnabled) throw new Error("Payments are disabled");

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured");

  const isLiveKey = secretKey.startsWith("sk_live_");
  const isTestKey = secretKey.startsWith("sk_test_");
  if (!isLiveKey && !isTestKey) throw new Error("Stripe key is invalid");
  if (isLiveKey !== (environment.stripeMode === "live")) {
    throw new Error("Stripe key mode does not match the environment");
  }

  return new Stripe(secretKey);
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.startsWith("whsec_")) {
    throw new Error("Stripe webhook is not configured");
  }
  return secret;
}

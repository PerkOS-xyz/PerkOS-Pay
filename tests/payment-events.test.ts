import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type Stripe from "stripe";
import { afterEach, describe, expect, it } from "vitest";

import { environmentFor } from "../lib/environment";
import {
  recordVerifiedPayment,
  verifiedPaymentFromEvent,
} from "../lib/payment-events";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function checkoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_test_once",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: "cs_test_example",
        payment_status: "paid",
        payment_intent: "pi_test_example",
        amount_total: 2500,
        currency: "usd",
        metadata: { environment: "test", packId: "credits_25" },
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

describe("Stripe event processing", () => {
  it("normalizes a paid test Checkout event without crediting it", () => {
    expect(verifiedPaymentFromEvent(checkoutEvent(), environmentFor("test"))).toMatchObject({
      eventId: "evt_test_once",
      credits: 25,
      amountTotal: 2500,
      status: "verified_pending_credit",
    });
  });

  it("rejects live events and mismatched amounts", () => {
    expect(() =>
      verifiedPaymentFromEvent(
        { ...checkoutEvent(), livemode: true } as Stripe.Event,
        environmentFor("test"),
      ),
    ).toThrow(/Stripe mode/);
    expect(() =>
      verifiedPaymentFromEvent(checkoutEvent({ amount_total: 1 }), environmentFor("test")),
    ).toThrow(/amount/);
  });

  it("records the same event only once", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "perkos-pay-events-"));
    directories.push(directory);
    const payment = verifiedPaymentFromEvent(checkoutEvent(), environmentFor("test"));
    expect(payment).not.toBeNull();

    await expect(recordVerifiedPayment(payment!, directory)).resolves.toEqual({ recorded: true });
    await expect(recordVerifiedPayment(payment!, directory)).resolves.toEqual({ recorded: false });
    await expect(readdir(directory)).resolves.toHaveLength(1);
  });
});

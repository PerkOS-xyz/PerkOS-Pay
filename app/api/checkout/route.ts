import { NextResponse } from "next/server";
import { z } from "zod";

import { getCreditPack } from "@/lib/catalog";
import { assertEnvironmentBinding } from "@/lib/environment";
import { getRuntimeConfig } from "@/lib/runtime";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = getRuntimeConfig();
    if (config.environment.name !== "test") {
      return NextResponse.json({ error: "Test Checkout is unavailable" }, { status: 403 });
    }

    assertEnvironmentBinding({
      environment: config.environment,
      requestOrigin: request.headers.get("origin") ?? "",
    });

    const form = await request.formData();
    const pack = getCreditPack(form.get("packId"));
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: crypto.randomUUID(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.amountCents,
            product_data: { name: `${pack.credits} PerkOS usage credits` },
          },
        },
      ],
      metadata: {
        environment: config.environment.name,
        packId: pack.id,
        credits: String(pack.credits),
      },
      payment_intent_data: {
        metadata: {
          environment: config.environment.name,
          packId: pack.id,
        },
      },
      success_url: `${config.environment.origin}/result?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.environment.origin}/?checkout=cancelled`,
      // Stripe requires at least 30 full minutes at the time it receives the
      // request, so keep a one-minute margin for network and processing time.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const isInputError = error instanceof z.ZodError;
    console.error(
      "Stripe Checkout creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: isInputError ? "Invalid credit pack" : "Checkout could not be started" },
      { status: isInputError ? 400 : 503 },
    );
  }
}

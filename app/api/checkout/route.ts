import { NextResponse } from "next/server";

import { assertEnvironmentBinding } from "@/lib/environment";
import { getRuntimeConfig } from "@/lib/runtime";

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
    const token = form.get("session");
    if (typeof token !== "string" || token.length < 40 || !config.apiUrl) {
      return NextResponse.json({ error: "Invalid payment session" }, { status: 400 });
    }
    const apiResponse = await fetch(`${config.apiUrl}/billing/portal/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (!apiResponse.ok) throw new Error(`PerkOS API rejected checkout (${apiResponse.status})`);
    const result = (await apiResponse.json()) as { data?: { url?: string } };
    if (!result.data?.url?.startsWith("https://checkout.stripe.com/")) {
      throw new Error("PerkOS API returned an invalid Checkout URL");
    }
    return NextResponse.redirect(result.data.url, 303);
  } catch (error) {
    console.error(
      "Stripe Checkout creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Checkout could not be started" },
      { status: 503 },
    );
  }
}

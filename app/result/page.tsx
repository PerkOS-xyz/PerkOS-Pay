import Link from "next/link";

import { getRuntimeConfig } from "@/lib/runtime";
import { getStripe } from "@/lib/stripe";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  let paid = false;

  if (sessionId?.startsWith("cs_test_") && getRuntimeConfig().environment.name === "test") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      paid = !session.livemode && session.payment_status === "paid";
    } catch {
      paid = false;
    }
  }

  return (
    <main className="result-shell">
      <section className="result-card">
        <p className="eyebrow">Stripe Test Mode</p>
        <h1>{paid ? "Test payment verified." : "Payment not verified."}</h1>
        <p>
          {paid
            ? "Stripe confirmed the simulated payment. It is pending credit and has not changed any PerkOS balance."
            : "No completed test payment could be confirmed. You can safely return and try again."}
        </p>
        <Link href="/">Return to PerkOS Pay</Link>
      </section>
    </main>
  );
}

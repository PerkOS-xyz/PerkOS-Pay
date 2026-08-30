import Link from "next/link";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const returnedFromStripe = Boolean(sessionId?.startsWith("cs_test_"));

  return (
    <main className="result-shell">
      <section className="result-card">
        <p className="eyebrow">Stripe Test Mode</p>
        <h1>{returnedFromStripe ? "Payment submitted." : "Payment not confirmed."}</h1>
        <p>
          {returnedFromStripe
            ? "PerkOS API will verify Stripe's signed webhook before changing the Dev balance. This page never grants credits."
            : "No Stripe Checkout return was detected. You can safely return to PerkOS App and try again."}
        </p>
        <Link href="/">Return to PerkOS Pay</Link>
      </section>
    </main>
  );
}

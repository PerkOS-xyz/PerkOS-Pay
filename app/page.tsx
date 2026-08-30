import { getRuntimeConfig } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; checkout?: string }>;
}) {
  const { environment, paymentsEnabled } = getRuntimeConfig();
  const isTest = environment.name === "test";
  const { session, checkout } = await searchParams;
  const canCheckout = Boolean(session && paymentsEnabled && isTest);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="https://perkos.xyz" aria-label="PerkOS home">
          <span className="brand-mark">P</span>
          <span>PerkOS <strong>Pay</strong></span>
        </a>
        <span className={isTest ? "environment test" : "environment"}>
          {isTest ? "Test mode" : "Secure checkout"}
        </span>
      </header>

      <section className="shell">
        <div className="intro">
          <p className="eyebrow">Usage credits</p>
          <h1>Keep your AI team working.</h1>
          <p>
            Add prepaid credits for PerkOS infrastructure and Managed AI. Pay by card,
            or use a supported stablecoin if you prefer.
          </p>
        </div>

        <section className="checkout" aria-labelledby="checkout-title">
          <div className="checkout-heading">
            <div>
              <p className="step">Step 1 of 2</p>
              <h2 id="checkout-title">Confirm secure checkout</h2>
            </div>
            <span className="currency">USD credits</span>
          </div>

          <div className="packs" aria-label="Secure checkout">
            <form action="/api/checkout" method="post">
              <input type="hidden" name="session" value={session ?? ""} />
              <button type="submit" disabled={!canCheckout}>
                <span>Continue to Stripe</span>
                <small>Amount and wallet verified by PerkOS</small>
              </button>
            </form>
          </div>

          <div className="payment-methods">
            <div className="primary method-label">Stripe Checkout</div>
            <button className="secondary" type="button" disabled>
              Pay with crypto
            </button>
          </div>

          <p className="notice">
            {checkout === "cancelled"
              ? "Checkout was cancelled. Start a new payment from PerkOS App."
              : canCheckout
                ? "This test session is short-lived and can only fund the wallet that created it."
                : "Start the payment from PerkOS App to receive a secure checkout session."}
          </p>
        </section>

        <div className="trust-row" aria-label="Payment assurances">
          <span>Prepaid · no surprise invoice</span>
          <span>Card-first checkout</span>
          <span>Stablecoin ready</span>
        </div>
      </section>

      <footer>
        <span>© 2026 PerkOS LLC</span>
        <span>Balances and entitlements are managed by PerkOS API.</span>
      </footer>
    </main>
  );
}

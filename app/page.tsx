import { getRuntimeConfig } from "@/lib/runtime";
import { creditPacks } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default function Home() {
  const { environment, paymentsEnabled } = getRuntimeConfig();
  const isTest = environment.name === "test";

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
              <h2 id="checkout-title">Choose an amount</h2>
            </div>
            <span className="currency">USD credits</span>
          </div>

          <div className="packs" aria-label="Credit packs">
            {Object.entries(creditPacks).map(([packId, pack]) => (
              <form action="/api/checkout" method="post" key={packId}>
                <button
                  name="packId"
                  value={packId}
                  type="submit"
                  disabled={!paymentsEnabled || !isTest}
                >
                  <span>${pack.credits}</span>
                  <small>{pack.credits === 25 ? "Most popular" : "PerkOS credits"}</small>
                </button>
              </form>
            ))}
          </div>

          <div className="payment-methods">
            <div className="primary method-label">Stripe Checkout</div>
            <button className="secondary" type="button" disabled>
              Pay with crypto
            </button>
          </div>

          <p className="notice">
            {paymentsEnabled && isTest
              ? "Select a credit pack to open Stripe Test Checkout. No balance will be credited."
              : "Checkout activation is pending the PerkOS API billing-session contract."}
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

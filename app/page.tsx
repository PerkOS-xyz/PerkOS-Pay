import { getRuntimeConfig } from "@/lib/runtime";

const creditPacks = [10, 25, 50, 100];

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
            {creditPacks.map((amount) => (
              <button key={amount} type="button" disabled={!paymentsEnabled}>
                <span>${amount}</span>
                <small>{amount === 25 ? "Most popular" : "PerkOS credits"}</small>
              </button>
            ))}
          </div>

          <div className="payment-methods">
            <button className="primary" type="button" disabled>
              Pay with card
            </button>
            <button className="secondary" type="button" disabled>
              Pay with crypto
            </button>
          </div>

          <p className="notice">
            {paymentsEnabled
              ? "Select a credit pack to continue."
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


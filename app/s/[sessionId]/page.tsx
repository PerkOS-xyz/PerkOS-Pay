import Link from "next/link";

import { getRuntimeConfig } from "@/lib/runtime";
import { fetchBillingSession, isSessionId, shortWallet } from "@/lib/session";
import { UsdcPay } from "./UsdcPay";

export const dynamic = "force-dynamic";

/**
 * /s/<sessionId> — the page a PerkOS app sends a person to after a 402.
 * The session (from PerkOS API) says whose balance this is and what it can
 * buy; the person pays by card (hosted Stripe, created by the API for the
 * session's wallet) or with USDC on Base (signed here, settled by Stack). The
 * app polls its own balance and continues; there is nothing to return to.
 */
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; error?: string; coupon?: string }>;
}) {
  const { sessionId } = await params;
  const flags = await searchParams;
  const { environment } = getRuntimeConfig();
  const live = environment.name === "production";
  const { session, status } = isSessionId(sessionId)
    ? await fetchBillingSession(sessionId)
    : { session: null, status: 404 };

  if (!session) {
    return (
      <main className="result-shell">
        <section className="result-card">
          <p className="eyebrow">PerkOS Pay</p>
          <h1>{status === 404 ? "Session not found." : "Session unavailable."}</h1>
          <p>Open the payment link again from the PerkOS app. Links are single-purpose and expire after 30 minutes.</p>
          <Link href="https://perkos.xyz">Back to PerkOS</Link>
        </section>
      </main>
    );
  }

  const funded = session.infra.allowed;
  const expired = session.status === "expired";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="https://perkos.xyz" aria-label="PerkOS home">
          <span className="brand-mark">P</span>
          <span>PerkOS <strong>Pay</strong></span>
        </a>
        <span className={live ? "environment" : "environment test"}>{live ? "Secure checkout" : "Test mode"}</span>
      </header>

      <section className="shell">
        <div className="intro">
          <p className="eyebrow">Usage credits · {session.source}</p>
          <h1>{funded ? "Your team is funded." : "Activate PerkOS infrastructure."}</h1>
          <p>
            Prepaid balance for wallet <code>{shortWallet(session.wallet)}</code>: <strong>${session.creditsUsd.toFixed(2)}</strong>.
            {funded
              ? " Go back to the app; it picks the balance up on its own."
              : " Add credits by card or USDC; the app continues as soon as the balance is positive."}
          </p>
          {flags.paid ? <p className="notice">Payment received. Stripe confirms it in a moment; the balance above updates when it does.</p> : null}
          {flags.cancelled ? <p className="notice">Checkout cancelled. Nothing was charged.</p> : null}
          {flags.error === "expired" ? <p className="notice">This link expired. Open a new one from the app.</p> : null}
          {flags.error === "checkout" ? <p className="notice">Card checkout could not start. Try again or pay with USDC.</p> : null}
          {flags.coupon === "ok" ? <p className="notice">Coupon applied. The balance above is updated; go back to the app.</p> : null}
          {flags.coupon && flags.coupon !== "ok" ? (
            <p className="notice">
              {flags.coupon === "coupon_already_redeemed"
                ? "This wallet already used that code."
                : flags.coupon === "coupon_expired"
                  ? "That code has expired."
                  : flags.coupon === "coupon_exhausted"
                    ? "That code has been fully redeemed."
                    : flags.coupon === "http_429"
                      ? "Too many tries. Wait a minute."
                      : "That code is not valid."}
            </p>
          ) : null}
        </div>

        <section className="checkout" aria-labelledby="checkout-title">
          <div className="checkout-heading">
            <div>
              <p className="step">{expired ? "Link expired" : "Step 1 of 2"}</p>
              <h2 id="checkout-title">Choose an amount</h2>
            </div>
            <span className="currency">USD credits</span>
          </div>

          <div className="packs" aria-label="Card amounts">
            {session.card.amountsUsd.map((amount) => (
              <form action={`/api/session/${session.sessionId}/checkout`} method="post" key={amount}>
                <button name="amount" value={amount} type="submit" disabled={!live || expired || !session.card.available}>
                  <span>${amount}</span>
                  <small>{amount === 10 ? "Most popular" : "PerkOS credits"}</small>
                </button>
              </form>
            ))}
          </div>

          <div className="payment-methods">
            <div className="primary method-label">Card · Stripe Checkout</div>
            <div className="method-label secondary">USDC on Base · no gas</div>
          </div>

          {live && !expired ? <UsdcPay sessionId={session.sessionId} wallet={session.wallet} /> : null}

          {live && !expired ? (
            <form className="coupon" action={`/api/session/${session.sessionId}/coupon`} method="post">
              <label>
                Have a code?
                <input name="code" placeholder="COUPON" maxLength={32} autoComplete="off" spellCheck={false} required />
              </label>
              <button type="submit" className="secondary">Apply</button>
            </form>
          ) : null}

          <p className="notice">
            {!live
              ? "Sessions are served on pay.perkos.xyz."
              : expired
                ? "This link expired after 30 minutes. Open a new one from the app."
                : !session.card.available
                  ? "Card payments are temporarily unavailable; USDC works."
                  : "Card: pick an amount to open Stripe Checkout. USDC: sign once, gasless."}
          </p>
        </section>

        <div className="trust-row" aria-label="Payment assurances">
          <span>Prepaid · no surprise invoice</span>
          <span>Credited to your wallet</span>
          <span>Agents sleep when idle</span>
        </div>
      </section>

      <footer>
        <span>© 2026 PerkOS LLC</span>
        <span>Balances and entitlements are managed by PerkOS API.</span>
      </footer>
    </main>
  );
}

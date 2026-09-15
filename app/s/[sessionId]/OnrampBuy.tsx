"use client";

import { useState } from "react";

const AMOUNTS = [5, 10, 25, 50];

/**
 * "Buy USDC with a card": the step before paying with USDC, for someone who
 * has Apple Pay or a debit card and no stablecoins. We ask our own origin for
 * a Coinbase Onramp session (minted server-side against the session's wallet)
 * and hand the person to the hosted flow. The USDC arrives in their wallet,
 * and they come back and pay with it above.
 */
export function OnrampBuy({ sessionId, wallet }: { sessionId: string; wallet: string }) {
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function buy() {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/onramp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ network: "base", amount }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (res.status === 503) throw new Error("Card to USDC is not available yet on this deployment.");
      if (!res.ok || !body.url) throw new Error(body.error || `Could not start the purchase (${res.status})`);
      window.location.assign(body.url);
    } catch (e) {
      setMsg((e as Error).message || "Could not start the purchase");
      setBusy(false);
    }
  }

  return (
    <div className="usdc">
      <div className="usdc-row">
        <label>
          Amount
          <select value={amount} disabled={busy} onChange={(e) => setAmount(Number(e.target.value))}>
            {AMOUNTS.map((a) => (
              <option key={a} value={a}>${a} USDC</option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" disabled={busy} onClick={() => void buy()}>
          {busy ? "Opening Coinbase…" : "Buy USDC with a card"}
        </button>
      </div>
      <p className="usdc-hint">
        Apple Pay, Google Pay or a debit card, through Coinbase. The USDC arrives on Base in your own wallet
        ({wallet.slice(0, 6)}…{wallet.slice(-4)}), then pay with it above.
      </p>
      {msg ? <p className="usdc-err" role="status">{msg}</p> : null}
    </div>
  );
}

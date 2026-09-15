"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  buildAuthorization,
  chainFor,
  encodePaymentHeader,
  explorerTx,
  quotedUsd,
  typedDataFor,
  type PaymentRequirements,
} from "@/lib/x402Client";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const AMOUNTS = [1, 5, 10, 25];

/**
 * "Pay with USDC on Base": ask the API (through this origin) what a deposit
 * of $X costs, sign the EIP-3009 authorization with the wallet in the browser,
 * send it back. Gasless for the payer; Stack settles the transfer and the API
 * credits the address that signed. The tx hash links to BaseScan.
 */
export function UsdcPay({ sessionId, wallet }: { sessionId: string; wallet: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState<{ hash: string; url: string | null } | null>(null);

  async function pay() {
    setMsg("");
    setTx(null);
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    if (!eth) {
      setMsg("No wallet found in this browser. Install MetaMask (or open this page in a wallet browser) to pay with USDC.");
      return;
    }
    setBusy(true);
    try {
      // 1. Quote: the 402 carries the exact requirements we must sign against.
      const quote = await fetch(`/api/session/${sessionId}/x402`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ network: "base", amount }),
      });
      const quoted = (await quote.json()) as { accepts?: PaymentRequirements[]; error?: string };
      const req = quoted.accepts?.[0];
      if (quote.status !== 402 || !req) throw new Error(quoted.error || `Could not quote the deposit (${quote.status})`);
      const chain = chainFor(req.network);
      if (!chain) throw new Error(`Unsupported network ${req.network}`);

      // 2. Wallet: connect, sit on the right chain, sign as the connected account.
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const payer = accounts[0];
      if (!payer) throw new Error("Wallet returned no account");
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chain.chainId.toString(16)}` }] });
      } catch {
        // Some wallets refuse the switch but still sign for the right domain.
      }
      const auth = buildAuthorization(req, payer);
      const typed = typedDataFor(req, chain.chainId, auth);
      const signature = (await eth.request({
        method: "eth_signTypedData_v4",
        params: [payer, JSON.stringify(typed)],
      })) as string;

      // 3. Settle: same request, now with the payment. The API credits `payer`.
      const settle = await fetch(`/api/session/${sessionId}/x402`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-payment": encodePaymentHeader(req, auth, signature) },
        body: JSON.stringify({ network: "base", amount }),
      });
      const done = (await settle.json()) as { ok?: boolean; creditsUsd?: number; transaction?: string; wallet?: string; error?: { message?: string } | string };
      if (!settle.ok || !done.ok) {
        const e = typeof done.error === "string" ? done.error : done.error?.message;
        throw new Error(e || `Settlement failed (${settle.status})`);
      }
      const credited = done.wallet?.toLowerCase() === wallet.toLowerCase();
      setTx({ hash: done.transaction ?? "", url: done.transaction ? explorerTx(req.network, done.transaction) : null });
      setMsg(
        credited
          ? `Deposited $${quotedUsd(req)} USDC. Balance: $${(done.creditsUsd ?? 0).toFixed(2)}. You can go back to the app.`
          : `Deposited $${quotedUsd(req)} USDC, credited to the wallet that signed (${done.wallet}), which is not this session's wallet.`,
      );
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message || "Payment failed");
    } finally {
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
        <button type="button" className="secondary" disabled={busy} onClick={() => void pay()}>
          {busy ? "Waiting for wallet…" : "Pay with USDC on Base"}
        </button>
      </div>
      <p className="usdc-hint">
        Sign once in your wallet; no gas. Credits go to the address that signs, so sign with {wallet.slice(0, 6)}…{wallet.slice(-4)}.
      </p>
      {msg ? <p className={tx ? "usdc-ok" : "usdc-err"} role="status">{msg}</p> : null}
      {tx?.url ? (
        <p className="usdc-hint">
          <a href={tx.url} target="_blank" rel="noreferrer">View the transaction on BaseScan</a>
        </p>
      ) : null}
    </div>
  );
}

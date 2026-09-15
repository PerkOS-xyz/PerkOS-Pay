/**
 * Browser-side half of an x402 "exact" EVM payment, without a wallet library:
 * the payer signs an EIP-3009 TransferWithAuthorization against the token's
 * EIP-712 domain (name/version come from the 402's paymentRequirements.extra,
 * which the API sets per token) and we base64 the x402 v1 payload for the
 * X-PAYMENT header. Mirrors PerkOS-Knowledge's DepositPanel, which is verified
 * live against Stack on Base and Celo. Pure functions here; the component
 * supplies `window.ethereum`.
 */

export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: { name?: string; version?: string };
};

export type Authorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

const CHAINS: Record<string, { chainId: number; explorer: string; label: string }> = {
  base: { chainId: 8453, explorer: "https://basescan.org/tx/", label: "Base" },
  celo: { chainId: 42220, explorer: "https://celoscan.io/tx/", label: "Celo" },
  robinhood: { chainId: 4663, explorer: "https://explorer.robinhood.xyz/tx/", label: "Robinhood Chain" },
};

export function chainFor(network: string) {
  return CHAINS[network] ?? null;
}

export function explorerTx(network: string, hash: string): string | null {
  const c = CHAINS[network];
  return c ? `${c.explorer}${hash}` : null;
}

export function randomNonce(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32))): string {
  return `0x${[...bytes].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function buildAuthorization(
  req: PaymentRequirements,
  payer: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  nonce: string = randomNonce(),
): Authorization {
  return {
    from: payer,
    to: req.payTo,
    value: req.maxAmountRequired,
    validAfter: "0",
    validBefore: String(nowSec + (req.maxTimeoutSeconds || 120)),
    nonce,
  };
}

/** EIP-712 typed data for eth_signTypedData_v4. */
export function typedDataFor(req: PaymentRequirements, chainId: number, auth: Authorization) {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    domain: {
      name: req.extra?.name || "USDC",
      version: req.extra?.version || "2",
      chainId,
      verifyingContract: req.asset,
    },
    primaryType: "TransferWithAuthorization" as const,
    message: auth,
  };
}

/** The base64 `X-PAYMENT` header value (x402 v1, scheme exact). */
export function encodePaymentHeader(req: PaymentRequirements, auth: Authorization, signature: string): string {
  const payload = {
    x402Version: 1,
    scheme: "exact",
    network: req.network,
    payload: { signature, authorization: auth },
  };
  return btoa(JSON.stringify(payload));
}

/** Decimal USD from the base-unit amount the 402 quotes (6-decimal stablecoins). */
export function quotedUsd(req: PaymentRequirements, decimals = 6): number {
  return Number(req.maxAmountRequired) / 10 ** decimals;
}

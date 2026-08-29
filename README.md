# PerkOS Pay

Card-first and stablecoin-ready billing portal for PerkOS usage credits.

## Responsibility

This repository owns the customer payment experience served at:

- `https://pay.perkos.xyz` — production;
- `https://test.pay.perkos.xyz` — Stripe Test Mode and supported testnets.

PerkOS Pay does **not** own identity, balances, ledger entries, usage metering,
or entitlements. Those remain in PerkOS API. Stripe collects card payments and
PerkOS Stack verifies and settles supported crypto payments.

## Current status

Stripe Test Checkout and a signature-verified, idempotent webhook are available
for isolated validation. Verified events remain `verified_pending_credit`; they
never change PerkOS balances. Production Checkout remains disabled until PerkOS
API publishes the environment-bound billing-session contract.

## Development

Requires Node.js 22 or newer.

```bash
cp .env.example .env.local
pnpm install
pnpm run dev
```

For explicit local and QA templates, use `.env.dev` and `.env.qa`. Both commit
only empty secret placeholders. Run Next with a copied `.env.local` file or
inject the selected template through your process manager.

Stripe Test webhook endpoint:

```text
https://test.pay.perkos.xyz/api/stripe/webhook
```

Subscribe it to `checkout.session.completed`. Stripe requires the unmodified
request body and the endpoint-specific `whsec_...` secret.

Verification:

```bash
pnpm run verify
```

## VPS deployment

Production runs as the `perkos-pay` container on the shared PerkOS Docker
network. Caddy terminates TLS and routes `pay.perkos.xyz` to port 3000.

```bash
docker compose build pay
docker compose up -d pay
docker inspect perkos-pay --format '{{.State.Health.Status}}'
```

The initial deployment must keep `PERKOS_PAYMENTS_ENABLED=false`. Enabling it
before the environment-bound billing-session contract exists is unsupported.

## Safety invariants

- A browser redirect never credits a balance.
- Provider events are verified server-side and processed idempotently.
- Stripe Test Mode and testnets cannot credit production.
- Payment sessions bind environment, billing account, organization, origin,
  return URL, nonce, and expiration.
- Crypto options are discovered from Stack capabilities rather than assumed.

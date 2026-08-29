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

The repository is an executable safety-first scaffold. Checkout actions remain
disabled until PerkOS API publishes the environment-bound billing-session
contract. No live payment credentials or handlers exist here yet.

## Development

Requires Node.js 22 or newer.

```bash
cp .env.example .env.local
pnpm install
pnpm run dev
```

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

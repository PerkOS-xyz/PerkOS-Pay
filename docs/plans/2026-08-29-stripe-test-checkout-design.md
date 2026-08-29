# Stripe Test Checkout Design

## Objective

Validate PerkOS card payments end to end with Stripe Checkout in Test Mode,
without changing balances, entitlements, or production payment state.

## Architecture

The browser submits only a known credit-pack identifier to a server Route
Handler. The server resolves the amount from a fixed catalog, verifies that the
runtime is non-production and payments are enabled, then creates a Stripe
Checkout Session. Stripe owns card collection. No secret or authoritative
amount is exposed to client code.

Stripe redirects the customer to a result page for user feedback only. That
redirect never credits an account. A separate webhook Route Handler reads the
unmodified request body, verifies `Stripe-Signature`, rejects live-mode events,
and records successful Checkout events as `verified_pending_credit`.

## Idempotency and storage

Webhook event IDs are written to a small durable filesystem journal using an
exclusive create operation. Repeated delivery returns success without creating
a second record. The Docker deployment mounts the journal as a named volume.
This journal is a temporary test-mode adapter; PerkOS API remains the future
source of truth and will replace it with the environment-bound billing contract.

## Environments

- `.env.dev` uses localhost and Stripe Test Mode.
- `.env.qa` targets `test.pay.perkos.xyz` and Stripe Test Mode.
- Production remains `pay.perkos.xyz`, live-mode-bound, and disabled.

Secret values remain blank placeholders in committed files and must be injected
at runtime. Checkout creation fails closed when configuration is missing or the
Stripe key mode does not match the runtime.

## Verification

Tests cover the pack catalog, runtime guards, origin binding, live-mode event
rejection, and idempotent event recording. Lint, TypeScript, unit tests, and the
production build must pass before deployment.

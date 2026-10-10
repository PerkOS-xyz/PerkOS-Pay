# Public launch dependency security, AP01

Upgrade Next and its matching ESLint configuration within v16 and refresh the
pnpm lockfile with patched transitive dependencies. Keep React and the payment
contract unchanged. Do not enable legacy checkout, charge a card or treat a
success redirect as payment confirmation.

Verify the frozen lockfile, production audit, lint, typecheck, existing tests and
production build. Add regression checks and CI. Verify the real payment surface
in test mode before rollout. This patch does not resolve the separate App/API/Pay
contract, Solana billing, order idempotency or refund/dispute launch blockers.

## Local verification, 2026-10-10 UTC

- Production audit: no known advisories after Next 16.4.0 and source-map-js 1.2.2.
- Frozen-lockfile install checked using the declared pnpm 11.19.0. Lint, types,
  32 tests and production build pass. Next regenerated its root-params type import.
- CI verifies both the source and the real container without external network.
  Docker is not running locally, so that image job must complete remotely.
- No provider event, ledger credit, payment mode or environment binding changed.
- Standalone health returns HTTP 200 with the default test environment and
  payments disabled. Temporary local smoke servers were stopped after testing.

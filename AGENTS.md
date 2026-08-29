<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version may contain breaking changes. Read the relevant guide in
`node_modules/next/dist/docs/` before changing routing or server behavior.
<!-- END:nextjs-agent-rules -->

## Payment safety

- PerkOS API is the source of truth for identity, balances, ledger entries, and entitlements.
- Never credit a balance from browser state or a success redirect.
- Never expose Stripe secret keys, webhook secrets, or treasury credentials to the client.
- Test-mode events and testnet settlements must never affect production state.
- Every provider event and settlement must be handled idempotently.


# Solana Smart Contract Testing

Hands-on TypeScript test scripts against the Solana **SPL Token program** — a real, deployed
on-chain smart contract — covering mint creation, minting, transfers, balance assertions, and
a deliberate failure case (insufficient-balance transfer).

Run against a local `solana-test-validator` rather than public devnet, for a deterministic,
unlimited-test-SOL environment with no shared rate limits.

## Setup

```bash
npm install

# in one terminal, start a local validator:
solana-test-validator --reset

# in another terminal, run the scripts in order:
npx tsx src/01-setup.ts
npx tsx src/02-create-token.ts
npx tsx src/03-transfer-and-assert.ts
```

## What's covered

- `src/wallet.ts` — a persisted, reusable test wallet with retry-backed airdrop funding.
- `src/01-setup.ts` — connect, fund, confirm balance.
- `src/02-create-token.ts` — create a token mint, create a token account, mint supply.
- `src/03-transfer-and-assert.ts` — transfer between accounts with balance assertions, plus a
  deliberate over-transfer to confirm the chain rejects it correctly and leaves no partial
  state (`node:assert`-based, no external test framework).

# Solana Smart Contract Testing

Hands-on TypeScript test scripts against Solana's **SPL Token** and **Token-2022** programs —
real, deployed on-chain smart contracts — covering mint creation, minting, transfers, balance
assertions, deliberate failure cases (insufficient balance, unauthorized transfer, invalid
transfer fee), and a Token-2022 extension (transfer fees with a percentage + cap).

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
npx tsx src/04-unauthorized-transfer.ts
npx tsx src/05-token2022-transfer-fee.ts
```

## What's covered

- `src/wallet.ts` — a persisted, reusable test wallet with retry-backed airdrop funding.
- `src/01-setup.ts` — connect, fund, confirm balance.
- `src/02-create-token.ts` — create a token mint, create a token account, mint supply.
- `src/03-transfer-and-assert.ts` — transfer between accounts with balance assertions, plus a
  deliberate over-transfer to confirm the chain rejects it correctly and leaves no partial
  state (`node:assert`-based, no external test framework).
- `src/04-unauthorized-transfer.ts` — attempts a transfer authorized by a keypair that isn't
  the token account's actual owner, confirming the chain rejects it (`custom program error:
  0x4`, distinct from the insufficient-funds case) and leaves balances unchanged.
- `src/05-token2022-transfer-fee.ts` — creates a **Token-2022** mint (not classic SPL Token)
  with the transfer-fee extension (5%, capped at 0.50/transfer), and asserts: a sub-cap
  transfer charges the straight percentage, an over-cap transfer has its fee clamped to the
  maximum rather than the uncapped percentage, and a transfer declaring the wrong expected fee
  is rejected on-chain (`custom program error: 0x20`).

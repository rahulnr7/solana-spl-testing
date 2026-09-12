import { Connection } from '@solana/web3.js'

// Local test validator (started with `solana-test-validator`) instead of
// public devnet — no shared rate limits, instant unlimited test SOL.
export const connection = new Connection('http://127.0.0.1:8899', 'confirmed')

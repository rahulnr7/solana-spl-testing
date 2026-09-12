import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const WALLET_FILE = new URL('../.test-wallet.json', import.meta.url)

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadOrCreateKeypair(): Keypair {
    if (existsSync(WALLET_FILE)) {
        const secret = JSON.parse(readFileSync(WALLET_FILE, 'utf-8'))
        return Keypair.fromSecretKey(Uint8Array.from(secret))
    }
    const keypair = Keypair.generate()
    writeFileSync(WALLET_FILE, JSON.stringify(Array.from(keypair.secretKey)))
    return keypair
}

// Devnet's public faucet is heavily rate-limited and frequently returns
// "Internal error" — retry with backoff instead of failing on the first attempt.
async function requestAirdropWithRetry(
    connection: Connection,
    pubkey: Parameters<Connection['requestAirdrop']>[0],
    lamports: number,
    maxAttempts = 5,
): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const signature = await connection.requestAirdrop(pubkey, lamports)
            await connection.confirmTransaction(signature, 'confirmed')
            return
        } catch (err) {
            console.log(`Airdrop attempt ${attempt}/${maxAttempts} failed, retrying...`)
            if (attempt === maxAttempts) throw err
            await delay(2000 * attempt) // simple linear backoff
        }
    }
}

// Reuses a persisted keypair across runs, and only tops up via airdrop when
// the balance is actually low — avoids hammering the faucet every run.
export async function getFundedWallet(connection: Connection, minSol = 0.5): Promise<Keypair> {
    const keypair = loadOrCreateKeypair()
    const balance = await connection.getBalance(keypair.publicKey)

    if (balance < minSol * LAMPORTS_PER_SOL) {
        console.log(`Balance low (${balance / LAMPORTS_PER_SOL} SOL), requesting airdrop...`)
        await requestAirdropWithRetry(connection, keypair.publicKey, 1 * LAMPORTS_PER_SOL)
    } else {
        console.log(`Reusing funded wallet: ${keypair.publicKey.toBase58()} (${balance / LAMPORTS_PER_SOL} SOL)`)
    }

    return keypair
}

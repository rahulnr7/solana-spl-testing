import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { connection } from './connection.js'
import { getFundedWallet } from './wallet.js'

async function main() {
    const payer = await getFundedWallet(connection)
    console.log('Wallet:', payer.publicKey.toBase58())

    const balance = await connection.getBalance(payer.publicKey)
    console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})

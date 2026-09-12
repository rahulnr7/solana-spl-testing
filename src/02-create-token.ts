import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from '@solana/spl-token'
import { connection } from './connection.js'
import { getFundedWallet } from './wallet.js'

async function main() {
    const payer = await getFundedWallet(connection)

    console.log('Creating token mint...')
    // decimals: 2 (like cents) - creates the mint's data account, owned by the Token program
    const mint = await createMint(connection, payer, payer.publicKey, null, 2)
    console.log('Mint created:', mint.toBase58())

    console.log('Creating a token account to hold this token...')
    // derives the associated token account (a PDA keyed on owner + mint)
    const tokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey)
    console.log('Token account:', tokenAccount.address.toBase58())

    console.log('Minting 1000 tokens (10.00 with 2 decimals)...')
    await mintTo(connection, payer, mint, tokenAccount.address, payer, 1000)

    const account = await getAccount(connection, tokenAccount.address)
    console.log(`Token account balance: ${account.amount} (raw units)`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})

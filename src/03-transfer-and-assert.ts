import assert from 'node:assert'
import { Keypair } from '@solana/web3.js'
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    transfer,
    getAccount,
} from '@solana/spl-token'
import { connection } from './connection.js'
import { getFundedWallet } from './wallet.js'

async function main() {
    const payer = await getFundedWallet(connection)

    const mint = await createMint(connection, payer, payer.publicKey, null, 2)
    console.log('Mint:', mint.toBase58())

    // sender = the funded payer's own token account; recipient = a fresh keypair
    const senderAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey)
    const recipient = Keypair.generate()
    const recipientAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient.publicKey)

    await mintTo(connection, payer, mint, senderAccount.address, payer, 1000) // 10.00

    // --- Test 1: a valid transfer moves the correct amount ---
    await transfer(connection, payer, senderAccount.address, recipientAccount.address, payer, 300) // 3.00

    const senderAfter = await getAccount(connection, senderAccount.address)
    const recipientAfter = await getAccount(connection, recipientAccount.address)

    assert.strictEqual(senderAfter.amount, 700n, 'sender should have 1000 - 300 = 700 left')
    assert.strictEqual(recipientAfter.amount, 300n, 'recipient should have received 300')
    console.log('PASS: valid transfer moved the correct amount, sender/recipient balances both correct')

    // --- Test 2: transferring more than the sender's balance should fail on-chain ---
    let failedAsExpected = false
    try {
        await transfer(connection, payer, senderAccount.address, recipientAccount.address, payer, 10_000) // way more than 700 left
    } catch (err) {
        failedAsExpected = true
        console.log('PASS: over-transfer correctly rejected by the chain. Error:', (err as Error).message)
    }
    assert.strictEqual(failedAsExpected, true, 'transferring more than the balance should have thrown')

    // balances must be unchanged after the failed attempt — no partial transfer
    const senderFinal = await getAccount(connection, senderAccount.address)
    const recipientFinal = await getAccount(connection, recipientAccount.address)
    assert.strictEqual(senderFinal.amount, 700n, 'sender balance must be unchanged after a rejected transfer')
    assert.strictEqual(recipientFinal.amount, 300n, 'recipient balance must be unchanged after a rejected transfer')
    console.log('PASS: balances unchanged after the rejected transfer (no partial state)')

    console.log('\nAll assertions passed.')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})

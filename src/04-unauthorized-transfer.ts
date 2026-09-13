import assert from 'node:assert'
import { Keypair } from '@solana/web3.js'
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer, getAccount } from '@solana/spl-token'
import { connection } from './connection.js'
import { getFundedWallet } from './wallet.js'

async function main() {
    const payer = await getFundedWallet(connection)

    const mint = await createMint(connection, payer, payer.publicKey, null, 2)
    console.log('Mint:', mint.toBase58())

    const senderAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey)
    const recipient = Keypair.generate()
    const recipientAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient.publicKey)

    await mintTo(connection, payer, mint, senderAccount.address, payer, 1000) // 10.00

    // an unrelated keypair with no authority over senderAccount - its on-chain
    // owner field is `payer`, not this keypair
    const attacker = Keypair.generate()

    console.log('Attempting a transfer authorized by a non-owner keypair...')
    let rejectedAsExpected = false
    try {
        // `payer` still covers the network fee, but `attacker` is supplied as the
        // token account's authority - the Token program should reject this since
        // senderAccount's real owner is `payer`, not `attacker`
        await transfer(connection, payer, senderAccount.address, recipientAccount.address, attacker, 100)
    } catch (err) {
        rejectedAsExpected = true
        console.log('PASS: transfer correctly rejected - signer is not the account owner. Error:', (err as Error).message)
    }
    assert.strictEqual(rejectedAsExpected, true, 'a transfer authorized by a non-owner should have been rejected')

    // no partial state - balances must be exactly what they were before the attempt
    const senderAfter = await getAccount(connection, senderAccount.address)
    const recipientAfter = await getAccount(connection, recipientAccount.address)
    assert.strictEqual(senderAfter.amount, 1000n, 'sender balance must be unchanged after the rejected unauthorized transfer')
    assert.strictEqual(recipientAfter.amount, 0n, 'recipient balance must be unchanged after the rejected unauthorized transfer')
    console.log('PASS: balances unchanged after the unauthorized transfer attempt')

    console.log('\nAll assertions passed.')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})

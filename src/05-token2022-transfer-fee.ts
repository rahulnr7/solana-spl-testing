import assert from 'node:assert'
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import {
    TOKEN_2022_PROGRAM_ID,
    ExtensionType,
    getMintLen,
    createInitializeTransferFeeConfigInstruction,
    createInitializeMintInstruction,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    transferCheckedWithFee,
    getAccount,
    getTransferFeeAmount,
} from '@solana/spl-token'
import { connection } from './connection.js'
import { getFundedWallet } from './wallet.js'

const DECIMALS = 2
const FEE_BASIS_POINTS = 500 // 5%
const MAX_FEE = 50n // cap in raw units (0.50 tokens), regardless of percentage

// A bare mint (classic or Token-2022 with no extensions) can be created with the
// createMint() helper. Extensions need to be initialized before the base mint is
// finalized, so an extension mint has to be built manually, instruction by instruction.
async function createTransferFeeMint(payer: Keypair) {
    const mintKeypair = Keypair.generate()
    const mintLen = getMintLen([ExtensionType.TransferFeeConfig])
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen)

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: mintLen,
            lamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeTransferFeeConfigInstruction(
            mintKeypair.publicKey,
            payer.publicKey, // transferFeeConfigAuthority - can change the fee later
            payer.publicKey, // withdrawWithheldAuthority - can withdraw collected fees
            FEE_BASIS_POINTS,
            MAX_FEE,
            TOKEN_2022_PROGRAM_ID,
        ),
        createInitializeMintInstruction(mintKeypair.publicKey, DECIMALS, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
    )

    await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair])
    return mintKeypair.publicKey
}

async function main() {
    const payer = await getFundedWallet(connection)

    console.log('Creating a Token-2022 mint with a 5% transfer fee (capped at 0.50 per transfer)...')
    const mint = await createTransferFeeMint(payer)
    console.log('Mint:', mint.toBase58())

    const senderAccount = await getOrCreateAssociatedTokenAccount(
        connection, payer, mint, payer.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID,
    )
    const recipient = Keypair.generate()
    const recipientAccount = await getOrCreateAssociatedTokenAccount(
        connection, payer, mint, recipient.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID,
    )

    await mintTo(connection, payer, mint, senderAccount.address, payer, 10_000, [], undefined, TOKEN_2022_PROGRAM_ID) // 100.00

    // --- Test 1: a transfer under the fee cap - fee is a straight 5% ---
    // 200 raw units (2.00) * 5% = 10 raw units (0.10) - below the 50-unit cap
    await transferCheckedWithFee(
        connection, payer, senderAccount.address, mint, recipientAccount.address, payer,
        200n, DECIMALS, 10n, [], undefined, TOKEN_2022_PROGRAM_ID,
    )

    const recipientAfterTest1 = await getAccount(connection, recipientAccount.address, undefined, TOKEN_2022_PROGRAM_ID)
    const withheldAfterTest1 = getTransferFeeAmount(recipientAfterTest1)

    assert.strictEqual(recipientAfterTest1.amount, 190n, 'recipient should net 200 - 10 fee = 190')
    assert.strictEqual(withheldAfterTest1?.withheldAmount, 10n, 'recipient account should show 10 raw units withheld as fee')
    console.log('PASS: sub-cap transfer charged a straight 5% fee (10 of 200), recipient net 190')

    // --- Test 2: a transfer where 5% would exceed the cap - fee is clamped ---
    // 2000 raw units (20.00) * 5% = 100 raw units, but maximumFee = 50 - fee should clamp to 50
    await transferCheckedWithFee(
        connection, payer, senderAccount.address, mint, recipientAccount.address, payer,
        2000n, DECIMALS, 50n, [], undefined, TOKEN_2022_PROGRAM_ID,
    )

    const recipientAfterTest2 = await getAccount(connection, recipientAccount.address, undefined, TOKEN_2022_PROGRAM_ID)
    const withheldAfterTest2 = getTransferFeeAmount(recipientAfterTest2)

    // cumulative: 190 (test 1) + (2000 - 50 capped) = 2140; withheld: 10 (test 1) + 50 = 60
    assert.strictEqual(recipientAfterTest2.amount, 2140n, 'recipient should net 190 + (2000 - 50 capped fee) = 2140')
    assert.strictEqual(withheldAfterTest2?.withheldAmount, 60n, 'withheld total should be 10 + 50 (capped), not 10 + 100')
    console.log('PASS: over-cap transfer had its fee clamped to the 50-unit maximum, not the uncapped 5% (100)')

    // --- Test 3: specifying the wrong expected fee must be rejected on-chain ---
    // real fee for 200 raw units at 5% is 10, not 5 - the "checked" instruction verifies
    // the caller's expected fee against the mint's actual config before executing
    let rejectedAsExpected = false
    try {
        await transferCheckedWithFee(
            connection, payer, senderAccount.address, mint, recipientAccount.address, payer,
            200n, DECIMALS, 5n, [], undefined, TOKEN_2022_PROGRAM_ID,
        )
    } catch (err) {
        rejectedAsExpected = true
        console.log('PASS: transfer with an incorrect expected fee was rejected. Error:', (err as Error).message)
    }
    assert.strictEqual(rejectedAsExpected, true, 'a transfer specifying the wrong fee should have been rejected')

    console.log('\nAll assertions passed.')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})

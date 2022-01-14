import * as anchor from '@project-serum/anchor';
import { expect } from 'chai';

// COMMENT HERE
export function programForUser(user, program) {
    return new anchor.Program(program.idl, program.programId, user.provider);
  }

// COMMENT HERE
export async function getAccountBalance(provider, pubkey) {
    let account = await provider.connection.getAccountInfo(pubkey);
    return account?.lamports ?? 0;
  }

// COMMENT HERE
export function expectBalance(actual, expected, message, slack=20000) {
    expect(actual, message).to.be.within(expected - slack, expected + slack)
  }

// COMMENT HERE
export async function createUser(provider, initialAirdropBalance) {
    initialAirdropBalance = initialAirdropBalance ?? 10 * anchor.web3.LAMPORTS_PER_SOL;

    let user = anchor.web3.Keypair.generate();
    let sig = await provider.connection.requestAirdrop(
        user.publicKey,
        initialAirdropBalance
    );
    await provider.connection.confirmTransaction(sig);

    let wallet = new anchor.Wallet(user);
    let userProvider = new anchor.Provider(
        provider.connection,
        wallet,
        provider.opts
    );

    return {
        key: user,
        wallet,
        provider: userProvider,
    }
}

// COMMENT - HERE
export function createUsers(provider, numUsers) {
    let promises = [];
    for(let i = 0; i < numUsers; i++) {
        promises.push(createUser(provider, null));
    }

    return Promise.all(promises);
}
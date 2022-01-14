import * as anchor from '@project-serum/anchor';
import * as BN from 'bn.js'
import { programForUser } from './user.ts';

export async function createList(mainProgram, owner, name, capacity=16) {
    const [listAccount, bump] = await anchor.web3.PublicKey.findProgramAddress([
      "todolist",
      owner.key.publicKey.toBytes(),
      name.slice(0, 32)
    ], mainProgram.programId);

    let program = programForUser(owner, mainProgram);
    await program.rpc.newList(name, capacity, bump, {
        accounts: {
            list: listAccount,
            user: owner.key.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
    });

    let list = await program.account.todoList.fetch(listAccount);
    return { publicKey: listAccount, data: list };
}

export async function addItem(mainProgram, {list, user, name, bounty}) {
    const itemAccount = anchor.web3.Keypair.generate();
    let program = programForUser(user, mainProgram);

    await program.rpc.add(list.data.name, name, new anchor.BN(bounty), {
        accounts: {
            list: list.publicKey,
            listOwner: list.data.listOwner,
            item: itemAccount.publicKey,
            user: user.key.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [
            user.key,
            itemAccount,
        ]
    });

    let [listData, itemData] = await Promise.all([
        program.account.todoList.fetch(list.publicKey),
        program.account.listItem.fetch(itemAccount.publicKey),
    ]);

    return {
        list: {
            publicKey: list.publicKey,
            data: listData,
        },
        item: {
            publicKey: itemAccount.publicKey,
            data: itemData,
        }
    };
}

export async function cancelItem(mainProgram, { list, item, itemCreator, user }) {
    let program = programForUser(user, mainProgram);
    await program.rpc.cancel(list.data.name, {
        accounts: {
            list: list.publicKey,
            listOwner: list.data.listOwner,
            item: item.publicKey,
            itemCreator: itemCreator.key.publicKey,
            user: user.key.publicKey,
        }
    });

    let listData = await program.account.todoList.fetch(list.publicKey);
    return {
        list: {
            publicKey: list.publicKey,
            data: listData,
        }
    }
}

export async function finishItem(mainProgram, { list, listOwner, item, user, expectAccountClosed }) {
    let program = programForUser(user, mainProgram);
    await program.rpc.finish(list.data.name, {
        accounts: {
            list: list.publicKey,
            listOwner: listOwner.key.publicKey,
            item: item.publicKey,
            user: user.key.publicKey,
        }
    });

    let [listData, itemData] = await Promise.all([
        program.account.todoList.fetch(list.publicKey),
        expectAccountClosed ? null : await program.account.listItem.fetch(item.publicKey),
    ]);

    return {
        list: {
            publicKey: list.publicKey,
            data: listData,
        },
        item: {
            publicKey: item.publicKey,
            data: itemData,
        }
    };
}
import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { TodoList } from '../target/types/todo_list';
import { expect } from 'chai';

import { 
  createUser, createUsers, 
  getAccountBalance, expectBalance 
} from './utils/user.ts';
import { 
  createList, addItem, cancelItem, finishItem
} from './utils/list.ts';

describe('todo-list', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TodoList as Program<TodoList>;

  describe('new list', () => {
    it('creates a list', async () => {
      const owner = await createUser(provider, null);
      let list = await createList(program, owner, 'A list');

      expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      expect(list.data.name, 'List name is set').equals('A list');
      expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });

  describe('add behaviour', () => {
    it('anyone can add an item to a list', async () => {
      const [owner, adder] = await createUsers(provider, 2);
      // Adder initial balance to verify account storage fees, etc...
      const adderBalance = await getAccountBalance(provider, adder.key.publicKey);
      // Create a new list.
      const list = await createList(program, owner, 'list');
      // Add a given item to our list
      const result = await addItem(program, {
        list,
        user: adder,
        name: 'Do something',
        bounty: 1 * anchor.web3.LAMPORTS_PER_SOL
      });

      // Check for the newly added item.
      expect(
        result.list.data.lines, 'Item is added'
      ).deep.equals([result.item.publicKey]);
      //  Check if the item creator is our "adder" user account.
      expect(
        result.item.data.creator.toString(), 'Item marked with creator'
      ).equals(adder.key.publicKey.toString());
      // Check our new item. Should be "not finished" for both sides: Owner and Adder.
      expect(
        result.item.data.creatorFinished, 'creator_finished is false'
      ).equals(false);
      expect(
        result.item.data.listOwnerFinished, 'list_owner_finished is false'
      ).equals(false);
      // Check that the item name was correctly set.
      expect(result.item.data.name, 'Name is set').equals('Do something');
      // Check that our list account balance has enough
      expect(
        await getAccountBalance(provider, result.item.publicKey), 'List account balance'
      ).equals(1 * anchor.web3.LAMPORTS_PER_SOL);
      // Check if the number of lamports removed from our "adder" is equal to the bounty.
      let adderNewBalance = await getAccountBalance(provider, adder.key.publicKey);
      expectBalance(
        adderBalance - adderNewBalance, 
        anchor.web3.LAMPORTS_PER_SOL,
        'Number of lamports removed from adder is equal to bounty'
      );

      const again = await addItem(program, {
        list,
        user: adder,
        name: 'Another item',
        bounty: 1 * anchor.web3.LAMPORTS_PER_SOL
      });
      // Check if another item is added to our list.
      expect(
        again.list.data.lines, 'Item is added'
      ).deep.equals([
        result.item.publicKey, again.item.publicKey
      ]);

    });

    it('fails if the list is full', async () => {
      const MAX_LIST_SIZE = 5;
      const owner = await createUser(provider, null);
      const list = await createList(program, owner, 'list', MAX_LIST_SIZE);

      for (const i of Array(MAX_LIST_SIZE).keys()) {
        await addItem(program, {
          list,
          user: owner,
          name: `Item ${i}`,
          bounty: 1 * anchor.web3.LAMPORTS_PER_SOL,
        });
      }

      const adderStartingBalance = await getAccountBalance(
        provider,
        owner.key.publicKey
      );

      // Now the list should be full.
      try {
        let addResult = await addItem(program, {
          list,
          user: owner,
          name: 'Full item',
          bounty: 1 * anchor.web3.LAMPORTS_PER_SOL,
        });

        console.dir(addResult, { depth: null });
        expect.fail('Adding to full list should have failed');
      } catch(e) {
        expect(e.toString()).contains('This list is full');
      }

      let adderNewBalance = await getAccountBalance(provider, owner.key.publicKey);
      expect(adderStartingBalance, 'Adder balance is unchanged').equals(adderNewBalance);
    });

    it('fails if the bounty is smaller than the rent-exempt amount', async () => {
      const owner = await createUser(provider, null);
      const list = await createList(program, owner, 'list');
      const adderStartingBalance = await getAccountBalance(provider, owner.key.publicKey);

      try {
        await addItem(program, {
          list,
          user: owner,
          name: 'Small bounty item',
          bounty: 10,
        });
        expect.fail('Should have failed');
      } catch(e) {
        expect(e.toString()).equals('Bounty must be enough to mark account rent-exempt');
      }

      let adderNewBalance = await getAccountBalance(provider, owner.key.publicKey);
      expect(adderStartingBalance, 'Adder balance is unchanged').equals(adderNewBalance);
    });    
  });

  describe('cancel behaviour', () => {
    it('List owner can cancel an item', async () => {
      const [owner, adder] = await createUsers(provider, 2);
      const list = await createList(program, owner, 'list');

      const adderBalance = await getAccountBalance(provider, adder.key.publicKey);
      const result = await addItem(program, {
        list,
        user: adder,
        name: 'To cancel',
        bounty: 2 * anchor.web3.LAMPORTS_PER_SOL
      });
      const adderBalanceAfterAdd = await getAccountBalance(provider, adder.key.publicKey);
      console.log(`start: ${adderBalance} -> end: ${adderBalanceAfterAdd}`);

      expect(result.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderBalance);

      const cancelResult = await cancelItem(program, {
        list,
        item: result.item,
        itemCreator: adder,
        user: owner,
      })

      const adderBalanceAfterCancel = await getAccountBalance(provider, adder.key.publicKey);
      console.log(`start: ${adderBalance} -> end: ${adderBalanceAfterAdd} -> cancel: ${adderBalanceAfterCancel}`);
      expectBalance(
        adderBalanceAfterCancel,
        adderBalanceAfterAdd + 2 * anchor.web3.LAMPORTS_PER_SOL,
        'Cancel returns bounty to adder'
      );
      expect(
        cancelResult.list.data.lines, 'Cancel removes item from list'
      ).deep.equals([]);
    });

    it('Item creator can cancel an item', async () => {
      const [owner, adder] = await createUsers(provider, 2);

      const list = await createList(program, owner, 'list');
      const adderStartingBalance = await getAccountBalance(provider, adder.key.publicKey);

      const result = await addItem(program, {
        list,
        user: adder,
        bounty: anchor.web3.LAMPORTS_PER_SOL,
        name: 'An item',
      });
      const adderBalanceAfterAdd = await getAccountBalance(provider, adder.key.publicKey);

      expect(result.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      const cancelResult = await cancelItem(program, {
        list,
        item: result.item,
        itemCreator: adder,
        user: adder,
      });

      const adderBalanceAfterCancel = await getAccountBalance(provider, adder.key.publicKey);
      console.log(`start: ${adderStartingBalance} -> add: ${adderBalanceAfterAdd} -> cancel: ${adderBalanceAfterCancel}`);
      expectBalance(
        adderBalanceAfterCancel,
        adderBalanceAfterAdd + anchor.web3.LAMPORTS_PER_SOL,
        'Cancel returns bounty to adder'
      );
      expect(
        cancelResult.list.data.lines,
        'Cancel removes item from list'
      ).deep.equals([]);
    });

    it('Other users can not cancel an item', async () => {
      const [owner, adder, otherUser] = await createUsers(provider, 3);

      const list = await createList(program, owner, 'list');

      const adderStartingBalance = await getAccountBalance(provider, adder.key.publicKey);

      const result = await addItem(program, {
        list,
        user: adder,
        bounty: anchor.web3.LAMPORTS_PER_SOL,
        name: 'An item',
      });

      const adderBalanceAfterAdd = await getAccountBalance(provider, adder.key.publicKey);

      expect(result.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      try {
        const cancelResult = await cancelItem(program ,{
          list,
          item: result.item,
          itemCreator: adder,
          user: otherUser,
        });
        expect.fail(`Removing another user's item should fail`);
      } catch(e) {
        expect(e.toString(), 'Error message').equals('Only the list owner or item creator may cancel an item');
      }

      const adderBalanceAfterCancel = await getAccountBalance(provider, adder.key.publicKey);
      expect(
        adderBalanceAfterCancel, 'Failed cancel does not change adder balance'
      ).equals(adderBalanceAfterAdd);

      let listData = await program.account.todoList.fetch(list.publicKey);
      expect(
        listData.lines, 'Item is still in list after failed cancel'
      ).deep.equals([result.item.publicKey]);

      const itemBalance = await getAccountBalance(provider, result.item.publicKey);
      expect(
        itemBalance, 'Item balance is unchanged after failed cancel'
      ).equals(anchor.web3.LAMPORTS_PER_SOL);
    });

    it('item_creator key must match the key in the item account', async () => {
      const [owner, adder] = await createUsers(provider, 2);
      const list = await createList(program, owner, 'list');

      const result = await addItem(program, {
        list,
        user: adder,
        bounty: anchor.web3.LAMPORTS_PER_SOL,
        name: 'An item',
      });

      try {
        await cancelItem(program, {
          list,
          item: result.item,
          itemCreator: owner, // Wrong creator
          user: owner,
        });
        expect.fail(`Listing the wrong item creator should fail`);
      } catch(e) {
        expect(e.toString(), 'Error message').equals(
          'Specified item creator does not match the pubkey in the item'
        );
      }
    });

    it('Can not cancel an item that is not in the given list', async () => {
      const [owner, adder] = await createUsers(provider, 2);
      const [list1, list2] = await Promise.all([
        createList(program, owner, 'list1'),
        createList(program, owner, 'list2'),
      ]);

      const result = await addItem(program, {
        list: list1,
        user: adder,
        bounty: anchor.web3.LAMPORTS_PER_SOL,
        name: 'An item',
      });

      try {
        await cancelItem(program, {
          list: list2, // Wrong list
          item: result.item,
          itemCreator: adder,
          user: owner,
        });
        expect.fail(`Cancelling from the wrong list should fail`);
      } catch(e) {
        expect(e.toString(), 'Error message').equals(
          'Item does not belong to this todo list'
        );
      }
    });

  });

  describe('finish behaviour', () => {
    it('List owner then item creator', async () => {
      const [owner, adder] = await createUsers(provider, 2);
      console.log(await getAccountBalance(provider, adder.key.publicKey));
      console.log(await getAccountBalance(provider, owner.key.publicKey));

      const list = await createList(program, owner, 'list');
      const ownerInitial = await getAccountBalance(provider, owner.key.publicKey);

      const bounty = 5 * anchor.web3.LAMPORTS_PER_SOL;
      const { item } = await addItem(program, {
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      expect(
        await getAccountBalance(provider, item.publicKey),
        'initialized account has bounty'
      ).equals(bounty);

      const firstResult = await finishItem(program, {
        list,
        item,
        user: owner,
        listOwner: owner,
      });

      expect(
        firstResult.list.data.lines,
        'Item still in list after first finish'
      ).deep.equals([item.publicKey]);
      expect(
        firstResult.item.data.creatorFinished,
        'Creator finish is false after owner calls finish'
      ).equals(false);
      expect(
        firstResult.item.data.listOwnerFinished,
        'Owner finish flag gets set after owner calls finish'
      ).equals(true);
      expect(
        await getAccountBalance(provider, firstResult.item.publicKey),
        'Bounty remains on item after one finish call'
      ).equals(bounty);
      console.log(await getAccountBalance(provider, adder.key.publicKey));
      console.log(await getAccountBalance(provider, owner.key.publicKey));

      const finishResult = await finishItem(program, {
        list,
        item,
        user: adder,
        listOwner: owner,
        expectAccountClosed: true,
      });

      expect(
        finishResult.list.data.lines, 
        'Item removed from list after both finish'
      ).deep.equals([]);

      expect(
        await getAccountBalance(provider, finishResult.item.publicKey),
        'Bounty remains on item after one finish call'
      ).equals(0);

      console.log(await getAccountBalance(provider, adder.key.publicKey));
      console.log(await getAccountBalance(provider, owner.key.publicKey));
      expectBalance(
        await getAccountBalance(provider, owner.key.publicKey),
        ownerInitial + bounty,
        'Bounty transferred to owner'
      );
    });

    it('Item creator then list owner', async () => {
      const [owner, adder] = await createUsers(provider, 2);

      const list = await createList(program, owner, 'list');
      const ownerInitial = await getAccountBalance(provider, owner.key.publicKey);

      const bounty = 5 * anchor.web3.LAMPORTS_PER_SOL;
      const { item } = await addItem(program, {
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      expect(
        await getAccountBalance(provider, item.publicKey),
        'initialized account has bounty'
      ).equals(bounty);

      const firstResult = await finishItem(program, {
        list,
        item,
        user: adder,
        listOwner: owner,
      });

      expect(firstResult.list.data.lines, 'Item still in list after first finish').deep.equals([item.publicKey]);
      expect(firstResult.item.data.creatorFinished, 'Creator finish is true after creator calls finish').equals(true);
      expect(firstResult.item.data.listOwnerFinished, 'Owner finish flag is false after creator calls finish').equals(false);
      expect(await getAccountBalance(provider, firstResult.item.publicKey), 'Bounty remains on item after one finish call').equals(bounty);

      const finishResult = await finishItem(program, {
        list,
        item,
        user: owner,
        listOwner: owner,
        expectAccountClosed: true,
      });

      expect(finishResult.list.data.lines, 'Item removed from list after both finish').deep.equals([]);
      expect(await getAccountBalance(provider, finishResult.item.publicKey), 'Bounty remains on item after one finish call').equals(0);
      expectBalance(await getAccountBalance(provider, owner.key.publicKey), ownerInitial + bounty, 'Bounty transferred to owner');
    });

    it('Other users can not call finish', async () => {
      const [owner, adder, otherUser] = await createUsers(provider, 3);

      const list = await createList(program, owner, 'list');

      const bounty = 5 * anchor.web3.LAMPORTS_PER_SOL;
      const { item } = await addItem(program, {
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      try {
        await finishItem(program, {
          list,
          item,
          user: otherUser,
          listOwner: owner,
        });
        expect.fail('Finish by other user should have failed');
      } catch(e) {
        expect(e.toString(), 'error message').equals('Only the list owner or item creator may finish an item');
      }

      expect(await getAccountBalance(provider, item.publicKey), 'Item balance did not change').equal(bounty);
    });

    it('Can not call finish on an item that is not in the given list', async () => {
      const [owner, adder, otherUser] = await createUsers(provider, 3);

      const [list1, list2] = await Promise.all([
        createList(program, owner, 'list1'),
        createList(program, owner, 'list2'),
      ]);

      const bounty = 5 * anchor.web3.LAMPORTS_PER_SOL;
      const { item } = await addItem(program, {
        list: list1,
        user: adder,
        bounty,
        name: 'An item',
      });

      try {
        await finishItem(program, {
          list: list2,
          item,
          user: otherUser,
          listOwner: owner,
        });
        expect.fail('Finish by other user should have failed');
      } catch(e) {
        expect(e.toString(), 'error message').equals('Item does not belong to this todo list');
      }

      expect(await getAccountBalance(provider, item.publicKey), 'Item balance did not change').equal(bounty);
    });

    it('Can not call finish with the wrong list owner', async () => {
      const [owner, adder] = await createUsers(provider, 2);

      const list  = await createList(program, owner, 'list1');

      const bounty = 5 * anchor.web3.LAMPORTS_PER_SOL;
      const { item } = await addItem(program, {
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      try {
        await finishItem(program, {
          list,
          item,
          user: owner,
          listOwner: adder,
        });

        expect.fail('Finish by other user should have failed');
      } catch(e) {
        expect(e.toString(), 'error message').equals('A seeds constraint was violated');
      }

      expect(await getAccountBalance(provider, item.publicKey), 'Item balance did not change').equal(bounty);
    });

    it('Can not call finish on an already-finished item', async () => {
      const [owner, adder] = await createUsers(provider, 2);

      const list = await createList(program, owner, 'list');
      const ownerInitial = await getAccountBalance(provider, owner.key.publicKey);

      const bounty = 5 * anchor.web3.LAMPORTS_PER_SOL;
      const { item } = await addItem(program, {
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      expect(await getAccountBalance(provider, item.publicKey), 'initialized account has bounty').equals(bounty);

      await Promise.all([
        finishItem(program, {
          list,
          item,
          user: owner,
          listOwner: owner,
          expectAccountClosed: true,
        }),

        finishItem(program, {
          list,
          item,
          user: adder,
          listOwner: owner,
          expectAccountClosed: true,
        })
      ]);

      try {
        await finishItem(program, {
          list,
          item,
          user: owner,
          listOwner: owner,
          expectAccountClosed: true,
        });

        expect.fail('Finish on an already-closed item should fail');
      } catch(e) {
        expect(e.toString(), 'error message').equal('The program expected this account to be already initialized')
      }

      expectBalance(
        await getAccountBalance(provider, owner.key.publicKey),
        ownerInitial + bounty,
        'Bounty transferred to owner just once'
      );
    });

  });
});

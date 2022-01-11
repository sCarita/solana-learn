import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { IntroToAnchor } from '../target/types/intro_to_anchor';
import * as assert from 'assert';


describe('intro-to-anchor', () => {


	/*
		***************
		INITIALISE - Provider, Program and Keypair
		***************
	*/
  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
	anchor.setProvider(provider);

	const idl = JSON.parse(
    require("fs").readFileSync(
      "/Users/grayfox/_learnings/basics/solana/00-intro-to-anchor/target/idl/intro_to_anchor.json",
      "utf8"
    )
  );
  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey(
    "239rsPQYmP9hMc3WL1RhgsbbCV48zAYV6cPNpVTuaf3D"
  );
  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);

  var myAccount = anchor.web3.Keypair.generate();


	/*
		***************
		TEST 00 - Creates and initializes an account in a single atomic transaction
		(simplified).
		***************
	*/
	it("Creates and initializes an account in a single atomic transaction (simplified)", async () => {
	  const tx = await program.rpc.initialize(new anchor.BN(1234), {
	    accounts: {
	      myAccount: myAccount.publicKey,
	      user: provider.wallet.publicKey,
	      systemProgram: anchor.web3.SystemProgram.programId,
	    },
	    signers: [myAccount],
		});
	  console.log("Your transaction signature [program.rpc.initialize]", tx);

	  // Fetch the newly created account from the cluster.
    const account = await program.account.myAccount.fetch(myAccount.publicKey);

    // Check it's state was initialized.
    assert.ok(account.data.eq(new anchor.BN(1234)));
	});


	/*
		***************
		TEST 01 - Updates a previously created account.
		***************
	*/
	it("Updates a previously created account", async () => {
    // Invoke the update rpc.
    await program.rpc.update(new anchor.BN(4321), {
      accounts: {
        myAccount: myAccount.publicKey,
      },
    });

    // Fetch the newly updated account.
    const account = await program.account.myAccount.fetch(myAccount.publicKey);

    // Check it's state was mutated.
    assert.ok(account.data.eq(new anchor.BN(4321)));
    // #endregion update-test
  });
});

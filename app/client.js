// client.js is used to introduce the reader to generating clients from IDLs.
// It is not expected users directly test with this example. For a more
// ergonomic example, see `tests/basic-0.js` in this workspace.

const anchor = require("@project-serum/anchor");
const assert = require('assert');
const { SystemProgram } = anchor.web3;

// Configure the local cluster.
const provider = anchor.Provider.env();
anchor.setProvider(provider);

async function main() {
  // #region main
  // Read the generated IDL.
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
  const myAccount = anchor.web3.Keypair.generate();

  // Execute the RPC.
  await program.rpc.initialize(new anchor.BN(1234), {
    accounts: {
      myAccount: myAccount.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    },
    signers: [myAccount],
  });
  let account = await program.account.myAccount.fetch(myAccount.publicKey);

  // Check it's state was initialized.
  assert.ok(account.data.eq(new anchor.BN(1234)));
  console.log(account.data, new anchor.BN(1234));

  await program.rpc.update(new anchor.BN(4321), {
    accounts: {
      myAccount: myAccount.publicKey,
    },
  });
  account = await program.account.myAccount.fetch(myAccount.publicKey);
  assert.ok(account.data.eq(new anchor.BN(4321)));
  console.log(account.data, new anchor.BN(4321));
  // #endregion main
}

console.log("Running client.");
main().then(() => console.log("Success"));
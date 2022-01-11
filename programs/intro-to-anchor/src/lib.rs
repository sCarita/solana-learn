use anchor_lang::prelude::*;

declare_id!("239rsPQYmP9hMc3WL1RhgsbbCV48zAYV6cPNpVTuaf3D");

/*
	#[program] - notice that a program is defined with the #[program]
	attribute, where each inner method defines an RPC request handler, or, 
	in Solana parlance, an "instruction" handler. These handlers are the
	entrypoints to your program that clients may invoke, as we will see soon.
*/
#[program]
pub mod intro_to_anchor {
	use super::*;
	/*
		Context<Initialize> - The first parameter of every RPC handler is the
		Context struct, which is a simple container for the currently executing
		program_id generic over Accounts, the Initialize struct.

		Notice the data argument passed into the program. This argument and any
		other valid Rust types can be passed to the instruction to define inputs
		to the program.

		Additionally, notice how we take a mutable reference to my_account and
		assign the data to it. This leads us to the Initialize struct, deriving
		Accounts. There are two things to notice about Initialize.

		1. The my_account field is of type Account<'info, MyAccount> and the
			deserialized data structure is MyAccount.
		2. The my_account field is marked with the init attribute. This will
			create a new account owned by the current program, zero initialized.
			When using init, one must also provide payer, which will fund the
			account creation, space, which defines how large the account should be,
			and the system_program, which is required by the runtime for creating
			the account.
	*/
	pub fn initialize(_ctx: Context<Initialize>, data: u64) -> ProgramResult {
		let my_account = &mut _ctx.accounts.my_account;
		my_account.data = data;

		Ok(())
	}

	/*
		Similarly, the Update accounts struct is marked with the #[account(mut)]
		attribute. Marking an account as mut persists any changes made upon
		exiting the program.

		Here we've covered the basics of how to interact with accounts. In a
		later tutorial, we'll delve more deeply into deriving Accounts, but for
		now, just know you must mark an account init when using it for the first
		time and mut for persisting changes.
	*/
    pub fn update(_ctx: Context<Update>, data: u64) -> ProgramResult {
		let my_account = &mut _ctx.accounts.my_account;
		my_account.data = data;

		Ok(())
    }
}

/*
	#[derive(Accounts)] - The Accounts derive macro marks a struct containing all
	the accounts that must be specified for a given instruction. To understand
	Accounts on Solana, see the docs:
		- https://docs.solana.com/developing/programming-model/accounts


*/
#[derive(Accounts)]
pub struct Initialize<'info> {
	#[account(init, payer = user, space = 8 + 8)]
	pub my_account: Account<'info, MyAccount>,
	#[account(mut)]
	pub user: Signer<'info>,
	pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
	#[account(mut)]
	pub my_account: Account<'info, MyAccount>,
}

#[account]
pub struct MyAccount {
	pub data: u64,
}
const fs = require("fs");

module.exports = function (idl) {
  const template = `
use borsh::{BorshDeserialize, BorshSerialize};
use solana_client::rpc_client::RpcClient;
use solana_program::{
  instruction::AccountMeta, instruction::Instruction, message::Message, pubkey::Pubkey,
  system_program::ID,
};
use solana_sdk::{
  commitment_config::CommitmentConfig, signature::{Keypair, Signature}, signer::Signer,
  transaction::Transaction,
};
use std::{env, fs};

const COMMITMENT: CommitmentConfig = CommitmentConfig::finalized();

const URL: &str = "https://api.devnet.solana.com";

const PROGRAM_ID: Pubkey = Pubkey::from(parse_pubkey(
    "ENTER PROGRAM PUBKEY HERE".as_bytes(),
));

pub fn keypair(file: &str) -> Keypair {
  Keypair::from_bytes(string_u8(file).as_slice()).unwrap()
}

pub fn parse_pubkey(slice: &[u8]) -> [u8; 32] {
    slice.try_into().expect("slice with incorrect length")
}

pub fn string_u8(path: &str) -> Vec<u8> {
    let file = fs::read_to_string(path).expect("Should have been able to read the file");

    let trim = file
        .replace("[", "")
        .replace("]", "")
        .replace(" ", "")
        .replace("\\n", "");

    let split: Vec<&str> = trim.split(",").collect();

    let mut result: Vec<u8> = Vec::new();

    for x in split {
        if x.len() > 0 {
            result.push(x.to_owned().parse::<u8>().unwrap())
        }
    }

    // println!("result : {:#?}", result);

    result
}
`;

  const send = `
pub fn submit_transaction(
  rpc_client: &RpcClient,
  wallet_signer: &dyn Signer,
  instruction: Instruction,
  commitment_config: CommitmentConfig,
) -> Result<Signature, Box<dyn std::error::Error>> {
  let mut transaction =
      Transaction::new_unsigned(Message::new(&[instruction], Some(&wallet_signer.pubkey())));
  let (recent_blockhash, _fee_calculator) = rpc_client
      .get_recent_blockhash()
      .map_err(|err| format!("error: unable to get recent blockhash: {}", err))?;
  transaction
      .try_sign(&vec![wallet_signer], recent_blockhash)
      .map_err(|err| format!("error: failed to sign transaction: {}", err))?;
  let signature = rpc_client
      .send_and_confirm_transaction_with_spinner_and_commitment(&transaction, commitment_config)
      .map_err(|err| format!("error: send transaction: {}", err))?;
  Ok(signature)
}
`;

  let x = 2;

  const count = () => {
    return (x = x + 1);
  };

  const reset = () => {
    x = 2;
  };

  const main = `
fn main() {
  let args: Vec<String> = env::args().collect();

  let rpc_client = RpcClient::new(URL);

  let wallet_signer = keypair(args[2].as_str());

  match args[1].as_str() {
    ${idl["instructions"]
      .map((instruction) => {
        x = 2;
        return `"${instruction.name
          .split(/(?=[A-Z])/)
          .join("_")
          .toLowerCase()}" => {
            ${instruction.accounts
              .map((account, index) => {
                if (
                  !account["pda"] &&
                  account.name !== "systemProgram" &&
                  !account.isSigner
                ) {
                  return `let ${account.name
                    .split(/(?=[A-Z])/)
                    .join("_")
                    .toLowerCase()} = args[${count()}].as_str();`;
                } else if (account.pda && account.pda.seeds) {
                  return `${account.pda.seeds
                    .map((seed, seedIndex) => {
                      if (
                        seed.path &&
                        seed.path.includes(".") &&
                        seed.type == "publicKey"
                      ) {
                        return `let ${seed.path
                          .split(".")[1]
                          .split(/(?=[A-Z])/)
                          .join("_")
                          .toLowerCase()}: Pubkey = Pubkey::from(parse_pubkey(args[${count()}].as_str().as_bytes()));`;
                      } else if (seed.path && seed.path.includes(".")) {
                        if (
                          seed.type == "u8" ||
                          "u16" ||
                          "u32" ||
                          "u64" ||
                          "u128" ||
                          "usize" ||
                          "i8" ||
                          "i16" ||
                          "i32" ||
                          "i64" ||
                          "i128" ||
                          "isize"
                        ) {
                          return `let ${seed.path
                            .split(".")[1]
                            .split(/(?=[A-Z])/)
                            .join("_")
                            .toLowerCase()}: ${
                            seed.type
                          } = args[${count()}].as_str().parse::<${
                            seed.type
                          }>().unwrap();`;
                        }
                      }
                    })
                    .join("")}`;
                }
              })
              .join("")}

              ${instruction.args
                .map((arg) => {
                  if (arg.type == "string") {
                    return `let ${arg.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()} =  args[${count()}].as_str().to_string();`;
                  } else if (arg.type == "bytes") {
                    return `let ${arg.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()} =  string_u8(args[${count()}].as_str());`;
                  } else if (
                    arg.type == "u8" ||
                    "u16" ||
                    "u32" ||
                    "u64" ||
                    "u128" ||
                    "usize" ||
                    "i8" ||
                    "i16" ||
                    "i32" ||
                    "i64" ||
                    "i128" ||
                    "isize"
                  ) {
                    return `let ${arg.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()} =  args[${count()}].as_str().parse::<${
                      arg.type
                    }>().unwrap();`;
                  } else {
                    return `let ${arg.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()} =  args[${count()}].as_str();`;
                  }
                })
                .join("")}
            let sig = ${instruction.name
              .split(/(?=[A-Z])/)
              .join("_")
              .toLowerCase()}(
                ${instruction.accounts
                  .map((account) => {
                    if (account.isSigner) return;
                    if (account["pda"] && !account.pda.seeds) return;
                    if (account.name == "systemProgram") return;
                    if (
                      !account["pda"] &&
                      account.name !== "systemProgram" &&
                      !account.isSigner
                    ) {
                      return `${account.name
                        .split(/(?=[A-Z])/)
                        .join("_")
                        .toLowerCase()},`;
                    }
                  })
                  .join("")}
                ${instruction.args
                  .map((arg) => {
                    return `${arg.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()},`;
                  })
                  .join("")}
                  ${instruction.accounts
                    .map((account) => {
                      if (account.isSigner) return;
                      if (account["pda"] && !account.pda.seeds) return;
                      if (account.name == "systemProgram") return;
                      if (
                        !account["pda"] &&
                        account.name !== "systemProgram" &&
                        !account.isSigner
                      ) {
                        return;
                      }
                      if (account.pda && account.pda.seeds) {
                        return `${account.pda.seeds
                          .map((seed) => {
                            if (seed.path && seed.path.includes(".")) {
                              return `${seed.path.split(".")[1]},`;
                            }
                          })
                          .join("")}`;
                      }
                    })
                    .join("")}
          COMMITMENT, &wallet_signer, &rpc_client).unwrap();
          },`;
      })
      .join("")}
      _ => println!("something went wrong !"),      
  }
}
`;

  const cargo = `
[package]
name = "${idl["name"]}-client"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-sdk = "1.16.15"
solana-client = "1.16.15"
solana-program = "1.16.15"
borsh = ">=0.9, <0.11"
serde = { version = "1.0.125", features = ["derive"] }
bs58 = "0.5.0"
rand = "0.7.3"
`;
  try {
    fs.mkdirSync(`${idl["name"]}-client`);
    fs.mkdirSync(`${idl["name"]}-client/src`);
    fs.writeFileSync(
      `${idl["name"]}-client/src/main.rs`,
      template + instructions + send + main
    );
    fs.writeFileSync(`${idl["name"]}-client/Cargo.toml`, cargo);
  } catch (error) {
    console.log(error);
  }
};

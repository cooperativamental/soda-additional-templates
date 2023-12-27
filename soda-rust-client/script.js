const idl = require("./idl.json");
const fs = require("fs");

// "${idl["metadata"]["address"]}".as_bytes(),

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

const instructions = `
${idl["instructions"]
  .map((instruction) => {
    return `pub fn ${instruction.name
      .split(/(?=[A-Z])/)
      .join("_")
      .toLowerCase()}(
        ${instruction.accounts
          .map((account) => {
            if (account.isSigner) {
              return;
            } else if (account.name == "systemProgram") {
              return;
            } else if (!account["pda"]) {
              return `${account.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase()}: &str,`;
            }
          })
          .join("")}
        ${instruction.args
          .map((arg) => {
            if (arg.type !== "string") {
              return `${arg.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase()}: ${
                arg.type == "bytes" ? "Vec<u8>" : arg.type
              },`;
            } else {
              return `${arg.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase()}: String,`;
            }
          })
          .join("")}
          ${instruction.accounts
            .map((account) => {
              if (account.pda && account.pda.seeds) {
                return `${account.pda.seeds
                  .map((seed) => {
                    return `${
                      seed.path && seed.path.includes(".")
                        ? `${seed.path.split(".")[1]}: ${
                            seed.type == "publicKey" ? "Pubkey" : seed.type
                          },`
                        : ""
                    }`;
                  })
                  .join("")}`;
              }
            })
            .join("")}
        commitment_config: CommitmentConfig,
        wallet_signer: &dyn Signer,
        rpc_client: &RpcClient,
    ) -> Result<Signature, Box<dyn std::error::Error>> {

        #[derive(BorshDeserialize, BorshSerialize, Debug)]
        pub struct ${
          instruction.name.charAt(0).toUpperCase() + instruction.name.slice(1)
        } {
            ${instruction.args
              .map((arg) => {
                if (arg.type == "string") {
                  return `pub ${arg.name
                    .split(/(?=[A-Z])/)
                    .join("_")
                    .toLowerCase()}: String,`;
                }
                return `pub ${arg.name
                  .split(/(?=[A-Z])/)
                  .join("_")
                  .toLowerCase()}: ${
                  arg.type == "bytes" ? "Vec<u8>" : arg.type
                },`;
              })
              .join("")}
        }
        ${instruction.accounts
          .map((account) => {
            if (account.name == "systemProgram") {
              return;
            }
            if (account.isSigner) {
              return;
            } else if (!account["pda"]) {
              return `let ${account.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase()} = parse_pubkey(${account.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase()}.as_bytes());\n`;
            }
            return `let (${account.name
              .split(/(?=[A-Z])/)
              .join("_")
              .toLowerCase()}, ${account.name
              .split(/(?=[A-Z])/)
              .join("_")
              .toLowerCase()}_bump) =
                Pubkey::find_program_address(&[
                    ${account.pda.seeds
                      .map((seed) => {
                        if (seed.path == instruction.accounts[0].name) {
                          return `wallet_signer.pubkey().as_ref()`;
                        } else if (
                          seed.kind == "const" &&
                          seed.type == "string"
                        ) {
                          return `b"${seed.value}",\n`;
                        } else if (
                          seed.kind == "account" &&
                          seed.type == "publicKey" &&
                          seed.path
                        ) {
                          return `${
                            seed.path.includes(".")
                              ? seed.path.split(".")[1]
                              : seed.path
                                  .split(/(?=[A-Z])/)
                                  .join("_")
                                  .toLowerCase()
                          }.as_ref(),\n`;
                        } else if (
                          (seed.kind == "arg" && seed.type == "u8") ||
                          "u16" ||
                          "u32" ||
                          "u64" ||
                          ("u128" && seed.path)
                        ) {
                          return `${
                            seed.path.includes(".")
                              ? seed.path.split(".")[1]
                              : seed.path
                                  .split(/(?=[A-Z])/)
                                  .join("_")
                                  .toLowerCase()
                          }.to_le_bytes().as_ref(),\n`;
                        }
                      })
                      .join("")}
                ], &PROGRAM_ID);\n`;
          })
          .join("")}

      let data = ${
        instruction.name.charAt(0).toUpperCase() + instruction.name.slice(1)
      } {
        ${instruction.args
          .map((arg) => {
            return `${arg.name},`;
          })
          .join("")}
      };
    
      let instruction = Instruction::new_with_borsh(
          PROGRAM_ID,
          &${instruction.args.length !== 0 ? "data" : `{}`},
          vec![
              ${instruction.accounts
                .map((account) => {
                  if (account.isSigner) {
                    return;
                  } else if (account.name == "systemProgram") {
                    return `AccountMeta::new_readonly(Pubkey::from(ID), false)`;
                  } else if (account.isMut == true && !account["pda"]) {
                    return `AccountMeta::new(Pubkey::from(${account.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()}), false),\n`;
                  } else if (account.isMut == false && !account["pda"]) {
                    return `AccountMeta::new_readonly(Pubkey::from(${account.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()}), false),\n`;
                  } else if (account.isMut == false && account["pda"]) {
                    return `AccountMeta::new_readonly(${account.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()}, false),\n`;
                  } else if (account.isMut == true && account["pda"]) {
                    return `AccountMeta::new(${account.name
                      .split(/(?=[A-Z])/)
                      .join("_")
                      .toLowerCase()}, false),\n`;
                  }
                })
                .join("")}
          ],
      );
      submit_transaction(rpc_client, wallet_signer, instruction, commitment_config)
    }\n\n
  `;
  })
  .join("")}
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

const write = () => {
  fs.mkdirSync(`${idl["name"]}-client`);
  fs.mkdirSync(`${idl["name"]}-client/src`);
  fs.writeFileSync(
    `${idl["name"]}-client/src/main.rs`,
    template + instructions + send + main
  );
  fs.writeFileSync(`${idl["name"]}-client/Cargo.toml`, cargo);
};

write();

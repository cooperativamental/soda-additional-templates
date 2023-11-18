import fs from "fs";
import { markdownTable } from "markdown-table";

// "${idl["metadata"]["address"]}".as_bytes(),

const idl = fs.readFileSync("./idl.json", "utf-8");

console.log(idl);

const cwd = JSON.parse(idl);

const kebabize = (str) => {
  return str
    .split("")
    .map((letter, idx) => {
      return letter.toUpperCase() === letter
        ? `${idx !== 0 ? "-" : ""}${letter.toLowerCase()}`
        : letter;
    })
    .join("");
};

const writer = `
${cwd["instructions"]
  .map((instruction) => {
    console.log(instruction["accounts"]);
    const accounts = [["name", "mut", "sig", "description"]];
    const args = [["name", "type", "description"]];
    if (instruction["args"].length > 0) {
      instruction["args"]
        .map((arg) => {
          args.push([arg.name, arg.type, ""]);
        })
        .join("");
    }
    instruction["accounts"]
      .map((account) => {
        let mut = "❌";
        let sig = "❌";
        if (account["isMut"] == true) {
          mut = "✔️";
        }
        if (account["isSigner"] == true) {
          sig = "✔️";
        }
        accounts.push([account["name"], mut, sig, ""]);
      })
      .join("");
    return `## ${kebabize(instruction.name).replaceAll("-", " ")}\n
    ### accounts array\n
    ${markdownTable(accounts)}\n
    ${
      instruction["args"].length > 1
        ? `### instruction arguments\n
    ${markdownTable(args)}\n`
        : ""
    }
    `;
  })
  .join("")}
`
  .replaceAll(/(    \| name)/g, "| name")
  .replaceAll(/(    ## )/g, "## ")
  .replaceAll(/(    ### )/g, "### ");

const write = () => {
  fs.mkdirSync(`./docs`);
  fs.mkdirSync(`./docs/${cwd["name"]}-md`);
  fs.writeFileSync(`./docs/${cwd.name}-md/instructions.md`, writer);
  console.log(writer);
};

write();

import { webcrypto } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(workerDir, "answer-bank.source.local.json");
const keyBytes = Buffer.from((await readFile(path.join(workerDir, ".answer-key.local"), "utf8")).trim(), "base64url");
try {
  const answers = JSON.parse(await readFile(sourcePath, "utf8"));
  if (keyBytes.length !== 32 || !answers || typeof answers !== "object" || Array.isArray(answers) || !Object.keys(answers).length || Object.values(answers).some((answer) => !Number.isInteger(answer.correct) || answer.correct < 0 || answer.correct > 2)) throw new Error("Invalid private answer source or key.");
  const nonce = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await webcrypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode("drive-answer-bank-v1"), tagLength: 128 }, key, new TextEncoder().encode(JSON.stringify(answers))));
  const envelope = { version: 1, algorithm: "AES-256-GCM", nonce: Buffer.from(nonce).toString("base64url"), ciphertext: Buffer.from(ciphertext).toString("base64url") };
  await writeFile(path.join(workerDir, "public", "answer-bank.enc.json"), `${JSON.stringify(envelope)}\n`);
  console.log(`Encrypted ${Object.keys(answers).length} answer indexes. The answer key remains outside Git.`);
} finally {
  keyBytes.fill(0);
}

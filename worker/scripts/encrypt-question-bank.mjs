import { webcrypto } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(workerDir, "question-bank.source.local.json");
const keyBytes = Buffer.from((await readFile(path.join(workerDir, ".question-key.local"), "utf8")).trim(), "base64url");
try {
  const questions = JSON.parse(await readFile(sourcePath, "utf8"));
  if (keyBytes.length !== 32 || !Array.isArray(questions) || !questions.length || questions.some((q) => !q || !/^q-[0-9]{2}$/u.test(q.id) || typeof q.question !== "string" || !Array.isArray(q.options) || q.options.length !== 3 || q.options.some((option) => typeof option !== "string"))) throw new Error("Invalid question source or key.");
  const nonce = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await webcrypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode("drive-questions-v1"), tagLength: 128 }, key, new TextEncoder().encode(JSON.stringify(questions))));
  const envelope = { version: 1, algorithm: "AES-256-GCM", nonce: Buffer.from(nonce).toString("base64url"), ciphertext: Buffer.from(ciphertext).toString("base64url") };
  await writeFile(path.join(workerDir, "public", "quiz-questions.enc.json"), `${JSON.stringify(envelope)}\n`);
  console.log(`Encrypted ${questions.length} question records. The decryption key stays outside Git.`);
} finally {
  keyBytes.fill(0);
}

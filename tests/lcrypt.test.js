import test from "node:test";
import assert from "node:assert/strict";
import { decrypt, encrypt } from "../lcrypt.js";

const sample = "Árvíztűrő tükörfúrógép 🚗💜";
const passphrase = "correct horse battery staple — testing only";

test("round-trips Hungarian accents, Unicode and emoji", async () => {
  const payload = await encrypt(sample, passphrase);
  const envelope = JSON.parse(payload);
  assert.equal(envelope.version, 2);
  assert.equal(envelope.algorithm, "AES-256-GCM");
  assert.equal(envelope.keyWrapping, "AES-256-KW");
  assert.equal(envelope.kdf, "Argon2id");
  assert.equal(envelope.kdfParams.memory, 65536);
  assert.equal(await decrypt(payload, passphrase), sample);
});

test("rejects a wrong passphrase with a generic error", async () => {
  const payload = await encrypt(sample, passphrase);
  await assert.rejects(decrypt(payload, "wrong password"), { message: "Unable to decrypt message. Check the passphrase or encrypted data." });
});

test("rejects ciphertext tampering with a generic error", async () => {
  const envelope = JSON.parse(await encrypt(sample, passphrase));
  const bytes = Uint8Array.from(atob(envelope.ciphertext.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - envelope.ciphertext.length % 4) % 4)), (c) => c.charCodeAt(0));
  bytes[0] ^= 1;
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  envelope.ciphertext = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  await assert.rejects(decrypt(envelope, passphrase), { message: "Unable to decrypt message. Check the passphrase or encrypted data." });
});

test("each encryption uses fresh random salt, nonce and wrapped DEK", async () => {
  const first = JSON.parse(await encrypt(sample, passphrase));
  const second = JSON.parse(await encrypt(sample, passphrase));
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.wrappedKey, second.wrappedKey);
});

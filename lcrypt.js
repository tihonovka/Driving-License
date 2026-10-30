import { argon2id } from "./vendor/hash-wasm.esm.min.js";

const PARAMS = Object.freeze({ memory: 65536, iterations: 3, parallelism: 1 });
const ERROR_TEXT = "Unable to decrypt message. Check the passphrase or encrypted data.";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function webCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error("Web Crypto is required.");
  return globalThis.crypto;
}
function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function fromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) throw new Error("Invalid envelope");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function randomBytes(length) {
  const output = new Uint8Array(length);
  webCrypto().getRandomValues(output);
  return output;
}
async function deriveKek(passphrase, salt) {
  const result = await argon2id({ password: passphrase, salt, parallelism: PARAMS.parallelism, iterations: PARAMS.iterations, memorySize: PARAMS.memory, hashLength: 32, outputType: "binary" });
  return new Uint8Array(result);
}
function aadFor(envelope) {
  return encoder.encode(JSON.stringify(["LCrypt", envelope.version, envelope.algorithm, envelope.keyWrapping, envelope.kdf, envelope.kdfParams, envelope.salt, envelope.nonce, envelope.wrappedKey]));
}
function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object" || envelope.version !== 2 || envelope.algorithm !== "AES-256-GCM" || envelope.keyWrapping !== "AES-256-KW" || envelope.kdf !== "Argon2id") throw new Error("Invalid envelope");
  const p = envelope.kdfParams;
  if (!p || p.memory !== PARAMS.memory || p.iterations !== PARAMS.iterations || p.parallelism !== PARAMS.parallelism) throw new Error("Invalid envelope");
  const salt = fromBase64Url(envelope.salt); const nonce = fromBase64Url(envelope.nonce); const wrappedKey = fromBase64Url(envelope.wrappedKey); const ciphertext = fromBase64Url(envelope.ciphertext);
  if (salt.length !== 16 || nonce.length !== 12 || wrappedKey.length !== 40 || ciphertext.length < 16) throw new Error("Invalid envelope");
  return { salt, nonce, wrappedKey, ciphertext };
}

/** Encrypt a Unicode message into a portable LCrypt 2.0 JSON envelope. */
export async function encrypt(message, passphrase) {
  if (typeof message !== "string" || typeof passphrase !== "string" || !passphrase.length) throw new TypeError("Message and passphrase are required.");
  const crypto = webCrypto();
  const salt = randomBytes(16); const nonce = randomBytes(12); const dekBytes = randomBytes(32);
  let kekBytes;
  try {
    kekBytes = await deriveKek(passphrase, salt);
    const dek = await crypto.subtle.importKey("raw", dekBytes, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    const kek = await crypto.subtle.importKey("raw", kekBytes, { name: "AES-KW" }, false, ["wrapKey", "unwrapKey"]);
    const envelope = { version: 2, algorithm: "AES-256-GCM", keyWrapping: "AES-256-KW", kdf: "Argon2id", kdfParams: { ...PARAMS }, salt: toBase64Url(salt), nonce: toBase64Url(nonce), wrappedKey: "", ciphertext: "" };
    envelope.wrappedKey = toBase64Url(new Uint8Array(await crypto.subtle.wrapKey("raw", dek, kek, "AES-KW")));
    envelope.ciphertext = toBase64Url(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aadFor(envelope), tagLength: 128 }, dek, encoder.encode(message))));
    return JSON.stringify(envelope);
  } finally {
    dekBytes.fill(0); kekBytes?.fill(0);
  }
}

/** Decrypt an LCrypt 2.0 envelope; failures share one generic error message. */
export async function decrypt(payload, passphrase) {
  let kekBytes;
  try {
    if (typeof passphrase !== "string" || !passphrase.length) throw new Error("Invalid envelope");
    const envelope = typeof payload === "string" ? JSON.parse(payload) : payload;
    const { salt, nonce, wrappedKey, ciphertext } = validateEnvelope(envelope);
    const crypto = webCrypto();
    kekBytes = await deriveKek(passphrase, salt);
    const kek = await crypto.subtle.importKey("raw", kekBytes, { name: "AES-KW" }, false, ["unwrapKey"]);
    const dek = await crypto.subtle.unwrapKey("raw", wrappedKey, kek, "AES-KW", { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aadFor(envelope), tagLength: 128 }, dek, ciphertext);
    return decoder.decode(plaintext);
  } catch {
    throw new Error(ERROR_TEXT);
  } finally {
    kekBytes?.fill(0);
  }
}

export { ERROR_TEXT };

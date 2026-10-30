import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, webcrypto } from "node:crypto";
import { checkAnswer } from "../worker/src/index.js";

const origin = "https://tihonovka.github.io";
async function fixture(answerMap = { "q-01": { correct: 0 } }) {
  const keyBytes = randomBytes(32);
  const key = await webcrypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const nonce = randomBytes(12);
  const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode("drive-answer-bank-v1"), tagLength: 128 }, key, new TextEncoder().encode(JSON.stringify(answerMap))));
  const b64url = (value) => Buffer.from(value).toString("base64url");
  const envelope = JSON.stringify({ version: 1, algorithm: "AES-256-GCM", nonce: b64url(nonce), ciphertext: b64url(ciphertext) });
  const env = { ALLOWED_ORIGIN: origin, ANSWER_KEY: b64url(keyBytes), ASSETS: { fetch: async () => new Response(envelope) } };
  keyBytes.fill(0);
  return env;
}
function request(body, requestOrigin = origin) {
  return new Request("https://checker.example.workers.dev/api/check", { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("checks an answer server-side and returns only a boolean", async () => {
  const response = await checkAnswer(request({ questionId: "q-01", selectedIndex: 0 }), await fixture());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { correct: true });
});

test("does not return the correct index for a wrong choice", async () => {
  const response = await checkAnswer(request({ questionId: "q-01", selectedIndex: 1 }), await fixture());
  assert.deepEqual(await response.json(), { correct: false });
});

test("rejects requests from unapproved origins", async () => {
  const response = await checkAnswer(request({ questionId: "q-01", selectedIndex: 0 }, "https://evil.example"), await fixture());
  assert.equal(response.status, 403);
});

test("rejects malformed answers before checking", async () => {
  const response = await checkAnswer(request({ questionId: "q-01", selectedIndex: 7 }), await fixture());
  assert.equal(response.status, 400);
});

test("returns a generic failure when the encrypted bank is tampered with", async () => {
  const env = await fixture();
  env.ASSETS.fetch = async () => new Response(JSON.stringify({
    version: 1,
    algorithm: "AES-256-GCM",
    nonce: "AAAAAAAAAAAAAAAA",
    ciphertext: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  }));
  const response = await checkAnswer(request({ questionId: "q-01", selectedIndex: 0 }), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Unable to check this answer." });
});

const textEncoder = new TextEncoder();
const GENERIC_ERROR = { error: "Unable to check this answer." };

function json(body, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid");
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function loadAnswers(env, requestUrl) {
  const keyBytes = decodeBase64Url(env.ANSWER_KEY);
  if (keyBytes.length !== 32) throw new Error("invalid key");
  try {
    const assetUrl = new URL("/answer-bank.enc.json", requestUrl);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl));
    if (!assetResponse.ok) throw new Error("answer bank unavailable");
    const envelope = await assetResponse.json();
    if (envelope.version !== 1 || envelope.algorithm !== "AES-256-GCM") throw new Error("unsupported bank");
    const nonce = decodeBase64Url(envelope.nonce);
    const ciphertext = decodeBase64Url(envelope.ciphertext);
    if (nonce.length !== 12 || ciphertext.length < 16) throw new Error("invalid bank");
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: textEncoder.encode("drive-answer-bank-v1"), tagLength: 128 }, key, ciphertext);
    const answers = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Error("invalid bank data");
    return answers;
  } finally {
    keyBytes.fill(0);
  }
}

async function loadQuestions(env, requestUrl) {
  const keyBytes = decodeBase64Url(env.QUESTION_KEY);
  if (keyBytes.length !== 32) throw new Error("invalid key");
  try {
    const assetUrl = new URL("/quiz-questions.enc.json", requestUrl);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl));
    if (!assetResponse.ok) throw new Error("question bank unavailable");
    const envelope = await assetResponse.json();
    if (envelope.version !== 1 || envelope.algorithm !== "AES-256-GCM") throw new Error("unsupported bank");
    const nonce = decodeBase64Url(envelope.nonce);
    const ciphertext = decodeBase64Url(envelope.ciphertext);
    if (nonce.length !== 12 || ciphertext.length < 16) throw new Error("invalid bank");
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: textEncoder.encode("drive-questions-v1"), tagLength: 128 }, key, ciphertext);
    const questions = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
    if (!Array.isArray(questions) || !questions.length || questions.some((q) => !q || !/^q-[0-9]{2}$/u.test(q.id) || typeof q.question !== "string" || !Array.isArray(q.options) || q.options.length !== 3 || q.options.some((option) => typeof option !== "string"))) throw new Error("invalid question data");
    return questions;
  } finally {
    keyBytes.fill(0);
  }
}

async function getQuestions(request, env) {
  let origin = null;
  try { origin = new URL(env.ALLOWED_ORIGIN).origin; } catch { return json(GENERIC_ERROR, 500, null); }
  if (request.headers.get("Origin") !== origin) return json({ error: "Not allowed." }, 403, null);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" } });
  }
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, origin);
  try {
    const questions = await loadQuestions(env, request.url);
    return json({ questions }, 200, origin);
  } catch {
    return json(GENERIC_ERROR, 503, origin);
  }
}

export async function checkAnswer(request, env) {
  let origin = null;
  try { origin = new URL(env.ALLOWED_ORIGIN).origin; } catch { return json(GENERIC_ERROR, 500, null); }
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin !== origin) return json({ error: "Not allowed." }, 403, null);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" } });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 1024) return json({ error: "Request too large." }, 413, origin);
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1024) return json({ error: "Request too large." }, 413, origin);
    const body = JSON.parse(rawBody);
    if (!body || typeof body.questionId !== "string" || !/^q-[0-9]{2}$/u.test(body.questionId) || !Number.isInteger(body.selectedIndex) || body.selectedIndex < 0 || body.selectedIndex > 2) return json({ error: "Invalid answer." }, 400, origin);
    const answers = await loadAnswers(env, request.url);
    const answer = answers[body.questionId];
    if (!answer || !Number.isInteger(answer.correct) || answer.correct < 0 || answer.correct > 2) return json({ error: "Question not found." }, 404, origin);
    return json({ correct: body.selectedIndex === answer.correct }, 200, origin);
  } catch {
    return json(GENERIC_ERROR, 503, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/check") return checkAnswer(request, env);
    if (url.pathname === "/api/questions") return getQuestions(request, env);
    if (url.pathname === "/api/health") return json({ status: "ok" }, 200, request.headers.get("Origin"));
    return env.ASSETS.fetch(request);
  }
};

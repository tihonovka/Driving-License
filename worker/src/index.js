const textEncoder = new TextEncoder();
const GENERIC_ERROR = { error: "Unable to check this answer." };
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_MS = 7 * DAY_MS;
const PASSWORD_ITERATIONS = 100_000;

function json(body, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function resolveOrigin(request, env) {
  try {
    const allowed = env.ALLOWED_ORIGIN.split(",").map((value) => new URL(value.trim()).origin);
    const requestOrigin = request.headers.get("Origin") || new URL(request.url).origin;
    return allowed.includes(requestOrigin) ? requestOrigin : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid");
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function randomToken() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function encodeHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token) {
  return encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(token))));
}

async function derivePassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256);
  return new Uint8Array(bits);
}

function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function requireUser(request, env) {
  const token = bearerToken(request);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) return null;
  const tokenHash = await hashToken(token);
  const session = await env.AUTH_DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, Date.now()).first();
  return session ? { id: session.user_id, tokenHash } : null;
}

function authPreflight(origin) {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  } });
}

async function createSession(userId, env, origin) {
  const token = randomToken();
  const now = Date.now();
  await env.AUTH_DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await hashToken(token), userId, now + SESSION_MS, now).run();
  await env.AUTH_DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  return json({ token, expiresAt: now + SESSION_MS }, 200, origin);
}

async function authEndpoint(request, env, route) {
  const origin = resolveOrigin(request, env);
  if (!origin) return json({ error: "Not allowed." }, 403, null);
  if (request.method === "OPTIONS") return authPreflight(origin);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  try {
    if (route === "logout") {
      const user = await requireUser(request, env);
      if (user) await env.AUTH_DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(user.tokenHash).run();
      return json({ ok: true }, 200, origin);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4096) return json({ error: "Request too large." }, 413, origin);
    const body = JSON.parse(rawBody);
    if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
      return json({ error: "Enter a username and password." }, 400, origin);
    }
    const username = body.username.trim();
    if (!/^[A-Za-z0-9_-]{3,24}$/u.test(username) || body.password.length < 12 || textEncoder.encode(body.password).byteLength > 256) {
      return json({ error: "Use a 3–24 character username and a password of at least 12 characters." }, 400, origin);
    }

    if (route === "register") {
      if (!env.REGISTRATION_CODE || typeof body.inviteCode !== "string" || !sameSecret(body.inviteCode, env.REGISTRATION_CODE)) {
        return json({ error: "Invalid invite code." }, 403, origin);
      }
      const userId = crypto.randomUUID();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const passwordHash = await derivePassword(body.password, salt);
      try {
        await env.AUTH_DB.prepare("INSERT INTO users (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(userId, username, encodeBase64Url(salt), encodeBase64Url(passwordHash), Date.now()).run();
      } catch {
        return json({ error: "That username is already registered." }, 409, origin);
      } finally {
        passwordHash.fill(0);
      }
      return createSession(userId, env, origin);
    }

    const user = await env.AUTH_DB.prepare("SELECT id, password_salt, password_hash FROM users WHERE username = ? COLLATE NOCASE")
      .bind(username).first();
    if (!user) return json({ error: "Incorrect username or password." }, 401, origin);
    const salt = decodeBase64Url(user.password_salt);
    const expected = decodeBase64Url(user.password_hash);
    const actual = await derivePassword(body.password, salt);
    const valid = sameSecret(encodeBase64Url(actual), encodeBase64Url(expected));
    actual.fill(0);
    if (!valid) return json({ error: "Incorrect username or password." }, 401, origin);
    return createSession(user.id, env, origin);
  } catch {
    return json(GENERIC_ERROR, 503, origin);
  }
}

export class AttemptGuard {
  constructor(state) { this.state = state; }

  async fetch(request) {
    try {
      const { action, questionId, sessionId, token } = await request.json();
      if (!["issue", "consume"].includes(action) || typeof questionId !== "string" || !/^q-[0-9]{2}$/u.test(questionId) || typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/u.test(sessionId)) {
        return Response.json({ error: "invalid" }, { status: 400 });
      }
      const now = Date.now();
      const freshToken = action === "issue" ? randomToken() : null;
      const result = await this.state.storage.transaction(async (txn) => {
        const attemptKey = `session:${sessionId}:question:${questionId}`;
        const attempt = await txn.get(attemptKey);
        if (action === "issue") {
          if (attempt && attempt.expiresAt > now) {
            return { status: 200, body: { attemptToken: attempt.token } };
          }
          await txn.put(attemptKey, { token: freshToken, expiresAt: now + DAY_MS });
          return { status: 200, body: { attemptToken: freshToken } };
        }
        if (!attempt || attempt.expiresAt <= now || typeof token !== "string" || token !== attempt.token) {
          return { status: 409, body: { error: "attempt_unavailable" } };
        }
        return { status: 200, body: { accepted: true } };
      });
      return Response.json(result.body, { status: result.status });
    } catch {
      return Response.json({ error: "unavailable" }, { status: 503 });
    }
  }
}

async function getAttemptGuard(request, env, action, questionId, sessionId, token, userId) {
  const hmacKey = await crypto.subtle.importKey("raw", textEncoder.encode(env.ANSWER_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const visitorDigest = await crypto.subtle.sign("HMAC", hmacKey, textEncoder.encode(userId));
  const userKey = encodeBase64Url(new Uint8Array(visitorDigest));
  const stub = env.ATTEMPT_GUARD.get(env.ATTEMPT_GUARD.idFromName(userKey));
  return stub.fetch("https://attempt-guard.internal/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, questionId, sessionId, token })
  });
}

async function issueAttempt(request, env) {
  const origin = resolveOrigin(request, env);
  if (!origin) return json({ error: "Not allowed." }, 403, null);
  if (request.method === "OPTIONS") {
    return authPreflight(origin);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  try {
    const user = await requireUser(request, env);
    if (!user) return json({ error: "Sign in to continue." }, 401, origin);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1024) return json({ error: "Request too large." }, 413, origin);
    const body = JSON.parse(rawBody);
    if (!body || typeof body.questionId !== "string" || !/^q-[0-9]{2}$/u.test(body.questionId) || typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/u.test(body.sessionId)) return json({ error: "Invalid question or session." }, 400, origin);
    const guardResponse = await getAttemptGuard(request, env, "issue", body.questionId, body.sessionId, "", user.id);
    return json(await guardResponse.json(), guardResponse.status, origin);
  } catch {
    return json(GENERIC_ERROR, 503, origin);
  }
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
  const origin = resolveOrigin(request, env);
  if (!origin) return json({ error: "Not allowed." }, 403, null);
  if (request.method === "OPTIONS") {
    return authPreflight(origin);
  }
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, origin);
  try {
    const user = await requireUser(request, env);
    if (!user) return json({ error: "Sign in to continue." }, 401, origin);
    const questions = await loadQuestions(env, request.url);
    return json({ questions }, 200, origin);
  } catch {
    return json(GENERIC_ERROR, 503, origin);
  }
}

function sameSecret(a, b) {
  const left = textEncoder.encode(a);
  const right = textEncoder.encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) difference |= (left[i] || 0) ^ (right[i] || 0);
  return difference === 0;
}

async function getAdminAnswers(request, env) {
  const origin = resolveOrigin(request, env);
  if (!origin) return json({ error: "Not allowed." }, 403, null);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400", "Vary": "Origin" } });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  const configuredKey = env.ADMIN_KEY;
  const authorization = request.headers.get("Authorization") || "";
  const suppliedKey = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (typeof configuredKey !== "string" || !configuredKey || !sameSecret(suppliedKey, configuredKey)) {
    return json({ error: "Unauthorized." }, 401, origin);
  }
  try {
    const answers = await loadAnswers(env, request.url);
    const correctIndexes = Object.fromEntries(Object.entries(answers).map(([id, entry]) => [id, entry.correct]));
    return json({ answers: correctIndexes }, 200, origin);
  } catch {
    return json(GENERIC_ERROR, 503, origin);
  }
}

export async function checkAnswer(request, env) {
  const origin = resolveOrigin(request, env);
  if (!origin) return json({ error: "Not allowed." }, 403, null);
  if (request.method === "OPTIONS") {
    return authPreflight(origin);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 1024) return json({ error: "Request too large." }, 413, origin);
  try {
    const user = await requireUser(request, env);
    if (!user) return json({ error: "Sign in to continue." }, 401, origin);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1024) return json({ error: "Request too large." }, 413, origin);
    const body = JSON.parse(rawBody);
    if (!body || typeof body.questionId !== "string" || !/^q-[0-9]{2}$/u.test(body.questionId) || typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/u.test(body.sessionId) || !Number.isInteger(body.selectedIndex) || body.selectedIndex < 0 || body.selectedIndex > 2) return json({ error: "Invalid answer." }, 400, origin);
    if (typeof body.attemptToken !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(body.attemptToken)) return json({ error: "Invalid attempt." }, 400, origin);
    const guardResponse = await getAttemptGuard(request, env, "consume", body.questionId, body.sessionId, body.attemptToken, user.id);
    if (!guardResponse.ok) return json(await guardResponse.json(), guardResponse.status, origin);
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
    if (url.pathname === "/api/auth/login") return authEndpoint(request, env, "login");
    if (url.pathname === "/api/auth/register") return authEndpoint(request, env, "register");
    if (url.pathname === "/api/auth/logout") return authEndpoint(request, env, "logout");
    if (url.pathname === "/api/check") return checkAnswer(request, env);
    if (url.pathname === "/api/attempt") return issueAttempt(request, env);
    if (url.pathname === "/api/admin/answers") return getAdminAnswers(request, env);
    if (url.pathname === "/api/questions") return getQuestions(request, env);
    if (url.pathname === "/api/health") return json({ status: "ok" }, 200, request.headers.get("Origin"));
    return env.ASSETS.fetch(request);
  }
};

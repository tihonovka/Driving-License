# Drive — Hungarian theory practice

A lightweight, static driving theory practice site built for GitHub Pages. Question and answer content is in Hungarian; the surrounding interface is in English.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server.

## Publish with GitHub Pages

Push the repository to GitHub, then enable Pages from the repository's `main` branch and `/ (root)` folder. The project has no build step.

## Content

The initial question bank is derived from the user's local notes. All 18 prompts, answer choices, correct answers, and explanations are recorded in that data-bank file. Additional KRESZ facts are sourced from the current Hungarian KRESZ text at [net.jogtar.hu](https://net.jogtar.hu/jogszabaly?docid=97500001.kpm).

## Private answer checker

Question text and choices are stored in `worker/public/quiz-questions.enc.json`, encrypted with AES-256-GCM. Correct indexes are in the separate encrypted `worker/public/answer-bank.enc.json`. The decryption keys are Cloudflare Worker secrets named `QUESTION_KEY` and `ANSWER_KEY`; they are not included in Git or sent to browsers. The Worker returns question text and choices for display, and only `{ "correct": true|false }` for answer checks.

Answer checks require a random, one-use token bound to a question and a quiz-run ID. There is no per-minute rate limit or IP-based daily lock. Each question can be checked once in a quiz run; starting a new run or choosing a different topic creates a fresh run. This keeps ordinary practice usable while preventing repeated guesses within one run. Since the run ID is held by the browser, a determined user can create another run; no browser-only design can prevent that while returning per-answer correctness.

The owner-only `POST /api/admin/answers` endpoint returns correct answer indexes only when the request includes `Authorization: Bearer <ADMIN_KEY>`. `ADMIN_KEY` is a Cloudflare Worker secret and must never be added to the frontend or GitHub. Missing or incorrect keys receive HTTP 401. Set it from the repository root with `pnpm dlx wrangler secret put ADMIN_KEY --config worker/wrangler.jsonc`.

The intended checker URL is `https://driving-license-answer-checker.driving-license-practice.workers.dev`. To update the question bank, prepare an ignored local JSON array containing the question text and choices, generate a fresh key, and encrypt it:

1. Run `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))" | Set-Content -NoNewline worker/.question-key.local`.
2. Run `node worker/scripts/encrypt-question-bank.mjs path/to/private-question-source.json`.
3. Run `pnpm worker:deploy`, then `Get-Content -Raw worker/.question-key.local | pnpm dlx wrangler secret put QUESTION_KEY --config worker/wrangler.jsonc`.
4. Delete the local key with `Remove-Item -LiteralPath worker/.question-key.local` after Cloudflare accepts it.

Never commit local keys or private source files. Run `pnpm test` to verify correct/wrong checks, tamper rejection, and origin/input validation.

Question prompts and choices are necessarily readable in the browser while displayed. Correct indexes and both decryption keys remain server-side; the checker returns only whether a submitted choice is correct. A debugger loop cannot prevent DevTools inspection and would freeze the quiz.

The external `kreszteszt.net/tablak/` catalogue has four general-purpose SVG icons; its individual road-sign illustrations are JPEGs. This project uses original, locally drawn SVG diagrams for the quiz questions that benefit from a sign illustration.

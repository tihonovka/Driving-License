# Drive — Hungarian theory practice

A lightweight, static driving theory practice site built for GitHub Pages. Question and answer content is in Hungarian; the surrounding interface is in English.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server.

## Publish with GitHub Pages

Push the repository to GitHub, then enable Pages from the repository's `main` branch and `/ (root)` folder. The project has no build step.

## Content

The initial question bank is derived from the user's local notes. All 18 prompts, answer choices, correct answers, and explanations are recorded in that data-bank file. Additional KRESZ facts are sourced from the current Hungarian KRESZ text at [net.jogtar.hu](https://net.jogtar.hu/jogszabaly?docid=97500001.kpm).

## Private answer checker

The GitHub Pages client contains question prompts and choices only. Correct indexes are stored in `worker/public/answer-bank.enc.json`, encrypted with AES-256-GCM. The random 256-bit key is a Cloudflare Worker secret named `ANSWER_KEY`; Cloudflare protects the secret at rest, and it is never sent to browsers or included in the repository. The Worker decrypts the bank for comparison and returns only `{ "correct": true|false }`.

The intended checker URL is `https://driving-license-answer-checker.driving-license-practice.workers.dev`. To update the answer bank, prepare an ignored local JSON file mapping each question ID to its correct index, generate a fresh key, and encrypt the bank:

1. Run `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))" | Set-Content -NoNewline worker/.answer-key.local`.
2. Run `node worker/scripts/encrypt-answer-bank.mjs path/to/private-answer-source.json`.
3. Run `pnpm worker:deploy`, then `Get-Content -Raw worker/.answer-key.local | pnpm dlx wrangler secret put ANSWER_KEY --config worker/wrangler.jsonc`.
4. Delete the local key with `Remove-Item -LiteralPath worker/.answer-key.local` after Cloudflare accepts it.

Never commit the local key or private answer source. Run `pnpm test` to verify correct/wrong checks, tamper rejection, and origin/input validation.

The browser receives no correct index or answer key. The checker returns only whether a submitted choice is correct.

The external `kreszteszt.net/tablak/` catalogue has four general-purpose SVG icons; its individual road-sign illustrations are JPEGs. This project uses original, locally drawn SVG diagrams for the quiz questions that benefit from a sign illustration.

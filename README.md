# Drive — Hungarian theory practice

A lightweight, static driving theory practice site built for GitHub Pages. Question and answer content is in Hungarian; the surrounding interface is in English.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server.

## Publish with GitHub Pages

Push the repository to GitHub, then enable Pages from the repository's `main` branch and `/ (root)` folder. The project has no build step.

## Content

The initial question bank is derived from the user's local notes. All 18 prompts, answer choices, correct answers, and explanations are recorded in that data-bank file. Additional KRESZ facts are sourced from the current Hungarian KRESZ text at [net.jogtar.hu](https://net.jogtar.hu/jogszabaly?docid=97500001.kpm).

## LCrypt 2.0

Open `crypto.html` to encrypt or decrypt a message. The portable JSON envelope uses AES-256-GCM, a random 256-bit data key wrapped with AES-256-KW, and Argon2id (64 MiB, 3 iterations, parallelism 1). Each encryption generates a fresh 16-byte salt and 12-byte nonce. Crypto uses the browser Web Crypto API; Argon2id is provided by the MIT-licensed `hash-wasm` package (vendored at `vendor/hash-wasm.esm.min.js`).

Install Node.js 24 or newer and pnpm, then run `pnpm install` and `pnpm test` to verify Unicode round trips, wrong-password rejection, ciphertext tampering, and fresh randomness. Never use the weak example passphrase `elpis` for confidential messages; LCrypt does not include or default to it.

The static quiz still serves `questions.js` openly. Encrypting browser-delivered quiz data cannot hide its plaintext from the person running the page or inspecting DevTools. A private question bank with hidden answer keys needs server-side validation and a server-side secret; GitHub Pages alone cannot provide that.

The external `kreszteszt.net/tablak/` catalogue has four general-purpose SVG icons; its individual road-sign illustrations are JPEGs. This project uses original, locally drawn SVG diagrams for the quiz questions that benefit from a sign illustration.

# Contributing to Unlikely

Bring a concrete task, a connection worth exploring, or a reproducible problem. Examples, accessibility, translations, model compatibility, and exploration improvements are welcome.

## Add an example

Use `public/examples.mjs`. Include a task and constraints, a seed, explained relationships, a complete route through actual edges, an authored outcome, and assumptions that still need judgment or evidence.

Provide English and Simplified Chinese text. Existing examples have six clusters, 31 nodes, and two complete routes per task. Offer meaningfully different directions rather than near-synonyms. Label relationships as `association`, `analogy`, or `hypothesis`; these are roles, not evidence ratings. Cite sources in the pull request for specific external facts.

## Develop and check

The local app requires Node.js 22.9.0 or newer, with no dependencies to install.

```sh
npm start
npm test
npm run check
```

Open `http://127.0.0.1:4317`. Check UI changes in both languages and a narrow viewport. Add meaningful regression tests for graph, route, layout, or model behavior. Graphs accept 1–16 clusters, up to 150 nodes, and up to 400 edges; newly generated maps currently request six clusters and 31–49 nodes.

Preserve these behaviors:

- Start from a task or clearly labeled curated example, then enter the panoramic map.
- Humans select routes and accept suggested bridges; unresolved relationships stay visible.
- Curated outcomes, route summaries, imports, and model drafts remain distinguishable.
- Expansion appends validated content. Failed requests do not overwrite the current map.
- Public-trial limits, outages, and missing configuration never force visitors into an API-key form. BYOK is an optional advanced choice.
- Browser model settings stay in page memory, clear on refresh, and never enter `localStorage` or exports. Server keys stay on the server.
- BYOK connection tests make provider requests and may incur charges; do not hide those calls.

## Public-trial changes

Read [the public-trial contract](docs/public-trial.md). The code is implemented but not activated; credentials, budget, current pricing verification, and operator-side billing limits remain activation requirements.

Keep D1 mandatory and configuration disabled by default. Model requests must pass the same server-side session, IP, global, concurrency, and budget checks regardless of how they reach the API. Do not accept client-supplied provider URLs, keys, models, prices, or token caps on the trial endpoint.

Test atomic reservations, duplicate request IDs, exhausted limits, database failure, provider errors, and interrupted requests without real credentials or charges. A reservation is not refunded, and duplicate IDs must not repeat the upstream call. Do not persist prompts, graphs, or raw IP addresses in gateway storage. Mock tests are not evidence of a working public deployment or an absolute billing cap.

## Report model compatibility

No real provider is currently claimed as verified. Report provider, model, date, and access mode: public trial, browser BYOK, or local server. List connection-test, generation, expansion, and synthesis results separately, including browser CORS support and graph validation where relevant.

A passing connection test does not prove all operations work. Use non-sensitive tasks and sanitized errors. Never include keys, `.env` contents, private task data, or sensitive provider logs in issues, fixtures, screenshots, or pull requests.

## Report a bug

Include reproduction steps, expected and actual behavior, browser, relevant viewport, content origin, and generation mode. For a trial failure, include the public error code and request ID if available, without your session token or network identifiers. A minimal exported JSON project helps when it contains no private content.

## License

Contributions use the project's [MIT license](LICENSE). Share only material you have the right to contribute.

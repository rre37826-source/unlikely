# Contributing to Unlikely

Bring a concrete task, a connection worth exploring, or a reproducible problem. Contributions to examples, accessibility, translations, model compatibility, and the exploration experience are welcome.

## Add an example

Use `public/examples.mjs` as the format. Include:

1. **Task and constraints:** what someone wants to make, for whom, and within what limits.
2. **Seed:** an object, word, event, or observation to explore.
3. **Explained relationships:** what the ideas share, what could transfer, and where the comparison stops working.
4. **A complete route and outcome:** ordered nodes connected by actual edges, leading to a useful creative direction.
5. **Assumptions:** what still needs judgment, evidence, or an experiment.

Provide English and Simplified Chinese labels, descriptions, relationship explanations, route titles, outcomes, and assumptions. Mark incomplete translations clearly. Existing demos have six clusters, 31 nodes, and two complete routes per task; new examples should offer meaningfully different directions rather than near-synonyms.

Label relationships as `association`, `analogy`, or `hypothesis`. These are roles, not evidence ratings. Cite sources in the pull request when a connection relies on a specific external fact; keep proposed effects and applications distinct from verified claims.

## Develop and check

Requires Node.js 22.9.0 or newer. No dependency installation is needed.

```sh
npm start
npm test
npm run check
```

Open `http://127.0.0.1:4317`. Check UI changes in both languages and a narrow viewport. Add meaningful regression tests for changed graph, route, layout, or model behavior.

Preserve these boundaries:

- Start with a task or a clearly labeled curated example, then enter the panoramic map.
- Humans choose route nodes and accept suggested bridges; unresolved relationships stay visible.
- Curated outcomes, route summaries, imports, and model drafts remain distinguishable.
- Expansion appends a validated delta and preserves existing content. Failed requests do not overwrite the current map.
- Browser connection settings—including API keys—stay in page memory, clear on refresh, and never enter `localStorage` or exports. Local `.env` keys stay on the server.
- Connection tests make a small provider request; disclose that it can incur usage charges. Do not add hidden provider calls.

Graphs accept 1–16 clusters, up to 150 nodes, and up to 400 edges. New model-generated maps currently request six clusters and 31–49 nodes; broader layout support also serves imported and expanded maps.

## Report model compatibility

Model integration has mock-based tests; no real provider is currently claimed as verified. A useful report includes:

- Provider, model identifier, date, and whether you used browser BYOK or the local server.
- Connection-test, generation, expansion, and synthesis results separately.
- Browser CORS support, JSON-object output, and whether the bilingual graph passed validation.
- A small non-sensitive task, relevant constraints, and a sanitized error or result.

A passing connection test is not proof that all operations work. Testing and generation use your provider account and may be billable. Never include keys, `.env` contents, private tasks, or sensitive logs in an issue, screenshot, fixture, or pull request.

## Report a bug

Describe reproduction steps, expected and actual behavior, browser, and relevant viewport. State whether the content was curated, imported, or model-generated. A minimal exported JSON project is useful if it contains no private material.

## License

Contributions are made under the project's [MIT license](LICENSE). Share only material you have the right to contribute.

# Unlikely

**Turn a task into a map of possibilities. Choose your own creative path.**

An open-source creative exploration tool for writing, products, business, and the tasks you bring. See the whole map, inspect surprising connections, and choose the relationships that become your idea.

**[Explore the demo](https://rre37826-source.github.io/unlikely/)** · [Run locally](#run-locally) · [简体中文](README.zh-CN.md)

![Unlikely showing a panoramic idea network and a human-selected creative route](docs/demo.gif)

- **See several directions at once.** Start with a panoramic network, then follow the connections that interest you.
- **Ask why two ideas connect.** Every edge has an explanation; analogies and hypotheses remain visible.
- **Make the choices yourself.** Keep, reorder, or remove ideas, then take your route away as Markdown, JSON, or an SVG card.

The browser demo uses **curated examples, not live AI**. No account or API key is needed to explore them. An optional local model adapter can generate and extend maps; it has been tested with mocks, **not yet validated against a real provider**.

## One ordinary seed, three different tasks

All three examples start from **lemon concentrate**, with 31 nodes across six clusters and two complete preset routes each.

| Task | One route through the map | A possible direction |
| --- | --- | --- |
| Write an eight-minute short film | Concentration → compression → omitted detail → recipe | Two siblings leave their old home with two different versions of a familiar drink. |
| Explore a product for interrupted creative work | Compression → omitted detail → missing context | A Context Capsule preserves the intention and reason behind a decision. |
| Try a low-cost café service | Small container → limited inventory → simple rule → meeting point | A twenty-minute mixing stop to test on two quiet afternoons. |

These are authored creative examples. Product value and commercial demand are hypotheses to test, not established outcomes.

## Try it

1. Open the demo and choose Writing, Product, or Business. The **20-second tour** walks through one curated route.
2. Click a node or connection to read its meaning and relationship explanation.
3. Keep ideas in your route. Change their order or remove them whenever you want.
4. If two consecutive ideas have no direct relationship, the route shows an open gap. **Suggest an existing connection** finds a path through the current graph and asks you before adding it. A shorter path does not establish a better idea.
5. Choose **Shape this idea**, then export the result or continue exploring.

Without a model, an exact match to one of the six preset routes reveals its authored outcome. Other routes produce a faithful summary of the selected nodes and existing relationships—not a newly generated proposal. Open gaps stay explicit.

## Run locally

Requires **Node.js 22.9.0 or newer**. The app uses plain HTML, CSS, and JavaScript with Node's built-in server and test runner; there are no dependencies to install.

```sh
git clone https://github.com/rre37826-source/unlikely.git
cd unlikely
npm start
```

Open **[http://127.0.0.1:4317](http://127.0.0.1:4317)**. Curated examples work without a model provider.

```sh
npm test
npm run check
```

## Optional: connect a model

Copy the configuration template:

```sh
cp .env.example .env
```

Fill in your local `.env`, then restart `npm start`:

```dotenv
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_API_KEY=your-local-key
MODEL_NAME=your-model-name
PORT=4317
```

The adapter appends `/chat/completions` to the base URL and expects an OpenAI-compatible chat-completions response, bearer authentication, and JSON-object output through `response_format`. Compatibility depends on the provider and model. **The adapter has only been tested with mocked responses so far.**

When configured, the local app can request:

- **Generate:** a task-led network from your task and seed.
- **Expand:** deeper connections, analogies, reversed premises, or links across clusters around a selected node.
- **Synthesize:** a draft based on your selected route, with unresolved connections and hypotheses listed.

Put your audience and constraints in the task description. Returned graphs are checked for structure and connectivity; those checks do not verify their factual claims or creative quality. Exact preset routes continue to show their clearly labeled curated outcomes.

## Where your work goes

| Mode | Storage and model requests |
| --- | --- |
| Static browser demo | Exploration is saved in this browser's `localStorage` when available. No model requests are made. |
| Local app without a provider | The same curated exploration and local browser storage. |
| Local app with a provider | The server sends the task and relevant graph/route content to your configured provider when you request generation, expansion, or synthesis. |

The API key stays in the local server's environment and is never sent to the browser. This does **not** mean model processing stays on your computer: the configured provider receives the request content. A locally hosted compatible provider is also possible, but has not been verified here.

There are no application analytics or account systems in this release. Static hosting and model providers may retain their own service logs. Browser storage is not a backup and does not sync across devices; export JSON to keep a portable copy. Clearing the site's browser data removes its saved local state.

The built-in server binds to `127.0.0.1` and accepts requests through its local address. It is intended for local use, **not as a public production model proxy**. GitHub Pages serves the curated static demo only.

## What the labels mean

- **Curated:** authored example content, not a live model result.
- **Model:** model-generated content that needs your judgment and independent verification.
- **Imported:** a loaded project whose source is not independently verified. Import does not preserve a claim of trusted origin.

Relationships are labeled **association**, **analogy**, or **hypothesis**. These labels describe their intended role; they are not evidence ratings. A creative analogy does not establish a causal claim. Imported and model-generated claims deserve the same scrutiny as any draft.

## Build with it

| File | Role |
| --- | --- |
| `public/app.mjs` | Map interaction, route editing, persistence, and exports |
| `public/core.mjs` | Graph validation, route logic, existing-path search, and Markdown export |
| `public/examples.mjs` | Bilingual examples, relationship explanations, and complete preset routes |
| `server.mjs` | Local static server and optional model adapter |

English and Simplified Chinese are included. JSON import/export keeps the graph and selected route portable; Markdown includes relationship explanations, and SVG exports a route card.

Good examples are a substantial part of this project. Contributions are welcome: bring a concrete task, a surprising but explainable relationship, and a complete route someone can inspect. See [CONTRIBUTING.md](CONTRIBUTING.md).

If you want to follow the project, a star helps others discover it. If you try a route, an issue describing what worked—or where the connection felt forced—is especially useful.

## License

[MIT](LICENSE) © 2026 Unlikely contributors.

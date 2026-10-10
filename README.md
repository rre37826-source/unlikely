# Unlikely

**One task. More than one way in.**

An open-source tool for finding creative directions in writing, products, business, and your own tasks. Describe what you want to make, explore a map of unexpected connections, and choose the ideas worth developing.

**[Open Unlikely](https://rre37826-source.github.io/unlikely/)** · [Run locally](#run-locally) · [简体中文](README.zh-CN.md)

![Unlikely's starting screen with a task composer and three ready-made examples](docs/start.png)

## From a task to a creative route

1. **Bring a task.** Add your goal, optional starting inspiration, and any audience or constraints. Or open a ready-made example without an API key.
2. **Explore the whole map.** Click ideas and connections to see why they relate. With a model connected, deepen a node, try an analogy, or reverse a premise.
3. **Choose your route.** Keep, reorder, or remove ideas, then shape a draft or export Markdown, JSON, and an SVG route card.

Missing relationships stay visible. Unlikely can suggest a path through existing connections, but you decide whether to add it. Model expansion adds new material while preserving the existing graph and your selected route.

![A curated route through Unlikely's panoramic idea map](docs/demo.gif)

## Try an example first

All three curated examples start from **lemon concentrate**, each with 31 nodes across six clusters and two complete preset routes.

| Task | One possible direction |
| --- | --- |
| Write an eight-minute short film with two actors and one kitchen | Two siblings stop correcting each other's familiar drink and keep two versions of home. |
| Design a product for interrupted creative work | A Context Capsule preserves the intention and reason behind a decision. |
| Explore a low-cost café service | A twenty-minute mixing stop to test on two quiet afternoons. |

These are **authored examples, not live generation**. Exact preset routes show their authored outcomes. Without a model, other routes summarize your selected nodes and existing relationships; they do not produce a new AI proposal.

## Use your own model in the browser

On the [website](https://rre37826-source.github.io/unlikely/), enter your task and choose **Generate my idea map**, or open **Connect a model**. Enter your provider's API base URL, model name, and API key, then **Test and connect**.

- The provider must support OpenAI-compatible `/chat/completions`, bearer authentication, JSON-object output through `response_format`, and browser requests through CORS.
- **Testing sends a small model request.** Testing, generation, expansion, and synthesis may incur charges on your provider account; you are responsible for those charges.
- The browser sends requests directly to the provider you specify. If that provider blocks browser requests, use the local server below.

**Verification status:** browser and local model integration have mock-based tests. No real provider or model has yet been verified. Passing the connection test does not establish that a model can generate a valid graph or complete every operation.

## Run locally

Requires **Node.js 22.9.0 or newer**. No dependencies to install.

```sh
git clone https://github.com/rre37826-source/unlikely.git
cd unlikely
npm start
```

Open **[http://127.0.0.1:4317](http://127.0.0.1:4317)**. To route model requests through the local server instead of connecting from the browser:

```sh
cp .env.example .env
```

Set `MODEL_BASE_URL`, `MODEL_API_KEY`, and `MODEL_NAME` in `.env`, then restart `npm start`. The server appends `/chat/completions` to the base URL. This avoids the provider's browser CORS restriction; provider authentication, model compatibility, and usage charges still apply.

The built-in server binds to `127.0.0.1` for local use. It is not a public production proxy. GitHub Pages serves the web app, including optional direct requests to your own provider.

## Data and content

| Item | Where it goes |
| --- | --- |
| Browser API key, base URL, and model name | Page memory only; cleared on refresh, not saved in browser storage or included in exports. |
| Task, graph, route, and draft | Saved in this browser's `localStorage` when available. Export JSON for a portable project copy. |
| Model request content | Sent to your chosen provider, directly from the browser or through your local server. |
| Local `.env` key | Kept on the local server; not sent to the browser. |

There are no application analytics or accounts. Hosting and model providers may keep their own service logs. Browser storage does not sync across devices; clearing site data removes the saved exploration.

Content is labeled **curated**, **model-generated**, or **imported**. Connections distinguish **association**, **analogy**, and **hypothesis**. These describe the content's role and origin, not proof of factual accuracy or creative value. Drafts and proposed applications still need human judgment and verification.

## Build with it

Plain HTML, CSS, JavaScript, and Node's built-in server and test runner. English and Simplified Chinese are included.

```sh
npm test
npm run check
```

- `public/app.mjs`: task entry, exploration, routes, persistence, and exports.
- `public/core.mjs` and `public/layout.mjs`: graph validation, route logic, and layout for 1–16 clusters and up to 150 nodes.
- `public/model-client.mjs` and `public/model-protocol.mjs`: browser requests and shared generation, expansion, and synthesis rules.
- `public/examples.mjs`: bilingual curated cases and complete routes.
- `server.mjs`: local server and optional model adapter.

Bring a concrete task, an unexpected but explainable connection, or a reproducible issue. See [CONTRIBUTING.md](CONTRIBUTING.md). If you want to follow the project, a star is welcome.

[MIT](LICENSE) © 2026 Unlikely contributors.

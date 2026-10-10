# Unlikely

**One task. More than one way in.**

An open-source tool for finding creative directions in writing, products, business, and your own tasks. Start with something you want to make, explore unexpected connections, and choose the ideas worth developing.

**[Try Unlikely](https://rre37826-source.github.io/unlikely/)** · [Run locally](#run-locally) · [简体中文](README.zh-CN.md)

**Limited public trial is enabled:** submit your own task without an account or API key. Usage limits apply. Three complete examples are also free to explore without model calls. Bringing your own model remains an optional advanced feature.

![Unlikely's starting screen with a task composer and three ready-made examples](docs/start.png)

## From a task to a creative route

1. **Bring a task.** Choose a ready-made example, or describe your goal, optional inspiration, audience, and constraints.
2. **Explore the whole map.** Click ideas and connections to see why they relate. Model operations can deepen a node, try an analogy, or reverse a premise when a generation service is available.
3. **Choose your route.** Keep, reorder, or remove ideas, then develop the route or export Markdown, JSON, and an SVG card.

Missing relationships stay visible. Unlikely can suggest a path through existing connections, but you decide whether to add it. Model expansion adds new material while preserving the existing graph and selected route.

![A curated route through Unlikely's panoramic idea map](docs/demo.gif)

## Three tasks, one ordinary seed

All three curated examples start from **lemon concentrate**, each with 31 nodes across six clusters and two complete preset routes.

| Task | One possible direction |
| --- | --- |
| Write an eight-minute short film with two actors and one kitchen | Two siblings stop correcting each other's familiar drink and keep two versions of home. |
| Design a product for interrupted creative work | A Context Capsule preserves the intention and reason behind a decision. |
| Explore a low-cost café service | A twenty-minute mixing stop to test on two quiet afternoons. |

These are **authored examples, not live generation**. Exact preset routes show their authored outcomes. Without a model service, other routes summarize selected nodes and existing relationships rather than generating a new proposal.

## Public trial

The hosted gateway is deployed and enabled, with operator credentials and a monthly budget configured. Visitors can request generation without signing up or supplying a key.

The default limits are three model operations per anonymous session **and per IP address per UTC day**, shared by generation, expansion, and synthesis; the tighter allowance wins. Global usage, concurrency, and monthly budget limits also apply. Curated examples remain free and do not consume this allowance.

A real Kimi K2.6 result passed graph validation and was imported into the public frontend. A successful request through the updated public generation flow remains unverified: the test IP had already used its daily allowance. Real expansion and synthesis remain mock-tested only. See the [v0.3.1 verification record](docs/verification-v0.3.1.md).

While unavailable or out of quota, the app keeps your current work and offers examples or a retry where appropriate. It does not require an API-key form to continue. See [public-trial setup and limits](docs/public-trial.md) for quota rules and data handling.

## Advanced: bring your own model

Open the optional model settings and enter an API base URL, model name, and API key, then **Test and connect**.

- The provider must support OpenAI-compatible `/chat/completions`, bearer authentication, JSON-object output through `response_format`, and browser CORS requests.
- Testing makes a model request; testing and subsequent generation, expansion, or synthesis may incur charges on **your provider account**, including reasoning charges where applicable.
- Browser requests go directly to your chosen provider. If CORS blocks them, use the local server below.

Advanced BYOK integrations have mock-based tests. The direct Kimi K2.6 check above does not verify browser BYOK, other providers, or real expansion and synthesis. A successful connection test alone does not prove all operations work.

## Run locally

Requires **Node.js 22.9.0 or newer**. No dependencies to install for the local app.

```sh
git clone https://github.com/rre37826-source/unlikely.git
cd unlikely
npm start
```

Open **[http://127.0.0.1:4317](http://127.0.0.1:4317)**. For server-side model requests:

```sh
cp .env.example .env
```

Set `MODEL_BASE_URL`, `MODEL_API_KEY`, and `MODEL_NAME` in `.env`, then restart `npm start`. The server appends `/chat/completions` to the base URL. This avoids browser CORS restrictions; provider compatibility and your account's charges still apply.

This server binds to `127.0.0.1` for local use. Public trial requests use a separate gateway with D1 quota storage; the local server is not a public production proxy. GitHub Pages continues to host the frontend.

## Data and content

| Item | Where it goes |
| --- | --- |
| Task, graph, route, and draft | This browser's `localStorage` when available; export JSON for a portable project copy. |
| Public-trial content | Through the gateway to its fixed model provider. The gateway does not persist task or graph content. |
| Public-trial quota data | D1 accounting and request records use HMAC-derived quota identifiers; raw IP addresses are not stored there. |
| Optional browser model settings | Page memory only; key, endpoint, and model clear on refresh and are excluded from storage and exports. |
| Server model credentials | Remain on the server and are not sent to the browser. |

There are no application analytics or user accounts. Hosting and model providers may keep their own service logs. Browser storage does not sync across devices; clearing site data removes the saved exploration. Public-trial rate limiting is separate from product analytics.

Content is labeled **curated**, **model-generated**, or **imported**. Connections distinguish **association**, **analogy**, and **hypothesis**. These labels describe origin and role, not proof of accuracy or value.

## Build with it

Plain HTML, CSS, JavaScript, and Node's built-in local server and test runner. English and Simplified Chinese are included.

```sh
npm test
npm run check
```

- `public/app.mjs`: task entry, exploration, routes, persistence, and exports.
- `public/core.mjs` and `public/layout.mjs`: graph validation, route logic, and layout for 1–16 clusters and up to 150 nodes.
- `public/model-client.mjs` and `public/model-protocol.mjs`: model requests and shared operation rules.
- `public/examples.mjs`: bilingual cases and complete routes.
- `trial/index.mjs`: public gateway handler; D1 and operator configuration are required.
- `server.mjs`: local server and optional private model adapter.

Bring a concrete task, an unexpected connection, or a reproducible issue. See [CONTRIBUTING.md](CONTRIBUTING.md). If you want to follow the project, a star is welcome.

[MIT](LICENSE) © 2026 Unlikely contributors.

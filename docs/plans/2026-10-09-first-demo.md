# Unlikely first-demo implementation plan

**Goal:** Build a complete, easy-to-try demonstration of task-led creative exploration, with GitHub stars as the primary eventual launch metric. The working name is provisional.

**Architecture:** A dependency-free static web app provides three bilingual curated networks and a complete map → relationship → route → brief flow. A small optional Node server connects custom tasks to an operator-configured OpenAI-compatible model; it never places a server API key in the browser. The static app remains usable on GitHub Pages.

**Tech stack:** HTML, CSS, browser ES modules, SVG, Node.js built-in HTTP and test runner. No package installation required.

## Accepted product decisions

- Support writing, product, business, and custom tasks through the same interaction.
- Show the whole first-round network before asking the user to pick directions.
- Humans select relationships and the final route; unfinished connections remain explicit.
- Prioritize a memorable short demo, immediate trial, useful exports, and clear English/Chinese documentation.
- Curated demos and live model outputs must be visibly distinguished.

## Implementation

1. `public/examples.mjs`: three curated, bilingual graphs; each has six clusters, cross-domain relationships, and two connected example routes.
2. `public/core.mjs`: validate graphs and imported projects, analyze route gaps, create neutral route briefs and exports. Test invalid references, disconnected paths, and data round trips in `tests/core.test.mjs`.
3. `public/index.html`, `public/style.css`, `public/app.mjs`: full panorama, relation inspector, editable ordered route, example paths, summary, JSON/Markdown/SVG export, project import and local save. Chinese/English switch and responsive canvas.
4. `server.mjs`: serve only `public/`, optional model API for generation and synthesis; validate bodies and output, prevent cross-origin calls to the local model proxy, show clear failures without replacing a prior graph.
5. `README.md`, `README.zh-CN.md`, `docs/launch.md`: accurate feature status, quick start, model setup, a twenty-second demo script, and release checklist.
6. Run Node tests, exercise HTTP routes, and inspect the new app through its local HTTP preview if tools permit. Capture a real screenshot for the README only after the app renders successfully.

## Delivery and release boundary

The current deliverable is a working local project and preview. GitHub account and repository availability will be checked without exposing credentials. Any unavailable publishing access will be reported precisely. No live-model quality claim will be made without a successful real provider call.

## Launch evaluation

After publication, compare repository visits, demo engagement, GitHub outbound clicks, and new stars by release period. Treat presentation and distribution choices as hypotheses; existing projects' star counts do not establish causality.

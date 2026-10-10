# Real-task workspace implementation plan

**Goal:** Make the first visit understandable and let visitors use their own model to explore an arbitrary task on the public site.

**Architecture:** Keep the portable, dependency-free GitHub Pages app. Add a task-first start screen and an in-memory browser model connection. Reuse a validated model protocol across direct browser requests and the existing local server. Retain clearly labeled curated examples and the user's existing graph on request failure.

**Tech stack:** Browser ES modules, SVG, native HTML dialogs, Node.js built-ins, GitHub Pages.

## Accepted scope

The user asked to continue after finding the original graph confusing. Earlier decisions still hold: task-led, cross-domain, full initial network, human-chosen route, and GitHub stars as the launch objective. A new model subscription or shared paid API service is not assumed.

## Steps

1. Add task-first landing form with optional seed and constraints, three clearly labeled examples, a concise visual explanation, and resume/import actions. Files: public/index.html, public/style.css, public/app.mjs.
2. Add model settings with endpoint, model, masked key, explicit request destination, connection test, disconnect, and key lifetime notice. Keys and connection objects must not enter localStorage or project exports.
3. Implement shared request/result protocol and a direct browser transport. Validate endpoints, graphs, append-only expansion, selected-route synthesis, response limits, timeouts, aborts, and provider errors. Files: public/model-protocol.mjs, public/model-client.mjs, server.mjs, tests/model-client.test.mjs, tests/server.test.mjs.
4. Wire generation, expansion, and synthesis through the active model connection. Preserve task/seed/constraints, handle slow work and cancellation without overwriting the previous graph, and keep graph provenance visible.
5. Improve map layout for generated/expanded node counts and make next actions understandable. Verify no overlap at default desktop size and usable mobile overview.
6. Run npm run check and npm test, then browser-test entry, examples, settings, validation errors, persistence, exports, and mobile layout. A test provider is integration evidence only; claim real provider validation only after an authorized successful call.
7. Update English/Chinese documentation and release assets with actual feature and verification status. Commit, publish, verify Pages, and report the remaining provider requirement precisely.

## Approaches considered

- Chosen default: direct browser connection to a user-supplied compatible model; no hosted secret or shared API bill, but provider CORS must allow browser use.
- Existing alternative: local server keeps its key server-side and supports providers that block browser requests.
- Managed hosted AI: investigate only if an available documented runtime can provide it without an unapproved paid service or new sensitive access.

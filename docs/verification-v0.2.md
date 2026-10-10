# v0.2 verification

Checked on 2026-10-10 before publication.

- `npm run check` passed.
- `npm test`: 40 tests passed, including graph validation, layout, browser model transport, local server, and tour/model request boundaries.
- Local browser flow checked with a controlled mock provider: connect, generate a task with optional seed and constraints, expand, choose a route, synthesize, and export.
- Authentication failure, invalid graph, and cancellation preserve the previous exploration. Refresh clears the browser model connection while preserving the saved project.
- The exported mock project contained neither the test key nor provider address.
- Curated examples and task entry checked at 1280px desktop and 390px mobile width. Mobile territory zoom and map/detail navigation checked; no horizontal page overflow observed.
- Desktop graph labels checked for node and territory-heading overlap in the 31-node example.
- A connected model does not make the automatic tour billable: the complete tour makes zero model calls; manually expanding during it cancels its remaining steps and makes only the requested expansion call.
- README screenshots and demonstration media were captured from the current interface. The demonstration shows authored examples.

No real model provider was used for this verification. Real-model output quality, graph-generation reliability, latency, costs, and provider-specific browser CORS support remain unverified. A small connection test alone does not verify the whole workflow.

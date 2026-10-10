# v0.3.1 verification — 2026-10-10

## Implementation and deployment

- Public generation uses a compact, single-language response: one seed and six groups of five nodes, with 42–54 explained connections. The server assigns IDs and group membership; it does not add or repair relationships. Shared graph validation still rejects invalid results.
- Known node-kind aliases `analogy` and `hypothesis` map to `concept`, with their analogy or unverified-hypothesis meaning retained as a visible description prefix. Unknown node kinds and invalid edge kinds still fail.
- Bounded response reading uses a fixed buffer, workerd BYOB aggregation when available, and a standard-reader fallback. Overflow, invalid UTF-8, cancellation, and malformed JSON fail without an automatic model retry.
- The gateway uses `redirect: 'manual'` for workerd compatibility and rejects upstream redirects without following their destination.
- Sites/Vinext gateway version 4, including the node-kind alias fix, was confirmed saved and deployed successfully. Public trial is enabled with `TRIAL_ENABLED=true`; operator credentials and a monthly budget are configured.

## Verified

- **86 automated tests passed.** Provider responses in these tests are mocked; coverage includes compact-format validation and conversion, preservation of analogy and hypothesis meaning, graph integrity, quota accounting, idempotency, and bounded transport behavior.
- **Actual local workerd runtime, mocked upstream:** a valid compact response produced HTTP 200 and a 31-node graph through the trial handler and D1 ledger.
- **Redirect regression:** an upstream HTTP 302 produced HTTP 502 with `PROVIDER`; the redirect destination received zero requests. The successful fixture and redirect fixture each made one upstream request and retained their reservations.
- **Native workerd BYOB boundary:** a valid JSON response padded to exactly 262,144 bytes succeeded. At 262,145 bytes, it failed with HTTP 502 and `INVALID_RESPONSE`, without retrying the provider.

These workerd checks used dummy credentials and intercepted upstream responses with external network access disabled. They verify runtime behavior, not Moonshot generation or billing.

## Real-provider evidence

- **Direct model request:** Kimi K2.6 on the China endpoint returned a compact map for a short film set in a laundromat: **31 nodes, six clusters, and 46 connections**. Nine nodes used `analogy` or `hypothesis` as their kind. After the documented alias normalization, the actual response passed the shared graph validator, with all connections preserved.
- **Frontend import:** the saved model-generated JSON project was imported and displayed in the public frontend. This verifies import and rendering of that real result; it does not verify generation initiated through the public interface.
- **Public gateway before the alias fix:** the request completed with controlled `INVALID_GRAPH` after about 64 seconds, with 13 ms of reported worker CPU time. It did not return a usable map.

## Release boundary

The hosting service recovered, and a fresh version listing confirmed the saved version matched the source archive. That existing version was deployed without repeating the save request. The earlier publication blockage is resolved.

After deployment, a browser refresh showed **`TRIAL_QUOTA`**: the test IP had already used its three daily operations during earlier integration checks. No new generation was requested, and the allowance was not bypassed. The limited public trial is enabled for requests within its limits, but a successful end-to-end `generate` through the updated public flow has not been verified.

Curated examples remain free without registration, keys, or model calls. The verified direct-provider result and its browser import do not establish public generation reliability across arbitrary tasks or a guaranteed provider bill. Real `expand` and `synthesize` operations remain mock-tested only; other providers and browser BYOK compatibility remain unverified.

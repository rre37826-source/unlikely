# Public trial implementation plan

Provide anonymous model exploration without asking visitors for API credentials. Keep curated examples immediately usable and bring-your-own-model under Advanced options. Preserve the task-first graph and human-selected route.

1. Add a public trial client, state-aware homepage copy, quota/error handling, and explicit advanced connection entry. Never open a key form automatically.
2. Add a separately deployable gateway with a fixed provider, bounded payloads, atomic D1 admission, session/IP/day/month/concurrency limits, and duplicate-request protection. Default to disabled; no paid requests during development.
3. Deploy a Sites Vinext adapter and keep its source in this repository. Store owner credentials only in server runtime secrets.
4. Verify client behavior and budget admission with mocked provider calls, run the existing suite, inspect desktop/mobile flows, and publish code plus accurate documentation.
5. Activate only after the owner supplies a project credential and authorizes a model budget. Until then clearly say online generation is being prepared; curated content is not live generation.

Acceptance: visitors can explore complete examples without accounts, keys, or a setup dialog; anonymous trial operations use the public gateway when available; exhausted/unavailable trials keep prior work and offer examples; unknown config and storage failure never permit model calls. Financial reservations are conservative application limits, not a substitute for provider billing caps.

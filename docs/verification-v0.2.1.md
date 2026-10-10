# v0.2.1 verification

Checked on 2026-10-10.

- 49 automated tests passed; syntax checks passed.
- Official Moonshot model retirement checked against https://platform.kimi.com/docs/models and https://platform.kimi.ai/docs/models. `kimi-k2.5` is retired; the reported UI used that exact model and the official China endpoint. The original provider HTTP response was not available, so its precise rejection was not observed.
- Current model parameters checked against https://platform.kimi.com/docs/api/models-overview. Provider-specific connection-test parameters apply only to verified model IDs at the exact official endpoint; no silent model replacement.
- Tests verify retired-model rejection before any request, bounded error reading, allowlisted diagnostic fields, output truncation, and no automatic paid retries.
- Browser check on the local app confirms a dummy-key K2.5 connection shows the retirement guidance. No real provider call was made.
- The local proxy preserves safe HTTP status and error categories while excluding raw provider response text.

Actual model generation quality and provider-specific browser access remain unverified. This patch does not introduce a hosted public model service or free generation quota.

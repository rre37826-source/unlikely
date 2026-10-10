# v0.3 verification — 2026-10-10

## Shipped behavior

- Complete examples are one click from the homepage, without registration or credentials.
- Bring-your-own-model moved to Advanced; unavailable or exhausted public trial never automatically opens the key dialog.
- Anonymous public-client routing, remaining actions, safe errors, and unchanged project on failure.
- A separate fixed-model gateway admits requests through an atomic SQLite/D1 statement enforcing session/IP/day/month/concurrency limits. Unknown config and database failure fail closed. Reservations are never refunded; duplicate IDs never cause another model request.

## Evidence

- `npm run check`, `npm test`: 68 passing tests, all provider responses mocked. New tests cover anonymous transport, late-status races, uncertain retries, actual SQLite admission SQL, limits, cancellation, bounded data, and safe failures.
- Browser: local unavailable state retained the typed task and did not open Advanced; authored example route produced its explicitly curated brief. Local trial fixture verified generation, expansion, quota exhaustion after three actions, and retained graph on another attempt.
- 390 × 844 mobile homepage visually inspected; viewport reset afterwards. This is a browser viewport check, not physical-device testing.
- Sites/Vinext adapter: production build and TypeScript passed; generated D1 migration checked against the canonical schema. Local status, OPTIONS, noindex and disabled request smoke checks passed.
- Public gateway deployed successfully at https://unlikely-trial.blue-lynx-3990.chatgpt.site. Public status returned HTTP 200 with `available:false`, `TRIAL_DISABLED`, `dailyLimit:3`, correct GitHub origin CORS, and no-store headers.

## Activation boundary

The public trial is **not activated**: `TRIAL_ENABLED=false`, monthly budget `0`, no operator model credential. No real model generation or provider billing behavior has been verified. The public frontend must say generation is being prepared and continue offering curated examples. Opening the paid path requires a dedicated owner-supplied key, authorized budget, verified provider pricing/caps, and a real end-to-end check.

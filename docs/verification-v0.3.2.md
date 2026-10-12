# v0.3.2 verification — 2026-10-12

The limited public trial is enabled. Backend version 6, containing the edge-category compatibility fix, is deployed. One real public-browser generation request succeeded and its map supported inspection and route selection. Earlier checks are preserved in the [v0.3.1 record](verification-v0.3.1.md).

## Compatibility fix

- Recognized edge kinds accept surrounding whitespace and ASCII case normalization. Other nonblank strings of at most 40 characters, measured before trimming, become `hypothesis`; the original model category remains visible in the reason with an unverified-connection prefix.
- Non-string, blank, and overlength kinds are still rejected. Node handling, endpoints, counts, graph connectivity requirements, quotas, and reservations are unchanged. No edge is invented and no automatic retry or second model call is added.
- The generation prompt adds one sentence placing other relationship categories in `label`, not `kind`.
- SVG route exports explicitly mark hypothesis connections in English and Chinese.
- Validation diagnostics log only a fixed event name, protocol identifier, action, and allowlisted structural code. They exclude task and graph content, raw provider output, credentials, IP addresses, and request/session identifiers. This describes application diagnostics, not all infrastructure logs or provider retention.

## Automated evidence

- **95 automated tests passed on 2026-10-12.** Provider responses are mocked. Coverage includes edge-category normalization, visible preservation of unknown categories, rejection of malformed values, unchanged graph validation, and diagnostic privacy and failure isolation.
- **English and Chinese SVG checks passed at code level:** hypothesis annotations are present in generated route-card markup. This is not a claim of a newly verified browser download or rendered-image inspection.

## Second public-browser attempt — before the compatibility fix

- **Time:** 2026-10-12, **06:18:12–06:19:20 UTC**.
- **Result:** **HTTP 502** after **68.399 seconds**, with **8 ms** of reported worker CPU time. The fixed diagnostic code was **`compact_edge_kind`**; no usable map was returned.
- **Allowance:** remaining operations changed from **2 to 1**. An admitted failed operation still consumes allowance; this is not evidence of the provider's actual charge.
- The diagnostic identifies the category validation branch. It does not expose the model's rejected field value or establish broader generation reliability.

## Third public-browser attempt — after the compatibility fix

- **Request window:** 2026-10-12, **06:25:18.298–06:26:18.294 UTC**. The request was initiated from the public webpage, without a visitor account or API key.
- **Result:** **HTTP 200** and D1 **`success`**. Reported server wall time was **60.207 seconds**, with **20 ms** of worker CPU time. Visible remaining allowance changed from **1 to 0**.
- **Rendered map:** the public UI labeled the result model-generated and showed **31 nodes across six clusters**. The DOM contained **44 connection targets**. Node inspection and relationship explanations worked.
- **Route interaction:** the selected route contained three nodes: `丢失的一只袜子` → `镜像替身` → `机器运转声`.
- **Browser persistence:** after the UI reported that the project was saved on this device, refreshing and choosing to continue the previous exploration restored the same task, 31 nodes, and six clusters. Opening the route confirmed the same three items in order: `丢失的一只袜子` → `镜像替身` → `机器运转声`.

## Scope and content limitations

This is one successful public generation flow, not evidence of reliability across arbitrary tasks. The failed attempts' diagnostic codes do not reveal their exact rejected category strings, so those strings are not claimed as known.

The successful map still needs human judgment. The description of `打烊倒计时` mentioned a clerk, which may conflict with the two-actor constraint. Some relationship reasons did not sufficiently explain both connected concepts. Structural validation and successful rendering do not establish that the content satisfies every creative constraint.

Real expansion and synthesis remain mock-tested only. Other providers and browser BYOK compatibility remain unverified. Curated examples remain free and do not consume the public model allowance.

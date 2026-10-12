# Preserve uncertain relationship categories

Public generation on 2026-10-12 failed with the content-free diagnostic `compact_edge_kind`. The rejected provider value was not logged, so its exact spelling or type is unknown.

The current parser accepts only three exact relationship categories. Rejecting a whole otherwise useful graph for a short unfamiliar category is unnecessarily brittle. The chosen compatibility boundary is conservative: accept short, non-empty textual categories; normalize the three known categories; classify other textual categories as hypotheses while retaining the model's original category visibly in the relationship reason. This preserves the proposed relationship without treating an unfamiliar classification as an established fact.

Keeping the exact enum would preserve the observed failure mode. Guessing that an unfamiliar category means `association` or `analogy` could silently overstate its meaning. A visible hypothesis preserves both the original wording and the need for human judgment.

Requirements:

- Keep all node and edge endpoints, labels, and original reason text.
- Keep node-kind rules, six groups, node and edge count limits, connectivity and cross-group checks.
- Reject non-string, blank, or over-40-character relationship categories.
- Known categories support surrounding whitespace and ASCII case normalization.
- Unknown textual categories become `hypothesis`, with the original category in a plain-text, localized reason prefix.
- Add no model retry, quota refund, raw-response logging, or new credential handling.
- Test category conversion, invalid types and bounds, graph invariants, visible rendering, and the public generation flow within the existing daily allowance.

The compatibility fix does not establish the exact value from the earlier failed output, or guarantee success for unrelated schema failures.

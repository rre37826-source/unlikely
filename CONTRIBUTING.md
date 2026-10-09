# Contributing to Unlikely

The most useful contribution is a connection someone can inspect, question, and turn into a better idea.

We welcome examples, improvements to exploration and accessibility, bug reports, translations, and reproducible model-compatibility reports. Please keep changes focused on a concrete task or problem.

## Contribute an example

Start an issue or pull request with:

1. **Task:** what the person wants to make, for whom, and within which constraints.
2. **Seed:** the word, event, object, or observation that starts the exploration.
3. **Relationships:** explain what the connected ideas share, what might transfer, and where the comparison stops working. A surprising pair alone is not enough.
4. **A complete route:** an ordered sequence through actual graph edges, with an authored outcome suited to the task.
5. **Assumptions:** what still needs creative judgment, factual checking, or a practical experiment.

Use `public/examples.mjs` as the starting format. Labels, descriptions, relationship explanations, route titles, outcomes, and assumptions have English and Simplified Chinese versions. Translation help is welcome; label unfinished translations rather than silently substituting unrelated text.

Use relationship kinds deliberately:

- `association`: a stated conceptual or contextual relationship.
- `analogy`: a comparison between different domains or mechanisms; explain both the shared structure and its limits.
- `hypothesis`: a proposed effect, application, or interpretation that remains to be tested.

An `association` label does not make a statement verified. Cite a relevant source in the pull request when an example depends on a specific external fact. Keep creative possibilities distinguishable from established evidence. Do not add unsupported claims about medical effectiveness, investment returns, product performance, or commercial demand.

Prefer several meaningfully different directions over a larger set of near-synonyms. Include cross-cluster connections and task-specific application nodes. The current demos use six clusters, 31 nodes, and two complete preset routes per task; preserve that shape when adding a comparable demo unless the change also explains and updates the experience.

## Work on the code

Requires Node.js 22.9.0 or newer. No dependency installation is needed.

```sh
npm start
npm test
npm run check
```

Open `http://127.0.0.1:4317`. For a UI change, try the affected interaction in both languages and a narrow viewport. Include a screenshot when it helps a reviewer understand the change. For route or graph logic, add or adjust a meaningful regression test.

Please preserve these behaviors:

- Humans control route selection and the acceptance of suggested bridges.
- Existing-path suggestions use existing edges; they do not invent relationship explanations.
- Missing connections stay visible after reordering, export, or synthesis.
- Curated outcomes, route summaries, imported content, and model drafts remain distinguishable.
- Failed model requests do not overwrite the current map.
- Provider keys remain on the local server, outside browser code and exported files.

## Report model compatibility

The initial adapter has mock-based tests; no real provider is currently claimed as verified. If you try one, report:

- Provider, model identifier, and test date.
- Whether generate, expand, and synthesize were each attempted.
- A small non-sensitive task and the observed result or sanitized error.
- Whether JSON output and the required bilingual graph structure worked.

Never include API keys, your `.env`, private task data, or raw sensitive provider logs. A configuration that passes one operation should not be reported as support for all three.

## Report a bug

Include the steps to reproduce, expected and actual behavior, browser, viewport if relevant, and whether you used a curated example, an import, or a model. An exported minimal JSON project is helpful when it contains no private material.

## License

By submitting a contribution, you agree to make it available under this project's [MIT license](LICENSE). Please contribute only material you have the right to share.

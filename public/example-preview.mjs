const EXAMPLE_IDS = Object.freeze(['writing', 'product', 'business']);

/** Only public, authored examples can be opened by a URL fragment. */
export function exampleFromHash(hash) {
  const match = typeof hash === 'string' && /^#example=([a-z]+)$/.exec(hash);
  return match && EXAMPLE_IDS.includes(match[1]) ? match[1] : null;
}

/** Share an example, never the current task, query parameters or local project. */
export function exampleShareUrl(location) {
  return `${location.origin}${location.pathname}#example=writing`;
}

/** A preview owns one independent snapshot, even when switching examples. */
export function createExamplePreview() {
  let original = null;
  return {
    get active() { return original !== null; },
    begin(workspace) { if (original === null) original = structuredClone(workspace); },
    discard() { const workspace = original; original = null; return workspace; },
    commit() { original = null; }
  };
}

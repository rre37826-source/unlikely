import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EXAMPLES } from '../public/examples.mjs';
import { text, validateGraph, validateProject, routeMatches, routeEdges } from '../public/core.mjs';
import { createExamplePreview } from '../public/example-preview.mjs';

// Execute the actual UI functions. Only the DOM, clock and model transport are replaced.
// This deliberately catches changes to app.mjs instead of testing a duplicate implementation.
const appSource = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
function sourceBetween(start, end) {
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Could not locate application source: ${start}`);
  return appSource.slice(from, to);
}
const functions = [
  sourceBetween('function keepNode(){', 'function currentCuratedRoute(){'),
  sourceBetween('function currentCuratedRoute(){', 'async function synthesize(){'),
  sourceBetween('async function synthesize(){', 'function suggestBridge(){'),
  sourceBetween('async function api(url,body,message){', 'function handleError('),
  sourceBetween('async function expand(operation){', 'function download('),
  sourceBetween('function stopTour(){', 'function tourCaption('),
  sourceBetween('function runTour(){', "$('language').onclick"),
  sourceBetween("document.addEventListener('click',", 'const canvas=')
].join('\n');

function harness() {
  const nodes = new Map();
  const timeouts = new Map();
  const calls = [];
  const persisted = [];
  const listeners = new Map();
  let now = 0;
  let nextTimer = 1;
  const dom = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', showModal() {}, close() {}, scrollIntoView() {} });
    return nodes.get(id);
  };
  const later = (fn, delay, interval = 0) => {
    const id = nextTimer++;
    timeouts.set(id, { at: now + delay, fn, interval });
    return id;
  };
  const context = {
    EXAMPLES, validateGraph, validateProject, routeMatches, routeEdges, AbortController,
    lang: 'en', exampleId: 'writing', selectedNode: 'seed', selectedEdge: null,
    project: null, brief: null, briefSource: '', tourTimers: [], requestController: null,
    examplePreview: createExamplePreview(), hasSavedProject: false, clearExampleHash() {},
    browserConnection: { model: 'ui-regression-fixture' }, provider: { configured: true },
    trialClient: {state: {available:false}}, trialState: {available:false}, updateProvider() {},
    $: dom, L: en => en, label: value => text(value, 'en'),
    document: { addEventListener: (name, fn) => listeners.set(name, fn) },
    Date: { now: () => now }, matchMedia: () => ({ matches: true }),
    setTimeout: (fn, delay) => later(fn, delay), clearTimeout: id => timeouts.delete(id),
    setInterval: (fn, delay) => later(fn, delay, delay), clearInterval: id => timeouts.delete(id),
    renderSelection() {}, renderRoute() {}, renderAll() {}, fitMap() {}, tourCaption() {}, notice() {},
    setTab(value) { context.tab = value; },
    persist() { persisted.push(structuredClone(context.project)); },
    invalidateBrief() { context.brief = null; context.briefSource = ''; },
    handleError(error) { throw error; },
    setExample(id) {
      const example = EXAMPLES.find(item => item.id === id);
      context.examplePreview.begin({project:context.project});
      context.exampleId = id;
      context.project = validateProject({ ...example, version: 1, route: [example.graph.seedId], provenance: 'curated' });
      context.selectedNode = context.project.graph.seedId;
    },
    direct: (a, b) => context.project.graph.edges.find(edge => edge.source === a && edge.target === b || edge.source === b && edge.target === a),
    fetch() { throw new Error('Unexpected local-proxy request in browser-model test.'); },
    async requestModel(operation, payload) {
      calls.push({ operation, payload: structuredClone(payload) });
      if (operation !== 'expand') return { title: 'Unexpected model synthesis', body: 'This should never run automatically.', assumptions: 'Fixture only.' };
      const graph = structuredClone(payload.project.graph);
      graph.nodes.push({ id: 'regression-new-node', cluster: graph.clusters[0].id, label: { en: 'A new possibility', zh: '新可能' }, description: { en: 'Regression fixture', zh: '回归测试' }, kind: 'concept' });
      graph.edges.push({ id: 'regression-new-edge', source: graph.seedId, target: 'regression-new-node', label: { en: 'Analogy', zh: '类比' }, reason: { en: 'Fixture relationship', zh: '测试关系' }, kind: 'analogy' });
      return { graph };
    }
  };
  context.setExample('writing');
  vm.createContext(context);
  vm.runInContext(functions, context, { filename: 'actual-app-tour-functions.mjs' });
  return {
    context, calls, persisted, listeners,
    async advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const pending = [...timeouts.entries()].filter(([, item]) => item.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
        if (!pending.length) break;
        const [id, item] = pending[0];
        now = item.at;
        timeouts.delete(id);
        if (item.interval) timeouts.set(id, { ...item, at: now + item.interval });
        item.fn();
        // Let async API continuations settle between clock events.
        for (let i = 0; i < 6; i++) await Promise.resolve();
      }
      now = target;
    }
  };
}

test('a complete curated tour makes zero model requests even when a model is connected', async () => {
  const app = harness();
  app.context.runTour();
  await app.advance(11_500);
  const route = EXAMPLES.find(example => example.id === 'writing').curatedRoutes[0];
  assert.deepEqual(app.calls, []);
  assert.deepEqual([...app.context.project.route], route.nodeIds);
  assert.equal(app.context.project.provenance, 'curated');
  assert.equal(app.context.brief.title, route.title.en);
  assert.equal(app.context.brief.body, route.output.en);
  assert.equal(app.context.briefSource, 'CURATED EXAMPLE OUTCOME');
  assert.equal(app.context.examplePreview.active, true);
  await app.advance(3_500);
  assert.equal(app.context.tourTimers.length, 0);
});

test('expanding during the tour cancels its later steps and never automatically synthesizes or rewrites the route', async () => {
  const app = harness();
  app.context.runTour();
  await app.advance(6_000);
  const routeBeforeExpansion = [...app.context.project.route];
  assert.ok(routeBeforeExpansion.length > 1, 'The test must interrupt a tour that has already advanced.');
  await app.context.expand('analogy');
  assert.equal(app.context.project.graph.nodes.length, 32);
  assert.equal(app.context.project.provenance, 'model');
  assert.equal(app.context.examplePreview.active, false, 'Explicit model work becomes the saved workspace.');
  assert.deepEqual([...app.context.project.route], routeBeforeExpansion);
  await app.advance(30_000);
  assert.deepEqual(app.calls.map(call => call.operation), ['expand']);
  assert.deepEqual([...app.context.project.route], routeBeforeExpansion);
  assert.equal(app.context.brief, null);
  assert.ok(app.context.project.graph.nodes.some(node => node.id === 'regression-new-node'));
  assert.equal(app.context.requestController, null);
  assert.equal(app.context.tourTimers.length, 0);
});

test('choosing a route node or another button stops the tour before it can replace a user choice', async () => {
  for (const interaction of ['keep-node', 'button']) {
    const app = harness();
    app.context.runTour();
    await app.advance(4_000);
    if (interaction === 'keep-node') {
      app.context.selectedNode = EXAMPLES[0].curatedRoutes[0].nodeIds.at(-1);
      app.context.keepNode();
    } else app.listeners.get('click')({ target: { closest: selector => selector === 'button' ? {} : null } });
    const selected = app.context.selectedNode;
    const route = [...app.context.project.route];
    await app.advance(20_000);
    assert.equal(app.context.selectedNode, selected);
    assert.deepEqual([...app.context.project.route], route);
    assert.equal(app.context.brief, null);
    assert.equal(app.context.tourTimers.length, 0);
    assert.deepEqual(app.calls, []);
  }
});

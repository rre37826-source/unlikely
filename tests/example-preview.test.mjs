import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EXAMPLES } from '../public/examples.mjs';
import { validateGraph, validateProject } from '../public/core.mjs';
import { createExamplePreview, exampleFromHash, exampleShareUrl } from '../public/example-preview.mjs';

const STORE = 'unlikely.workspace.v1';
const source = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
function between(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
}
const functions = [
  between('function localStorageSafe(', 'function notice('),
  between('function setExample(', 'function updateProvider('),
  between('async function generateTask(', 'async function expand('),
  between('function importFile(', 'function stopTour(')
].join('\n');

function harness({ saved = true, writeFails = false } = {}) {
  const previous = validateProject({ ...EXAMPLES[1], version: 1, title: 'PRIVATE_WORKSPACE', route: EXAMPLES[1].curatedRoutes[0].nodeIds, provenance: 'model' });
  const data = new Map(saved ? [[STORE, JSON.stringify({ project: previous, exampleId: null, brief: { title: 'Saved draft', body: 'Private body', assumptions: 'Keep this' }, briefSource: 'saved-source' })]] : []);
  const writes = [];
  const elements = new Map();
  const makeElement = tag => ({ tag, hidden: false, dataset: {}, attributes: {}, children: [],
    setAttribute(name, value) { this.attributes[name] = value; },
    replaceChildren(...children) { this.children = children; },
    insertAdjacentElement(position, element) { elements.set(element.id, element); },
    scrollIntoView() { this.scrolled = true; }, focus() { this.focused = true; }, select() { this.selected = true; }
  });
  const dom = id => {
    if (id === 'feature-share-fallback' && !elements.has(id)) return null;
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const steps = ['0', '1', '2'].map(value => ({ ...makeElement('button'), dataset: { featureStep: value } }));
  const panels = ['0', '1', '2'].map(value => ({ ...makeElement('article'), dataset: { featurePanel: value } }));
  let modelCalls = 0;
  const context = {
    EXAMPLES, validateGraph, validateProject, STORE, examplePreview: createExamplePreview(), exampleFromHash, exampleShareUrl,
    project: validateProject({ ...EXAMPLES[0], version: 1, route: ['seed'], provenance: 'curated' }),
    exampleId: 'writing', brief: null, briefSource: '', selectedNode: 'seed', selectedEdge: null,
    tab: 'explore', hasSavedProject: false, page: 'home', pendingBridge: null, requestController: null,
    lang: 'en', persistenceAvailable: true, $: dom, L: en => en,
    location: { origin: 'https://example.github.io', pathname: '/unlikely/', search: '?secret=private', hash: '#private-task' },
    history: { state: { navigation: 'unchanged' }, replaceState(state, title, path) { context.history.lastPath=path;context.history.lastState=state;context.location.hash=''; } },
    navigator: { clipboard: { async writeText() { throw Error('Clipboard unavailable'); } } },
    localStorage: { getItem: key => data.get(key) ?? null, setItem(key, value) { if (writeFails && key === STORE) throw Error('Storage full'); writes.push(key); data.set(key, value); } },
    document: { querySelectorAll: selector => selector === '[data-feature-step]' ? steps : selector === '[data-feature-panel]' ? panels : [] },
    window: { scrollTo() {} }, requestAnimationFrame() {}, fitMap() {},
    renderAll() {}, updateLanguage() { context.updateSaveStatus(); },
    stopTour() {}, notice(message) { context.lastNotice = message; },
    provider: { configured: true }, handleError(error) { context.lastError = error; },
    invalidateBrief() { context.brief = null; context.briefSource = ''; },
    setTab(value) { context.tab = value; }, matchMedia: () => ({ matches: true }),
    el(tag, className, text) { return { ...makeElement(tag), textContent: text }; },
    fetch() { modelCalls++; throw Error('No example interaction may invoke a model'); },
    requestModel() { modelCalls++; throw Error('No example interaction may invoke a model'); }
  };
  vm.createContext(context);
  vm.runInContext(functions, context, { filename: 'actual-app-preview-functions.mjs' });
  context.restore();
  return { context, data, writes, elements, steps, panels, modelCalls: () => modelCalls };
}

test('only allowlisted example fragments open a public example; shared links contain no workspace or query', () => {
  for (const id of ['writing', 'product', 'business']) assert.equal(exampleFromHash(`#example=${id}`), id);
  for (const hash of ['', '#example=private', '#example=writing&task=secret', '#example=writing&example=product', '#example=%77riting', '#task=writing', null]) assert.equal(exampleFromHash(hash), null);
  assert.equal(exampleShareUrl({ origin: 'https://example.github.io', pathname: '/unlikely/', search: '?key=PRIVATE', hash: '#PRIVATE' }), 'https://example.github.io/unlikely/#example=writing');
});

test('opening, editing and switching previews preserve the real saved workspace, then home restores it', () => {
  const app = harness();
  const original = app.data.get(STORE);
  const previous = JSON.stringify(app.context.project);
  app.context.location.hash='#example=writing';
  app.context.setExample(exampleFromHash('#example=writing'));
  app.context.project.route.push('motif');
  app.context.brief = { title: 'Preview draft', body: 'Temporary', assumptions: 'Example' };
  app.context.lang = 'zh';
  app.context.persist();
  app.context.setExample('business');
  assert.equal(app.data.get(STORE), original);
  assert.ok(app.writes.every(key => key === 'unlikely.language'));
  assert.equal(app.context.examplePreview.active, true);
  assert.equal(app.elements.get('feature-preview-note').hidden, false);
  app.context.showHome();
  assert.equal(app.context.location.hash, '');
  assert.equal(app.context.history.lastPath, '/unlikely/?secret=private');
  assert.deepEqual(app.context.history.lastState, { navigation: 'unchanged' });
  assert.equal(app.context.examplePreview.active, false);
  assert.equal(JSON.stringify(app.context.project), previous);
  assert.equal(app.context.brief.title, 'Saved draft');
  assert.equal(app.context.briefSource, 'saved-source');
  assert.equal(app.context.hasSavedProject, true);
  app.context.showWorkspace();
  assert.equal(app.context.project.title, 'PRIVATE_WORKSPACE');
  assert.equal(app.data.get(STORE), original);
  assert.equal(app.modelCalls(), 0);
});

test('saving a preview explicitly replaces the stored map and prevents home from restoring the old one', () => {
  const app = harness();
  app.context.location.hash='#example=writing';
  app.context.setExample('writing');
  app.context.project.route = [...EXAMPLES[0].curatedRoutes[0].nodeIds];
  app.context.brief = { title: 'Chosen route', body: 'My preview changes', assumptions: 'Example' };
  app.context.saveExamplePreview();
  assert.equal(app.context.examplePreview.active, false);
  assert.equal(app.context.location.hash, '');
  const saved = JSON.parse(app.data.get(STORE));
  assert.deepEqual(saved.project.route, EXAMPLES[0].curatedRoutes[0].nodeIds);
  assert.equal(saved.brief.body, 'My preview changes');
  assert.equal(app.elements.get('feature-save').hidden, true);
  app.context.showHome();
  assert.equal(app.context.brief.title, 'Chosen route');
  assert.equal(app.context.exampleId, 'writing');
  assert.equal(app.modelCalls(), 0);
});

test('a failed explicit save retains preview status and the previous workspace', () => {
  const app = harness({ writeFails: true });
  const original = app.data.get(STORE);
  app.context.setExample('writing');
  app.context.saveExamplePreview();
  assert.equal(app.context.examplePreview.active, true);
  assert.equal(app.data.get(STORE), original);
  assert.match(app.context.lastNotice, /Could not save/);
  app.context.showHome();
  assert.equal(app.context.project.title, 'PRIVATE_WORKSPACE');
});

test('a new visitor can discard a preview without creating a saved map or a resume action', () => {
  const app = harness({ saved: false });
  app.context.persist();
  assert.equal(app.data.has(STORE), false, 'Changing language on the initial home page does not save the hidden default map.');
  app.context.setExample('product');
  app.context.persist();
  assert.equal(app.data.has(STORE), false);
  app.context.showHome();
  assert.equal(app.context.hasSavedProject, false);
  assert.equal(app.elements.get('resume-work').hidden, true);
});

test('model work in progress prevents deep-linked examples from changing its project', () => {
  const app = harness();
  app.context.requestController = {};
  assert.equal(app.context.setExample('writing'), false);
  assert.equal(app.context.project.title, 'PRIVATE_WORKSPACE');
  assert.equal(app.context.examplePreview.active, false);
});

test('an explicitly generated or imported project survives leaving preview; failed generation preserves the previous workspace', async () => {
  for (const operation of ['generate', 'import', 'failure']) {
    const app = harness();
    const original = app.data.get(STORE);
    app.context.location.hash='#example=writing';
    app.context.setExample('writing');
    if (operation === 'import') {
      const imported = validateProject({ ...EXAMPLES[2], version: 1, title: 'Imported work', route: ['seed'], provenance: 'curated' });
      app.context.importFile({ size: 100, async text() { return JSON.stringify(imported); } });
      await new Promise(resolve => setImmediate(resolve));
    } else {
      app.context.$('task-input').value = 'An explicit new task';
      app.context.$('seed-input').value = '';
      app.context.$('constraints-input').value = 'Keep the generated result';
      app.context.api = async () => {
        if (operation === 'failure') throw Error('Fixture failure');
        return { graph: EXAMPLES[2].graph };
      };
      await app.context.generateTask();
    }
    if (operation === 'failure') {
      assert.equal(app.context.examplePreview.active, true);
      assert.equal(app.context.location.hash, '#example=writing');
      assert.equal(app.data.get(STORE), original);
      app.context.showHome();
      assert.equal(app.context.project.title, 'PRIVATE_WORKSPACE');
    } else {
      assert.equal(app.context.examplePreview.active, false);
      assert.equal(app.context.location.hash, '');
      assert.equal(app.context.hasSavedProject, true);
      app.context.showHome();
      assert.equal(app.context.project.title, operation === 'import' ? 'Imported work' : 'An explicit new task');
      assert.equal(JSON.parse(app.data.get(STORE)).project.title, app.context.project.title);
      assert.equal(app.context.exampleId, null);
    }
  }
});

test('the three feature panels expose the selected step and sharing has a selectable fallback', async () => {
  const app = harness();
  app.context.selectFeatureStep('2');
  assert.deepEqual(app.panels.map(panel => panel.hidden), [true, true, false]);
  assert.deepEqual(app.steps.map(step => step.attributes['aria-pressed']), ['false', 'false', 'true']);
  app.context.selectFeatureStep('0');
  assert.deepEqual(app.panels.map(panel => panel.hidden), [false, true, true]);
  await app.context.shareFeaturedExample();
  const input = app.elements.get('feature-share-fallback').children[1];
  assert.equal(input.value, 'https://example.github.io/unlikely/#example=writing');
  assert.equal(input.readOnly, true);
  assert.equal(input.selected, true);
  assert.equal(app.data.has('unlikely.language'), false);
  assert.equal(app.modelCalls(), 0);
});

test('preview snapshots are independent and only the first workspace is restored', () => {
  const preview = createExamplePreview();
  const workspace = { project: { route: ['seed'] } };
  preview.begin(workspace);
  workspace.project.route.push('changed');
  preview.begin({ project: { route: ['another-preview'] } });
  assert.deepEqual(preview.discard(), { project: { route: ['seed'] } });
  assert.equal(preview.discard(), null);
  preview.begin(workspace);
  preview.commit();
  assert.equal(preview.discard(), null);
});

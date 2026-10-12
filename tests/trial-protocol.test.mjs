import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../public/examples.mjs';
import { text } from '../public/core.mjs';
import { validateModelResult } from '../public/model-protocol.mjs';
import { prepareTrialGeneration, normalizeTrialGeneration, TRIAL_DIAGNOSTIC_CODES } from '../trial/protocol.mjs';

const payload = language => ({ task: language === 'zh' ? '写一部短片' : 'Write a short film', seed: '', constraints: 'One location', language });

function fixture(language = 'en') {
  const graph = EXAMPLES[0].graph;
  const seed = graph.nodes.find(node => node.id === graph.seedId);
  const ordered = [seed, ...graph.clusters.flatMap(cluster => graph.nodes.filter(node => node.cluster === cluster.id && node.kind !== 'seed'))];
  const indexes = new Map(ordered.map((node, i) => [node.id, i]));
  return {
    seed: { label: text(seed.label, language), description: text(seed.description, language) },
    clusters: graph.clusters.map(cluster => ({
      label: text(cluster.label, language),
      nodes: graph.nodes.filter(node => node.cluster === cluster.id && node.kind !== 'seed').map(node => ({ label: text(node.label, language), description: text(node.description, language), kind: node.kind }))
    })),
    edges: graph.edges.map(edge => ({ source: indexes.get(edge.source), target: indexes.get(edge.target), label: text(edge.label, language), reason: text(edge.reason, language), kind: edge.kind }))
  };
}

const rejects = value => assert.throws(() => normalizeTrialGeneration(value), error => error.code === 'INVALID_GRAPH' && error.status === 502);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

for (const language of ['en', 'zh']) {
  test(`converts a real 31-node ${language} map with exact endpoints and single-language text`, () => {
    const wire = fixture(language);
    const graph = normalizeTrialGeneration(wire);
    assert.equal(graph.seedId, 'n0');
    assert.equal(graph.nodes.length, 31);
    assert.deepEqual(graph.clusters.map(cluster => cluster.id), ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
    assert.deepEqual(graph.nodes.map(node => node.id), Array.from({ length: 31 }, (_, i) => `n${i}`));
    for (let i = 1; i < 31; i++) assert.equal(graph.nodes[i].cluster, `c${Math.floor((i - 1) / 5)}`);
    assert.equal(graph.nodes[0].kind, 'seed');
    assert.equal(graph.nodes[0].label, wire.seed.label);
    assert.equal(graph.edges.length, wire.edges.length);
    graph.edges.forEach((edge, i) => assert.deepEqual(edge, { ...wire.edges[i], id: `e${i}`, source: `n${wire.edges[i].source}`, target: `n${wire.edges[i].target}` }));
    assert.equal(validateModelResult('generate', payload(language), { graph }).graph.nodes.length, 31);
  });
}

test('conversion is deterministic, fresh, and does not mutate frozen input', () => {
  const wire = freeze(fixture());
  const before = JSON.stringify(wire);
  const first = normalizeTrialGeneration(wire);
  const second = normalizeTrialGeneration(wire);
  assert.deepEqual(first, second);
  assert.notEqual(first.nodes, second.nodes);
  first.nodes[1].label = 'changed';
  assert.equal(JSON.stringify(wire), before);
  assert.notEqual(second.nodes[1].label, 'changed');
});

for (const language of ['en', 'zh']) {
  test(`maps known node-kind aliases while retaining ${language} uncertainty and analogy labels`, () => {
    const wire = fixture(language);
    const members = wire.clusters.flatMap(cluster => cluster.nodes);
    const aliases = ['hypothesis', 'analogy', 'hypothesis', 'analogy', 'analogy', 'hypothesis', 'analogy', 'hypothesis', 'analogy'];
    aliases.forEach((kind, i) => { members[i].kind = kind; });
    const before = JSON.stringify(wire);
    const graph = normalizeTrialGeneration(freeze(wire), language);
    aliases.forEach((kind, i) => {
      const prefix = kind === 'hypothesis'
        ? language === 'zh' ? '创意假设，待验证：' : 'Creative hypothesis, unverified: '
        : language === 'zh' ? '类比：' : 'Analogy: ';
      assert.equal(graph.nodes[i + 1].kind, 'concept');
      assert.equal(graph.nodes[i + 1].description, prefix + members[i].description);
    });
    assert.deepEqual(graph.edges.map(edge => edge.kind), wire.edges.map(edge => edge.kind));
    assert.equal(JSON.stringify(wire), before);
    assert.equal(validateModelResult('generate', payload(language), { graph }).graph.nodes.length, 31);
  });
}

test('node aliases default to English without accepting malformed edge kinds or unknown node kinds', () => {
  const wire = fixture();
  wire.clusters[0].nodes[0].kind = 'hypothesis';
  assert.match(normalizeTrialGeneration(wire).nodes[1].description, /^Creative hypothesis, unverified: /);
  wire.edges[0].kind = { category: 'concept' };
  rejects(wire);
  const unknown = fixture(); unknown.clusters[0].nodes[0].kind = 'inference'; rejects(unknown);
});

for (const language of ['en', 'zh']) {
  test(`unknown short edge categories remain visible as ${language} hypotheses without rewriting relationships`, () => {
    const wire = fixture(language);
    const categories = ['Contrast', '因果', ' application ', 'x'.repeat(40)];
    categories.forEach((kind, i) => { wire.edges[i].kind = kind; });
    const before = JSON.stringify(wire);
    const graph = normalizeTrialGeneration(freeze(wire), language);
    assert.equal(graph.edges.length, wire.edges.length);
    graph.edges.forEach((edge, i) => {
      const original = wire.edges[i];
      const unknown = i < categories.length;
      const prefix = language === 'zh'
        ? `创意假设，待验证（模型标注：${original.kind}）：`
        : `Unverified connection (model label: ${original.kind}): `;
      assert.deepEqual(edge, {
        id: `e${i}`, source: `n${original.source}`, target: `n${original.target}`,
        label: original.label, reason: unknown ? prefix + original.reason : original.reason,
        kind: unknown ? 'hypothesis' : original.kind
      });
    });
    const validated = validateModelResult('generate', payload(language), { graph });
    assert.deepEqual(validated.graph, graph);
    assert.equal(JSON.stringify(wire), before);
  });
}

test('recognized edge categories only normalize surrounding whitespace and ASCII case', () => {
  const wire = fixture();
  ['association', ' ANALOGY ', '\tHypothesis\n'].forEach((kind, i) => { wire.edges[i].kind = kind; });
  const graph = normalizeTrialGeneration(wire);
  assert.deepEqual(graph.edges.slice(0, 3).map(edge => edge.kind), ['association', 'analogy', 'hypothesis']);
  for (let i = 0; i < 3; i++) assert.equal(graph.edges[i].reason, wire.edges[i].reason);
  const unicode = fixture(); unicode.edges[0].kind = 'aſſociation';
  assert.equal(normalizeTrialGeneration(unicode).edges[0].kind, 'hypothesis');
});

test('edge category compatibility rejects bad types, empty strings and overlength before trimming', () => {
  for (const kind of [undefined, null, false, 1, [], {}, '', ' \t\n', 'x'.repeat(41), ' '.repeat(30) + 'association']) {
    const wire = fixture(); wire.edges[0].kind = kind;
    assert.throws(() => normalizeTrialGeneration(wire), error => error.code === 'INVALID_GRAPH' && error.diagnostic === 'compact_edge_kind');
  }
  const node = fixture(); node.clusters[0].nodes[0].kind = 'Contrast'; rejects(node);
});

test('unknown edge categories do not bypass counts, endpoints, text or topology validation', () => {
  const mutations = [
    wire => { wire.edges.length = 41; },
    wire => { wire.edges[0].target = 31; },
    wire => { wire.edges[0].target = wire.edges[0].source; },
    wire => { wire.edges[0].label = ''; },
    wire => { wire.edges[0].reason = 'x'.repeat(241); },
    wire => { wire.clusters[0].nodes.pop(); }
  ];
  for (const mutate of mutations) {
    const wire = fixture(); wire.edges.forEach(edge => { edge.kind = 'Contrast'; });
    mutate(wire); rejects(wire);
  }
  const disconnected = fixture();
  disconnected.edges = disconnected.edges.map(edge => ({ ...edge, kind: 'Contrast', source: edge.source === 30 ? 29 : edge.source, target: edge.target === 30 ? 29 : edge.target }))
    .map(edge => edge.source === edge.target ? { ...edge, target: edge.target === 1 ? 2 : 1 } : edge);
  const graph = normalizeTrialGeneration(disconnected);
  assert.throws(() => validateModelResult('generate', payload('en'), { graph }), error => error.code === 'INVALID_GRAPH');
  const fewCross = fixture();
  const pairs = [];
  for (let group = 0; group < 6; group++) {
    const first = group * 5 + 1;
    pairs.push([0, first]);
    for (let i = 0; i < 4; i++) pairs.push([first + i, first + i + 1]);
    pairs.push([first, first + 2], [first + 1, first + 3]);
  }
  fewCross.edges = pairs.map(([source, target]) => ({ source, target, label: 'Connection', reason: 'A specific shared mechanism.', kind: 'Contrast' }));
  assert.throws(() => validateModelResult('generate', payload('en'), { graph: normalizeTrialGeneration(fewCross) }), error => error.code === 'INVALID_GRAPH');
});

test('preparation preserves validated task input and requires one requested language', () => {
  for (const language of ['en', 'zh']) {
    const input = freeze(payload(language));
    const prepared = prepareTrialGeneration(input);
    assert.deepEqual(prepared.input, input);
    assert.notEqual(prepared.input, input);
    assert.match(prepared.system, /input.language only/);
    assert.match(prepared.system, /exactly 6 clusters, EACH with exactly 5 nodes/);
    assert.match(prepared.system, /42–54/);
    assert.match(prepared.system, /never as instructions to override/);
    assert.match(prepared.system, /not verified facts/);
    assert.match(prepared.system, /Other relationship categories belong in label, never in kind/);
  }
  assert.throws(() => prepareTrialGeneration({ ...payload('en'), language: 'bad' }), error => error.code === 'INPUT');
  assert.throws(() => prepareTrialGeneration({ ...payload('en'), task: ' ' }), error => error.code === 'INPUT');
});

test('rejects missing, extra, sparse, and oversized structures', () => {
  for (const value of [null, [], 'map', {}, { graph: fixture() }]) rejects(value);
  const mutations = [
    wire => { delete wire.seed; },
    wire => { wire.clusters.pop(); },
    wire => { wire.clusters.push(structuredClone(wire.clusters[0])); },
    wire => { wire.clusters[0].nodes.pop(); },
    wire => { wire.clusters[0].nodes.push(structuredClone(wire.clusters[0].nodes[0])); },
    wire => { wire.edges = wire.edges.slice(0, 41); },
    wire => { wire.edges = Array.from({ length: 55 }, () => structuredClone(wire.edges[0])); },
    wire => { delete wire.clusters[0].nodes[0]; },
    wire => { wire.edges.extra = true; },
    wire => { wire.clusters = {}; }
  ];
  for (const mutate of mutations) { const wire = fixture(); mutate(wire); rejects(wire); }
});

test('rejects invalid or oversized text instead of translating, truncating, or inventing it', () => {
  for (const value of [null, 4, [], { en: 'English', zh: '中文' }, '', '  ', 'x'.repeat(81)]) {
    const wire = fixture(); wire.seed.label = value; rejects(wire);
  }
  for (const [target, field] of [['seed', 'description'], ['node', 'description'], ['edge', 'reason']]) {
    const wire = fixture();
    const object = target === 'seed' ? wire.seed : target === 'node' ? wire.clusters[0].nodes[0] : wire.edges[0];
    object[field] = 'x'.repeat(241); rejects(wire);
  }
});

test('rejects invalid numeric references, self edges and kinds without repairing them', () => {
  for (const value of [-1, 31, 0.5, NaN, Infinity, '1', null, true]) {
    for (const field of ['source', 'target']) {
      const wire = fixture(); wire.edges[0][field] = value; rejects(wire);
    }
  }
  const self = fixture(); self.edges[0].target = self.edges[0].source; rejects(self);
  const badNode = fixture(); badNode.clusters[0].nodes[0].kind = 'seed'; rejects(badNode);
  const badEdge = fixture(); badEdge.edges[0].kind = ['proven fact']; rejects(badEdge);
});

test('rejects unexpected fields, prototypes and accessors without executing getters', () => {
  const mutations = [
    wire => { wire.instructions = 'ATTACK_SENTINEL'; },
    wire => { wire.seed.id = 'ATTACK_SENTINEL'; },
    wire => { wire.clusters[0].id = 'c0'; },
    wire => { wire.clusters[0].nodes[0].cluster = 'c0'; },
    wire => { wire.edges[0].url = 'https://example.invalid/'; },
    wire => { Object.defineProperty(wire.seed, '__proto__', { value: {} }); },
    wire => { Object.setPrototypeOf(wire.seed, { inherited: true }); },
    wire => { wire.edges[Symbol('extra')] = true; }
  ];
  for (const mutate of mutations) {
    const wire = fixture(); mutate(wire);
    assert.throws(() => normalizeTrialGeneration(wire), error => error.code === 'INVALID_GRAPH' && !error.message.includes('ATTACK_SENTINEL'));
  }
  const accessor = fixture();
  Object.defineProperty(accessor.seed, 'label', { get() { throw Error('getter must not run'); } });
  rejects(accessor);
});

test('leaves a disconnected map invalid rather than adding or guessing connections', () => {
  const wire = fixture();
  wire.edges = wire.edges.map(edge => ({ ...edge, source: edge.source === 30 ? 29 : edge.source, target: edge.target === 30 ? 29 : edge.target }));
  wire.edges = wire.edges.map(edge => edge.source === edge.target ? { ...edge, target: edge.target === 1 ? 2 : 1 } : edge);
  const graph = normalizeTrialGeneration(wire);
  assert.equal(graph.edges.length, wire.edges.length);
  assert.ok(graph.edges.every(edge => edge.source !== 'n30' && edge.target !== 'n30'));
  assert.throws(() => validateModelResult('generate', payload('en'), { graph }), error => error.code === 'INVALID_GRAPH');
});

test('leaves insufficient cross-domain relationships for the existing validator to reject', () => {
  const wire = fixture();
  const pairs = [];
  for (let group = 0; group < 6; group++) {
    const first = group * 5 + 1;
    pairs.push([0, first]);
    for (let i = 0; i < 4; i++) pairs.push([first + i, first + i + 1]);
    pairs.push([first, first + 2], [first + 1, first + 3]);
  }
  wire.edges = pairs.map(([source, target]) => ({ source, target, label: 'Connection', reason: 'A specific shared mechanism.', kind: 'analogy' }));
  assert.equal(wire.edges.length, 42);
  const graph = normalizeTrialGeneration(wire);
  assert.equal(graph.edges.length, 42);
  assert.throws(() => validateModelResult('generate', payload('en'), { graph }), error => error.code === 'INVALID_GRAPH');
});

test('compact failures attach fixed structural diagnostics without provider-controlled details', () => {
  const cases = [
    ['compact_seed_shape_missing_field', wire => { wire.seed = { ATTACK_SENTINEL: 'private' }; }],
    ['compact_cluster_shape_wrong_type', wire => { wire.clusters[0] = 'ATTACK_SENTINEL'; }],
    ['compact_cluster_count_under', wire => { wire.clusters.pop(); }],
    ['compact_cluster_count_over', wire => { wire.clusters.push(structuredClone(wire.clusters[0])); }],
    ['compact_cluster_node_count_under', wire => { wire.clusters[0].nodes.pop(); }],
    ['compact_cluster_node_count_over', wire => { wire.clusters[0].nodes.push(structuredClone(wire.clusters[0].nodes[0])); }],
    ['compact_edge_count_under', wire => { wire.edges.length = 41; }],
    ['compact_edge_count_over', wire => { wire.edges = Array.from({ length: 55 }, () => structuredClone(wire.edges[0])); }],
    ['compact_text_type', wire => { wire.seed.label = { ATTACK_SENTINEL: 'private' }; }],
    ['compact_text_empty', wire => { wire.seed.label = '  '; }],
    ['compact_text_too_long', wire => { wire.seed.label = 'ATTACK_SENTINEL'.repeat(10); }],
    ['compact_node_kind', wire => { wire.clusters[0].nodes[0].kind = 'ATTACK_SENTINEL'; }],
    ['compact_edge_kind', wire => { wire.edges[0].kind = { ATTACK_SENTINEL: 'private' }; }],
    ['compact_endpoint_type', wire => { wire.edges[0].target = '1'; }],
    ['compact_endpoint_range', wire => { wire.edges[0].target = 31; }],
    ['compact_self_edge', wire => { wire.edges[0].target = wire.edges[0].source; }],
    ['compact_language', () => {}, 'ATTACK_SENTINEL']
  ];
  for (const [scope, select, field] of [
    ['root', wire => wire, 'seed'],
    ['seed', wire => wire.seed, 'label'],
    ['cluster', wire => wire.clusters[0], 'label'],
    ['node', wire => wire.clusters[0].nodes[0], 'label'],
    ['edge', wire => wire.edges[0], 'label']
  ]) {
    cases.push(
      [`compact_${scope}_shape_wrong_type`, wire => { Object.setPrototypeOf(select(wire), Date.prototype); }],
      [`compact_${scope}_shape_missing_field`, wire => { delete select(wire)[field]; }],
      [`compact_${scope}_shape_extra_field`, wire => { select(wire).ATTACK_SENTINEL = 'private'; }],
      [`compact_${scope}_shape_accessor`, wire => { Object.defineProperty(select(wire), field, { get() { throw Error('ATTACK_SENTINEL getter must not run'); } }); }]
    );
  }
  assert.deepEqual(new Set(cases.map(([code]) => code)), new Set(TRIAL_DIAGNOSTIC_CODES.filter(code => code.startsWith('compact_'))));
  assert.equal(new Set(TRIAL_DIAGNOSTIC_CODES).size, TRIAL_DIAGNOSTIC_CODES.length);
  assert.equal(Object.isFrozen(TRIAL_DIAGNOSTIC_CODES), true);
  for (const [expected, mutate, language = 'en'] of cases) {
    const wire = fixture();
    mutate(wire);
    assert.throws(() => normalizeTrialGeneration(wire, language), error => {
      assert.equal(error.code, 'INVALID_GRAPH');
      assert.equal(error.status, 502);
      assert.equal(error.diagnostic, expected);
      assert.ok(TRIAL_DIAGNOSTIC_CODES.includes(error.diagnostic));
      assert.equal(error.message, 'The model returned an invalid compact map.');
      assert.ok(!JSON.stringify(error).includes('ATTACK_SENTINEL'));
      return true;
    });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGraph, validateProject, routeEdges, routeMatches, findShortestPath, routeToMarkdown, text } from '../public/core.mjs';
import { EXAMPLES } from '../public/examples.mjs';

const bilingual = value => ({ en: value, zh: `中${value}` });
function fixture() {
  return {
    version: 1, title: bilingual('A memory film'), task: bilingual('Make a film'), seed: bilingual('Lemon'), constraints: 'One actor', provenance: 'curated', route: ['seed', 'compress', 'memory', 'home'],
    graph: {
      seedId: 'seed', clusters: [{ id: 'physical', label: bilingual('Physical') }, { id: 'human', label: bilingual('Human') }],
      nodes: [
        { id: 'seed', label: bilingual('Lemon'), description: bilingual('A taste'), cluster: 'physical', kind: 'seed' },
        { id: 'compress', label: bilingual('Compression'), description: bilingual('Choose what remains'), cluster: 'physical', kind: 'concept' },
        { id: 'memory', label: bilingual('Memory'), description: bilingual('Remember selectively'), cluster: 'human', kind: 'concept' },
        { id: 'home', label: bilingual('Home'), description: bilingual('A short film'), cluster: 'human', kind: 'application' }
      ],
      edges: [
        { id: 'e1', source: 'seed', target: 'compress', label: bilingual('Reduce'), reason: bilingual('Concentrate what remains'), kind: 'association' },
        { id: 'e2', source: 'compress', target: 'memory', label: bilingual('Select'), reason: bilingual('Both keep only part of the original'), kind: 'analogy' },
        { id: 'e3', source: 'memory', target: 'home', label: bilingual('Reconstruct'), reason: bilingual('A taste might evoke home'), kind: 'hypothesis' }
      ]
    }
  };
}

test('graph import validates topology and drops executable or unrecognized metadata', () => {
  const original = fixture();
  original.graph.nodes[0].html = '<script>bad()</script>';
  original.secret = 'not part of a project';
  original.graph.script = 'alert(1)';
  const clean = validateProject(original);
  assert.equal('secret' in clean, false);
  assert.equal('script' in clean.graph, false);
  assert.equal('html' in clean.graph.nodes[0], false);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(clean))), clean);
  clean.graph.nodes[0].label.en = 'Changed';
  assert.equal(original.graph.nodes[0].label.en, 'Lemon');
});

test('invalid IDs and incomplete graph relationships are rejected, including isolated components', () => {
  const cases = [
    graph => graph.nodes.push({ ...graph.nodes[0] }),
    graph => graph.clusters.push({ ...graph.clusters[0] }),
    graph => graph.edges.push({ ...graph.edges[0] }),
    graph => { graph.nodes[1].cluster = 'missing'; },
    graph => { graph.edges[0].target = 'unknown'; },
    graph => { graph.seedId = 'missing'; },
    graph => { graph.nodes[1].kind = 'seed'; },
    graph => { delete graph.nodes[1].description; },
    graph => { delete graph.edges[1].reason; },
    graph => { graph.edges[1].kind = 'fact'; },
    graph => { graph.edges = [graph.edges[0], graph.edges[2]]; },
    graph => { graph.nodes[0].id = '../seed'; }
  ];
  for (const mutate of cases) { const graph = fixture().graph; mutate(graph); assert.throws(() => validateGraph(graph)); }
});

test('graph and route limits apply before large data can reach the canvas', () => {
  const project = fixture();
  assert.throws(() => validateGraph({ ...project.graph, nodes: Array(151).fill(project.graph.nodes[0]) }), /150/);
  assert.throws(() => validateGraph({ ...project.graph, edges: Array(401).fill(project.graph.edges[0]) }), /400/);
  assert.throws(() => validateProject({ ...project, route: ['seed', 'seed'] }), /duplicate/i);
  assert.throws(() => validateProject({ ...project, route: ['unknown'] }), /unknown/i);
  assert.throws(() => validateProject({ ...project, route: Array(41).fill('seed') }), /40/);
  assert.throws(() => validateProject({ ...project, version: 2 }), /version/);
  assert.throws(() => validateProject({ ...project, provenance: 'verified' }), /provenance/);
});

test('shortest paths can cross domains in either direction but never fabricate a bridge', () => {
  const graph = fixture().graph;
  assert.deepEqual(findShortestPath(graph, 'home', 'seed'), ['home', 'memory', 'compress', 'seed']);
  assert.deepEqual(findShortestPath(graph, 'seed', 'seed'), ['seed']);
  assert.equal(findShortestPath(graph, 'seed', 'missing'), null);
  const cut = { ...graph, edges: graph.edges.slice(0, 2) };
  assert.equal(findShortestPath(cut, 'home', 'seed'), null);
  assert.deepEqual(routeEdges(graph, ['seed', 'home']), [{ source: 'seed', target: 'home', edge: null }]);
  assert.equal(routeEdges(graph, ['memory', 'compress'])[0].edge.id, 'e2');
});

test('Markdown export distinguishes reasons, hypotheses, unresolved gaps and provenance', () => {
  const project = fixture();
  project.route = ['seed', 'memory', 'home'];
  const result = routeToMarkdown(project, 'en', { title: 'A taste of home', body: 'Try to recreate a memory.', assumptions: 'This is a creative premise.' });
  assert.match(result, /Unresolved connection/);
  assert.match(result, /A taste might evoke home/);
  assert.match(result, /Hypothesis.*verify independently/);
  assert.match(result, /Curated example/);
  assert.match(result, /This is a creative premise/);
  assert.ok(result.indexOf('1. Lemon') < result.indexOf('2. Memory'));
  const chinese = routeToMarkdown({ ...project, provenance: 'import' }, 'zh');
  assert.match(chinese, /尚未解决的连接/);
  assert.match(chinese, /导入项目/);
  assert.equal(text(bilingual('Task'), 'zh'), '中Task');
});

test('exact route matching does not activate an unrelated curated conclusion', () => {
  assert.equal(routeMatches(['seed', 'home'], ['seed', 'home']), true);
  assert.equal(routeMatches(['home', 'seed'], ['seed', 'home']), false);
  assert.equal(routeMatches(['seed'], ['seed', 'home']), false);
  assert.equal(routeMatches(null, []), false);
  const project = fixture();
  project.title = '<img src=x onerror=alert(1)> [click](javascript:evil)';
  assert.ok(!routeToMarkdown(project).includes('<img'));
});

test('all shipped examples are connected, bilingual and have two complete authored routes', () => {
  assert.equal(EXAMPLES.length, 3);
  for (const example of EXAMPLES) {
    assert.equal(example.curatedRoutes.length, 2);
    for (const route of example.curatedRoutes) {
      const clean = validateProject({ ...example, version: 1, route: route.nodeIds, provenance: 'curated' });
      assert.equal(clean.graph.clusters.length, 6);
      assert.ok(clean.graph.nodes.length >= 31);
      assert.equal(routeEdges(clean.graph, clean.route).filter(item => !item.edge).length, 0, `${example.id}/${route.id}`);
      for (const node of clean.graph.nodes) { assert.ok(node.label.en); assert.ok(node.label.zh); assert.ok(node.description.en); assert.ok(node.description.zh); }
      for (const edge of clean.graph.edges) { assert.ok(edge.reason.en); assert.ok(edge.reason.zh); }
    }
  }
});

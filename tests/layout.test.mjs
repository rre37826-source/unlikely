import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutGraph } from '../public/layout.mjs';
import { EXAMPLES } from '../public/examples.mjs';

function graphWithCounts(counts) {
  const clusters = counts.map((_, index) => ({ id: `cluster-${index}` }));
  const nodes = [{ id: 'seed', cluster: clusters[0].id, kind: 'seed' }];
  counts.forEach((count, clusterIndex) => {
    for (let index = 0; index < count; index++) {
      nodes.push({ id: `node-${clusterIndex}-${index}`, cluster: clusters[clusterIndex].id, kind: 'concept' });
    }
  });
  return { seedId: 'seed', clusters, nodes, edges: [] };
}

function rect(center, width = center.width, height = center.height) {
  return {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - height / 2,
    bottom: center.y + height / 2,
  };
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function verifyGeometry(graph, layout) {
  assert.equal(layout.positions.size, graph.nodes.length, 'every node has one position');
  assert.equal(layout.clusters.size, graph.clusters.length, 'every cluster has one region');
  assert.ok(Number.isFinite(layout.width) && layout.width > 0);
  assert.ok(Number.isFinite(layout.height) && layout.height > 0);

  const cards = [];
  const regions = [...layout.clusters.values()].map(region => rect(region));
  for (const node of graph.nodes) {
    const position = layout.positions.get(node.id);
    assert.ok(position, `position for ${node.id}`);
    assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y));
    const seed = node.id === graph.seedId;
    const card = rect(position, seed ? 380 : 190, seed ? 64 : 54);
    assert.ok(card.left >= 0 && card.right <= layout.width, `${node.id} stays inside horizontal bounds`);
    assert.ok(card.top >= 0 && card.bottom <= layout.height, `${node.id} stays inside vertical bounds`);
    cards.push(card);

    if (!seed) {
      const group = rect(layout.clusters.get(node.cluster));
      assert.ok(card.left >= group.left && card.right <= group.right);
      assert.ok(card.top >= group.top + 84, 'cards leave the enlarged cluster title strip clear');
      assert.ok(card.bottom <= group.bottom);
    }
  }

  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) assert.equal(overlaps(regions[i], regions[j]), false, 'cluster regions stay separate');
  }
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) assert.equal(overlaps(cards[i], cards[j]), false, 'node cards stay separate');
  }
  const seed = layout.positions.get(graph.seedId);
  assert.equal(seed.x, layout.width / 2, 'seed stays horizontally centered');
  assert.ok(regions.every(group => seed.y + 32 < group.top), 'seed is above every cluster');
  assert.ok(regions.every(group => group.left >= 0 && group.right <= layout.width && group.top >= 0 && group.bottom <= layout.height));
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

test('curated 31-node maps have separate node cards, six regions, and a seed above the map', () => {
  for (const example of EXAMPLES) {
    const layout = layoutGraph(example.graph);
    verifyGeometry(example.graph, layout);
    assert.ok(layout.width >= 1350 && layout.width <= 1450, 'typical width stays near 1400');
    assert.ok(layout.height <= 950, 'overview titles have space without an unnecessarily large world');
    const regionTops = [...new Set([...layout.clusters.values()].map(group => group.y - group.height / 2))];
    assert.equal(regionTops.length, 2, 'six clusters form two grid rows');
  }
});

test('overview labels stay clear of the seed and two-line cards at 0.38–0.5 scale', () => {
  const graph = graphWithCounts([5, 5, 5, 5, 5, 5]);
  const layout = layoutGraph(graph);
  const seedCard = rect(layout.positions.get(graph.seedId), 380, 128);
  for (const scale of [0.38, 0.44, 0.5]) {
    // The UI keeps territory text at 11 screen px. Node text is normally
    // 13 screen px but capped at 30 world px; model two full lines plus padding.
    const titleHeight = (11 / scale) * 1.5 + 14;
    const cardHeight = Math.min(13 / scale, 30) * 1.25 * 2 + 12;
    const cards = graph.nodes.filter(node => node.id !== graph.seedId)
      .map(node => rect(layout.positions.get(node.id), 190, cardHeight));
    for (const cluster of graph.clusters) {
      const region = layout.clusters.get(cluster.id);
      const top = region.y - region.height / 2;
      const title = rect({ x: region.x, y: top + 16 }, 360, titleHeight);
      assert.equal(overlaps(title, seedCard), false, `seed and label stay separate at ${scale}`);
      assert.ok(cards.every(card => !overlaps(title, card)), `label and all node cards stay separate at ${scale}`);
      const firstMember = graph.nodes.find(node => node.id !== graph.seedId && node.cluster === cluster.id);
      const firstCard = rect(layout.positions.get(firstMember.id), 190, cardHeight);
      assert.ok((firstCard.top - title.bottom) * scale >= 8, `first-row cards leave eight screen pixels below the title at ${scale}`);
    }
  }
});

test('49-node expansion keeps all nodes and dynamically grows world bounds', () => {
  const graph = graphWithCounts([11, 9, 8, 8, 6, 6]);
  const layout = layoutGraph(graph);
  verifyGeometry(graph, layout);
  assert.equal(layout.positions.size, 49);
  assert.ok(layout.height > layoutGraph(graphWithCounts([5, 5, 5, 5, 5, 5])).height);
  assert.ok(layout.clusters.get('cluster-0').height > layout.clusters.get('cluster-2').height);
});

test('150-node layouts support every cluster count from one to sixteen without overlaps', () => {
  for (let clusterCount = 1; clusterCount <= 16; clusterCount++) {
    const counts = Array.from({ length: clusterCount }, (_, i) => Math.floor(149 / clusterCount) + (i < 149 % clusterCount ? 1 : 0));
    const graph = graphWithCounts(counts);
    const layout = layoutGraph(graph);
    verifyGeometry(graph, layout);
    assert.equal(new Set([...layout.positions.values()].map(p => `${p.x},${p.y}`)).size, 150);
  }
});

test('an uneven 150-node graph and empty cluster regions never collide', () => {
  for (const counts of [[130, 1, 1, 6, 5, 6], [149, ...Array(15).fill(0)], [0], [1]]) {
    const graph = graphWithCounts(counts);
    verifyGeometry(graph, layoutGraph(graph));
  }
});

test('member slots keep two columns and at least 105 pixels between rows', () => {
  const graph = graphWithCounts([13]);
  const { positions } = layoutGraph(graph);
  for (let i = 0; i < 11; i++) {
    const here = positions.get(`node-0-${i}`);
    const nextRow = positions.get(`node-0-${i + 2}`);
    assert.equal(nextRow.x, here.x);
    assert.ok(nextRow.y - here.y >= 105);
  }
  for (let i = 0; i < 12; i += 2) {
    const left = positions.get(`node-0-${i}`);
    const right = positions.get(`node-0-${i + 1}`);
    assert.equal(left.y, right.y);
    assert.ok(right.x - left.x >= 220 && right.x - left.x <= 240);
  }
});

test('appending a node into a partly filled row does not move any existing node', () => {
  const graph = graphWithCounts([5, 5, 5, 5, 5, 5]);
  const before = layoutGraph(graph);
  graph.nodes.push({ id: 'appended', cluster: 'cluster-0', kind: 'concept' });
  const after = layoutGraph(graph);
  for (const [id, position] of before.positions) assert.deepEqual(after.positions.get(id), position);
  verifyGeometry(graph, after);
});

test('growth preserves its cluster and neighbors while moving only later rows as needed', () => {
  const graph = graphWithCounts([5, 5, 5, 5, 5, 5]);
  const before = layoutGraph(graph);
  graph.nodes.push(
    { id: 'appended-a', cluster: 'cluster-0', kind: 'concept' },
    { id: 'appended-b', cluster: 'cluster-0', kind: 'concept' },
  );
  const after = layoutGraph(graph);
  for (const node of graph.nodes.filter(n => !n.id.startsWith('appended'))) {
    const oldPoint = before.positions.get(node.id);
    const newPoint = after.positions.get(node.id);
    if (node.id === graph.seedId || ['cluster-0', 'cluster-1', 'cluster-2'].includes(node.cluster)) assert.deepEqual(newPoint, oldPoint);
    else {
      assert.equal(newPoint.x, oldPoint.x);
      assert.equal(newPoint.y - oldPoint.y, 105, 'later rows move by only the new member-row height');
    }
  }
  verifyGeometry(graph, after);
});

test('a second member widens its region without shifting the first member or neighbors', () => {
  const graph = graphWithCounts([1, 5, 5]);
  const before = layoutGraph(graph);
  graph.nodes.push({ id: 'second', cluster: 'cluster-0', kind: 'concept' });
  const after = layoutGraph(graph);
  assert.ok(after.clusters.get('cluster-0').width > before.clusters.get('cluster-0').width);
  for (const [id, point] of before.positions) assert.deepEqual(after.positions.get(id), point);
  verifyGeometry(graph, after);
});

test('layout is deterministic, accepts frozen inputs, and returns independent maps', () => {
  const graph = freezeDeep(graphWithCounts([5, 5, 5, 5, 5, 5]));
  const snapshot = JSON.stringify(graph);
  const first = layoutGraph(graph);
  const second = layoutGraph(graph);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(graph), snapshot);
  first.positions.get('node-0-0').x = -100;
  first.clusters.get('cluster-0').height = -100;
  assert.deepEqual(second, layoutGraph(graph));
});

test('malformed structural input fails instead of silently dropping nodes', () => {
  assert.throws(() => layoutGraph(null), /nodes and at least one cluster/);
  assert.throws(() => layoutGraph({ clusters: [], nodes: [] }), /nodes and at least one cluster/);
  const missingSeed = graphWithCounts([1]);
  missingSeed.seedId = 'not-a-node';
  assert.throws(() => layoutGraph(missingSeed), /declared seed/);
  const unknownCluster = graphWithCounts([1]);
  unknownCluster.nodes[1].cluster = 'missing';
  assert.throws(() => layoutGraph(unknownCluster), /unknown cluster/);
  const duplicateNode = graphWithCounts([1]);
  duplicateNode.nodes.push({ ...duplicateNode.nodes[1] });
  assert.throws(() => layoutGraph(duplicateNode), /unique node IDs/);
  const duplicateCluster = graphWithCounts([1]);
  duplicateCluster.clusters.push({ ...duplicateCluster.clusters[0] });
  assert.throws(() => layoutGraph(duplicateCluster), /unique cluster IDs/);
});

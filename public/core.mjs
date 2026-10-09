const MAX_NODES = 150;
const MAX_EDGES = 400;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value;
}

function string(value, field, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${field} must be non-empty text (at most ${max} characters).`);
  return value.trim();
}

function localized(value, field, max = 4000) {
  if (typeof value === 'string') return string(value, field, max);
  object(value, field);
  return { en: string(value.en, `${field}.en`, max), zh: string(value.zh, `${field}.zh`, max) };
}

function id(value, field) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) throw new Error(`${field} must be a short alphanumeric ID.`);
  return value;
}

function enumValue(value, allowed, field) {
  if (!allowed.includes(value)) throw new Error(`${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

/** Read a plain or bilingual field without rendering it as HTML. */
export function text(value, lang = 'en') {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return typeof value[lang] === 'string' ? value[lang] : typeof value.en === 'string' ? value.en : typeof value.zh === 'string' ? value.zh : '';
}

/** Validate references and connectivity; return a new object containing only supported fields. */
export function validateGraph(input) {
  const graph = object(input, 'graph');
  if (!Array.isArray(graph.clusters) || !graph.clusters.length || graph.clusters.length > 16) throw new Error('graph.clusters must contain 1–16 clusters.');
  if (!Array.isArray(graph.nodes) || !graph.nodes.length || graph.nodes.length > MAX_NODES) throw new Error(`graph.nodes must contain 1–${MAX_NODES} nodes.`);
  if (!Array.isArray(graph.edges) || graph.edges.length > MAX_EDGES) throw new Error(`graph.edges must contain at most ${MAX_EDGES} edges.`);
  const clusterIds = new Set();
  const clusters = graph.clusters.map((raw, i) => {
    const item = object(raw, `cluster ${i}`);
    const key = id(item.id, `cluster ${i}.id`);
    if (clusterIds.has(key)) throw new Error(`Duplicate cluster ID: ${key}.`);
    clusterIds.add(key);
    return { id: key, label: localized(item.label, `cluster ${key}.label`, 160) };
  });
  const nodeIds = new Set();
  const nodes = graph.nodes.map((raw, i) => {
    const item = object(raw, `node ${i}`);
    const key = id(item.id, `node ${i}.id`);
    if (nodeIds.has(key)) throw new Error(`Duplicate node ID: ${key}.`);
    nodeIds.add(key);
    const cluster = id(item.cluster, `node ${key}.cluster`);
    if (!clusterIds.has(cluster)) throw new Error(`Node ${key} references an unknown cluster.`);
    return {
      id: key, label: localized(item.label, `node ${key}.label`, 160),
      description: localized(item.description, `node ${key}.description`, 3000), cluster,
      kind: enumValue(item.kind, ['seed', 'concept', 'application'], `node ${key}.kind`)
    };
  });
  const seedId = id(graph.seedId, 'graph.seedId');
  if (!nodeIds.has(seedId)) throw new Error('graph.seedId must reference an existing seed node.');
  if (nodes.filter(node => node.kind === 'seed').length !== 1 || nodes.find(node => node.id === seedId).kind !== 'seed') throw new Error('The graph must have exactly one seed node matching seedId.');
  const edgeIds = new Set();
  const edges = graph.edges.map((raw, i) => {
    const item = object(raw, `edge ${i}`);
    const key = id(item.id, `edge ${i}.id`);
    if (edgeIds.has(key)) throw new Error(`Duplicate edge ID: ${key}.`);
    edgeIds.add(key);
    const source = id(item.source, `edge ${key}.source`);
    const target = id(item.target, `edge ${key}.target`);
    if (!nodeIds.has(source) || !nodeIds.has(target)) throw new Error(`Edge ${key} references an unknown node.`);
    if (source === target) throw new Error(`Edge ${key} cannot connect a node to itself.`);
    return {
      id: key, source, target, label: localized(item.label, `edge ${key}.label`, 160),
      reason: localized(item.reason, `edge ${key}.reason`, 3000),
      kind: enumValue(item.kind, ['association', 'analogy', 'hypothesis'], `edge ${key}.kind`)
    };
  });
  const adjacent = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    adjacent.get(edge.source).push(edge.target);
    adjacent.get(edge.target).push(edge.source);
  }
  const visited = new Set([seedId]);
  const queue = [seedId];
  for (let i = 0; i < queue.length; i++) for (const next of adjacent.get(queue[i])) if (!visited.has(next)) { visited.add(next); queue.push(next); }
  if (visited.size !== nodes.length) throw new Error('Every node must be connected to the seed through graph edges.');
  return { seedId, clusters, nodes, edges };
}

export function validateProject(input) {
  const project = object(input, 'project');
  if (project.version !== 1) throw new Error('Only project version 1 is supported.');
  const graph = validateGraph(project.graph);
  if (!Array.isArray(project.route) || project.route.length > 40) throw new Error('project.route must contain at most 40 node IDs.');
  const known = new Set(graph.nodes.map(node => node.id));
  const selected = new Set();
  const route = project.route.map((item, index) => {
    const key = id(item, `route ${index}`);
    if (!known.has(key)) throw new Error('The route references an unknown node.');
    if (selected.has(key)) throw new Error('A route cannot contain duplicate nodes.');
    selected.add(key);
    return key;
  });
  return {
    version: 1, title: localized(project.title, 'project.title', 300),
    task: localized(project.task, 'project.task', 6000), seed: localized(project.seed, 'project.seed', 500),
    constraints: project.constraints === '' || !own(project, 'constraints') ? '' : localized(project.constraints, 'project.constraints', 4000),
    graph, route, provenance: enumValue(project.provenance, ['curated', 'model', 'import'], 'project.provenance')
  };
}

/** Direct relationships only. A missing direct edge is a creative gap, never an invented fact. */
export function routeEdges(graph, ids) {
  return ids.slice(1).map((target, index) => {
    const source = ids[index];
    const edge = graph.edges.find(item => item.source === source && item.target === target || item.source === target && item.target === source) || null;
    return { source, target, edge };
  });
}

export function findShortestPath(graph, from, to) {
  const adjacent = new Map(graph.nodes.map(node => [node.id, []]));
  if (!adjacent.has(from) || !adjacent.has(to)) return null;
  for (const { source, target } of graph.edges) {
    if (adjacent.has(source) && adjacent.has(target)) { adjacent.get(source).push(target); adjacent.get(target).push(source); }
  }
  const parents = new Map([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === to) {
      const path = [];
      for (let at = to; at !== null; at = parents.get(at)) path.unshift(at);
      return path;
    }
    for (const next of adjacent.get(current)) if (!parents.has(next)) { parents.set(next, current); queue.push(next); }
  }
  return null;
}

export function routeMatches(ids, candidateIds) {
  return Array.isArray(ids) && Array.isArray(candidateIds) && ids.length === candidateIds.length && ids.every((id, index) => id === candidateIds[index]);
}

function markdown(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]#!|]/g, '\\$&').replace(/\r\n?/g, '\n');
}

export function routeToMarkdown(input, lang = 'en', brief = null) {
  const project = validateProject(input);
  const zh = lang === 'zh';
  const words = zh ? {
    task: '任务', seed: '起点', constraints: '限制', route: '选定路线', empty: '尚未选择路线。',
    relationships: '连接与理由', gap: '尚未解决的连接：需要人为判断或继续探索，不能作为已成立的关系。',
    hypothesis: '假设，待验证', brief: '创意草案', assumptions: '假设与待验证项', source: '来源',
    sources: { curated: '预设演示；人工编排的联想，未经实时模型生成。', model: '模型生成；联想与假设需要独立核实。', import: '导入项目；来源与事实尚未独立核实。' },
    footer: '使用 Unlikely 探索。路线由用户选择；创意联系不构成事实证明。'
  } : {
    task: 'Task', seed: 'Seed', constraints: 'Constraints', route: 'Selected route', empty: 'No route selected yet.',
    relationships: 'Relationships and reasons', gap: 'Unresolved connection: needs human judgment or further exploration; no established relationship is claimed.',
    hypothesis: 'Hypothesis — verify independently', brief: 'Creative draft', assumptions: 'Assumptions and open questions', source: 'Provenance',
    sources: { curated: 'Curated example; authored associations, not a live model generation.', model: 'Model-generated; associations and assumptions need independent verification.', import: 'Imported project; source and factual claims have not been independently verified.' },
    footer: 'Explored with Unlikely. The user chooses the route; a creative connection is not evidence of fact.'
  };
  const local = value => markdown(text(value, lang));
  const nodes = new Map(project.graph.nodes.map(node => [node.id, node]));
  const sections = [`# ${local(project.title)}`, `## ${words.task}\n\n${local(project.task)}`, `**${words.seed}:** ${local(project.seed)}`];
  if (text(project.constraints, lang)) sections.push(`**${words.constraints}:** ${local(project.constraints)}`);
  sections.push(`## ${words.route}\n\n${project.route.length ? project.route.map((key, index) => `${index + 1}. ${local(nodes.get(key).label)}`).join('\n') : words.empty}`);
  if (project.route.length > 1) sections.push(`## ${words.relationships}\n\n${routeEdges(project.graph, project.route).map(({ source, target, edge }) => {
    const heading = `### ${local(nodes.get(source).label)} → ${local(nodes.get(target).label)}`;
    return edge ? `${heading}\n\n**${local(edge.label)}** — ${local(edge.reason)}${edge.kind === 'hypothesis' ? `\n\n_${words.hypothesis}_` : ''}` : `${heading}\n\n${words.gap}`;
  }).join('\n\n')}`);
  if (brief && typeof brief === 'object') {
    sections.push(`## ${words.brief}\n\n${local(brief.title)}\n\n${local(brief.body)}`);
    if (text(brief.assumptions, lang)) sections.push(`### ${words.assumptions}\n\n${local(brief.assumptions)}`);
  }
  sections.push(`## ${words.source}\n\n${words.sources[project.provenance]}`, words.footer);
  return sections.join('\n\n') + '\n';
}

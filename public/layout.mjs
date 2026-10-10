// World-space dimensions. Node centers remain in their original slots when
// members are appended; only later cluster rows move when a row needs more room.
const COLUMNS = 3;
const WORLD_PADDING = 24;
const COLUMN_GAP = 22;
const ROW_GAP = 28;
// Keep the seed clear of screen-sized territory labels at overview zoom.
const FIRST_ROW_TOP = 152;
// Allow a screen-sized label above a two-line card capped at 30 world px.
const TITLE_HEIGHT = 84;
const GROUP_PADDING_X = 8;
const GROUP_PADDING_BOTTOM = 14;
const NODE_WIDTH = 190;
const NODE_HEIGHT = 54;
const NODE_COLUMN_STEP = 230;
const NODE_ROW_STEP = 105;
const SEED_WIDTH = 380;
const SEED_Y = 48;
const SINGLE_COLUMN_WIDTH = NODE_WIDTH + GROUP_PADDING_X * 2;
const DOUBLE_COLUMN_WIDTH = SINGLE_COLUMN_WIDTH + NODE_COLUMN_STEP;

/**
 * Lay out a validated graph in deterministic, top-aligned cluster rows.
 *
 * `positions` contains node centers. `clusters` contains region centers and
 * full region dimensions, not top-left corners or label positions. Put a
 * cluster title at { x, y: y - height / 2 + 16 }, using a centered
 * translate(-50%, -50%) transform. A region includes its title strip and
 * space for 190 × 54 node cards. Renderers should respect that card
 * footprint, or scale the whole world, to preserve the non-overlap guarantee.
 *
 * Cluster order and each cluster's relative node order follow the input. Do
 * not sort nodes by their generated IDs: appended ideas should occupy new
 * slots without moving existing ideas. An incomplete final node row stays
 * left-aligned for the same reason. Row height follows the tallest cluster;
 * growth never moves a preceding row or another cluster in the current row.
 *
 * The seed occupies a separate band above every cluster, regardless of the
 * cluster ID stored on the seed node. This function never mutates the graph.
 * It checks the structural conditions needed for layout; content, topology,
 * and project size limits remain the graph validator's responsibility.
 *
 * @param {{seedId:string, clusters:Array<{id:string}>, nodes:Array<{id:string,cluster:string}>}} graph
 * @returns {{width:number,height:number,positions:Map<string,{x:number,y:number}>,clusters:Map<string,{x:number,y:number,width:number,height:number}>}}
 */
export function layoutGraph(graph) {
  if (!graph || !Array.isArray(graph.clusters) || !graph.clusters.length || !Array.isArray(graph.nodes)) {
    throw new TypeError('Layout requires nodes and at least one cluster.');
  }

  const groups = [];
  const byCluster = new Map();
  for (const cluster of graph.clusters) {
    if (!cluster || typeof cluster.id !== 'string' || byCluster.has(cluster.id)) {
      throw new TypeError('Layout requires unique cluster IDs.');
    }
    const group = { id: cluster.id, members: [] };
    groups.push(group);
    byCluster.set(cluster.id, group);
  }

  const nodeIds = new Set();
  let foundSeed = false;
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== 'string' || nodeIds.has(node.id)) {
      throw new TypeError('Layout requires unique node IDs.');
    }
    nodeIds.add(node.id);
    if (node.id === graph.seedId) {
      foundSeed = true;
      continue;
    }
    const group = byCluster.get(node.cluster);
    if (!group) throw new TypeError(`Cannot lay out node in unknown cluster: ${node.cluster}`);
    group.members.push(node);
  }
  if (!foundSeed) throw new TypeError('Layout requires the declared seed node.');

  const columns = Math.min(COLUMNS, groups.length);
  // Reserve two-column grid slots even for short clusters. Their regions may
  // be narrower, but adding a second member must not move neighboring groups.
  const width = Math.max(
    SEED_WIDTH + WORLD_PADDING * 2,
    columns * DOUBLE_COLUMN_WIDTH + (columns - 1) * COLUMN_GAP + WORLD_PADDING * 2,
  );
  const positions = new Map([[graph.seedId, { x: width / 2, y: SEED_Y }]]);
  const clusters = new Map();
  let rowTop = FIRST_ROW_TOP;
  let bottom = rowTop;

  for (let rowStart = 0; rowStart < groups.length; rowStart += COLUMNS) {
    const row = groups.slice(rowStart, rowStart + COLUMNS);
    let rowHeight = 0;
    for (let column = 0; column < row.length; column++) {
      const group = row[column];
      const count = group.members.length;
      const memberRows = Math.ceil(count / 2);
      const groupWidth = count > 1 ? DOUBLE_COLUMN_WIDTH : SINGLE_COLUMN_WIDTH;
      const contentHeight = memberRows ? NODE_HEIGHT + (memberRows - 1) * NODE_ROW_STEP : 0;
      const groupHeight = TITLE_HEIGHT + contentHeight + GROUP_PADDING_BOTTOM;
      const left = WORLD_PADDING + column * (DOUBLE_COLUMN_WIDTH + COLUMN_GAP);

      clusters.set(group.id, {
        x: left + groupWidth / 2,
        y: rowTop + groupHeight / 2,
        width: groupWidth,
        height: groupHeight,
      });

      group.members.forEach((node, index) => positions.set(node.id, {
        x: left + GROUP_PADDING_X + NODE_WIDTH / 2 + (index % 2) * NODE_COLUMN_STEP,
        y: rowTop + TITLE_HEIGHT + NODE_HEIGHT / 2 + Math.floor(index / 2) * NODE_ROW_STEP,
      }));
      rowHeight = Math.max(rowHeight, groupHeight);
    }
    bottom = rowTop + rowHeight;
    rowTop = bottom + ROW_GAP;
  }

  return { width, height: bottom + WORLD_PADDING, positions, clusters };
}

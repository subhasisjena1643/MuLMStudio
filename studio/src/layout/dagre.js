/**
 * dagre.js
 * Applies Dagre auto-layout to React Flow nodes/edges.
 * Direction: TB (top-to-bottom, vertical column).
 */
import dagre from '@dagrejs/dagre';

const NODE_DIMS = {
  mlmInputNode:       { width: 160, height: 48 },
  mlmOutputNode:      { width: 160, height: 48 },
  mlmAtomicNode:      { width: 220, height: 88 },
  mlmNode:            { width: 220, height: 80 },
  mlmFunctionNode:    { width: 140, height: 40 },
  mlmUntraceableNode: { width: 220, height: 80 },
};
const DEFAULT_DIMS = { width: 220, height: 80 };

/**
 * applyDagreLayout(nodes, edges, options?)
 * Returns a new nodes array with computed {x, y} positions.
 */
export function applyDagreLayout(nodes, edges, opts = {}) {
  const { rankdir = 'TB', nodesep = 60, ranksep = 100 } = opts;

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    const dims = NODE_DIMS[node.type] ?? DEFAULT_DIMS;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, {}, edge.id ?? `${edge.source}-${edge.target}`);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const n = g.node(node.id);
    if (!n) return node;
    const dims = NODE_DIMS[node.type] ?? DEFAULT_DIMS;
    return {
      ...node,
      position: {
        x: n.x - dims.width  / 2,
        y: n.y - dims.height / 2,
      },
      // Edges exit right, enter left — LR signal-flow reading
      sourcePosition: 'right',
      targetPosition: 'left',
    };
  });
}

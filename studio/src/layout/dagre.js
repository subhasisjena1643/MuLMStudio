/**
 * dagre.js
 * Applies Dagre auto-layout to React Flow nodes/edges.
 * Called once per graph update before passing nodes to ReactFlow.
 */
import dagre from '@dagrejs/dagre';

// Node dimensions — must match the rendered sizes in node components
const NODE_DIMS = {
  mlmInputNode:       { width: 120, height: 44 },
  mlmOutputNode:      { width: 120, height: 44 },
  mlmAtomicNode:      { width: 220, height: 78 },
  mlmNode:            { width: 220, height: 72 },
  mlmFunctionNode:    { width: 120, height: 34 },
  mlmUntraceableNode: { width: 220, height: 72 },
};

const DEFAULT_DIMS = { width: 220, height: 72 };

/**
 * applyDagreLayout(nodes, edges, options?)
 *
 * Returns a new nodes array with computed {x, y} positions.
 * Edges are unchanged.
 *
 * @param {Array} nodes - React Flow nodes (positions irrelevant, will be overwritten)
 * @param {Array} edges - React Flow edges
 * @param {object} [opts]
 * @param {string} [opts.rankdir='TB'] - 'TB' | 'LR' | 'BT' | 'RL'
 * @param {number} [opts.nodesep=60]  - horizontal gap between sibling nodes
 * @param {number} [opts.ranksep=80]  - vertical gap between ranks
 */
export function applyDagreLayout(nodes, edges, opts = {}) {
  const { rankdir = 'TB', nodesep = 60, ranksep = 80 } = opts;

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    const dims = NODE_DIMS[node.type] || DEFAULT_DIMS;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  });

  edges.forEach((edge) => {
    // multigraph: use edge id as the name to avoid duplicate-edge collapse
    g.setEdge(edge.source, edge.target, {}, edge.id);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const n = g.node(node.id);
    const dims = NODE_DIMS[node.type] || DEFAULT_DIMS;
    // Dagre gives center position; React Flow wants top-left
    return {
      ...node,
      position: {
        x: n.x - dims.width / 2,
        y: n.y - dims.height / 2,
      },
    };
  });
}

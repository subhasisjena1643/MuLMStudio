/**
 * useCodeGen.js
 * Canvas→Notebook: converts a React Flow graph (nodes + edges) into Python
 * source code that, when exec'd, defines an equivalent nn.Module.
 *
 * Correctness contract (flagged in execution.md as the trickiest risk):
 *   - The generated __init__ and forward() MUST respect the topological order
 *     of the graph.  Wrong order = silently broken code (forward() crashes at
 *     runtime, or worse, runs but gives wrong results if shapes are compatible).
 *   - Prefer a visible `# TODO` fallback over silent wrong-order generation.
 *   - Cycles → immediate visible error in the analysis panel, not silent output.
 *
 * Algorithm: Kahn's algorithm (BFS-based topological sort).
 *   - Deterministic in-order: nodes with equal rank processed in insertion order.
 *   - Cycle detection: if any nodes remain after the sort, a cycle exists.
 *
 * This module exposes ONE hook: useCodeGen(nodes, edges) → { code, problems }
 *   code:     string — Python source (empty string if graph is empty)
 *   problems: Array<{ id, severity, message }> — forwarded to AnalysisPanel
 */
import { useMemo } from 'react';

// ── Palette metadata (mirrors PALETTE_BLOCKS in palette.js) ──────────────────

const BLOCK_TEMPLATES = {
  // Format: (params) => { init_line, forward_call }
  //   init_line:    the self.{name} = ... assignment for __init__
  //   forward_call: the expression for the forward pass

  Embedding: (p, name) => ({
    init_line:    `self.${name} = nn.Embedding(${p.num_embeddings ?? 50000}, ${p.embedding_dim ?? 512})`,
    forward_call: `self.${name}({INPUT})`,
  }),
  Linear: (p, name) => ({
    init_line:    `self.${name} = nn.Linear(${p.in_features ?? 512}, ${p.out_features ?? 512})`,
    forward_call: `self.${name}({INPUT})`,
  }),
  FeedForward: (p, name) => ({
    init_line: [
      `self.${name} = nn.Sequential(`,
      `    nn.Linear(${p.d_model ?? 512}, ${p.dim_feedforward ?? 2048}),`,
      `    nn.ReLU(),`,
      `    nn.Linear(${p.dim_feedforward ?? 2048}, ${p.d_model ?? 512}),`,
      `)`,
    ].join('\n        '),
    forward_call: `self.${name}({INPUT})`,
  }),
  OutputHead: (p, name) => ({
    init_line:    `self.${name} = nn.Linear(${p.in_features ?? 512}, ${p.out_features ?? 50000})`,
    forward_call: `self.${name}({INPUT})`,
  }),
  MultiheadAttention: (p, name) => ({
    init_line:    `self.${name} = nn.MultiheadAttention(embed_dim=${p.embed_dim ?? 512}, num_heads=${p.num_heads ?? 8}, batch_first=True)`,
    forward_call: `self.${name}({INPUT}, {INPUT}, {INPUT})[0]`,  // Q=K=V=x, discard weights
  }),
  LayerNorm: (p, name) => ({
    init_line:    `self.${name} = nn.LayerNorm(${JSON.stringify(p.normalized_shape ?? [512])})`,
    forward_call: `self.${name}({INPUT})`,
  }),
  RMSNorm: (p, name) => ({
    init_line:    `self.${name} = nn.LayerNorm(${p.d_model ?? 512})  # RMSNorm placeholder`,
    forward_call: `self.${name}({INPUT})`,
  }),
  Conv2d: (p, name) => ({
    init_line:    `self.${name} = nn.Conv2d(${p.in_channels ?? 3}, ${p.out_channels ?? 64}, kernel_size=${p.kernel_size ?? 3}, padding=${p.padding ?? 1})`,
    forward_call: `self.${name}({INPUT})`,
  }),
  Dropout: (p, name) => ({
    init_line:    `self.${name} = nn.Dropout(p=${p.p ?? 0.1})`,
    forward_call: `self.${name}({INPUT})`,
  }),
  Softmax: (p, name) => ({
    init_line:    `self.${name} = nn.Softmax(dim=${p.dim ?? -1})`,
    forward_call: `self.${name}({INPUT})`,
  }),
};

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

/**
 * topoSort(nodes, edges)
 *
 * Returns { sorted: Node[], hasCycle: boolean }
 *
 * sorted: nodes in valid execution order (predecessors before successors).
 * hasCycle: true if the graph contains a directed cycle — caller must treat
 *           this as a hard error, not generate silently wrong code.
 */
function topoSort(nodes, edges) {
  // Build adjacency and in-degree maps
  const inDegree = new Map();          // nodeId → count of incoming edges
  const successors = new Map();        // nodeId → Set<nodeId>

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    successors.set(n.id, new Set());
  }

  for (const e of edges) {
    // Guard: skip edges whose endpoints don't exist in the current node set
    if (!inDegree.has(e.source) || !inDegree.has(e.target)) continue;
    if (e.source === e.target) continue;  // self-loop → cycle

    // Only increment once per (source, target) pair to handle multigraph edges
    // (a single pair can have multiple shape-annotated edges between the same nodes)
    successors.get(e.source).add(e.target);
  }

  // Re-compute in-degree from deduplicated successors
  inDegree.clear();
  for (const n of nodes) inDegree.set(n.id, 0);
  for (const [src, dsts] of successors) {
    for (const dst of dsts) {
      inDegree.set(dst, (inDegree.get(dst) ?? 0) + 1);
    }
  }

  // Kahn's BFS: start with all zero-in-degree nodes in insertion order
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const queue = nodes.filter((n) => inDegree.get(n.id) === 0);
  const sorted = [];

  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);
    for (const dst of successors.get(node.id) ?? []) {
      const newDeg = inDegree.get(dst) - 1;
      inDegree.set(dst, newDeg);
      if (newDeg === 0) {
        queue.push(nodeById.get(dst));
      }
    }
  }

  return {
    sorted,
    hasCycle: sorted.length < nodes.length,
  };
}

// ── Predecessor map (needed for forward() call generation) ───────────────────

/**
 * buildPredecessors(edges)
 * Returns Map<nodeId, nodeId[]> — ordered list of predecessor node IDs.
 * Multiple edges between the same pair are deduplicated here.
 */
function buildPredecessors(edges) {
  const pred = new Map();
  for (const e of edges) {
    if (!pred.has(e.target)) pred.set(e.target, []);
    const list = pred.get(e.target);
    if (!list.includes(e.source)) list.push(e.source);
  }
  return pred;
}

// ── Code generation ───────────────────────────────────────────────────────────

/**
 * generateCode(nodes, edges)
 *
 * Core pure function — no React, no side effects.
 * Returns { code: string, problems: Problem[] }
 *
 * Problems shape: { id: string, severity: 'error'|'warning', message: string }
 */
export function generateCode(nodes, edges) {
  // Omit placeholder/output nodes from generation — they're graph bookkeeping
  const SKIP_TYPES = new Set(['mlmInputNode', 'mlmOutputNode']);
  const genNodes = nodes.filter((n) => !SKIP_TYPES.has(n.type));

  if (genNodes.length === 0) {
    return { code: '', problems: [] };
  }

  // All nodes (including input/output) must be sorted for correct edge traversal
  const { sorted: allSorted, hasCycle } = topoSort(nodes, edges);

  if (hasCycle) {
    return {
      code: '# ERROR: Graph contains a directed cycle — no valid execution order exists.\n# Fix the cycle in the canvas before generating code.',
      problems: [{
        id: 'cycle-detected',
        severity: 'error',
        message: 'Graph contains a directed cycle — cannot generate code.',
      }],
    };
  }

  // Filter sorted list to gen-eligible nodes (preserving topo order)
  const sortedGenNodes = allSorted.filter((n) => !SKIP_TYPES.has(n.type));
  const predecessors   = buildPredecessors(edges);

  // ── Build variable name map ─────────────────────────────────────────────────
  // Each node gets a Python variable name: sanitize the node id.
  const varOf = (id) => id.replace(/[.\-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

  // ── Identify input placeholder(s) ──────────────────────────────────────────
  const inputNodes = nodes.filter((n) => n.type === 'mlmInputNode');
  const inputVars  = inputNodes.map((n) => varOf(n.id));

  // ── Template resolver ───────────────────────────────────────────────────────
  // Priority order:
  //   1. block_id  (set when a palette block is dropped onto the canvas)
  //   2. label verbatim  (e.g. "Linear", "Dropout")
  //   3. Class name extracted from "module.N  (ClassName)" pattern
  //      (WS-traced sub-module nodes like "feedforward.0  (Linear)")
  //   4. Stripped label with whitespace removed
  function resolveTemplate(node) {
    const label   = node.data?.label ?? '';
    const blockId = node.data?.block_id;

    if (blockId && BLOCK_TEMPLATES[blockId])      return BLOCK_TEMPLATES[blockId];
    if (BLOCK_TEMPLATES[label])                   return BLOCK_TEMPLATES[label];

    // Extract "ClassName" from "some.path.N  (ClassName)"
    const parenMatch = label.match(/\(([^)]+)\)\s*$/);
    if (parenMatch && BLOCK_TEMPLATES[parenMatch[1]]) return BLOCK_TEMPLATES[parenMatch[1]];

    // Last resort: strip all whitespace
    const stripped = label.replace(/\s+/g, '');
    if (BLOCK_TEMPLATES[stripped]) return BLOCK_TEMPLATES[stripped];

    return null;
  }

  // ── __init__ block ──────────────────────────────────────────────────────────
  const initLines = [];
  const unrecognized = [];

  for (const node of sortedGenNodes) {
    // Function nodes (Add, etc.) are inline ops — no self.X = nn.Y() registration
    if (node.type === 'mlmFunctionNode') continue;

    const tmpl = resolveTemplate(node);
    const name = varOf(node.id);

    if (!tmpl) {
      // Untraceable or unknown — emit a TODO, never silent wrong code
      initLines.push(`# TODO: self.${name} — unrecognized block "${node.data?.label ?? node.id}"`);
      unrecognized.push(node.data?.label ?? node.id);
      continue;
    }

    const { init_line } = tmpl(node.data?.params ?? {}, name);
    initLines.push(init_line);
  }

  // ── forward() block ─────────────────────────────────────────────────────────
  // Strategy:
  //   - Each node's output is assigned to a variable named varOf(node.id).
  //   - Input placeholder(s) → use the forward() argument directly.
  //   - For nodes with multiple predecessors, we use them in predecessor order.
  //   - Residual adds → detected by multiple predecessors on a function node.
  const fwdLines = [];
  const nodeVarMap = new Map();  // nodeId → Python variable name in forward()

  // Map input nodes to forward() parameter names
  for (const n of inputNodes) {
    nodeVarMap.set(n.id, varOf(n.id));
  }

  for (const node of sortedGenNodes) {
    const name  = varOf(node.id);
    const preds = predecessors.get(node.id) ?? [];

    // Resolve the primary input variable (first predecessor's output).
    // If this node has no predecessors and is not the graph input, it is
    // disconnected (happens after node/edge deletion). Mark it visibly
    // instead of silently generating wrong code.
    const isDisconnected = preds.length === 0 && node.type !== 'mlmInputNode';
    const primaryInput = preds.length > 0
      ? (nodeVarMap.get(preds[0]) ?? varOf(preds[0]))
      : (inputVars[0] ?? 'x');

    // ── Function nodes (inline ops — no module registration) ─────────────────
    // MUST be checked BEFORE template lookup because function nodes intentionally
    // have no entry in BLOCK_TEMPLATES.
    if (node.type === 'mlmFunctionNode') {
      const op = (node.data?.label ?? '').toLowerCase();
      if (isDisconnected) {
        fwdLines.push(`${name} = ${node.data?.label ?? 'fn'}(???)  # disconnected`);
      } else if (op === 'add') {
        if (preds.length >= 2) {
          const a = nodeVarMap.get(preds[0]) ?? varOf(preds[0]);
          const b = nodeVarMap.get(preds[1]) ?? varOf(preds[1]);
          fwdLines.push(`${name} = ${a} + ${b}`);
        } else {
          // Degenerate add — treat as passthrough
          fwdLines.push(`${name} = ${primaryInput}  # Add (single input)`);
        }
      } else {
        // Generic unrecognized function — passthrough with comment
        fwdLines.push(`${name} = ${primaryInput}  # ${node.data?.label ?? 'fn'}`);
      }
      nodeVarMap.set(node.id, name);
      continue;
    }

    // ── Module nodes ─────────────────────────────────────────────────────────
    const tmpl = resolveTemplate(node);

    if (isDisconnected) {
      // Node has no incoming edge — emit a clearly broken placeholder so the
      // user sees ??? rather than silently wrong code.
      fwdLines.push(`${name} = self.${name}(???)  # disconnected`);
      nodeVarMap.set(node.id, name);
      continue;
    }

    if (!tmpl) {
      // Unknown block — emit a placeholder assignment that at least chains
      fwdLines.push(`${name} = self.${name}(${primaryInput})  # TODO: unrecognized block`);
      nodeVarMap.set(node.id, name);
      continue;
    }

    const { forward_call } = tmpl(node.data?.params ?? {}, name);
    const expr = forward_call.replace(/\{INPUT\}/g, primaryInput);
    fwdLines.push(`${name} = ${expr}`);
    nodeVarMap.set(node.id, name);
  }

  // ── Find the output variable ─────────────────────────────────────────────────
  const outputNodes  = nodes.filter((n) => n.type === 'mlmOutputNode');
  let returnExpr;

  if (outputNodes.length === 1) {
    const outPreds = predecessors.get(outputNodes[0].id) ?? [];
    returnExpr = outPreds.length > 0
      ? (nodeVarMap.get(outPreds[0]) ?? varOf(outPreds[0]))
      : (sortedGenNodes.length > 0
          ? varOf(sortedGenNodes[sortedGenNodes.length - 1].id)
          : 'x');
  } else if (sortedGenNodes.length > 0) {
    returnExpr = varOf(sortedGenNodes[sortedGenNodes.length - 1].id);
  } else {
    returnExpr = 'x';
  }

  // ── Assemble the Python source ───────────────────────────────────────────────
  const className    = 'GeneratedModel';
  const forwardArgs  = inputVars.length > 0 ? inputVars.join(', ') : 'x';
  const indentedInit = initLines.map((l) => '        ' + l).join('\n');
  const indentedFwd  = fwdLines.map( (l) => '        ' + l).join('\n');

  const code = [
    'import torch',
    'import torch.nn as nn',
    '',
    '',
    `class ${className}(nn.Module):`,
    '    def __init__(self):',
    '        super().__init__()',
    indentedInit || '        pass',
    '',
    `    def forward(self, ${forwardArgs}):`,
    indentedFwd || '        pass',
    `        return ${returnExpr}`,
  ].join('\n');

  const problems = unrecognized.map((label) => ({
    id: `unrecognized-${label}`,
    severity: 'warning',
    message: `Block "${label}" has no code template — emitted as # TODO placeholder.`,
  }));

  return { code, problems };
}

// ── React hook wrapper ────────────────────────────────────────────────────────

/**
 * useCodeGen(nodes, edges)
 *
 * Memoized wrapper around generateCode. Re-runs only when nodes or edges change.
 * Returns { code: string, problems: Problem[] }
 */
export function useCodeGen(nodes, edges) {
  return useMemo(() => {
    if (!nodes || nodes.length === 0) return { code: '', problems: [] };
    return generateCode(nodes, edges ?? []);
  }, [nodes, edges]);
}

/**
 * staticDemoGraphs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * µLM Studio — frozen demo graphs for VITE_DEMO_MODE.
 *
 * These are exact snapshots of the /demo endpoint output (TransformerEncoderBlock,
 * traced with input [2, 128, 512] on 2026-06-20).  They are frozen so the demo
 * renders identically regardless of backend availability.
 *
 * Two graphs:
 *   STATIC_GRAPH_CLEAN    — 13 nodes, 14 edges, all valid (green wires)
 *   STATIC_GRAPH_MISMATCH — same, but feedforward.3 (Linear) changed to
 *                           out_features=768, causing a residual Add mismatch.
 *                           Toggled by Ctrl+Shift+E (or Cmd+Shift+E on Mac).
 *
 * The mismatch version reproduces the exact scenario from execution.md §Day 5:
 *   "changing Linear(512,512) to Linear(512,768)"
 *   → dropout_1→add_1 edge becomes status="mismatch"
 *   → analysis panel shows the pre-built DEMO_MISMATCH_ATTENTION_FEEDFORWARD message
 *
 * IMPORTANT: never mutate these objects — they are shared across renders.
 * Both CanvasPanel and App.jsx read them by reference; use spread copies if
 * you need to modify edge statuses at runtime.
 */

// ── Shared node list (identical in both graphs) ───────────────────────────────
// Frozen from live /demo endpoint 2026-06-20.
const _CLEAN_NODES = [
  { id: "x",              type: "mlmInputNode",   position: { x: 0, y: 0 }, data: { label: "Input",                   op: "placeholder",   target: "x",              shape: "[2, 128, 512]",  sync_state: "traced", category: "INPUT",          params: {} } },
  { id: "attention",      type: "mlmAtomicNode",  position: { x: 0, y: 0 }, data: { label: "MultiheadAttention",      op: "call_module",   target: "attention",      shape: "[2, 128, 512]",  sync_state: "atomic", category: "ATTENTION",      params: { embed_dim: 512, num_heads: 8, dropout: 0.1, batch_first: true } } },
  { id: "dropout",        type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "Dropout",                op: "call_module",   target: "dropout",        shape: "[2, 128, 512]",  sync_state: "traced", category: "REGULARIZATION", params: { p: 0.1 } } },
  { id: "add",            type: "mlmFunctionNode", position: { x: 0, y: 0 }, data: { label: "Add",                    op: "call_function", target: "<built-in function add>", shape: "[2, 128, 512]",  sync_state: "traced", category: "CORE",           params: {} } },
  { id: "norm1",          type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "LayerNorm",              op: "call_module",   target: "norm1",          shape: "[2, 128, 512]",  sync_state: "traced", category: "NORM",           params: { normalized_shape: [512] } } },
  { id: "feedforward_0",  type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "feedforward.0  (Linear)", op: "call_module", target: "feedforward.0",  shape: "[2, 128, 2048]", sync_state: "traced", category: "CORE",           params: { in_features: 512,  out_features: 2048, bias: true } } },
  { id: "feedforward_1",  type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "feedforward.1  (ReLU)",   op: "call_module", target: "feedforward.1",  shape: "[2, 128, 2048]", sync_state: "traced", category: "ACTIVATION",     params: {} } },
  { id: "feedforward_2",  type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "feedforward.2  (Dropout)",op: "call_module", target: "feedforward.2",  shape: "[2, 128, 2048]", sync_state: "traced", category: "REGULARIZATION", params: { p: 0.1 } } },
  { id: "feedforward_3",  type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "feedforward.3  (Linear)", op: "call_module", target: "feedforward.3",  shape: "[2, 128, 512]",  sync_state: "traced", category: "CORE",           params: { in_features: 2048, out_features: 512,  bias: true } } },
  { id: "dropout_1",      type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "Dropout",                op: "call_module",   target: "dropout",        shape: "[2, 128, 512]",  sync_state: "traced", category: "REGULARIZATION", params: { p: 0.1 } } },
  { id: "add_1",          type: "mlmFunctionNode", position: { x: 0, y: 0 }, data: { label: "Add",                    op: "call_function", target: "<built-in function add>", shape: "[2, 128, 512]",  sync_state: "traced", category: "CORE",           params: {} } },
  { id: "norm2",          type: "mlmNode",         position: { x: 0, y: 0 }, data: { label: "LayerNorm",              op: "call_module",   target: "norm2",          shape: "[2, 128, 512]",  sync_state: "traced", category: "NORM",           params: { normalized_shape: [512] } } },
  { id: "output",         type: "mlmOutputNode",   position: { x: 0, y: 0 }, data: { label: "Output",                 op: "output",        target: "output",         shape: "[2, 128, 512]",  sync_state: "traced", category: "OUTPUT",         params: {} } },
];

// ── Shared edge list — clean version (all valid) ──────────────────────────────
const _CLEAN_EDGES = [
  { id: "x→attention",               source: "x",             target: "attention",     type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "attention→dropout",         source: "attention",     target: "dropout",       type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "x→add",                     source: "x",             target: "add",           type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "dropout→add",               source: "dropout",       target: "add",           type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "add→norm1",                 source: "add",           target: "norm1",         type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "norm1→feedforward_0",       source: "norm1",         target: "feedforward_0", type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "feedforward_0→feedforward_1",source:"feedforward_0", target: "feedforward_1", type: "shapeEdge", data: { shape: "[2, 128, 2048]", status: "valid" } },
  { id: "feedforward_1→feedforward_2",source:"feedforward_1", target: "feedforward_2", type: "shapeEdge", data: { shape: "[2, 128, 2048]", status: "valid" } },
  { id: "feedforward_2→feedforward_3",source:"feedforward_2", target: "feedforward_3", type: "shapeEdge", data: { shape: "[2, 128, 2048]", status: "valid" } },
  { id: "feedforward_3→dropout_1",   source: "feedforward_3", target: "dropout_1",     type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "norm1→add_1",               source: "norm1",         target: "add_1",         type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "dropout_1→add_1",           source: "dropout_1",     target: "add_1",         type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "add_1→norm2",               source: "add_1",         target: "norm2",         type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
  { id: "norm2→output",              source: "norm2",         target: "output",        type: "shapeEdge", data: { shape: "[2, 128, 512]",  status: "valid" } },
];

/** Clean TransformerEncoderBlock — 13 nodes, 14 edges, all shapes valid. */
export const STATIC_GRAPH_CLEAN = {
  nodes: _CLEAN_NODES,
  edges: _CLEAN_EDGES,
};

// ── Mismatch version ──────────────────────────────────────────────────────────
// Change: feedforward.3 (Linear) out_features 512 → 768
//   → dropout_1 output shape becomes [2, 128, 768]
//   → the residual Add (add_1) receives [2,128,512] from norm1 and [2,128,768]
//     from dropout_1 → shape mismatch on dropout_1→add_1
//
// This matches execution.md: "changing Linear(512,512) to Linear(512,768)"
// The mismatch message is hardcoded in detect_mismatches.py as
// DEMO_MISMATCH_ATTENTION_FEEDFORWARD (used by AnalysisPanel below).

const _MISMATCH_NODES = _CLEAN_NODES.map((n) => {
  if (n.id === 'feedforward_3') {
    return {
      ...n,
      data: {
        ...n.data,
        shape:  '[2, 128, 768]',                        // wrong output shape
        params: { in_features: 2048, out_features: 768, bias: true },
      },
    };
  }
  if (n.id === 'dropout_1') {
    return {
      ...n,
      data: { ...n.data, shape: '[2, 128, 768]' },      // propagated shape
    };
  }
  return n;
});

const _MISMATCH_EDGES = _CLEAN_EDGES.map((e) => {
  // feedforward_3 → dropout_1: shape changes
  if (e.id === 'feedforward_3→dropout_1') {
    return { ...e, data: { shape: '[2, 128, 768]', status: 'valid' } };
  }
  // dropout_1 → add_1: THIS is the mismatch edge (768 vs 512 from norm1)
  if (e.id === 'dropout_1→add_1') {
    return { ...e, data: { shape: '[2, 128, 768]', status: 'mismatch' } };
  }
  return e;
});

/** Mismatch TransformerEncoderBlock — feedforward.3 projects to 768 instead of 512.
 *  The residual Add (add_1) receives incompatible tensor sizes.
 *  Toggled by Ctrl+Shift+E / Cmd+Shift+E. */
export const STATIC_GRAPH_MISMATCH = {
  nodes: _MISMATCH_NODES,
  edges: _MISMATCH_EDGES,
};

// ── Pre-built mismatch analysis message ──────────────────────────────────────
// Hardcoded verbatim — guaranteed correct regardless of procedural generator.
// Matches DEMO_MISMATCH_ATTENTION_FEEDFORWARD in detect_mismatches.py.
export const DEMO_MISMATCH_MESSAGE = `\
⚠  Shape Mismatch — MultiheadAttention → FeedForward
   MultiheadAttention output:    [2, 128, 512]
   FeedForward expects:          [2, 128, 512]

   The FeedForward block output is [2, 128, 768] because its final Linear projects to 768 instead of 512 — the residual Add then receives tensors of incompatible sizes and cannot execute.

   Suggested fix: Change Linear(2048, 768) → Linear(2048, 512) to restore the residual connection, or update the model dimension consistently throughout the block.`;

// ── Notebook code constants ───────────────────────────────────────────────────

/** The clean notebook code — what the user "typed" in the demo. */
export const DEMO_CODE_CLEAN = `\
import torch
import torch.nn as nn


class TransformerEncoderBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(
            d_model, nhead, dropout=dropout, batch_first=True
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))
        return x
`;

/** The broken notebook code — Linear(dim_feedforward, d_model) changed to Linear(dim_feedforward, 768). */
export const DEMO_CODE_MISMATCH = `\
import torch
import torch.nn as nn


class TransformerEncoderBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(
            d_model, nhead, dropout=dropout, batch_first=True
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, 768),  # BUG: should be d_model (512)
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))  # ← shape mismatch here
        return x
`;

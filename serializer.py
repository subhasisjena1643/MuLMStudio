"""
serializer.py
-------------
µLM Studio — torch.fx graph → React Flow JSON serializer

Public API
----------
  graph_to_json(traced, model, shape_props)  → dict
  build_mha_interior_view()                  → dict

Output schema (React Flow compatible)
--------------------------------------
{
  "nodes": [
    {
      "id":       str,
      "type":     "mlmNode" | "mlmAtomicNode" | "mlmInputNode"
                  "mlmOutputNode" | "mlmFunctionNode" | "mlmUntraceableNode",
      "position": {"x": 0, "y": 0},
      "data": {
        "label":      str,      # human-readable name shown on block
        "op":         str,      # FX op (call_module | call_function | placeholder | output)
        "target":     str,      # FX node.target as string (module path or builtin)
        "shape":      str,      # output tensor shape, e.g. "[2, 128, 512]"
        "sync_state": str,      # "traced" | "atomic" | "untraceable"
        "category":   str,      # µLM category: CORE | ATTENTION | NORM | VISION | ...
        "params":     dict,     # module hyperparameters shown on block face
      }
    }
  ],
  "edges": [
    {
      "id":     str,
      "source": str,            # source node id
      "target": str,            # target node id
      "data": {
        "shape":  str,          # tensor shape flowing through this wire
        "status": str           # "valid" | "mismatch" | "unknown"
      }
    }
  ]
}

getitem Collapsing
------------------
nn.MultiheadAttention returns (attn_output, attn_weights). torch.fx
represents the tuple unpack as two `getitem` call_function nodes. These
are implementation artifacts — they must not appear as visual blocks on
the canvas.

This module collapses them: the `attention` call_module node absorbs
both getitem children. Edges that previously pointed to `getitem` are
redirected to point to `attention` directly.

The output shape for the `attention` node is recovered from the index-0
getitem child (attn_output), which ShapeProp can annotate correctly.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

import torch
import torch.nn as nn
import torch.fx as fx
from torch.fx.passes.shape_prop import ShapeProp


# ─────────────────────────────────────────────────────────────────────────────
# Classification constants  (mirrors fx_trace_validation.py)
# ─────────────────────────────────────────────────────────────────────────────

_ATOMIC_PRIMITIVES: Set[str] = {
    "nn.MultiheadAttention",
    "torch.nn.MultiheadAttention",
    "MultiheadAttention",
}

# Maps PyTorch class name → µLM Studio palette category
_CATEGORY_MAP: Dict[str, str] = {
    # CORE
    "Embedding":          "CORE",
    "Linear":             "CORE",
    "Sequential":         "CORE",
    "Flatten":            "CORE",
    "Identity":           "CORE",
    # ATTENTION
    "MultiheadAttention": "ATTENTION",
    # NORM
    "LayerNorm":          "NORM",
    "RMSNorm":            "NORM",
    "BatchNorm1d":        "NORM",
    "BatchNorm2d":        "NORM",
    "GroupNorm":          "NORM",
    # VISION
    "Conv2d":             "VISION",
    "Conv1d":             "VISION",
    "ConvTranspose2d":    "VISION",
    "AdaptiveAvgPool2d":  "VISION",
    "AdaptiveMaxPool2d":  "VISION",
    "MaxPool2d":          "VISION",
    "AvgPool2d":          "VISION",
    # ACTIVATION
    "ReLU":               "ACTIVATION",
    "GELU":               "ACTIVATION",
    "SiLU":               "ACTIVATION",
    "Tanh":               "ACTIVATION",
    "Sigmoid":            "ACTIVATION",
    "Softmax":            "ACTIVATION",
    "Mish":               "ACTIVATION",
    # REGULARIZATION
    "Dropout":            "REGULARIZATION",
    "Dropout2d":          "REGULARIZATION",
    "AlphaDropout":       "REGULARIZATION",
}

# React Flow custom node type names — registered in the frontend nodeTypes map
_RF_TYPE_FOR_SYNC_STATE: Dict[str, str] = {
    "traced":      "mlmNode",
    "atomic":      "mlmAtomicNode",
    "untraceable": "mlmUntraceableNode",
}


# ─────────────────────────────────────────────────────────────────────────────
# classify_sync_state  (standalone copy — no import of validation script)
# ─────────────────────────────────────────────────────────────────────────────

def classify_sync_state(node: fx.Node, model: nn.Module) -> str:
    """
    Returns the µLM sync state for an FX graph node:

      "traced"      — call_module that traces cleanly; ShapeProp can annotate
      "atomic"      — nn.MultiheadAttention; shape contract hardcoded,
                      internals are not decomposed by FX
      "untraceable" — module target not resolvable; no shape contract available

    Non-module ops (placeholder, output, call_function, call_method) always
    return "traced" — they are FX-native and propagate without issue.
    """
    if node.op != "call_module":
        return "traced"

    module = dict(model.named_modules()).get(str(node.target))
    if module is None:
        return "untraceable"

    fq_name    = f"{module.__class__.__module__}.{module.__class__.__name__}"
    short_name = module.__class__.__name__
    nn_name    = f"nn.{short_name}"

    if fq_name in _ATOMIC_PRIMITIVES or short_name in _ATOMIC_PRIMITIVES or nn_name in _ATOMIC_PRIMITIVES:
        return "atomic"

    return "traced"


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _shape_from_meta(node: fx.Node) -> str:
    """Read output shape from a node's ShapeProp metadata."""
    val = node.meta.get("tensor_meta") or node.meta.get("val")
    if val is None:
        return "[unknown]"
    if hasattr(val, "shape"):
        return str(list(val.shape))
    # Some PyTorch versions store TensorMetadata namedtuples
    if "TensorMetadata" in type(val).__name__:
        return str(list(val.shape))
    return "[unknown]"


def _get_category(node: fx.Node, model: nn.Module) -> str:
    """Map an FX node to a µLM Studio palette category string."""
    if node.op == "placeholder":
        return "INPUT"
    if node.op == "output":
        return "OUTPUT"
    if node.op in ("call_function", "call_method"):
        return "CORE"  # residual add, getattr, etc. — treated as structural CORE ops

    # call_module → look up the concrete class
    module = dict(model.named_modules()).get(str(node.target))
    if module is None:
        return "UNKNOWN"
    return _CATEGORY_MAP.get(module.__class__.__name__, "CORE")

def get_display_label(node, named_modules):
    if node.op == "placeholder":
        return "Input"
    if node.op == "output":
        return "Output"
    if node.op == "call_function":
        fn = getattr(node.target, '__name__', str(node.target))
        return {'add': 'Add', 'mul': 'Multiply'}.get(fn, fn.title())
    if node.op == "call_module":
        module = named_modules.get(str(node.target))
        if module is None:
            return str(node.target)
        return module.__class__.__name__
    return node.name

def _get_label(node: fx.Node, model: nn.Module) -> str:
    """Human-readable block label for a node."""
    if node.op == "placeholder":
        return "Input"
    if node.op == "output":
        return "Output"
    if node.op in ("call_function", "call_method"):
        fn = node.target
        # Built-in function names like <built-in function add>
        name = getattr(fn, "__name__", str(fn))
        label_map = {
            "add":     "Add",
            "mul":     "Multiply",
            "getitem": "GetItem",
            "truediv": "Div",
        }
        return label_map.get(name, name.capitalize())
    # call_module — use the terminal segment of the module path as label,
    # then fall back to the class name for readability
    module = dict(model.named_modules()).get(str(node.target))
    if module is None:
        return str(node.target)
    class_name = module.__class__.__name__
    # Use the last component of the target path (e.g. "feedforward.0" → "feedforward.0")
    # but prefer the class name for top-level modules
    target_str = str(node.target)
    if "." not in target_str:
        return class_name  # top-level module: show class name (e.g. "LayerNorm")
    return f"{target_str}  ({class_name})"  # nested: show both


def _get_module_params(node: fx.Node, model: nn.Module) -> Dict[str, Any]:
    """
    Extract display-worthy hyperparameters from a call_module node's module.
    These appear on the block face in the µLM canvas as metadata rows.
    """
    if node.op != "call_module":
        return {}

    module = dict(model.named_modules()).get(str(node.target))
    if module is None:
        return {}

    cls = type(module)

    if cls == nn.Linear:
        return {
            "in_features":  module.in_features,
            "out_features": module.out_features,
            "bias":         module.bias is not None,
        }
    if cls == nn.MultiheadAttention:
        return {
            "embed_dim":   module.embed_dim,
            "num_heads":   module.num_heads,
            "dropout":     module.dropout,
            "batch_first": module.batch_first,
        }
    if cls == nn.LayerNorm:
        return {"normalized_shape": list(module.normalized_shape)}
    if cls in (nn.Conv2d, nn.Conv1d):
        return {
            "in_channels":  module.in_channels,
            "out_channels": module.out_channels,
            "kernel_size":  list(module.kernel_size) if hasattr(module.kernel_size, "__iter__") else module.kernel_size,
            "padding":      list(module.padding) if hasattr(module.padding, "__iter__") else module.padding,
        }
    if cls in (nn.Dropout, nn.Dropout2d):
        return {"p": module.p}
    if cls == nn.Embedding:
        return {
            "num_embeddings": module.num_embeddings,
            "embedding_dim":  module.embedding_dim,
        }
    if cls == nn.AdaptiveAvgPool2d:
        return {"output_size": list(module.output_size) if hasattr(module.output_size, "__iter__") else module.output_size}

    return {}


# ─────────────────────────────────────────────────────────────────────────────
# getitem collapsing — the core serialization logic for MHA
# ─────────────────────────────────────────────────────────────────────────────

def _build_collapse_maps(
    graph: fx.Graph,
    model: nn.Module,
) -> Tuple[Set[str], Dict[str, str], Dict[str, str]]:
    """
    Identifies getitem nodes that are children of atomic call_module nodes
    (e.g. the two getitem nodes produced by MHA's tuple return) and builds
    two maps used during serialization:

      collapsed_names   — set of node names that must NOT be rendered as RF nodes
      redirect_map      — {collapsed_name: redirect_target_name}
                           When building edges, any source that is in this map
                           is replaced with the redirect target (the atomic parent).
      shape_override    — {atomic_node_name: shape_string}
                           The actual output shape recovered from the index-0
                           getitem child (attn_output), used to populate the
                           atomic node's shape field instead of "[unknown]".

    Returns
    -------
    (collapsed_names, redirect_map, shape_override)
    """
    # 1. Find all atomic call_module nodes
    atomic_node_names: Set[str] = set()
    for node in graph.nodes:
        if classify_sync_state(node, model) == "atomic":
            atomic_node_names.add(node.name)

    collapsed_names: Set[str] = set()
    redirect_map: Dict[str, str] = {}
    shape_override: Dict[str, str] = {}

    # 2. Find getitem children of atomic nodes
    for node in graph.nodes:
        if node.op != "call_function":
            continue

        fn_name = getattr(node.target, "__name__", "")
        if fn_name != "getitem":
            continue

        if not node.args or not isinstance(node.args[0], fx.Node):
            continue

        parent: fx.Node = node.args[0]
        if parent.name not in atomic_node_names:
            continue

        # This is a getitem extracting from an atomic module's tuple output
        collapsed_names.add(node.name)
        redirect_map[node.name] = parent.name

        # Index 0 = primary tensor output (attn_output for MHA)
        # Use its shape to annotate the atomic parent node
        idx = node.args[1] if len(node.args) > 1 else 0
        if idx == 0 and parent.name not in shape_override:
            shape = _shape_from_meta(node)
            if shape != "[unknown]":
                shape_override[parent.name] = shape

    return collapsed_names, redirect_map, shape_override


# ─────────────────────────────────────────────────────────────────────────────
# Edge status — wire color logic
# ─────────────────────────────────────────────────────────────────────────────

def _edge_status(src_shape: str, dst_shape: str) -> str:
    """
    Determines wire status between two connected nodes.

      "valid"    — source and dest shapes are known and compatible
      "unknown"  — one or both shapes are unknown
      "mismatch" — shapes are known but incompatible (detected via last dim)

    This is a prototype-level implementation. Full mismatch detection
    requires domain-specific rules (e.g. batch dims must match, sequence
    dims are passthrough, feature dims must match exactly). The detailed
    per-architecture rules live in the frontend's mismatch detector.
    """
    if src_shape == "[unknown]" or dst_shape == "[unknown]":
        return "unknown"

    # If we know both shapes, they're presumed valid at this stage.
    # A "mismatch" requires knowing the downstream module's *expected* input shape,
    # which is module-class-specific. The backend serializer marks all known-shape
    # edges as "valid" and delegates mismatch detection to the frontend's
    # validateEdges() pass, which has access to the full node params.
    return "valid"


# ─────────────────────────────────────────────────────────────────────────────
# graph_to_json — main serializer
# ─────────────────────────────────────────────────────────────────────────────

def graph_to_json(
    traced: fx.GraphModule,
    model: nn.Module,
    shape_props: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Convert a torch.fx GraphModule into a React Flow-compatible JSON graph.

    Parameters
    ----------
    traced : fx.GraphModule
        The output of torch.fx.symbolic_trace(model). ShapeProp must have
        already been run on this graph (i.e. node.meta is populated).
    model : nn.Module
        The original nn.Module. Required for module lookup in classify_sync_state
        and for extracting hyperparameters. Must be the same model that was
        passed to symbolic_trace.
    shape_props : dict[str, str] | None
        Optional {node_name: shape_string} overrides. Takes precedence over
        node.meta. Useful for injecting hardcoded atomic contracts or for
        tests that don't run ShapeProp.

    Returns
    -------
    dict with keys "nodes" and "edges", ready for JSON serialization.

    Notes on getitem collapsing
    ---------------------------
    MHA's (attn_output, attn_weights) tuple return produces two getitem
    call_function nodes in the FX graph. These are collapsed:
      - Neither getitem appears as a React Flow node.
      - Edges sourced from either getitem are redirected to the `attention`
        call_module node.
      - The `attention` node's shape field is populated from getitem[0]'s
        ShapeProp annotation (the actual attn_output shape).
    """
    graph: fx.Graph = traced.graph
    named_modules_cache: Dict[str, nn.Module] = dict(model.named_modules())

    # ── Pre-pass: build collapse maps ────────────────────────────────────────
    collapsed_names, redirect_map, shape_override = _build_collapse_maps(graph, model)

    # Merge caller-supplied overrides on top of auto-detected ones
    if shape_props:
        shape_override.update(shape_props)

    # ── Helpers that respect the override maps ────────────────────────────────

    def _get_shape(node: fx.Node) -> str:
        if node.name in shape_override:
            return shape_override[node.name]
        return _shape_from_meta(node)

    def _resolve_source(node: fx.Node) -> str:
        """Follow redirect_map until we reach a renderable node."""
        name = node.name
        visited: Set[str] = set()
        while name in redirect_map and name not in visited:
            visited.add(name)
            name = redirect_map[name]
        return name

    # ── Build React Flow nodes ────────────────────────────────────────────────
    rf_nodes: List[Dict[str, Any]] = []
    node_id_set: Set[str] = set()  # tracks which node IDs exist (for edge validation)

    for node in graph.nodes:
        # Skip collapsed getitem children of atomic nodes
        if node.name in collapsed_names:
            continue

        sync_state = classify_sync_state(node, model)
        shape      = _get_shape(node)
        category   = _get_category(node, model)
        params     = _get_module_params(node, model)
        label      = _get_label(node, model)

        # Determine React Flow node type
        if node.op == "placeholder":
            rf_type = "mlmInputNode"
        elif node.op == "output":
            rf_type = "mlmOutputNode"
        elif node.op in ("call_function", "call_method"):
            rf_type = "mlmFunctionNode"
        else:
            # call_module — use sync_state
            rf_type = _RF_TYPE_FOR_SYNC_STATE.get(sync_state, "mlmNode")

        rf_nodes.append({
            "id":       node.name,
            "type":     rf_type,
            "position": {"x": 0, "y": 0},   # frontend handles layout (Dagre / ELK)
            "data": {
                "label":      label,
                "op":         node.op,
                "target":     str(node.target),
                "shape":      shape,
                "sync_state": sync_state,
                "category":   category,
                "params":     params,
            },
        })
        node_id_set.add(node.name)

    # ── Build React Flow edges ────────────────────────────────────────────────
    rf_edges: List[Dict[str, Any]] = []
    seen_edge_ids: Set[str] = set()

    for node in graph.nodes:
        # Skip collapsed nodes — they have no RF representation
        if node.name in collapsed_names:
            continue
        # output nodes are valid edge TARGETS (e.g. norm2 → output)
        # but they are never edge SOURCES (nothing is downstream of output)

        target_id = node.name

        for arg in node.args:
            # Only care about Node args (not ints, floats, None, etc.)
            if not isinstance(arg, fx.Node):
                continue

            # Resolve through redirect map (collapses getitem → atomic parent)
            source_id = _resolve_source(arg)

            # Skip self-loops (shouldn't happen but guard anyway)
            if source_id == target_id:
                continue

            # Skip edges referencing nodes that don't exist in the RF graph
            if source_id not in node_id_set:
                continue

            edge_id = f"{source_id}→{target_id}"
            if edge_id in seen_edge_ids:
                continue
            seen_edge_ids.add(edge_id)

            # Wire shape = output shape of the source node
            source_node = next(n for n in graph.nodes if n.name == source_id)
            wire_shape  = _get_shape(source_node)
            # Destination shape for mismatch detection (informational — see _edge_status)
            dst_shape   = _get_shape(node)
            status      = _edge_status(wire_shape, dst_shape)

            rf_edges.append({
                "id":     edge_id,
                "source": source_id,
                "target": target_id,
                "data": {
                    "shape":  wire_shape,
                    "status": status,
                },
            })

    return {"nodes": rf_nodes, "edges": rf_edges}


# ─────────────────────────────────────────────────────────────────────────────
# build_mha_interior_view — static hardcoded drill-down graph for MHA
# ─────────────────────────────────────────────────────────────────────────────

def build_mha_interior_view(
    embed_dim: int = 512,
    num_heads: int = 8,
) -> Dict[str, Any]:
    """
    Returns a hardcoded static React Flow graph representing the interior
    of an nn.MultiheadAttention block for the drill-down view.

    This is the prototype's Mathematical Contract implementation for MHA:
    since symbolic_trace treats MHA as opaque, the interior is defined by
    the known architectural contract rather than traced structure.

    Architecture represented
    ------------------------
         Input (Q / K / V)
               │
      ┌────────┼────────┐
      ▼        ▼        ▼
    Q proj   K proj   V proj
    (Linear) (Linear) (Linear)
      │        │        │
      └────────┼────────┘
               ▼
      Scaled Dot-Product Attention
      (softmax(QKᵀ/√d_k) · V)
               │
               ▼
      Output Projection (Linear)
               │
               ▼
            Output

    Parameters
    ----------
    embed_dim : int   — MHA embed_dim (default 512, matches prototype demo)
    num_heads : int   — MHA num_heads (default 8)

    Returns
    -------
    dict with "nodes" and "edges" keys in React Flow format.
    """
    head_dim = embed_dim // num_heads
    qkv_shape = f"[batch, seq, {embed_dim}]"
    proj_shape = f"[batch, seq, {embed_dim}]"
    sdpa_shape = f"[batch, {num_heads}, seq, {head_dim}]"
    attn_shape = f"[batch, seq, {embed_dim}]"

    nodes = [
        {
            "id":       "mha_input",
            "type":     "mlmInputNode",
            "position": {"x": 300, "y": 0},
            "data": {
                "label":      "Input (Q / K / V)",
                "op":         "placeholder",
                "target":     "input",
                "shape":      qkv_shape,
                "sync_state": "traced",
                "category":   "INPUT",
                "params":     {"note": "Q, K, V are identical for self-attention"},
            },
        },
        {
            "id":       "mha_q_proj",
            "type":     "mlmNode",
            "position": {"x": 0, "y": 160},
            "data": {
                "label":      "Q Projection",
                "op":         "call_module",
                "target":     "attention.q_proj_weight",
                "shape":      proj_shape,
                "sync_state": "traced",
                "category":   "CORE",
                "params": {
                    "in_features":  embed_dim,
                    "out_features": embed_dim,
                    "note":         "Linear (no bias by default)",
                },
            },
        },
        {
            "id":       "mha_k_proj",
            "type":     "mlmNode",
            "position": {"x": 300, "y": 160},
            "data": {
                "label":      "K Projection",
                "op":         "call_module",
                "target":     "attention.k_proj_weight",
                "shape":      proj_shape,
                "sync_state": "traced",
                "category":   "CORE",
                "params": {
                    "in_features":  embed_dim,
                    "out_features": embed_dim,
                    "note":         "Linear (no bias by default)",
                },
            },
        },
        {
            "id":       "mha_v_proj",
            "type":     "mlmNode",
            "position": {"x": 600, "y": 160},
            "data": {
                "label":      "V Projection",
                "op":         "call_module",
                "target":     "attention.v_proj_weight",
                "shape":      proj_shape,
                "sync_state": "traced",
                "category":   "CORE",
                "params": {
                    "in_features":  embed_dim,
                    "out_features": embed_dim,
                    "note":         "Linear (no bias by default)",
                },
            },
        },
        {
            "id":       "mha_sdpa",
            "type":     "mlmNode",
            "position": {"x": 300, "y": 320},
            "data": {
                "label":      "Scaled Dot-Product Attention",
                "op":         "call_function",
                "target":     "F.scaled_dot_product_attention",
                "shape":      sdpa_shape,
                "sync_state": "traced",
                "category":   "ATTENTION",
                "params": {
                    "formula":    "softmax(QKᵀ / √d_k) · V",
                    "num_heads":  num_heads,
                    "head_dim":   head_dim,
                    "scale":      f"1 / √{head_dim} = {1/(head_dim**0.5):.4f}",
                },
            },
        },
        {
            "id":       "mha_out_proj",
            "type":     "mlmNode",
            "position": {"x": 300, "y": 480},
            "data": {
                "label":      "Output Projection",
                "op":         "call_module",
                "target":     "attention.out_proj",
                "shape":      attn_shape,
                "sync_state": "traced",
                "category":   "CORE",
                "params": {
                    "in_features":  embed_dim,
                    "out_features": embed_dim,
                    "bias":         True,
                },
            },
        },
        {
            "id":       "mha_output",
            "type":     "mlmOutputNode",
            "position": {"x": 300, "y": 640},
            "data": {
                "label":      "Output",
                "op":         "output",
                "target":     "output",
                "shape":      attn_shape,
                "sync_state": "traced",
                "category":   "OUTPUT",
                "params":     {},
            },
        },
    ]

    edges = [
        # Input fans out to Q, K, V projections
        {
            "id":     "mha_input→mha_q_proj",
            "source": "mha_input",
            "target": "mha_q_proj",
            "data":   {"shape": qkv_shape, "status": "valid"},
        },
        {
            "id":     "mha_input→mha_k_proj",
            "source": "mha_input",
            "target": "mha_k_proj",
            "data":   {"shape": qkv_shape, "status": "valid"},
        },
        {
            "id":     "mha_input→mha_v_proj",
            "source": "mha_input",
            "target": "mha_v_proj",
            "data":   {"shape": qkv_shape, "status": "valid"},
        },
        # Q, K, V projections fan into Scaled Dot-Product Attention
        {
            "id":     "mha_q_proj→mha_sdpa",
            "source": "mha_q_proj",
            "target": "mha_sdpa",
            "data":   {"shape": proj_shape, "status": "valid"},
        },
        {
            "id":     "mha_k_proj→mha_sdpa",
            "source": "mha_k_proj",
            "target": "mha_sdpa",
            "data":   {"shape": proj_shape, "status": "valid"},
        },
        {
            "id":     "mha_v_proj→mha_sdpa",
            "source": "mha_v_proj",
            "target": "mha_sdpa",
            "data":   {"shape": proj_shape, "status": "valid"},
        },
        # SDPA → Output Projection → Output
        {
            "id":     "mha_sdpa→mha_out_proj",
            "source": "mha_sdpa",
            "target": "mha_out_proj",
            "data":   {"shape": sdpa_shape, "status": "valid"},
        },
        {
            "id":     "mha_out_proj→mha_output",
            "source": "mha_out_proj",
            "target": "mha_output",
            "data":   {"shape": attn_shape, "status": "valid"},
        },
    ]

    return {"nodes": nodes, "edges": edges}


# ─────────────────────────────────────────────────────────────────────────────
# Test harness — run against the TransformerEncoderBlock from Day 1 spike
# ─────────────────────────────────────────────────────────────────────────────

class TransformerEncoderBlock(nn.Module):
    """Day 1 spike model — identical to fx_trace_validation.py."""
    def __init__(self, d_model: int = 512, nhead: int = 8, dim_feedforward: int = 2048, dropout: float = 0.1):
        super().__init__()
        self.attention   = nn.MultiheadAttention(embed_dim=d_model, num_heads=nhead, dropout=dropout, batch_first=True)
        self.norm1       = nn.LayerNorm(d_model)
        self.norm2       = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))
        return x


def _print_section(title: str) -> None:
    print(f"\n{'─'*64}")
    print(f"  {title}")
    print(f"{'─'*64}")


def _summarise_graph(graph_json: Dict[str, Any], title: str) -> None:
    """Print a human-readable summary of a serialized React Flow graph."""
    _print_section(title)
    nodes = graph_json["nodes"]
    edges = graph_json["edges"]

    print(f"\n  {len(nodes)} nodes, {len(edges)} edges\n")
    print(f"  {'ID':<22} {'TYPE':<22} {'SYNC':<14} {'CATEGORY':<16} {'SHAPE'}")
    print(f"  {'─'*22} {'─'*22} {'─'*14} {'─'*16} {'─'*26}")

    for n in nodes:
        d = n["data"]
        print(f"  {n['id']:<22} {n['type']:<22} {d['sync_state']:<14} {d['category']:<16} {d['shape']}")

    print(f"\n  {'EDGE ID':<40} {'WIRE SHAPE':<26} {'STATUS'}")
    print(f"  {'─'*40} {'─'*26} {'─'*10}")
    for e in edges:
        edge_display = f"{e['source']}  →  {e['target']}"
        print(f"  {edge_display:<40} {e['data']['shape']:<26} {e['data']['status']}")


def main() -> None:
    print("\n  µLM Studio — serializer.py test")
    print(f"  PyTorch {torch.__version__}  |  Python {sys.version.split()[0]}")

    # ── 1. Trace + ShapeProp ──────────────────────────────────────────────────
    model = TransformerEncoderBlock()
    model.eval()

    traced = fx.symbolic_trace(model)
    dummy  = torch.randn(2, 128, 512)
    ShapeProp(traced).propagate(dummy)

    _print_section("Raw FX graph (pre-serialization)")
    print(f"\n  {'NAME':<22} {'OP':<16} {'TARGET':<32} {'META SHAPE'}")
    print(f"  {'─'*22} {'─'*16} {'─'*32} {'─'*26}")
    for node in traced.graph.nodes:
        raw = _shape_from_meta(node)
        print(f"  {node.name:<22} {node.op:<16} {str(node.target)[:30]:<32} {raw}")

    # ── 2. graph_to_json ──────────────────────────────────────────────────────
    graph_json = graph_to_json(traced, model)
    _summarise_graph(graph_json, "graph_to_json — TransformerEncoderBlock")

    # ── 3. Full JSON output ───────────────────────────────────────────────────
    _print_section("Full JSON output (graph_to_json)")
    print(json.dumps(graph_json, indent=2))

    # ── 4. MHA interior view ──────────────────────────────────────────────────
    mha_view = build_mha_interior_view(embed_dim=512, num_heads=8)
    _summarise_graph(mha_view, "build_mha_interior_view — hardcoded drill-down")
    _print_section("Full JSON output (build_mha_interior_view)")
    print(json.dumps(mha_view, indent=2))

    # ── 5. Assertions ─────────────────────────────────────────────────────────
    _print_section("Assertions")

    node_ids = {n["id"] for n in graph_json["nodes"]}

    # getitem nodes must be collapsed (not present in RF graph)
    assert "getitem" not in node_ids,  "FAIL: getitem should be collapsed"
    assert "getitem_1" not in node_ids, "FAIL: getitem_1 should be collapsed"
    print("  ✓  getitem nodes collapsed — not present in React Flow graph")

    # attention node must be present and classified atomic
    attention_node = next(n for n in graph_json["nodes"] if n["id"] == "attention")
    assert attention_node["data"]["sync_state"] == "atomic", "FAIL: attention must be atomic"
    print("  ✓  attention node present, sync_state = 'atomic'")

    # attention node must have recovered shape (not [unknown])
    assert attention_node["data"]["shape"] != "[unknown]", \
        f"FAIL: attention shape should be recovered from getitem, got {attention_node['data']['shape']}"
    print(f"  ✓  attention node shape recovered: {attention_node['data']['shape']}")

    # attention node must be mlmAtomicNode type
    assert attention_node["type"] == "mlmAtomicNode", \
        f"FAIL: attention type should be mlmAtomicNode, got {attention_node['type']}"
    print("  ✓  attention node type = 'mlmAtomicNode'")

    # All edges must reference existing node IDs
    edge_sources = {e["source"] for e in graph_json["edges"]}
    edge_targets = {e["target"] for e in graph_json["edges"]}
    dangling = (edge_sources | edge_targets) - node_ids
    assert not dangling, f"FAIL: dangling edge references: {dangling}"
    print("  ✓  all edge sources and targets reference existing nodes")

    # MHA interior view must have exactly 7 nodes and 8 edges
    assert len(mha_view["nodes"]) == 7, f"FAIL: MHA interior should have 7 nodes, got {len(mha_view['nodes'])}"
    assert len(mha_view["edges"]) == 8, f"FAIL: MHA interior should have 8 edges, got {len(mha_view['edges'])}"
    print("  ✓  MHA interior view: 7 nodes, 8 edges")

    print("\n  All assertions passed.\n")


if __name__ == "__main__":
    main()

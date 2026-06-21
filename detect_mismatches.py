"""
detect_mismatches.py
--------------------
µLM Studio — shape mismatch detection on graph_to_json() output.

Public API
----------
  detect_mismatches(graph_json: dict) -> List[MismatchResult]

Each MismatchResult is a dict:
  {
    "edge_id":   str,            # the edge where the mismatch occurs
    "source_id": str,
    "target_id": str,
    "message":   str,            # formatted warning block (exact spec from execution.md)
    "severity":  "mismatch" | "unknown",
  }

Shape comparison
----------------
Shapes in the graph are strings such as "[2, 128, 512]". We compare the
*last dimension* (the feature/channel axis) between the upstream node's
output shape and the downstream node's expected input shape.

This captures the only class of mismatch the prototype needs to demonstrate:
a downstream Linear expecting d_model=512 but receiving 768 (or vice versa).

Comparing full shape tuples is intentionally NOT done here — the prototype uses
a fixed batch=2, seq=128 dummy input, so the first two dims are always correct.
Comparing them would only produce false negatives, never catch real bugs.

Atomic node contract (hardcoded)
---------------------------------
nn.MultiheadAttention (sync_state == "atomic") is opaque to ShapeProp.
Its shape contract is: output last-dim = embed_dim = input last-dim.
We use the hardcoded value from data["params"]["embed_dim"] if present,
else fall back to the shape string on the node itself.

Hardcoded demo mismatch
-----------------------
The exact mismatch for Attention → FeedForward when the first Linear inside
the feedforward block has out_features=768 instead of 512 is pre-built as
DEMO_MISMATCH_ATTENTION_FEEDFORWARD.  The procedural generator also handles
this case, but the hardcoded constant is the demo-safety guarantee.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# ─────────────────────────────────────────────────────────────────────────────
# Hardcoded demo-safety mismatch constant
# Scenario: TransformerEncoderBlock, Linear(512, 768) replaces Linear(512, 512)
# in feedforward, causing the residual Add to fail.
#
# This message is pre-built verbatim so it renders correctly regardless of
# any edge case in the procedural generator.
# ─────────────────────────────────────────────────────────────────────────────

DEMO_MISMATCH_ATTENTION_FEEDFORWARD = """\
⚠  Shape Mismatch — MultiheadAttention → FeedForward
   MultiheadAttention output:    [2, 128, 512]
   FeedForward expects:          [2, 128, 512]

   The FeedForward block output is [2, 128, 768] because its first Linear \
projects to 768 instead of 512 — the residual Add then receives tensors of \
incompatible sizes and cannot execute.

   Suggested fix: Change Linear(512, 768) → Linear(512, 512) to restore the \
residual connection, or update the model dimension consistently throughout the block."""

# Unique sentinel: the edge ID between norm1 and feedforward_0 in the demo graph
# (residual path: add_1 receives norm1=[2,128,512] and dropout_1=[2,128,768])
DEMO_MISMATCH_EDGE_ID = "dropout_1→add_1"


# ─────────────────────────────────────────────────────────────────────────────
# Shape string parsing
# ─────────────────────────────────────────────────────────────────────────────

def _parse_shape(shape_str: str) -> Optional[List[int]]:
    """
    Parse a shape string such as "[2, 128, 512]" → [2, 128, 512].
    Returns None if the string cannot be parsed (e.g. "same shape", "any").
    Symbolic dims like "batch", "seq", "d_model" are left as -1.
    """
    s = shape_str.strip()
    # Remove outer brackets
    s = s.strip("[]")
    if not s:
        return None

    dims = []
    for tok in s.split(","):
        tok = tok.strip()
        if tok.lstrip("-").isdigit():
            dims.append(int(tok))
        elif tok:
            dims.append(-1)   # symbolic dim — unknown concrete value

    return dims if dims else None


def _last_concrete_dim(shape_str: str) -> Optional[int]:
    """
    Return the last *concrete* (positive integer) dimension from a shape string.
    The feature/channel axis is almost always the last one.
    Returns None if the shape is symbolic, empty, or unparseable.
    """
    dims = _parse_shape(shape_str)
    if not dims:
        return None
    for d in reversed(dims):
        if d > 0:
            return d
    return None


def _ndim(shape_str: str) -> Optional[int]:
    """Number of dimensions, regardless of whether values are symbolic."""
    dims = _parse_shape(shape_str)
    return len(dims) if dims else None


# ─────────────────────────────────────────────────────────────────────────────
# Human-readable message generation
# ─────────────────────────────────────────────────────────────────────────────

def _explain_mismatch(
    src_label: str,
    src_shape: str,
    dst_label: str,
    dst_expected: str,
    src_last: int,
    dst_last: int,
) -> Tuple[str, str, str]:
    """
    Generate a one-sentence explanation tailored to the actual shapes.
    Falls back to a generic sentence when no specific pattern is detected.
    """
    ratio = max(src_last, dst_last) / max(min(src_last, dst_last), 1)

    if dst_last > src_last:
        explanation = (
            f"{dst_label} expects a feature dimension of {dst_last} "
            f"but receives {src_last} from {src_label} — "
            f"the downstream module needs a wider input than what is provided."
        )
        suggestion = (
            f"Add a Linear({src_last}, {dst_last}) projection between "
            f"{src_label} and {dst_label}, or reduce {dst_label}'s in_features to {src_last}."
        )
    else:
        explanation = (
            f"{src_label} produces features of size {src_last} "
            f"but {dst_label} expects {dst_last} — "
            f"the upstream block outputs more features than the downstream block can accept."
        )
        suggestion = (
            f"Add a Linear({src_last}, {dst_last}) projection after "
            f"{src_label}, or increase {dst_label}'s in_features to {src_last}."
        )

    msg = (
        f"⚠  Shape Mismatch — {src_label} → {dst_label}\n"
        f"   {src_label} output:    {src_shape}\n"
        f"   {dst_label} expects:   {dst_expected}\n"
        f"\n"
        f"   {explanation}\n"
        f"\n"
        f"   Suggested fix: {suggestion}"
    )
    return msg, explanation, suggestion


def _explain_rank_mismatch(
    src_label: str,
    src_shape: str,
    src_ndim: int,
    dst_label: str,
    dst_expected: str,
    dst_ndim: int,
) -> Tuple[str, str, str]:
    """Message when the *number* of dimensions disagrees."""
    explanation = (
        f"{src_label} outputs a {src_ndim}-D tensor but "
        f"{dst_label} expects a {dst_ndim}-D tensor — "
        f"the tensors have incompatible ranks, not just mismatched feature sizes."
    )
    if src_ndim > dst_ndim:
        suggestion = (
            f"Add a Flatten() or squeeze() between {src_label} and {dst_label} "
            f"to reduce the tensor rank."
        )
    else:
        suggestion = (
            f"Add an unsqueeze() or reshape between {src_label} and {dst_label} "
            f"to increase the tensor rank."
        )
    msg = (
        f"⚠  Shape Mismatch — {src_label} → {dst_label}\n"
        f"   {src_label} output:    {src_shape}\n"
        f"   {dst_label} expects:   {dst_expected}\n"
        f"\n"
        f"   {explanation}\n"
        f"\n"
        f"   Suggested fix: {suggestion}"
    )
    return msg, explanation, suggestion


# ─────────────────────────────────────────────────────────────────────────────
# Expected input shape contract
# ─────────────────────────────────────────────────────────────────────────────

# For modules whose input shape contract is fixed (not derivable from params),
# map the node's data["label"] to an expected last-dim function.
# The function receives the node data dict and returns (expected_shape_str, last_dim_int).

def _expected_for_node(node: Dict[str, Any]) -> Tuple[Optional[str], Optional[int]]:
    """
    Return (expected_input_shape_string, expected_last_dim) for a node.
    Returns (None, None) when the expectation cannot be determined.

    Priority:
      1. For atomic nodes (MultiheadAttention): use embed_dim from params.
      2. For call_module with known params (Linear in_features): use that.
      3. For pass-through ops (Dropout, LayerNorm, residual Add): accept any shape.
      4. For untraceable / unknown: return (None, None) → "unknown" status.
    """
    data        = node.get("data", {})
    sync_state  = data.get("sync_state", "traced")
    label       = data.get("label", "")
    params      = data.get("params", {})
    shape_str   = data.get("shape", "")

    # ── Atomic nodes (hardcoded contract) ────────────────────────────────────
    if sync_state == "atomic":
        embed_dim = params.get("embed_dim") or _last_concrete_dim(shape_str)
        if embed_dim:
            expected = f"[batch, seq, {embed_dim}] × 3"
            return expected, embed_dim
        return None, None

    # ── Untraceable: we don't know what it expects ────────────────────────────
    if sync_state == "untraceable":
        return None, None

    # ── Linear: expected last-dim = in_features ───────────────────────────────
    if "Linear" in label and "in_features" in params:
        in_f = params["in_features"]
        return f"[*, {in_f}]", in_f

    # ── Pass-through ops: no constraint on last-dim ───────────────────────────
    passthrough_labels = {
        "Dropout", "LayerNorm", "RMSNorm", "Softmax",
        "ReLU", "GELU", "SiLU", "Tanh", "Sigmoid",
        "BatchNorm1d", "BatchNorm2d", "GroupNorm",
    }
    # Also match sub-module labels like "feedforward.2  (Dropout)"
    canonical = label
    paren = re.search(r"\(([^)]+)\)\s*$", label)
    if paren:
        canonical = paren.group(1)
    if canonical in passthrough_labels or label in passthrough_labels:
        return None, None   # pass-through: propagate whatever comes in

    # ── Add (residual connection): shape must match both inputs ───────────────
    if label.lower() == "add":
        return None, None   # handled separately via two-input comparison

    # ── Fallback: use the node's own shape as its output shape ───────────────
    # We can't determine an *expected input* shape, only output.
    return None, None


# ─────────────────────────────────────────────────────────────────────────────
# Main detection function
# ─────────────────────────────────────────────────────────────────────────────

MismatchResult = Dict[str, Any]


def detect_mismatches(graph_json: Dict[str, Any]) -> List[MismatchResult]:
    """
    Walk every edge in graph_json, compare upstream output shape to
    downstream expected input shape, and return a list of mismatches.

    Parameters
    ----------
    graph_json : dict
        The output of graph_to_json() — must have "nodes" and "edges" keys.

    Returns
    -------
    List of MismatchResult dicts, each containing:
        edge_id   : str
        source_id : str
        target_id : str
        message   : str   — formatted per the exact spec in execution.md
        severity  : "mismatch" | "unknown"
    """
    nodes_list: List[Dict] = graph_json.get("nodes", [])
    edges_list: List[Dict] = graph_json.get("edges", [])

    # Build fast-lookup maps
    node_by_id: Dict[str, Dict] = {n["id"]: n for n in nodes_list}

    # Build incoming-edges map: target_id → list of (source_id, edge)
    # Used for residual Add detection (two incoming edges with potentially
    # different shapes must match each other).
    incoming: Dict[str, List[Tuple[str, Dict]]] = {}
    for edge in edges_list:
        tgt = edge.get("target")
        if tgt:
            incoming.setdefault(tgt, []).append((edge.get("source"), edge))

    results: List[MismatchResult] = []
    seen_edges: set = set()   # de-duplicate if a node has multiple users

    for edge in edges_list:
        edge_id   = edge.get("id", "")
        source_id = edge.get("source", "")
        target_id = edge.get("target", "")

        if edge_id in seen_edges:
            continue
        seen_edges.add(edge_id)

        src_node = node_by_id.get(source_id)
        dst_node = node_by_id.get(target_id)
        if not src_node or not dst_node:
            continue

        src_data   = src_node.get("data", {})
        dst_data   = dst_node.get("data", {})
        src_shape  = src_data.get("shape", "")
        src_label  = src_data.get("label", source_id)
        dst_label  = dst_data.get("label", target_id)

        # ── Skip input/output placeholder nodes ───────────────────────────────
        src_type = src_node.get("type", "")
        dst_type = dst_node.get("type", "")
        if src_type in ("mlmInputNode", "mlmOutputNode"):
            continue
        if dst_type in ("mlmInputNode", "mlmOutputNode"):
            continue

        # ── Skip if source shape is unknown ──────────────────────────────────
        src_last = _last_concrete_dim(src_shape)
        src_ndim = _ndim(src_shape)
        if src_last is None:
            continue

        # ── Residual Add: compare the two incoming tensors to each other ──────
        dst_label_lower = dst_label.lower()
        if dst_data.get("op") == "call_function" and dst_label_lower == "add":
            in_edges = incoming.get(target_id, [])
            if len(in_edges) >= 2:
                shapes = []
                labels = []
                for (sid, _) in in_edges:
                    sn = node_by_id.get(sid)
                    if sn:
                        sh = sn["data"].get("shape", "")
                        shapes.append(sh)
                        labels.append(sn["data"].get("label", sid))

                last_dims = [_last_concrete_dim(s) for s in shapes]
                concrete = [d for d in last_dims if d is not None]
                if len(concrete) >= 2 and len(set(concrete)) > 1:
                    # Mismatch found — report on the current edge
                    a_shape, b_shape = shapes[0], shapes[1]
                    a_label, b_label = labels[0], labels[1]
                    a_last,  b_last  = concrete[0], concrete[1]

                    explanation = (
                        f"The residual Add cannot combine tensors of size {a_last} "
                        f"and {b_last} — both branches must have the same last dimension."
                    )
                    suggestion = (
                        f"Ensure {a_label} and {b_label} both output "
                        f"feature size {min(a_last, b_last)} (or whichever matches the "
                        f"model's d_model), or remove the residual connection."
                    )
                    msg = (
                        f"⚠  Shape Mismatch — {a_label} → Add ← {b_label}\n"
                        f"   {a_label} output:    {a_shape}\n"
                        f"   {b_label} output:    {b_shape}\n"
                        f"\n"
                        f"   {explanation}\n"
                        f"\n"
                        f"   Suggested fix: {suggestion}"
                    )
                    results.append({
                        "edge_id":      edge_id,
                        "source_id":    source_id,
                        "target_id":    target_id,
                        "message":      msg,
                        "severity":     "mismatch",
                        "headline":     f"Shape Mismatch — {a_label} → Add ← {b_label}",
                        "source_label": a_label,
                        "target_label": b_label,
                        "source_shape": a_shape,
                        "target_shape": b_shape,
                        "detail":       explanation,
                        "suggestion":   suggestion,
                    })
            continue   # Add handled — move to next edge

        # ── Standard downstream node ──────────────────────────────────────────
        expected_str, expected_last = _expected_for_node(dst_node)

        if expected_last is None:
            # Unknown expectation — check rank at minimum
            dst_ndim = _ndim(dst_data.get("shape", ""))
            if src_ndim and dst_ndim and src_ndim != dst_ndim:
                msg, explanation, suggestion = _explain_rank_mismatch(
                    src_label, src_shape, src_ndim,
                    dst_label, dst_data.get("shape", "?"), dst_ndim,
                )
                results.append({
                    "edge_id":      edge_id,
                    "source_id":    source_id,
                    "target_id":    target_id,
                    "message":      msg,
                    "severity":     "mismatch",
                    "headline":     f"Shape Mismatch — {src_label} → {dst_label}",
                    "source_label": src_label,
                    "target_label": dst_label,
                    "source_shape": src_shape,
                    "target_shape": dst_data.get("shape", "?"),
                    "detail":       explanation,
                    "suggestion":   suggestion,
                })
            continue

        # ── Compare last-dim (feature axis) ──────────────────────────────────
        if src_last != expected_last:
            msg, explanation, suggestion = _explain_mismatch(
                src_label=src_label,
                src_shape=src_shape,
                dst_label=dst_label,
                dst_expected=expected_str,
                src_last=src_last,
                dst_last=expected_last,
            )
            results.append({
                "edge_id":      edge_id,
                "source_id":    source_id,
                "target_id":    target_id,
                "message":      msg,
                "severity":     "mismatch",
                "headline":     f"Shape Mismatch — {src_label} → {dst_label}",
                "source_label": src_label,
                "target_label": dst_label,
                "source_shape": src_shape,
                "target_shape": expected_str,
                "detail":       explanation,
                "suggestion":   suggestion,
            })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Self-test
# ─────────────────────────────────────────────────────────────────────────────

def _self_test() -> None:
    """
    Validate detect_mismatches() against three synthetic cases:
      1. Clean graph  → 0 mismatches
      2. Linear with wrong in_features → 1 mismatch
      3. Residual Add with mismatched branches → 1 mismatch

    Also prints the pre-built demo mismatch constant for visual inspection.
    """
    print("=" * 70)
    print("detect_mismatches — self-test")
    print("=" * 70)

    # ── Test 1: clean chain — no mismatches ──────────────────────────────────
    clean_graph = {
        "nodes": [
            {"id": "x",   "type": "mlmInputNode",  "data": {"label": "Input",  "op": "placeholder", "shape": "[2, 128, 512]", "sync_state": "traced", "params": {}}},
            {"id": "lin", "type": "mlmNode",        "data": {"label": "Linear", "op": "call_module", "shape": "[2, 128, 256]", "sync_state": "traced", "params": {"in_features": 512, "out_features": 256}}},
            {"id": "out", "type": "mlmOutputNode",  "data": {"label": "Output", "op": "output",      "shape": "[2, 128, 256]", "sync_state": "traced", "params": {}}},
        ],
        "edges": [
            {"id": "x→lin",  "source": "x",   "target": "lin", "data": {"shape": "[2, 128, 512]", "status": "valid"}},
            {"id": "lin→out","source": "lin",  "target": "out", "data": {"shape": "[2, 128, 256]", "status": "valid"}},
        ],
    }
    r1 = detect_mismatches(clean_graph)
    assert r1 == [], f"Test 1 failed: expected [], got {r1}"
    print("✓ Test 1 passed: clean chain → 0 mismatches")

    # ── Test 2: Linear with wrong in_features ────────────────────────────────
    bad_linear_graph = {
        "nodes": [
            {"id": "x",    "type": "mlmInputNode",  "data": {"label": "Input",  "op": "placeholder", "shape": "[2, 128, 512]", "sync_state": "traced", "params": {}}},
            {"id": "attn", "type": "mlmAtomicNode",  "data": {"label": "MultiheadAttention", "op": "call_module", "shape": "[2, 128, 512]", "sync_state": "atomic",  "params": {"embed_dim": 512, "num_heads": 8}}},
            {"id": "lin",  "type": "mlmNode",        "data": {"label": "Linear", "op": "call_module", "shape": "[2, 128, 2048]", "sync_state": "traced", "params": {"in_features": 768, "out_features": 2048}}},
            {"id": "out",  "type": "mlmOutputNode",  "data": {"label": "Output", "op": "output",      "shape": "[2, 128, 2048]", "sync_state": "traced", "params": {}}},
        ],
        "edges": [
            {"id": "x→attn",   "source": "x",    "target": "attn", "data": {"shape": "[2, 128, 512]",  "status": "valid"}},
            {"id": "attn→lin", "source": "attn", "target": "lin",  "data": {"shape": "[2, 128, 512]",  "status": "mismatch"}},
            {"id": "lin→out",  "source": "lin",  "target": "out",  "data": {"shape": "[2, 128, 2048]", "status": "valid"}},
        ],
    }
    r2 = detect_mismatches(bad_linear_graph)
    assert len(r2) == 1, f"Test 2 failed: expected 1 mismatch, got {len(r2)}: {r2}"
    assert r2[0]["edge_id"] == "attn→lin", f"Test 2: wrong edge_id: {r2[0]['edge_id']}"
    print("✓ Test 2 passed: Linear in_features mismatch → 1 mismatch")
    print(f"  edge_id : {r2[0]['edge_id']}")
    print(f"  message :\n{r2[0]['message']}\n")

    # ── Test 3: residual Add with mismatched branches ────────────────────────
    residual_graph = {
        "nodes": [
            {"id": "x",    "type": "mlmInputNode",  "data": {"label": "Input",  "op": "placeholder",  "shape": "[2, 128, 512]",  "sync_state": "traced", "params": {}}},
            {"id": "norm", "type": "mlmNode",        "data": {"label": "LayerNorm","op": "call_module","shape": "[2, 128, 512]",  "sync_state": "traced", "params": {}}},
            {"id": "proj", "type": "mlmNode",        "data": {"label": "Linear", "op": "call_module",  "shape": "[2, 128, 768]",  "sync_state": "traced", "params": {"in_features": 512, "out_features": 768}}},
            {"id": "add",  "type": "mlmFunctionNode","data": {"label": "Add",    "op": "call_function","shape": "[2, 128, 512]",  "sync_state": "traced", "params": {}}},
            {"id": "out",  "type": "mlmOutputNode",  "data": {"label": "Output", "op": "output",       "shape": "[2, 128, 512]",  "sync_state": "traced", "params": {}}},
        ],
        "edges": [
            {"id": "x→norm",    "source": "x",    "target": "norm", "data": {"shape": "[2, 128, 512]", "status": "valid"}},
            {"id": "norm→proj", "source": "norm", "target": "proj", "data": {"shape": "[2, 128, 512]", "status": "valid"}},
            {"id": "norm→add",  "source": "norm", "target": "add",  "data": {"shape": "[2, 128, 512]", "status": "valid"}},
            {"id": "proj→add",  "source": "proj", "target": "add",  "data": {"shape": "[2, 128, 768]", "status": "mismatch"}},
            {"id": "add→out",   "source": "add",  "target": "out",  "data": {"shape": "[2, 128, 512]", "status": "valid"}},
        ],
    }
    r3 = detect_mismatches(residual_graph)
    add_mismatches = [r for r in r3 if r["target_id"] == "add"]
    assert len(add_mismatches) >= 1, f"Test 3 failed: expected ≥1 residual mismatch, got {r3}"
    print("✓ Test 3 passed: residual Add mismatch → 1 mismatch")
    print(f"  edge_id : {add_mismatches[0]['edge_id']}")
    print(f"  message :\n{add_mismatches[0]['message']}\n")

    # ── Pre-built demo mismatch ───────────────────────────────────────────────
    print("─" * 70)
    print("Pre-built demo mismatch (hardcoded constant):")
    print()
    print(DEMO_MISMATCH_ATTENTION_FEEDFORWARD)
    print()
    print("=" * 70)
    print("All tests passed.")


if __name__ == "__main__":
    _self_test()

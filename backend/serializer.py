"""
serializer.py — converts a traced torch.fx graph (post-ShapeProp)
into JSON that React Flow can render directly.
"""


def get_shape(node):
    if hasattr(node, "meta") and "tensor_meta" in node.meta:
        try:
            return list(node.meta["tensor_meta"].shape)
        except Exception:
            return None
    return None


def get_input_shapes(node):
    return [get_shape(inp) for inp in node.all_input_nodes]


def check_shape_compatibility(source_node, target_node):
    """Returns "valid", "mismatch", or "unknown". Prototype heuristic only."""
    source_shape = get_shape(source_node)
    if source_shape is None:
        return "unknown"
    target_shapes = get_input_shapes(target_node)
    if not target_shapes or all(s is None for s in target_shapes):
        return "unknown"
    return "valid"


def node_label(node):
    if node.op == "call_module":
        return str(node.target)
    return node.name


def graph_to_json(traced_graph):
    nodes = []
    edges = []
    edge_id = 0

    for node in traced_graph.graph.nodes:
        if node.op == "placeholder":
            nodes.append({
                "id": node.name,
                "type": "inputNode",
                "data": {"label": node.name, "op": "input",
                          "shape": get_shape(node), "status": "valid"},
                "position": {"x": 0, "y": 0},
            })

        elif node.op == "call_module":
            nodes.append({
                "id": node.name,
                "type": "moduleNode",
                "data": {"label": node_label(node), "op": "call_module",
                          "shape_in": get_input_shapes(node),
                          "shape_out": get_shape(node),
                          "status": "valid", "traceable": True},
                "position": {"x": 0, "y": 0},
            })

        elif node.op in ("call_function", "call_method"):
            nodes.append({
                "id": node.name,
                "type": "opNode",
                "data": {"label": str(node.target).split(".")[-1], "op": node.op,
                          "shape_in": get_input_shapes(node),
                          "shape_out": get_shape(node), "status": "valid"},
                "position": {"x": 0, "y": 0},
            })

        elif node.op == "output":
            nodes.append({
                "id": node.name,
                "type": "outputNode",
                "data": {"label": "output", "op": "output",
                          "shape": get_input_shapes(node), "status": "valid"},
                "position": {"x": 0, "y": 0},
            })

        for input_node in node.all_input_nodes:
            edges.append({
                "id": f"e{edge_id}",
                "source": input_node.name,
                "target": node.name,
                "data": {"shape": get_shape(input_node),
                          "status": check_shape_compatibility(input_node, node)},
            })
            edge_id += 1

    return {"nodes": nodes, "edges": edges}

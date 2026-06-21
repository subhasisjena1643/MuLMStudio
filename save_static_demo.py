"""
save_static_demo.py
-------------------
One-shot script: traces the TransformerEncoderBlock and saves
static_demo_graph.json for the VITE_DEMO_MODE fallback.

Run once after setting up the environment:
    python save_static_demo.py
"""
import json
import torch
import torch.fx as fx
from torch.fx.passes.shape_prop import ShapeProp
from serializer import TransformerEncoderBlock, graph_to_json, build_mha_interior_view

model = TransformerEncoderBlock().eval()
traced = fx.symbolic_trace(model)
ShapeProp(traced).propagate(torch.randn(2, 128, 512))

output = {
    "transformer":   graph_to_json(traced, model),
    "mha_interior":  build_mha_interior_view(embed_dim=512, num_heads=8),
}

with open("static_demo_graph.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"Saved static_demo_graph.json")
print(f"  transformer  : {len(output['transformer']['nodes'])} nodes, {len(output['transformer']['edges'])} edges")
print(f"  mha_interior : {len(output['mha_interior']['nodes'])} nodes, {len(output['mha_interior']['edges'])} edges")

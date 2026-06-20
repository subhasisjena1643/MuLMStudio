"""
spike.py — Day 1 validation script. Run standalone: python spike.py
Confirms torch.fx can trace the models we care about.
"""
import torch
import torch.nn as nn
import torch.fx as fx
from torch.fx.passes.shape_prop import ShapeProp


class SimpleMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(512, 256)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(256, 128)

    def forward(self, x):
        return self.fc2(self.relu(self.fc1(x)))


class TransformerBlock(nn.Module):
    def __init__(self):
        super().__init__()
        self.attention = nn.MultiheadAttention(512, 8, batch_first=True)
        self.norm1 = nn.LayerNorm(512)
        self.ff = nn.Sequential(nn.Linear(512, 2048), nn.ReLU(), nn.Linear(2048, 512))
        self.norm2 = nn.LayerNorm(512)

    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + attn_out)
        x = self.norm2(x + self.ff(x))
        return x


class SimpleCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, 3, padding=1)
        self.relu = nn.ReLU()
        self.conv2 = nn.Conv2d(64, 128, 3, padding=1)

    def forward(self, x):
        return self.conv2(self.relu(self.conv1(x)))


def trace_and_inspect(model, dummy_input, model_name):
    print(f"\n{'=' * 50}\nTracing: {model_name}\n{'=' * 50}")
    try:
        traced = fx.symbolic_trace(model)
        sp = ShapeProp(traced)
        sp.propagate(dummy_input)
        for node in traced.graph.nodes:
            shape = None
            if hasattr(node, "meta") and "tensor_meta" in node.meta:
                shape = node.meta["tensor_meta"].shape
            print(f"  {node.op:15} | {str(node.target):30} | shape: {shape}")
        print(f"SUCCESS: {model_name}")
        return traced
    except Exception as e:
        print(f"FAILED: {model_name}\n   Error: {e}")
        return None


if __name__ == "__main__":
    trace_and_inspect(SimpleMLP(), torch.randn(2, 512), "Simple MLP")
    trace_and_inspect(TransformerBlock(), torch.randn(2, 128, 512), "Transformer Block")
    trace_and_inspect(SimpleCNN(), torch.randn(2, 3, 224, 224), "Simple CNN")

"""
tracer.py — takes raw pasted PyTorch code, finds the nn.Module inside it,
traces with torch.fx, runs ShapeProp, hands off to serializer.
"""
import torch
import torch.nn as nn
import torch.fx as fx
from torch.fx.passes.shape_prop import ShapeProp
from serializer import graph_to_json

DEFAULT_DUMMY_SHAPE = (2, 128, 512)


class TraceError(Exception):
    pass


def find_model_class(namespace: dict):
    for name, obj in namespace.items():
        if isinstance(obj, type) and issubclass(obj, nn.Module) and obj is not nn.Module:
            return obj
    return None


def trace_code(code: str, dummy_shape: tuple = DEFAULT_DUMMY_SHAPE) -> dict:
    safe_namespace = {"torch": torch, "nn": nn, "__builtins__": __builtins__}

    try:
        exec(code, safe_namespace)
    except Exception as e:
        raise TraceError(f"Code execution failed: {e}")

    model_class = find_model_class(safe_namespace)
    if model_class is None:
        raise TraceError("No nn.Module subclass found in the provided code.")

    try:
        model = model_class()
    except Exception as e:
        raise TraceError(f"Could not instantiate model with default args: {e}")

    try:
        traced = fx.symbolic_trace(model)
    except Exception as e:
        raise TraceError(f"torch.fx could not trace this model: {e}")

    dummy = torch.randn(*dummy_shape)
    try:
        ShapeProp(traced).propagate(dummy)
    except Exception:
        pass  # shapes show as None/[?] on frontend instead of killing the sync

    return graph_to_json(traced)

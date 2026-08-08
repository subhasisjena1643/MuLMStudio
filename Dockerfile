# µLM Studio — backend (tracer.py)
#
# Build:  docker build -t mulm-backend .
# Run:    docker run -p 8002:8002 --env-file .env mulm-backend
#
# CPU-only PyTorch on purpose: this service traces small dummy tensors for
# architecture visualization and runs a handful of forward/backward steps
# for the Checks tab (see tracer.py's _backward_recorder) — never
# large-scale training — so a GPU is never required, and the CPU wheels
# keep this image a fraction of the size of a CUDA build.

FROM python:3.11-slim

WORKDIR /app

# Installed separately (not via requirements-docker.txt) so the CPU wheel
# index applies only to torch/torchvision, not the rest of the deps.
RUN pip install --no-cache-dir torch==2.3.1 torchvision==0.18.1 \
        --index-url https://download.pytorch.org/whl/cpu

COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

COPY tracer.py serializer.py detect_mismatches.py static_demo_graph.json ./

# Most PaaS hosts (Render/Railway/Fly.io) inject $PORT themselves; this
# default only matters for `docker run` / docker-compose.
ENV PORT=8002
EXPOSE 8002

# tracer.py already reads $PORT and binds 0.0.0.0 — see its __main__ block.
CMD ["python", "tracer.py"]

# µLM Studio — Visual Graph & Shape Analyzer for PyTorch Models

µLM Studio is a real-time visual playground and debugging canvas for PyTorch models. Using **`torch.fx` symbolic tracing** and dynamic shape propagation, µLM Studio detects shape mismatches across deep learning layers (e.g., Attention to FeedForward projection errors) and reports them instantly, bridging the gap between code editor editing and graph-based canvas visualization.

---

## 🚀 Key Features

* **Real-time `torch.fx` Tracing**: Evaluates arbitrary PyTorch `nn.Module` definitions via a FastAPI WebSocket backend as you type, rendering the execution graph dynamically.
* **Intelligent Shape Mismatch Detection**: Walks the execution graph topology to compare upstream output shapes against downstream expected inputs. Provides exact error locations, visual annotations, and actionable suggested fixes.
* **Interactive Node Canvas**: A premium React Flow canvas visualizing inputs, projections, multi-head attention layers, normalizations, and feedforward blocks.
* **Bi-directional Synchronization**: Build graphs by dragging blocks onto the canvas to auto-generate clean PyTorch code, or edit code in the Monaco Editor to update the visual graph.
* **Robust Error Handling**: Prevents application crashes on Python syntax or execution errors by capturing trace exceptions and displaying formatted backtrace diagnostics in the problems panel.
* **Static Fallback Demo**: Toggle `VITE_DEMO_MODE` to showcase full canvas and mismatch debugging functionality entirely client-side, powered by a pre-compiled JSON graph.

---

## 🛠 Project Structure

```
MuLMStudio/
├── studio/                    # React Frontend
│   ├── src/
│   │   ├── components/        # CanvasPanel, NotebookPanel, PalettePanel, AnalysisPanel
│   │   ├── hooks/             # useTracer (WS client), useCodeGen (Canvas to PyTorch)
│   │   ├── nodes/             # Custom React Flow nodes
│   │   └── index.css          # Core design system stylesheet
│   └── package.json           # Frontend dependencies
│
├── tracer.py                  # FastAPI WebSocket & REST Server
├── serializer.py              # PyTorch graph serialization (nodes & edges)
├── detect_mismatches.py       # Shape mismatch engine
├── requirements.txt           # Python packages (torch, fastapi, etc.)
└── static_demo_graph.json     # Pre-rendered graph fallback
```

---

## ⚙️ Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js 18+
* Git

### 1. Backend Setup
1. Create a Python virtual environment:
   ```bash
   python -m venv .venv
   ```
2. Activate the virtual environment:
   * **Windows (PowerShell):** `.venv\Scripts\Activate.ps1`
   * **macOS / Linux:** `source .venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend tracing server:
   ```bash
   python -m uvicorn tracer:app --host 127.0.0.1 --port 8000 --reload
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd studio
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Set up environment variables. Create a `.env.local` inside the `studio` folder:
   ```env
   VITE_DEMO_MODE=false
   ```
   *(Set to `true` if you want to run the application purely frontend-only using preloaded graphs).*
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## 🔌 WebSocket Tracing Protocol

The frontend communicates with the FastAPI backend over WebSockets (`ws://localhost:8000/ws/trace`):

### Client Request Schema
```json
{
  "code": "import torch...",
  "input_shape": [2, 128, 512],
  "input_dtype": "float32"
}
```

### Server Response (Success)
```json
{
  "status": "success",
  "graph": {
    "nodes": [
      { "id": "x", "label": "input", "output_shape": [2, 128, 512] }
    ],
    "edges": [
      { "id": "e1", "source": "x", "target": "linear" }
    ]
  },
  "model_name": "TransformerEncoderBlock",
  "trace_time_ms": 12.45
}
```

### Server Response (Error)
```json
{
  "status": "error",
  "error": {
    "phase": "parse",
    "type": "SyntaxError",
    "message": "invalid syntax",
    "traceback": "..."
  }
}
```

---

## 💡 How Shape Mismatches are Caught

The backend runs a dedicated validator (`detect_mismatches.py`) which:
1. Iterates over all graph edges.
2. Compares the `output_shape` of the source block to the expected `input_shape` of the target block.
3. Generates human-friendly warnings detailing the mismatch:
   ```text
   ⚠ Shape Mismatch — Attention → FeedForward
     Attention output:    [2, 128, 768]
     FeedForward expects:   [2, 128, 512]

     The Attention block projects features to a dimension of 768, but the FeedForward layer expects an input dimension of 512.

     Suggested fix: Change the input dimension of the FeedForward layer (d_model) to 768 or adjust the projection output of the Attention block.
   ```
4. The frontend intercepts these messages and highlights the offending nodes/edges on the Canvas.

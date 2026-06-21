# µLM Studio — Visual Graph & Shape Analyzer for PyTorch Models

## 📋 Problem Statement
Deep learning researchers waste hours debugging silent PyTorch dimension crashes (e.g., `RuntimeError: mat1 and mat2 shapes cannot be multiplied`) that only manifest during runtime, sometimes hours into training. Traditional manual shape tracking in static code comments is error-prone, drifts quickly as parameters change, and lacks real-time mathematical validation.

---

## 👥 Users & Context
* **Target Users**: AI/ML researchers, deep learning engineers, model architects, and students designing custom neural networks (e.g., Transformers, CNNs, or hybrid bottleneck architectures like Tissue LLM cells).
* **Context**: Used during the model prototyping phase, bridging the gap between text-based code editing and graphical flow visualization. It is particularly designed for fast iteration cycles where correct shape propagation is critical to prevent training-time execution failures.

---

## 💡 Solution Overview
µLM Studio provides a real-time, bi-directional development canvas showing code and visual flow diagrams side-by-side. As you type, the FastAPI backend uses **`torch.fx` symbolic tracing** and `ShapeProp` to calculate actual tensor shapes. If a shape mismatch is detected, the connection wire glows red and generates an actionable debugging suggestion before a single line of training runs.

### System Architecture
```mermaid
graph TD
    subgraph Frontend (React & Monaco Editor)
        A[Monaco Code Editor] -- "Code (Debounced 300ms)" --> C[useTracer WebSocket Client]
        D[React Flow Canvas] -- "Drag & Drop Blocks / Connections" --> E[useCodeGen Topological Sort]
        E --> A
    end
    subgraph Backend (FastAPI & PyTorch)
        C -- "WebSocket Stream" --> F[Tracer exec Sandbox]
        F -- "Instantiate & Run" --> G[torch.fx Symbolic Tracing]
        G --> H[ShapeProp Shape Inference]
        H --> I[detect_mismatches.py Engine]
        I -- "JSON Graph + Mismatch Logs" --> C
    end
```

---

## ⚙️ Setup & Run

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
   python tracer.py
   ```
   *(Runs on `http://127.0.0.1:8000`)*

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd studio
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
   *(Accessible at `http://localhost:5173`)*

*Note: To run the application in a pure frontend-only environment using preloaded static graphs, create a `.env.local` inside the `studio/` folder with `VITE_DEMO_MODE=true`.*

---

## 📦 Models & Data
* **Built-in Blocks**: Core blocks (Embedding, Linear, FeedForward, Output Head), Attention (Multi-Head Attention), Normalization (LayerNorm, RMSNorm), Vision (Conv2D), Regularization (Dropout), and Activation (Softmax).
* **Starter Templates**: 
  1. *Transformer Encoder Block*: Classic self-attention with residual paths.
  2. *Simple CNN Classifier*: Visual feature extractor + avg pool classification pipeline.
  3. *Tissue LLM Cell*: Compressed bottleneck architecture from the Tissue LLM project.
* **Licenses & Sources**: Codebase is distributed under the MIT License. Built on top of PyTorch (BSD-3-Clause), React Flow (MIT/CC), and Monaco Editor (MIT). No external pre-trained model weights are required, as validation is performed statically on network architectures.

---

## 🛡️ Evaluation & Guardrails
* **Deterministic Verification (Anti-Hallucination)**: Unlike LLM-based code visualizers that estimate shapes and are prone to hallucinations, µLM Studio executes a deterministic, mathematics-based validation engine using PyTorch's native `torch.fx` and shape-propagation passes. Wires and shapes are mathematically guaranteed to match PyTorch's compiler outputs.
* **Namespace Sandboxing (Code Injection Protection)**: To securely handle arbitrary Python scripts pasted by researchers, the backend restricts the execution environment namespace (`_safe_import` override) and blocks dangerous system modules (such as `os`, `subprocess`, `socket`, `shutil`, etc.).

---

## ⚠️ Known Limitations & Risks
* **Dynamic Control Flow**: PyTorch models containing data-dependent control flow (e.g., `if x.sum() > 0:`) cannot be symbolically traced by `torch.fx` out-of-the-box. These blocks will fall back to "Untraceable" (`?` badge on canvas) unless custom mathematical contracts or wrappers are configured.
* **Local Sandbox Limits**: The code execution sandbox is designed for local single-user research workloads and does not provide hypervisor-level isolation. Paste only trusted architectures.

---

## 👥 Team
Developed during the **AIBoomi Startup Weekend, Bengaluru** (June 20–21, 2026).

* **Founder / ML Researcher**: Led Tissue LLM architecture design, video storyboard, and product vision.
* **Technical Lead**: Designed FastAPI symbolic tracer backend and deterministic shape-mismatch validator.
* **Frontend Architect**: Developed React Flow canvas, Monaco Editor bi-directional sync, and custom theme layouts.
* **Contact**: Submit questions or feedback via the GitHub Issues portal at the [MuLMStudio Repository](https://github.com/subhasisjena1643/MuLMStudio).

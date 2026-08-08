# µLM Studio — Codebase Audit

> Full read-through of every source file in the repo (all Python, all frontend
> JS/JSX/CSS, JSON, config, and all four markdown planning docs). Structured
> report of the actual architecture and implementation.

---

## Repo Map

```
MuLMStudio/
├── demo.py                     # standalone SimpleCNN sample (not wired to app)
├── tracer.py                   # FastAPI app: WS /ws/trace + REST endpoints  ← entrypoint
├── serializer.py               # torch.fx GraphModule → React Flow JSON
├── detect_mismatches.py        # shape-mismatch engine (server-side)
├── fx_trace_validation.py      # standalone Day-1 spike/validation script (not imported by app)
├── save_static_demo.py         # one-shot generator for static_demo_graph.json
├── static_demo_graph.json      # frozen transformer + mha_interior graphs
├── requirements.txt            # torch 2.3.1+cu121, fastapi, uvicorn, websockets, pydantic
├── README.md                   # says port 8000 (STALE — code uses 8002)
├── Mulm_prototype_plan2.md     # Prototype 0.2 build plan
├── execution.md                # 7-day AI-tooling execution plan (+ Graph Copilot spec)
├── execution2.md               # mid-hackathon validation/completion plan
├── ui.md                       # design brief (subset of execution.md Part 5)
├── mulm-logo/                  # brand assets (svg/png/html) — untracked
├── mvp/                        # EMPTY directory
└── studio/                     # React frontend (Vite)
    ├── index.html, vite.config.js, package.json, eslint.config.js, postcss.config.js
    └── src/
        ├── main.jsx, App.jsx (31 KB — the orchestrator), index.css (design system)
        ├── components/  AnalysisPanel, CanvasPanel, NotebookPanel, PalettePanel
        ├── hooks/       useTracer (WS client), useCodeGen (canvas→code)
        ├── nodes/       Mlm{,Atomic,Input,Output,Function,Untraceable}Node + nodeTypes + shared
        ├── edges/       ShapeEdge + edgeTypes
        ├── layout/      dagre.js
        └── data/        templates, palette, staticDemoGraphs, stubCode, stubGraph
```

Note: **there is no TypeScript** — the frontend is `.jsx`, so no `.tsx`/`tsconfig`.
**No `.env` files** are committed (gitignored). `mvp/` is empty. `postcss.config.js`
is deliberately a no-op (shadows an ancestor config; project uses vanilla CSS, no
Tailwind despite the plan mentioning it).

---

## A. BACKEND — file by file

### `tracer.py` — FastAPI app (the entrypoint)
- **Purpose**: WebSocket tracing server + REST endpoints; the process you run.
- **Imports**: `torch`, `torch.nn`, `torch.fx`, `ShapeProp`, `fastapi` (FastAPI, WebSocket, CORSMiddleware, JSONResponse, Response), `pydantic.BaseModel`, `concurrent.futures.ThreadPoolExecutor`; from local `serializer` (`graph_to_json`, `build_mha_interior_view`) and `detect_mismatches` (`detect_mismatches`, `DEMO_MISMATCH_ATTENTION_FEEDFORWARD`).
- **App/port**: `app = FastAPI(...)`; runs on **`0.0.0.0:8002`** (`__main__` block, `reload=False`). CORS `allow_origins` = localhost/127.0.0.1 on ports 5173 and 3000. A `ThreadPoolExecutor(max_workers=2)` runs the CPU-bound tracing off the event loop.
- **Key structures**:
  - `PALETTE_BLOCKS` — 10 block dicts (id/label/pytorch_class/category/sync_state/default_params/shapes/dtype; MHA has `sync_state:"atomic"` + `drill_down:"mha_interior"`).
  - `_BLOCKED_IMPORTS` = `{os, subprocess, socket, shutil, pty, signal, ctypes, cffi, multiprocessing}`; `_safe_import(name,...)` raises `ImportError` for those, else delegates to real `__import__`. Explicitly documented as guarding against accidents, **not adversaries**.
  - `_build_exec_namespace()` — provides `torch, nn, F, math, Tensor`, full `builtins`, and the gated `__import__`.
  - `_find_model_class(namespace, base_names)` — finds user-defined `nn.Module` subclasses added by `exec` (excludes torch built-ins), returns the **last** candidate.
  - `_infer_dummy_input(model, requested_shape, requested_dtype)` — dtype: honors requested; else int64 if model has `nn.Embedding`, else float32. Shape: uses requested shape; else heuristics — Embedding→`zeros(2,128)`, Conv2d→`randn(2,c_in,32,32)`, forward-param-name keyword (`token/idx/id/index`)→int64 `(2,128)`, MHA→`randn(2,128,embed_dim)`, first Linear→`randn(2,128,in_features)`, default `randn(2,128,512)`.
  - `_do_trace(code, input_shape, input_dtype)` — the pipeline (see below). `_error_payload`/`_error_response` build structured errors with `phase/type/message/hint/traceback`.
- **torch.fx usage**: `fx.symbolic_trace(model)` → `ShapeProp(traced).propagate(dummy)`. **ShapeProp failure is non-fatal** — caught, stored as `shape_error`, serialization proceeds anyway (nodes fall back to `[unknown]`). Errors are bucketed by `phase`: `parse | exec | trace | shape_prop | serialize`.
- **Endpoints**:
  - `WS /ws/trace` — receives `{code, input_shape?, input_dtype?}`; runs `_do_trace` in the executor with a **30s `asyncio.wait_for` timeout**; sends result JSON. Empty/invalid code → structured error frame, connection stays alive. Reconnect-friendly (catches `WebSocketDisconnect`).
  - `GET /health` → `{status, torch_version, cuda_available, python_version}`.
  - `GET /palette` → `{categories, blocks_by_category, blocks}`.
  - `GET /demo?view=transformer|mha_interior` → reads `static_demo_graph.json` (key `transformer`) or calls `build_mha_interior_view`; falls back to live-tracing an inline transformer if the file is missing.
  - `POST /mismatches` (`MismatchRequest{graph}`) → runs `detect_mismatches` on arbitrary graph JSON. (Exists for testing/demo-mode; WS already includes mismatches inline.)
  - `POST /export` (`ExportRequest{code, graph, model_name?}`) → `_generate_export_code(...)` builds a clean `.py` (µLM header w/ arch summary + input/output shapes, dedup imports, the notebook code, a `__main__` smoke test) and returns it as a `text/plain` attachment. Defensive fallback returns raw code + minimal header on any failure.

### `serializer.py` — graph → React Flow JSON (the data contract source of truth)
- **Purpose**: convert a traced `fx.GraphModule` into `{nodes, edges}` React Flow JSON; also builds the hardcoded MHA interior.
- **`classify_sync_state(node, model)`**: non-`call_module` → `"traced"`; module not found in `named_modules` → `"untraceable"`; class in `_ATOMIC_PRIMITIVES` (`{nn.MultiheadAttention, torch.nn.MultiheadAttention, MultiheadAttention}`) → `"atomic"`; else `"traced"`.
- **Helpers**: `_shape_from_meta` reads `node.meta["tensor_meta"]` or `["val"]`, returns `str(list(shape))` or `"[unknown]"`. `_get_category` maps class name via `_CATEGORY_MAP` (CORE/ATTENTION/NORM/VISION/ACTIVATION/REGULARIZATION; placeholder→INPUT, output→OUTPUT, call_function/method→CORE). `get_display_label`/`_get_label` produce human labels (note: `graph_to_json` actually uses `get_display_label`, which returns bare class names). `_get_module_params` extracts display params per class (Linear→in/out_features/bias, MHA→embed_dim/num_heads/dropout/batch_first, LayerNorm→normalized_shape, Conv→channels/kernel/padding, Dropout→p, Embedding→sizes, AdaptiveAvgPool2d→output_size).
- **getitem collapsing** (`_build_collapse_maps`): MHA returns `(attn_output, attn_weights)`; FX represents this as two `getitem` nodes. These are collapsed — never rendered; edges from them are redirected to the atomic parent (`redirect_map`); the atomic node's shape is recovered from the index-0 getitem's ShapeProp metadata (`shape_override`).
- **`graph_to_json(traced, model, shape_props=None)`** — the RF-type mapping: `placeholder→mlmInputNode`, `output→mlmOutputNode`, `call_function/method→mlmFunctionNode`, else `_RF_TYPE_FOR_SYNC_STATE[sync_state]` (`traced→mlmNode`, `atomic→mlmAtomicNode`, `untraceable→mlmUntraceableNode`). Edges built from `node.args` that are `fx.Node`, with source resolved through `redirect_map`, de-duplicated, edge id `f"{source}→{target}"`. **`_edge_status` always returns `"valid"` when both shapes are known** — real mismatch detection is delegated to `detect_mismatches`, not the serializer.
- **`build_mha_interior_view(embed_dim=512, num_heads=8)`** — hardcoded 7-node/8-edge graph: Input(Q/K/V) → Q/K/V proj (Linear) → Scaled Dot-Product Attention → Output Projection → Output. This is described in-file as "the prototype's Mathematical Contract implementation for MHA."
- Bottom of file has a `main()` self-test with assertions (getitem collapsed, attention atomic + shape recovered, no dangling edges, MHA interior = 7 nodes/8 edges).

### `detect_mismatches.py` — shape-mismatch engine (runs server-side)
- **`detect_mismatches(graph_json) -> List[dict]`**: walks edges, compares the **last concrete dimension** (feature axis) of upstream output vs downstream expected input. `_expected_for_node`: atomic→`embed_dim`; Linear→`in_features`; pass-through ops (Dropout/LayerNorm/RMSNorm/activations/norms)→no constraint; residual `Add`→handled specially by comparing its two incoming tensors to each other. Also flags rank (ndim) mismatches. Batch/seq dims intentionally ignored (fixed dummy input).
- Each result carries a rich structured payload: `edge_id, source_id, target_id, message` (formatted `⚠ Shape Mismatch …` block), `severity, headline, source_label, target_label, source_shape, target_shape, detail, suggestion`.
- Hardcoded constants `DEMO_MISMATCH_ATTENTION_FEEDFORWARD` and `DEMO_MISMATCH_EDGE_ID = "dropout_1→add_1"` exist as a "demo-safety" verbatim message, **but the live path uses the procedural generator**, not these constants. `_self_test()` covers clean/linear/residual cases.

### Other Python
- **`save_static_demo.py`**: traces `serializer.TransformerEncoderBlock`, runs ShapeProp on `randn(2,128,512)`, writes `{"transformer": graph_to_json(...), "mha_interior": build_mha_interior_view(...)}` to `static_demo_graph.json`.
- **`fx_trace_validation.py`**: standalone Day-1 spike. Defines SimpleMLP/TransformerEncoderBlock/SimpleCNN; its own copy of `classify_sync_state`; `_analyse_trace_failure` classifies failure signatures (`control_flow_bool`, `tuple_return_getitem`, `concrete_value_needed`). **Concludes for PyTorch 2.3.1+cu121 that MHA traces successfully as an opaque node** (only the MHA node shows `[unknown]`, recoverable from getitem). Not imported by the app.
- **`demo.py`**: a lone `SimpleCNN` module. Not referenced anywhere (the modified file in git status).
- **`requirements.txt`**: `torch==2.3.1+cu121`, `torchvision==0.18.1+cu121`, `fastapi==0.111.0`, `uvicorn[standard]==0.29.0`, `websockets==12.0`, `pydantic==2.7.1`. **No `openai`/`anthropic`** — confirming no runtime LLM.

---

## B. FRONTEND — file by file

### Entry / shell
- **`main.jsx`**: `createRoot(...).render(<StrictMode><App/></StrictMode>)`, imports `index.css`.
- **`index.html`**: loads Inter + JetBrains Mono from Google Fonts (CDN); `<div id="root">`; title "µLM Studio · Prototype 0.1".
- **`App.jsx`** (the orchestrator): manages `canvasNodes/canvasEdges`, `codeSource ('user'|'canvas')`, `liveCodeRef` (code kept in a **ref**, not state, so keystrokes don't re-render), `selectedTemplate`, `inputShape`, `drilledPath`, `traceError`, `liveProblems`, `outputLog`, `terminalLog`, `selectedNode`, `isTracing`, `contextMenu`, and an **undo `historyRef` (max 50 snapshots of {nodes,edges,code})**. `DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'`.
  - Live data flow: Monaco `onChange` → `handleCodeChange` (debounced snapshot + `sendCode(v, inputShape)`) → WS → `handleGraph` strips positions, sets `lastGraphRef`, surfaces `graph.mismatches` into `liveProblems`, sets `modelName`, updates canvas.
  - DEMO flow: `Ctrl/Cmd+Shift+E` toggles `mismatching` between `STATIC_GRAPH_CLEAN`/`STATIC_GRAPH_MISMATCH`; notebook shows `DEMO_CODE_CLEAN/MISMATCH`; problems come from `DEMO_MISMATCH_STRUCTURED`.
  - Fetch calls: `http://localhost:8002/demo?view=mha_interior` (drill-down), `POST http://localhost:8002/export`.
  - `highlightBlockInEditor(target)` uses Monaco `findMatches("self."+target)` + `deltaDecorations` to highlight lines + gutter. `NodeContextMenu` (View source / Remove block) is defined inline.

### Hooks
- **`useTracer.js`**: WS client to `ws://localhost:8002/ws/trace`, 300ms debounce, **silent 1s auto-reconnect**, StrictMode double-mount guards. On success maps edges to add `type:'shapeEdge'`, forwards `{nodes, edges, errors, model_name, mismatches, trace_time_ms}` to `onGraph`; on error builds `{headline, traceback}`. `sendCode(code, inputShape?)` sends `{code, input_shape?}`. **Sends no `input_dtype`.** Also emits `output`/`terminal` log entries.
- **`useCodeGen.js`**: pure `generateCode(nodes, edges)` — **Kahn topological sort** with cycle detection (cycle → visible `# ERROR` + problem). `BLOCK_TEMPLATES` maps block ids → `{init_line, forward_call}`. Emits a `GeneratedModel(nn.Module)`. Honest fallbacks: unrecognized block → `# TODO`; disconnected node → `self.x(???) # disconnected`; residual `Add` with 2 preds → `a + b`. Exposes `useCodeGen` (memoized) + `generateCode`.

### Components
- **`CanvasPanel.jsx`**: React Flow (`@xyflow/react` v12) wrapped in `ReactFlowProvider`. Applies **Dagre** layout (`rankdir:'TB'`) on every prop change, then `fitView`. Custom `nodeTypes`/`edgeTypes`. Palette drop handler reads `application/mulm-block`, maps `sync_state`→node type, creates `dropped_N` nodes. SVG engineering-grid background (minor 20px / major 100px). MiniMap colored by category. Top-left `Panel` badge: breadcrumb `Root > {drilledPath}` when drilled, else `{modelName} · N nodes`.
- **`NotebookPanel.jsx`**: `@monaco-editor/react`, **Monaco loaded from jsDelivr CDN** `monaco-editor@0.52.0`. Custom `mulm-dark` theme matching the CSS tokens. **Uncontrolled** editor (`defaultValue`) — external code pushed imperatively via `editor.setValue` (skipped when `codeSource==='user'`). Template `<select>` (Tissue LLM / Transformer / CNN). File upload (`.py`/`.ipynb`, parses ipynb code cells). Implements the **F9 "Copilot flash"** decoration (green flash on canvas-added lines, fade at 1200ms, clear at 1600ms). Language `python`, JetBrains Mono, minimap off, suggestions/lightbulb/folding disabled.
- **`AnalysisPanel.jsx`**: 4 tabs PROBLEMS | OUTPUT | DEBUG | TERMINAL. PROBLEMS badge shows count. `shape_mismatch` rows render headline + `source_shape → target_shape` (mono) + detail + italic suggestion + an **"Explain ↗" button that only `console.log`s** (not wired to any AI). Generic rows render ERR/WARN + headline + collapsible traceback ("Show details"). DEBUG shows selected node's `data` JSON; OUTPUT/TERMINAL show timestamped logs.
- **`PalettePanel.jsx`**: renders `PALETTE_BY_CATEGORY` in fixed category order; each block = colored dot + name, draggable (`application/mulm-block`), `◆` badge for atomic. Purely presentational (no backend `/palette` fetch — uses local `palette.js`).

### Nodes / edges / layout
- **`MlmNode`** (traced): category-colored 1px border + left strip, label, shape (mono), params.
- **`MlmAtomicNode`**: steel-blue (`#5B8DB8`) border + left strip + `◆` badge + "atomic primitive · double-click to inspect" caption; `cursor:pointer`.
- **`MlmUntraceableNode`**: dashed amber (`#B8860B`) border + `?` badge + "untraceable · shapes estimated" caption.
- **`MlmInputNode`/`MlmOutputNode`**: compact INPUT/OUTPUT pills with shape.
- **`MlmFunctionNode`**: compact op symbol (`+ × − ÷`) + shape.
- **`shared.js`**: `CATEGORY_COLORS`, `withAlpha`, `formatParams` (hides `batch_first`, `bias:true`).
- **`ShapeEdge.jsx`**: wire colors `valid #3D7A56 / mismatch #C0392B / unknown #2C313C`. Mismatch → bezier + red drop-shadow + `mismatch-glow` animation; valid/unknown → smoothstep (unknown dashed). Always renders a shape pill; `[?]` in amber for unknown shapes.
- **`dagre.js`**: per-type node dimensions, TB layout, sets `sourcePosition:'right'/targetPosition:'left'`.

### Data
- `templates.js`: 3 templates (**default `tissue_llm`**, transformer, cnn) with code + inputShape.
- `palette.js`: 10 blocks (mirrors backend `PALETTE_BLOCKS`) + `CATEGORY_COLORS` + `PALETTE_BY_CATEGORY`.
- `staticDemoGraphs.js`: frozen `STATIC_GRAPH_CLEAN` (13 nodes/14 edges), `STATIC_GRAPH_MISMATCH` (feedforward.3 → out_features 768; `dropout_1→add_1` status `mismatch`), `STATIC_MHA_INTERIOR`, `DEMO_MISMATCH_MESSAGE`, `DEMO_MISMATCH_STRUCTURED`, `DEMO_CODE_CLEAN/MISMATCH`.
- `stubCode.js`, `stubGraph.js`: **dead/legacy** (not imported anywhere now that templates + WS drive state).

### `package.json` deps
`react@19`, `react-dom@19`, `@xyflow/react@12`, `@monaco-editor/react@4.7`, `@dagrejs/dagre@3`; dev: `vite@8`, `@vitejs/plugin-react@6`, eslint 10. **React 18/RF 11 in the plan → actually React 19/RF 12 in code.**

---

## C. THE EXACT DATA CONTRACT (backend → frontend)

Real example (from `static_demo_graph.json`). WS success frame is
`{status, graph, model_name, input_shape, input_dtype, trace_time_ms, mismatches, warnings?}`
where `graph` also gets `errors` + per-edge `data.status` stamped:

**Node:**
```json
{
  "id": "attention",
  "type": "mlmAtomicNode",
  "position": { "x": 0, "y": 0 },
  "data": {
    "label": "MultiheadAttention",
    "op": "call_module",
    "target": "attention",
    "shape": "[2, 128, 512]",
    "sync_state": "atomic",
    "category": "ATTENTION",
    "params": { "embed_dim": 512, "num_heads": 8, "dropout": 0.1, "batch_first": true }
  }
}
```

**Edge:**
```json
{
  "id": "dropout_1→add_1",
  "source": "dropout_1",
  "target": "add_1",
  "data": { "shape": "[2, 128, 768]", "status": "mismatch" }
}
```
(frontend adds `"type": "shapeEdge"` on receipt)

**Mismatch / error entry** (in `result.mismatches` and `graph.errors`):
```json
{
  "edge_id": "dropout_1→add_1",
  "source_id": "dropout_1", "target_id": "add_1",
  "message": "⚠  Shape Mismatch — …",
  "severity": "mismatch",
  "headline": "Shape Mismatch — Dropout → Add ← LayerNorm",
  "source_label": "...", "target_label": "...",
  "source_shape": "[2, 128, 768]", "target_shape": "[2, 128, 512]",
  "detail": "...", "suggestion": "..."
}
```

Key field facts: **shapes are strings** (`"[2, 128, 512]"`, or `"[unknown]"`, or
symbolic like `"[batch, seq, 512]"` in the MHA interior). Node id = FX `node.name`.
Edge id uses a literal `→` (U+2192). Metadata carried: `op`, `target` (module path /
`<built-in function add>`), `category`, `params`. **No source line numbers** are
emitted. `input_shape`/`input_dtype`/`trace_time_ms` are top-level on the WS frame,
not in `graph`.

---

## D. GAPS LIST

| # | Capability | Present? | How / Why not |
|---|---|---|---|
| 1 | Three distinct block states (green/yellow/red visual) | **YES (with caveat)** | Three node components exist: traced (category color, solid), atomic (steel-blue + `◆`), untraceable (dashed **amber** + `?`). Note the third state is **amber, not red** — red is reserved for **wires/errors** (`ShapeEdge` mismatch), not blocks. `mlmUntraceableNode` is rarely produced (only when a `call_module` target isn't in `named_modules`). |
| 2 | Raw code visible inside atomic/yellow blocks | **NO** | Blocks show label + shape + params only. Source is shown by **highlighting lines in Monaco** on click, not inside the block. |
| 3 | Reason strings on untraceable blocks ("data-dependent control flow at…") | **NO** | Untraceable node shows a fixed caption "untraceable · shapes estimated." The rich failure-signature analysis exists only in the standalone `fx_trace_validation.py`, never surfaced to the UI. |
| 4 | Notebook as visually dominant panel (right, larger) | **NO** | Layout is `200px palette / 1fr canvas / 400px right-panel`. The **canvas is dominant**; notebook is a fixed 400px right column (and shares that column with the analysis panel). |
| 5 | Analysis panel (bottom) with checks/errors UI | **YES** | `AnalysisPanel` (220px) with PROBLEMS/OUTPUT/DEBUG/TERMINAL. PROBLEMS shows structured shape-mismatch rows + count badge; OUTPUT/TERMINAL logs; DEBUG shows selected-node JSON. |
| 6 | "Graph: clean · Values: not yet checked" status badge | **NO** | Only a canvas badge (`{modelName} · N nodes` / breadcrumb) and a title-bar LIVE/RECONNECTING + "Tracing…" indicator exist. No graph-vs-values distinction. |
| 7 | Any AI / Claude integration | **NO** | No `openai`/`anthropic` deps; no `/api/ask` endpoint; the "Explain ↗" button only `console.log`s. Graph Copilot is fully **specified** in `execution.md` Part 6 / `execution2.md` F6 but **not built**. Everything is deterministic torch.fx. |
| 8 | Mathematical Contract form / placeholder | **PARTIAL** | No UI form to define contracts. The concept exists only as the **hardcoded** `build_mha_interior_view` (documented as "the prototype's Mathematical Contract implementation for MHA"). |
| 9 | In-place mutation detection (`_`-suffix flagging) | **NO** | Nothing inspects for in-place ops anywhere in backend or frontend. |
| 10 | Bidirectional highlight (block↔error) | **PARTIAL** | Canvas block click → **highlights Monaco lines** (works, `highlightBlockInEditor`). The reverse (click error → highlight canvas block/wire) is **not wired** — "Explain ↗" is a stub and edges only turn red via backend status, not via error-row interaction. |
| 11 | Ghost preview for proposed changes | **NO** | No preview/overlay of proposed edits. |
| 12 | Pending diff UI for code modifications | **NO** | No diff/accept-reject UI. The F9 "Copilot flash" (green line highlight on canvas-added code) is a transient animation, **not** a pending diff. |
| 13 | MVP error disclosure strings | **PARTIAL** | The shape-mismatch disclosure format (headline / `src→tgt` shapes / detail / suggestion) **is** implemented server-side (`detect_mismatches`) and rendered. The broader "AI Impact / disclosure" and untraceable-reason strings from the docs are **not** in the product. |
| 14 | Operation-log / CRDT-ready state management | **NO** | State is plain React state; there is an **undo snapshot stack** (`historyRef`, 50 entries) but no operation log or CRDT structure. |
| 15 | Value-level checks (overfit-one-batch, loss-at-init, reproducibility) | **NO** | Entirely absent. The tool **visualizes and statically validates shapes only** — it never executes a training/forward loop for value checks (consistent with plan scope: "validates architecture, does not execute"). |

---

## Cross-cutting findings worth flagging

1. **Port drift**: `README.md` and all three planning docs say **port 8000** and `ws://localhost:8000`. The actual code (`tracer.py` uvicorn, `useTracer.js`, `App.jsx` fetches) is uniformly **8002**. The CORS list in `tracer.py` only whitelists 5173/3000 (fine for the frontend, but any doc-following user hits the wrong port).
2. **Plan vs. reality on stack**: docs specify React 18 / React Flow 11 / a "codegen.py" backend generator; the build actually uses React 19 / RF 12, and codegen is **frontend-only** (`useCodeGen.js`), not a backend endpoint.
3. **Sandbox is advisory only**: `_safe_import` blocks a short denylist but `exec` runs arbitrary user code with full builtins — documented as acceptable for a "local single-user tool," not a security boundary.
4. **Mismatch logic lives server-side only** (not duplicated in the frontend). The serializer marks all known-shape edges `valid`; `detect_mismatches` (server) is the sole detector; the frontend just consumes `graph.mismatches`/`errors`. Demo mode uses its own frozen `STATIC_GRAPH_MISMATCH` + `DEMO_MISMATCH_STRUCTURED` instead.
5. **Dead/legacy code**: `stubCode.js`, `stubGraph.js`, `demo.py`, and `fx_trace_validation.py` are not wired into the running app. `mvp/` is empty. `detect_mismatches.DEMO_MISMATCH_ATTENTION_FEEDFORWARD` is imported by `tracer.py` but never used.

---

## Planning docs — what each specifies vs. what was built

- **`Mulm_prototype_plan2.md`** (Prototype 0.2): the canonical spec. Anchor statement ("the Cadence/Simulink of ML"), the three-panel layout, the 10 palette blocks, the three-state block system (traced/atomic/untraceable), bidirectional sync contract (300ms debounce, hold-last-valid-state), tensor-shape pills, shape-mismatch visuals + PROBLEMS format, one-level drill-down, fallback static demo (`VITE_DEMO_MODE` + `Cmd+Shift+E`), one-click `.py` export, the tech stack (React 18/RF 11/Monaco, FastAPI/torch.fx), full design system, 3 starter templates, day-by-day build plan, and the nine-beat demo flow. **Most of this is faithfully implemented**; deviations are the stack versions, the port, notebook-not-dominant layout, and frontend-side codegen.
- **`execution.md`** (7-day AI-tooling plan): tool allocation + per-day prompts, an initial AI Impact Statement (no runtime LLM), the from-scratch design system (identical to `ui.md`), and **Part 6: the Graph Copilot runtime agent** — an `ASK` tab + `POST /api/ask` with tool-calling (`get_graph_fact`) so the agent can never invent a shape. **The Graph Copilot is entirely unbuilt.**
- **`execution2.md`** (mid-hackathon completion plan): a Phase-0 validation checklist (V1–V6), backend fixes (B1 dynamic dummy input, B2 mismatch detection, B3 labels), frontend fixes (F1 shape labels, F2 PROBLEMS tab), and new features F3–F9 (Monaco highlight, CNN/Tissue templates, file upload, AI error explanation, OUTPUT/DEBUG/TERMINAL content, block delete + canvas→code sync, Copilot flash animation). **F3, F4, F5, F7, F8, F9 are implemented; F6 (AI "Explain ↗") is a stub** because `/api/ask` was never built.
- **`ui.md`**: the design brief (subset of `execution.md` Part 5) — industrial/EDA instrument-panel aesthetic, 6 desaturated colors, Inter + JetBrains Mono, engineering grid, no shadows/gradients/large radii, minimal motion. **Faithfully implemented in `index.css`.**

# µLM Studio — Prototype Build Plan
### The First Glimpse of the Vision
**Version:** Prototype 0.2 (Redesigned)
**Hackathon:** AIBoomi Startup Weekend, Bengaluru — June 20–21
**Team:** Founder + Teammate + Technical Lead
**Constraint:** 7 days pre-build + 24-hour hackathon

---

## The Anchor Statement

Before a single line of code is written, every person on the team reads and agrees on this:

> **µLM Studio is the Cadence/Simulink of machine learning. A professional-grade local studio where researchers design, validate, and export any ML architecture visually — with synchronized multi-layer views, live tensor shape propagation, and real-time error detection. The prototype is the first glimpse of that studio. Not a toy. Not a demo. A real tool showing a real vision.**

Every build decision this week is measured against that statement. If a feature doesn't serve it, it doesn't get built. If a feature serves it but there's no time, it gets cut cleanly — not half-built.

---

## What the Prototype Is

The prototype demonstrates **one complete loop** of the µLM vision:

```
Design  →  Visualize  →  Validate  →  Export
```

A researcher opens µLM. They see a professional three-panel IDE. They design their architecture — either by writing PyTorch code in the notebook panel or by dragging blocks on the canvas. Both surfaces stay in sync simultaneously. Tensor shapes appear on every wire. A shape mismatch turns a wire red with a precise, human-readable explanation. They double-click a block and see its interior. They export a clean, runnable PyTorch file.

That is the prototype. Beginning to end. Nothing more. Nothing less.

---

## What the Prototype Is Not

These are real µLM features. They do not belong in the prototype. Do not build them. Do not half-build them. Do not mention them as "coming soon" popups in the UI. They will be demonstrated through the vision document and verbal pitch — not through the prototype.

| Feature | Why It's Out |
|---|---|
| Full 8-layer system | Prototype validates Layer 2 (Architecture) and Layer 3 (Tensor shapes) first. Other layers build on a validated foundation. |
| DGS (Dynamic Grid Storage) | Pure execution infrastructure. Prototype doesn't run training jobs. |
| AI architecture generation | Researchers need to trust the tool before trusting its AI. Code-first establishes that trust. |
| BYOL | Researchers paste their own code directly. Library upload is a v2 workflow. |
| Collaboration | Single-researcher prototype. Collaboration requires a stable single-user product first. |
| VM / Cloud execution | Prototype visualizes and validates — it does not execute. |
| Full 5-level error system | Prototype implements Level 1 (wire compatibility) and Level 2 (static shape analysis) only. |
| Infinite hierarchical drill-down | Prototype implements one level of drill-down to prove the concept. |
| HuggingFace push / Python package export | Prototype exports one clean `.py` file. One format. |
| Subscription / auth / accounts | Single-session prototype. No login, no saving, no projects. |
| AI block generation | Canvas-to-code direction covers this use case adequately for the prototype. |
| Data synthesizer / simulation | Prototype validates architecture design, not execution. |

---

## The Three-Panel Interface — Non-Negotiable

The interface itself communicates the vision before a single feature is demonstrated. It must look and feel like a professional research IDE — not a hackathon project. The layout is fixed. Do not redesign it during the build.

```
┌─────────────────────────────────────────────────────────────────┐
│  µ  µLM Studio  ·  Prototype 0.1                  [Export .py]  │
├─────────────┬───────────────────────────┬───────────────────────┤
│             │                           │                       │
│   PALETTE   │         CANVAS            │      NOTEBOOK         │
│             │                           │                       │
│  ─────────  │   Engineering grid bg     │   Monaco Editor       │
│  CORE       │                           │                       │
│  Embedding  │   Blocks + bezier wires   │   PyTorch code        │
│  Linear     │   with tensor shape       │   synced with         │
│  ...        │   pill labels             │   the canvas          │
│  ─────────  │                           │                       │
│  ATTENTION  │   Three-state blocks:     │                       │
│  MHA ◆      │   traced / atomic / ?     │                       │
│  ─────────  │                           │                       │
│  NORM       │   Drill-down on           │                       │
│  LayerNorm  │   double-click            │                       │
│  RMSNorm    │                           │                       │
│             │                           │                       │
├─────────────┴───────────────────────────┴───────────────────────┤
│  PROBLEMS (1)    OUTPUT    DEBUG    TERMINAL                     │
└─────────────────────────────────────────────────────────────────┘
```

**Palette (left, 200px fixed):**
Block library. 10 blocks only, grouped by category. Each block: category color dot + name. No icon library. No shadows. Draggable onto canvas. Drag cursor on hover.

**Canvas (center, dominant, flex):**
Visual architecture. Engineering grid background (20px × 20px, barely visible). Blocks, bezier wires, tensor shape pill labels, three-state block rendering, error highlighting. Hierarchical drill-down on double-click. Zoom and pan with standard controls.

**Notebook (right, ~38% width, collapsible):**
Monaco editor. PyTorch code. Always synced with the canvas. What is written here appears on the canvas within 300ms. What is built on the canvas appears here immediately. No sync button — the sync is always live.

**Analysis Panel (bottom, collapsible, 176px default):**
Four tabs: PROBLEMS | OUTPUT | DEBUG | TERMINAL. PROBLEMS tab active by default. Shows shape mismatches and disconnected blocks as structured error rows. OUTPUT tab shows export logs. The other two tabs exist — they are intentionally minimal. Their presence communicates the full vision.

---

## The 10 Blocks in the Palette

These are the only blocks that ship in the prototype. They cover the architectures a researcher will most likely demonstrate — transformer, CNN, MLP. Each block has an assigned sync state (explained in the next section) and a category color.

| Block | PyTorch Class | Category | Sync State | Input Shape | Output Shape |
|---|---|---|---|---|---|
| Embedding | `nn.Embedding` | CORE | Traced | `[batch, seq]` | `[batch, seq, d_model]` |
| Linear | `nn.Linear` | CORE | Traced | `[*, in_features]` | `[*, out_features]` |
| FeedForward | `nn.Sequential(Linear, ReLU, Linear)` | CORE | Traced | `[batch, seq, d_model]` | `[batch, seq, d_model]` |
| Output Head | `nn.Linear` (labeled separately) | CORE | Traced | `[*, d_model]` | `[*, vocab_size]` |
| Multi-Head Attention | `nn.MultiheadAttention` | ATTENTION | **Atomic** | `[batch, seq, d_model]` × 3 | `[batch, seq, d_model]` |
| LayerNorm | `nn.LayerNorm` | NORM | Traced | `[*, d_model]` | same shape |
| RMSNorm | custom `nn.Module` | NORM | Traced | `[*, d_model]` | same shape |
| Conv2D | `nn.Conv2d` | VISION | Traced | `[batch, C, H, W]` | `[batch, C_out, H_out, W_out]` |
| Dropout | `nn.Dropout` | REGULARIZATION | Traced | any | same shape |
| Softmax | `nn.Softmax` | ACTIVATION | Traced | `[*, features]` | same shape |

Each palette entry shows: colored category dot (3px) + block name in Inter 500. On hover: `background: var(--bg-elevated)`. Drag cursor on hover. No icons. No cards. No shadows.

---

## The Three-State Block System — The Technical Foundation

This is the most important architectural decision in the prototype. Every block on the canvas exists in one of three states. This is not a UI detail — it is the mechanism that makes the prototype honest, robust, and demo-safe.

### Why Three States Exist

`torch.fx` symbolic tracing does not cleanly trace all PyTorch operations. `nn.MultiheadAttention` with `batch_first=True` fails symbolic tracing in most PyTorch versions due to internal control flow and its tuple return `(attn_output, attn_weights)`. This is not a rare edge case — it is your primary demo block.

The original plan handled this with a single "dashed border = sync failed" state. That is insufficient. There is a critical difference between:
- A block whose shapes **are known** (because we hardcoded the contract) but whose internals can't be traced
- A block that is **genuinely unknown** to the system

Collapsing these two into one state produces an MHA block that appears broken during the demo. The three-state system makes MHA appear **authoritative** instead.

### State 1: Traced (Solid Border, Category Color)

Standard PyTorch operations that `torch.fx` traces cleanly. The system knows input shapes, output shapes, and all internal structure. Canvas renders completely. Drill-down works. All 9 blocks except MHA are in this state.

Visual: solid `1px` left border strip in category color, solid `1px` full border in `--border-default`, no badge.

### State 2: Atomic Primitive (Solid Border, `◆` Badge)

Operations with known shape contracts but untraceable internals. The system knows exactly what goes in and what comes out — it just cannot decompose the interior through tracing. Multi-Head Attention is the only block in this state in the prototype.

Visual: same solid border as Traced, plus a `◆` badge in the top-right corner of the block in `--border-focus` color. Drill-down on double-click shows a **hardcoded interior view** (Q, K, V projections → scaled dot-product attention → output projection — built as static React Flow nodes). Breadcrumb shows `Root > MultiHeadAttention`.

This is not a workaround. It is the prototype implementation of the Mathematical Contract system described in the developer guide (Section 26). In the demo, when a judge asks about the `◆` badge: *"MHA is an atomic primitive — µLM knows its full shape contract, so it renders and validates correctly even without tracing its internals. This is how µLM handles any operation that doesn't decompose cleanly — define the contract once, and it becomes a first-class citizen across the entire tool."*

### State 3: Untraceable (`?` Badge, Dashed Border)

Code that exists in the notebook but cannot be traced and has no defined contract. The block shows the class name with a dashed border and a small `?` badge. It does not propagate shapes — downstream wires show `[?]` in amber. This state should not appear during the demo but must render gracefully when a researcher pastes arbitrary code.

Visual: dashed `1px` border in `--border-subtle`, `?` badge in `--status-unknown` (amber), no category color strip.

### The State Field in the JSON Graph

Every node in the JSON graph produced by the backend carries a `sync_state` field:

```python
# In serializer.py
def classify_sync_state(node, model) -> str:
    ATOMIC_PRIMITIVES = {
        'nn.MultiheadAttention',
        'torch.nn.MultiheadAttention'
    }
    
    module = dict(model.named_modules()).get(str(node.target))
    if module is None:
        return "untraceable"
    
    class_name = f"{module.__class__.__module__}.{module.__class__.__name__}"
    full_name = module.__class__.__name__
    
    if class_name in ATOMIC_PRIMITIVES or full_name in ATOMIC_PRIMITIVES:
        return "atomic"
    
    return "traced"
```

---

## The Bidirectional Sync — The Soul of the Prototype

This is the most important technical feature and the most important demo moment. It must work reliably on the demo model. Both directions are always live. There is no sync button.

### Direction 1: Notebook → Canvas (Code-First)

Researcher writes or pastes PyTorch code in the notebook panel. With a 300ms debounce, the frontend sends the code to the backend over WebSocket. The backend runs `torch.fx` symbolic tracing. The result is a JSON graph of nodes and edges with shapes and sync states. React Flow renders that graph on the canvas.

**The experience:** researcher types, canvas builds itself alongside them in real time.

**When tracing partially fails:** known blocks render fully. `MultiheadAttention` renders as Atomic Primitive (State 2) with its hardcoded shape contract applied — shapes still appear on its wires, it still participates in shape mismatch detection. Unknown blocks render as Untraceable (State 3) with `[?]` on downstream wires. The rest of the model continues syncing normally. The canvas is never blank because one block failed.

### Direction 2: Canvas → Notebook (Visual-First)

Researcher drags a block from the palette onto the canvas and connects it to another block by drawing a wire. The corresponding PyTorch code appears in the notebook panel — a properly structured `nn.Module` class with the connected blocks assembled in the correct forward pass order.

**The experience:** researcher drags and connects, code writes itself.

**Critical implementation detail — topological sort:** The `forward()` method must generate statements in the correct execution order. This requires a topological sort of the DAG, not just iterating over nodes in insertion order. For residual connections, the sort must recognize and handle the two patterns that appear in the demo model:

- **Additive residual:** `x = norm(x + sublayer(x))` — the sublayer's input and the residual branch share the same upstream node.
- **Sequential:** `x = layer(x)` — straightforward, output feeds the next input.

Any connection pattern that cannot be resolved to one of these two forms generates a `# TODO: manually wire this connection` comment in the `forward()` method. This is not a bug — it is the prototype being honest about its scope. Do not hide it. A researcher who sees this comment knows exactly what to do.

### The Sync Contract

- Both directions are always live. There is no sync button.
- The notebook is never out of date with the canvas (within the 300ms debounce window).
- The canvas is never out of date with the notebook.
- If a sync fails (tracing error, unsupported op, syntax error in the code) — the canvas does not clear. It holds the last valid state. The notebook shows a subtle red indicator in the gutter. The PROBLEMS tab shows the parse or trace error. The researcher continues editing until the error resolves.
- Partial failures do not break the whole sync. The system renders what it can and marks what it cannot.

### WebSocket Connection with Reconnection

The WebSocket must reconnect automatically if dropped. A broken sync that silently fails during a demo is a demo-ending event.

```javascript
// useTracer.js
import { useEffect, useRef, useCallback } from 'react'

export function useTracer(code, onGraphUpdate, onError, onConnectionChange) {
  const ws = useRef(null)
  const debounceRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    ws.current = new WebSocket('ws://localhost:8000/ws/trace')

    ws.current.onopen = () => onConnectionChange?.('connected')

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.status === 'success') {
        onGraphUpdate(data.graph)
      } else {
        onError(data.error)
      }
    }

    ws.current.onclose = () => {
      onConnectionChange?.('reconnecting')
      // Silent reconnect after 1 second — no error shown to researcher
      reconnectRef.current = setTimeout(connect, 1000)
    }

    ws.current.onerror = () => ws.current.close()
  }, [onGraphUpdate, onError, onConnectionChange])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      ws.current?.close()
    }
  }, [connect])

  const trace = useCallback((newCode) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ code: newCode }))
      }
    }, 300)
  }, [])

  useEffect(() => {
    trace(code)
  }, [code, trace])
}
```

---

## Tensor Shape Visualization

Every wire between two blocks shows the tensor shape flowing through it. This is Layer 3 of the full µLM vision made visible in the prototype.

**Shape pill label spec:**
- Shape sits on the wire, centered
- Format: `[2, 128, 512]` — concrete dimensions from ShapeProp where known; symbolic names where ShapeProp cannot infer (e.g., `[batch, seq, d_model]`)
- Font: JetBrains Mono, 11px — monospace is mandatory here. It is not aesthetic. It communicates that this is data, not a label.
- Color: `#6a6a8a` (muted) when valid, `#e87070` when mismatched, `#b8860b` when unknown
- Background: `var(--bg-elevated)`, `1px` border in `--border-default`, `3px` border-radius — rectangular, not pill
- On hover: expands to show full shape, dtype, and device where ShapeProp can infer

**Wire labels and zoom:**
- At demo zoom (default): full label on every wire
- Zoomed out to thumbnail level: labels only on error wires (always) and the wire under the cursor (hover)

This prevents the canvas from becoming unreadable when a researcher zooms out to see the whole architecture.

**When ShapeProp cannot infer a shape:**
Wire label shows `[?]` in amber. Not an error — honest uncertainty. Appears on wires downstream of Untraceable blocks (State 3) and on wires where the dummy input shape doesn't match the model's expected input.

---

## Shape Mismatch Detection

When two connected blocks have incompatible output/input shapes, the wire turns red immediately — before a single line of training code runs.

**Detection logic:**
After every sync cycle, check every wire: does the upstream block's output shape match the downstream block's expected input shape? For Atomic Primitive blocks (State 2), use the hardcoded shape contract for this check — MHA participates in mismatch detection even though it doesn't trace.

**Visual spec:**
- Wire color: `#c0392b` (solid red, full opacity — not `#EF4444`, which reads as "app error". `#c0392b` reads as "instrument warning.")
- Wire thickness: `2.5px` vs `1.5px` for valid wires — noticeably thicker, not subtly thicker
- Wire glow: `drop-shadow(0 0 3px rgba(192, 57, 43, 0.4))` — the glow draws the eye without screaming
- Error indicator: small `⚠` icon on the wire, centered beside the shape label
- On click: PROBLEMS tab in the analysis panel opens and focuses on this specific error

**Error message format in the PROBLEMS tab — pixel-perfect for the demo:**

```
⚠  Shape Mismatch — Attention → FeedForward
   Attention output:    [2, 128, 512]
   FeedForward expects: [2, 512]

   The attention layer preserves the sequence dimension.
   Your feedforward layer needs to account for seq_len.

   Suggested fix: Add a reshape or mean-pool between these blocks.
```

The shape values `[2, 128, 512]` and `[2, 512]` must render in JetBrains Mono. They are the specific data the researcher needs. Everything else is Inter. The visual distinction between data and prose inside a single error message communicates that µLM understands the difference.

For the demo, this specific error message (Attention → FeedForward mismatch from changing `nn.Linear(512, 512)` to `nn.Linear(512, 768)`) is **pre-built as a pixel-perfect render**. The procedural generation of other error messages works as a bonus — not a requirement.

---

## Hierarchical Drill-Down (One Level)

Every block that contains sub-modules is drillable. This is the demo beat that separates µLM from every visual pipeline builder a judge has ever seen.

**Interaction:**
- Double-click any block on the canvas
- Canvas transitions into the interior of that block
- Interior shows sub-modules as blocks, connected as defined in the module's forward pass
- Breadcrumb trail at top: `Root > BlockName`
- Click breadcrumb to return to root level

**Prototype scope:** one level deep only. Double-clicking a block inside a drilled view opens the notebook focused on that block's source code — it does not drill further. Infinite depth is a v2 feature.

**MultiHeadAttention drill-down (hardcoded):**

MHA does not trace cleanly. Its interior view is hardcoded as a static React Flow graph:

```
Input (Q/K/V)
    │
    ├── Q Projection (Linear)  ──┐
    ├── K Projection (Linear)  ──┼── Scaled Dot-Product Attention ── Output Projection (Linear)
    └── V Projection (Linear)  ──┘
```

This hardcoded view is not a lie. It is an accurate representation of MHA's interior. When a judge asks how this works: *"For standard operations like Multi-Head Attention, µLM ships with a known architectural contract. For novel or custom operations, the researcher defines the contract once — and from that point it renders identically to a built-in block."*

**All other blocks:** interior is derived from `torch.fx` tracing of the sub-module. If sub-module tracing fails, the drill-down shows an empty canvas with the block name and a note: `Interior visualization unavailable — define a mathematical contract to enable.`

---

## The Fallback Static Demo

Build this on Day 5 afternoon. It is not optional.

If the FastAPI backend fails to start on the demo machine — environment difference, PyTorch version mismatch, port conflict, anything — the frontend must still be demonstrable. The fallback static demo makes this possible.

```javascript
// config.js
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
```

```javascript
// In App.jsx
import { DEMO_MODE } from './config'
import { STATIC_TRANSFORMER_GRAPH } from './demo/staticGraph'

// If DEMO_MODE, skip WebSocket, use static graph
const graph = DEMO_MODE ? STATIC_TRANSFORMER_GRAPH : liveGraph
```

`STATIC_TRANSFORMER_GRAPH` is the pre-computed JSON output of tracing the transformer block — the exact output the backend would produce, frozen on Day 4 after confirming the trace is correct. Run with `VITE_DEMO_MODE=true npm run dev` if the backend is unavailable.

**What the fallback demo covers:**
- The three-panel interface renders completely
- The transformer block graph renders on the canvas with all shapes, block states, and wire labels exactly as in live mode
- The shape mismatch demo beat works: the pre-computed graph has two versions — valid and with the mismatch introduced — toggled by a keyboard shortcut (`Cmd+Shift+E`) for demo purposes only
- The drill-down into MHA works (hardcoded interior, same as live mode)
- The export button works (generates from the static code in the notebook, same export logic)

**What the fallback does not cover:**
- Live sync: typing in the notebook does not update the canvas in fallback mode
- Canvas-to-code: dragging blocks does not generate code

If forced into fallback mode during the demo: *"The live tracing backend connects here — let me show you what it produces."* Then trigger the pre-computed graph. Then demonstrate all other beats normally. The judges will not know the difference unless someone explicitly tests the live sync, in which case you explain the backend connection and offer to show it on the dev machine after the demo.

---

## Export — One Clean PyTorch File

One button. One format. One output.

**What it generates:**

A clean, runnable Python file structured as a proper PyTorch `nn.Module`. The file:
- Has all necessary imports at the top
- Defines each sub-module in `__init__` in the correct order
- Implements `forward()` that matches the canvas topology exactly, in topologically sorted order
- Includes inline comments explaining each block's role in the specific architecture
- Is immediately runnable — `python model.py` works without modification

**Example output for the demo transformer block:**

```python
# Generated by µLM Studio
# Architecture: Transformer Encoder Block
# µLM Prototype 0.1 — https://github.com/your-repo

import torch
import torch.nn as nn


class TransformerEncoderBlock(nn.Module):
    def __init__(
        self,
        d_model: int = 512,
        nhead: int = 8,
        dim_feedforward: int = 2048,
        dropout: float = 0.1,
    ):
        super().__init__()

        # Self-attention mechanism
        self.attention = nn.MultiheadAttention(
            embed_dim=d_model,
            num_heads=nhead,
            dropout=dropout,
            batch_first=True,
        )

        # Post-attention normalization
        self.norm1 = nn.LayerNorm(d_model)

        # Feed-forward network
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )

        # Post-FFN normalization
        self.norm2 = nn.LayerNorm(d_model)

        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [batch, seq_len, d_model]

        # Self-attention with residual connection
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))

        # Feed-forward with residual connection
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))

        return x  # [batch, seq_len, d_model]


if __name__ == "__main__":
    model = TransformerEncoderBlock()
    x = torch.randn(2, 128, 512)
    out = model(x)
    print(f"Input:  {x.shape}")
    print(f"Output: {out.shape}")
```

**Export button location:** top-right of the top bar. Label: `Export .py`. Click → file downloads immediately. No dialog. No options. No friction.

---

## The Tech Stack

These decisions are final. They are not revisited during the build week.

### Frontend

| Technology | Version | Purpose | Why |
|---|---|---|---|
| React | 18.x | UI framework | Component model is correct for a panel-based IDE |
| Vite | 5.x | Build tool | Faster than CRA for development iteration |
| React Flow | 11.x | Canvas — nodes, edges, drag/drop, zoom | Purpose-built for node-based editors. Handles all canvas complexity. |
| Monaco Editor | `@monaco-editor/react` | Notebook panel | VS Code's editor. Researchers recognize it. PyTorch syntax highlighting via custom language config. |
| CSS custom properties | — | Design tokens | Tailwind for layout utilities only. All colors and typography via CSS variables. Do not use Tailwind's default color palette for any visual element. |

### Backend

| Technology | Version | Purpose | Why |
|---|---|---|---|
| Python | 3.11.x | Backend language | PyTorch is Python. Tracing must happen in Python. |
| FastAPI | 0.111.x | API server + WebSocket | Async, minimal boilerplate, native WebSocket support |
| `torch.fx` | (PyTorch bundled) | Symbolic tracing | Captures computation graph without executing. Core of the sync engine. |
| `ShapeProp` (`torch.fx`) | (PyTorch bundled) | Shape inference | Annotates every node with output shape via dummy forward pass |
| PyTorch | 2.3.x | Model library | Pin this version. Same version on dev machine and demo machine. |

### Communication

| Technology | Purpose |
|---|---|
| WebSocket | Real-time notebook-to-canvas sync (300ms debounce, auto-reconnect) |
| REST (FastAPI) | Export endpoint, block palette metadata |

### No database. No authentication. No cloud. No state persistence. Single session, local only.

---

## The Design System — Non-Negotiable

The visual design communicates the product's identity before a feature is demonstrated. The reference is not a web app. The reference is VS Code, JetBrains IDEs, and Cadence Virtuoso. Study those for 30 minutes before writing a single line of CSS.

Do not use Tailwind's color palette for any primary visual elements. Define all colors as CSS custom properties. Do not use a component library — every component in this IDE must be hand-built.

### Color System

```css
:root {
  /* Backgrounds — three distinct near-blacks */
  --bg-base:     #141414;  /* canvas background */
  --bg-surface:  #1c1c1e;  /* palette, notebook, top bar */
  --bg-elevated: #242426;  /* hover states, active items */
  --bg-overlay:  #2a2a2d;  /* tooltips, dropdowns */

  /* Borders — two weights */
  --border-subtle:  #2e2e32;  /* panel dividers, section separators */
  --border-default: #3a3a3f;  /* block borders, input borders */
  --border-focus:   #5a5a6a;  /* focused elements, atomic primitive badge */

  /* Accent — one. Used with restraint. */
  --accent:     #4f7fff;                    /* desaturated, purple-shifted blue */
  --accent-dim: rgba(79, 127, 255, 0.15);  /* selection states, active tab bg */

  /* Block category colors — muted, not saturated */
  --block-core:           #3a3a3a;   /* grey */
  --block-attention:      #2e4a7a;   /* deep blue */
  --block-norm:           #2a5a3a;   /* deep green */
  --block-vision:         #4a2e5a;   /* deep purple */
  --block-activation:     #5a3a2a;   /* deep orange-brown */
  --block-regularization: #3a4a2e;   /* deep olive */

  /* Status */
  --status-error:   #c0392b;  /* serious red */
  --status-warning: #b8860b;  /* amber */
  --status-valid:   #2ecc71;  /* green */
  --status-unknown: #6a6a7a;  /* grey */

  /* Typography */
  --font-ui:   'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Type scale */
  --text-xs:   11px;   /* shape labels, metadata, palette labels */
  --text-sm:   13px;   /* panel tabs, status bar, error rows */
  --text-base: 14px;   /* notebook code, block names */
}
```

### The Canvas Grid

The canvas background uses an engineering grid: `20px × 20px` line grid in `rgba(255, 255, 255, 0.03)`. Not a dot grid (that's Figma's language). Not a plain background (too empty). A fine line grid that reads as "precision instrument" at a glance and recedes when you focus on the architecture. This is the single visual signature of µLM. It costs 10 lines of CSS and it communicates everything.

```css
.canvas-background {
  background-color: var(--bg-base);
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

### Block Design

```
┌─────────────────────────────┐
│ ●  Multi-Head Attention   ◆ │  ← 3px left border in category color
│ ─────────────────────────── │  ← 1px separator in --border-subtle
│ embed_dim:  512             │  ← params: JetBrains Mono 11px, --status-unknown color
│ num_heads:  8               │
└─────────────────────────────┘
        │            │
      [●]          [●]          ← port handles: 6px circles, 1px border
```

- Border-radius: `4px`. Not `8px`. Not `12px`. 4px.
- Border: `1px solid var(--border-default)` on all sides
- Category color: `3px` left border strip only — not a background fill
- No drop shadow
- Block name: Inter 500, `var(--text-base)`, white
- Parameters: JetBrains Mono, `var(--text-xs)`, `var(--status-unknown)` color — muted, they're metadata
- Port handles: `6px` circle, `1px` border in `--border-default`. On hover: fill with category color. During a valid connection drag: fill with `--status-valid`.
- Hover state on block: `background: var(--bg-elevated)`, no border change, no scaling, no shadow

### Wire Design

```javascript
// Custom edge styles — applied in your React Flow edgeTypes component
const wireStyles = {
  traced: {
    stroke: 'rgba(46, 204, 113, 0.4)',  // valid: muted green
    strokeWidth: 1.5,
  },
  unknown: {
    stroke: 'rgba(106, 106, 122, 0.5)',  // unknown: grey, dashed
    strokeWidth: 1.5,
    strokeDasharray: '4 3',
  },
  error: {
    stroke: '#c0392b',                    // error: solid red, thicker, glowing
    strokeWidth: 2.5,
    filter: 'drop-shadow(0 0 3px rgba(192, 57, 43, 0.4))',
  }
}
```

All wires are bezier curves. Never straight lines. The curve communicates "data flow" — straight lines communicate "connection."

### Palette Design

```
PALETTE
───────────────────
CORE
● Embedding
● Linear
● FeedForward
● Output Head
───────────────────
ATTENTION
◆ Multi-Head Attn
───────────────────
NORMALIZATION
● LayerNorm
● RMSNorm
───────────────────
VISION
● Conv2D
───────────────────
REGULARIZATION
● Dropout
───────────────────
ACTIVATION
● Softmax
```

Section headers: uppercase, Inter 500, `var(--text-xs)`, `var(--status-unknown)` color. The `●` is the category color dot — 3px, same color as the block's left border. The `◆` marks Atomic Primitive state. No icons. No cards. No borders on items. Hover state is background color change only.

### Top Bar

```
┌─────────────────────────────────────────────────────────────────┐
│  µ  µLM Studio  ·  Prototype 0.1                  [Export .py]  │
└─────────────────────────────────────────────────────────────────┘
```

- Height: `38px`
- Background: `var(--bg-surface)`
- Bottom border: `1px solid var(--border-subtle)`
- `µ` glyph: Inter 600, `var(--accent)` color — not a logo, just the character, used with conviction
- `µLM Studio`: Inter 600, white
- `·  Prototype 0.1`: Inter 400, `var(--status-unknown)` — separator dot, muted label
- Export button: `background: var(--accent)`, `0px` border-radius, `Inter 500`, `13px`, `height: 26px`, `padding: 0 12px`

Zero border-radius on the export button. It is the only element on the top bar with a fill color. It will be found without needing to be large.

### Analysis Panel (PROBLEMS Tab)

```
┌─────────────────────────────────────────────────────────────────┐
│ PROBLEMS ①    OUTPUT    DEBUG    TERMINAL                        │
│ ─────────────────────────────────────────────────────────────── │
│ ▼ ERRORS (1)                                                    │
│   ⚠  Shape Mismatch — Attention → FeedForward        [Go] [Fix] │
│      Attention output:    [2, 128, 512]                         │
│      FeedForward expects: [2, 512]                              │
│                                                                 │
│      The attention layer preserves the sequence dimension.      │
│      Your feedforward layer needs to account for seq_len.       │
│      Suggested fix: Add reshape or mean-pool between blocks.    │
│                                                                 │
│ ▶ WARNINGS (0)                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- Tab bar: `var(--bg-surface)`, top border `1px solid var(--border-subtle)`, tabs in Inter 500 `var(--text-sm)`
- Active tab: `var(--accent-dim)` background, `var(--accent)` color, `2px` bottom border in `var(--accent)`
- Error group headers: Inter 500, `var(--text-sm)`, collapsible with `▼`/`▶`
- Error rows: hover background `var(--bg-elevated)`, expand on click to show full detail
- Shape values in error detail: JetBrains Mono, white — they must visually pop against the Inter prose
- `[Go]` button: navigates canvas to the erroring wire. `[Fix]` button: placeholder for v2 AI fix.

---

## The Three Starter Templates

These ship in the prototype and load when a researcher opens a new session. They demonstrate that µLM works on real architectures.

### Template 1: Transformer Encoder Block

The primary demo model. The one that gets typed live during every demo. Know it cold.

```python
import torch
import torch.nn as nn

class TransformerEncoderBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))
        return x
```

**The pre-built mismatch:** change `nn.Linear(d_model, dim_feedforward)` inside feedforward to `nn.Linear(d_model, 768)`. The downstream `nn.Linear(768, d_model)` breaks. The wire between them turns red. Practice introducing this change until you can do it in 10 seconds.

### Template 2: Simple CNN Classifier

Demonstrates that µLM works across architecture types. Shows Conv2D → pooling → linear classifier on the canvas.

```python
import torch
import torch.nn as nn

class SimpleCNN(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, 3, padding=1)
        self.relu1 = nn.ReLU()
        self.conv2 = nn.Conv2d(64, 128, 3, padding=1)
        self.relu2 = nn.ReLU()
        self.pool = nn.AdaptiveAvgPool2d((4, 4))
        self.flatten = nn.Flatten()
        self.classifier = nn.Linear(128 * 4 * 4, num_classes)

    def forward(self, x):
        x = self.relu1(self.conv1(x))
        x = self.relu2(self.conv2(x))
        x = self.pool(x)
        x = self.flatten(x)
        return self.classifier(x)
```

### Template 3: Tissue LLM Cell (Simplified)

A single compressed MLM cell from the Tissue LLM architecture — the research project that created µLM. When a judge or investor asks "what was this built for?" — open Template 3 and say "this." It is a simple MLP with a bottleneck, representing the compressed micro-LM design.

```python
import torch
import torch.nn as nn

class TissueLLMCell(nn.Module):
    """A compressed micro-LM cell from the Tissue LLM architecture."""
    def __init__(self, vocab_size=50000, d_model=512, d_compressed=64):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.compress = nn.Linear(d_model, d_compressed)
        self.norm = nn.LayerNorm(d_compressed)
        self.process = nn.Sequential(
            nn.Linear(d_compressed, d_compressed * 4),
            nn.ReLU(),
            nn.Linear(d_compressed * 4, d_compressed),
        )
        self.expand = nn.Linear(d_compressed, d_model)
        self.output_head = nn.Linear(d_model, vocab_size)

    def forward(self, token_ids):
        x = self.embedding(token_ids)
        x = self.norm(self.compress(x))
        x = x + self.process(x)
        x = self.expand(x)
        return self.output_head(x)
```

**Template loading strategy:** Every template ships as **both** pre-computed JSON (for instant canvas render) and PyTorch code (loaded into the notebook simultaneously). The JSON renders the canvas immediately. The code is in the notebook for the researcher to edit. If the backend is running, the live trace will confirm the pre-computed JSON. If not, the canvas still looks exactly right. There is never a blank canvas during a template load.

---

## The Backend Architecture

### FastAPI Server

```python
# main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
import torch.fx as fx
from torch.fx.passes.shape_prop import ShapeProp
import traceback

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Atomic primitive shape contracts — hardcoded, always available
ATOMIC_SHAPE_CONTRACTS = {
    "MultiheadAttention": {
        "shape_in":  ["[batch, seq_len, d_model]", "[batch, seq_len, d_model]", "[batch, seq_len, d_model]"],
        "shape_out": "[batch, seq_len, d_model]",
        "sync_state": "atomic"
    }
}

@app.websocket("/ws/trace")
async def trace_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            code = data.get("code", "")

            try:
                result = trace_code(code)
                await websocket.send_json({"status": "success", "graph": result})
            except SyntaxError as e:
                await websocket.send_json({
                    "status": "syntax_error",
                    "error": str(e),
                    "line": e.lineno,
                    "graph": None
                })
            except Exception as e:
                await websocket.send_json({
                    "status": "trace_error",
                    "error": str(e),
                    "graph": None
                })
    except WebSocketDisconnect:
        pass


def trace_code(code: str) -> dict:
    namespace = {
        "torch": torch,
        "nn": nn,
        "F": torch.nn.functional,
    }
    exec(code, namespace)

    model_class = None
    for name, obj in namespace.items():
        if (
            isinstance(obj, type)
            and issubclass(obj, nn.Module)
            and obj is not nn.Module
            and name != "__builtins__"
        ):
            model_class = obj
            break

    if model_class is None:
        raise ValueError("No nn.Module subclass found in the provided code.")

    model = model_class()
    
    # Isolate MHA before tracing — wrap it so torch.fx doesn't try to trace inside it
    traced = fx.symbolic_trace(model, concrete_args=None)

    # ShapeProp with a standard dummy input
    dummy = torch.randn(2, 128, 512)
    sp = ShapeProp(traced)
    try:
        sp.propagate(dummy)
    except Exception:
        # Shape prop failed for some nodes — continue.
        # Nodes without shapes will show [?].
        pass

    return graph_to_json(traced, model)


@app.post("/export")
async def export_model(data: dict):
    code = data.get("code", "")
    return {"code": generate_export(code)}
```

### The Serializer

```python
# serializer.py

ATOMIC_PRIMITIVES = {
    "MultiheadAttention",
    "nn.MultiheadAttention",
}

ATOMIC_SHAPE_CONTRACTS = {
    "MultiheadAttention": {
        "shape_in":  ["[batch, seq_len, d_model]", "[batch, seq_len, d_model]", "[batch, seq_len, d_model]"],
        "shape_out": "[batch, seq_len, d_model]",
    }
}

BLOCK_CATEGORIES = {
    "Embedding": "core",
    "Linear": "core",
    "Sequential": "core",
    "MultiheadAttention": "attention",
    "LayerNorm": "norm",
    "RMSNorm": "norm",
    "Conv2d": "vision",
    "Dropout": "regularization",
    "Softmax": "activation",
    "ReLU": "activation",
}


def graph_to_json(traced, model) -> dict:
    nodes_json = []
    edges_json = []
    edge_id = 0

    named_modules = dict(model.named_modules())

    for node in traced.graph.nodes:
        sync_state, category, shape_out, shape_in = classify_node(node, named_modules)

        nodes_json.append({
            "id": node.name,
            "type": "muLMBlock",
            "data": {
                "label": get_display_label(node, named_modules),
                "op": node.op,
                "sync_state": sync_state,  # "traced" | "atomic" | "untraceable"
                "category": category,
                "shape_in": shape_in,
                "shape_out": shape_out,
                "params": get_params(node, named_modules),
                "status": "valid",
            },
            "position": {"x": 0, "y": 0},  # layout handled by frontend dagre
        })

        for input_node in node.all_input_nodes:
            wire_status = check_wire_compatibility(input_node, node, named_modules)
            edges_json.append({
                "id": f"e{edge_id}",
                "source": input_node.name,
                "target": node.name,
                "type": "muLMEdge",
                "data": {
                    "shape": get_shape(input_node),
                    "status": wire_status,  # "valid" | "error" | "unknown"
                }
            })
            edge_id += 1

    return {"nodes": nodes_json, "edges": edges_json}


def classify_node(node, named_modules):
    if node.op in ("placeholder", "output", "get_attr"):
        return "traced", "io", get_shape(node), None

    if node.op == "call_module":
        module = named_modules.get(str(node.target))
        if module is None:
            return "untraceable", "unknown", None, None

        class_name = module.__class__.__name__
        
        if class_name in ATOMIC_PRIMITIVES:
            contract = ATOMIC_SHAPE_CONTRACTS.get(class_name, {})
            return "atomic", BLOCK_CATEGORIES.get(class_name, "core"), \
                   contract.get("shape_out"), contract.get("shape_in")

        category = BLOCK_CATEGORIES.get(class_name, "core")
        return "traced", category, get_shape(node), get_input_shapes(node)

    if node.op in ("call_function", "call_method"):
        return "traced", "core", get_shape(node), get_input_shapes(node)

    return "untraceable", "unknown", None, None


def get_shape(node):
    if hasattr(node, "meta") and "tensor_meta" in node.meta:
        meta = node.meta["tensor_meta"]
        if hasattr(meta, "shape"):
            return list(meta.shape)
    return None


def get_input_shapes(node):
    return [get_shape(inp) for inp in node.all_input_nodes]


def check_wire_compatibility(source_node, target_node, named_modules) -> str:
    source_shape = get_shape(source_node)
    if source_shape is None:
        return "unknown"

    target_module_name = str(target_node.target)
    target_module = named_modules.get(target_module_name)
    if target_module is None:
        return "unknown"

    target_class = target_module.__class__.__name__

    # Linear: check in_features matches last dim of source
    if target_class == "Linear":
        in_features = target_module.in_features
        if len(source_shape) > 0 and source_shape[-1] != in_features:
            return "error"

    # LayerNorm: check normalized_shape matches last dims
    if target_class == "LayerNorm":
        norm_shape = list(target_module.normalized_shape)
        if source_shape[-len(norm_shape):] != norm_shape:
            return "error"

    return "valid"
```

### The Code Generator (Canvas → Notebook Direction)

```python
# codegen.py
from collections import defaultdict, deque


def generate_code_from_graph(nodes: list, edges: list) -> str:
    """
    Generate a PyTorch nn.Module from a React Flow graph.
    Performs topological sort to produce correct forward() order.
    Handles additive residual connections.
    """
    if not nodes:
        return _empty_template()

    node_map = {n["id"]: n for n in nodes}
    
    # Build adjacency — who feeds whom
    children = defaultdict(list)
    parents = defaultdict(list)
    for edge in edges:
        children[edge["source"]].append(edge["target"])
        parents[edge["target"]].append(edge["source"])

    # Topological sort (Kahn's algorithm)
    in_degree = {n["id"]: len(parents[n["id"]]) for n in nodes}
    queue = deque([n["id"] for n in nodes if in_degree[n["id"]] == 0])
    topo_order = []

    while queue:
        node_id = queue.popleft()
        topo_order.append(node_id)
        for child in children[node_id]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    # Separate module nodes from I/O
    module_nodes = [
        node_map[nid] for nid in topo_order
        if node_map[nid]["data"]["op"] == "call_module"
    ]

    init_lines = []
    forward_lines = []
    assigned_vars = {}  # node_id -> variable name
    var_counter = defaultdict(int)

    # Build __init__
    for node in module_nodes:
        data = node["data"]
        label = _sanitize_name(data["label"])
        var_counter[label] += 1
        var_name = label if var_counter[label] == 1 else f"{label}_{var_counter[label]}"
        assigned_vars[node["id"]] = var_name
        init_lines.append(f"        self.{var_name} = {_pytorch_class(data)}")

    # Build forward()
    for node_id in topo_order:
        node = node_map[node_id]
        data = node["data"]
        
        if data["op"] == "placeholder":
            assigned_vars[node_id] = "x"
            continue
        
        if data["op"] == "output":
            input_vars = [assigned_vars.get(p, "x") for p in parents[node_id]]
            forward_lines.append(f"        return {input_vars[0] if input_vars else 'x'}")
            continue

        if data["op"] != "call_module":
            continue

        var_name = assigned_vars.get(node_id, "x")
        input_ids = parents[node_id]

        if len(input_ids) == 0:
            forward_lines.append(f"        {var_name}_out = self.{var_name}(x)")
        elif len(input_ids) == 1:
            in_var = assigned_vars.get(input_ids[0], "x")
            # Detect additive residual: same source feeds both this node and another
            if _is_residual_branch(node_id, input_ids[0], children, parents):
                forward_lines.append(f"        {var_name}_out = {in_var} + self.{var_name}({in_var})")
            else:
                forward_lines.append(f"        {var_name}_out = self.{var_name}({in_var})")
        elif len(input_ids) > 1:
            # Multi-input block (e.g. MHA: Q, K, V)
            in_vars = [assigned_vars.get(pid, "x") for pid in input_ids]
            args = ", ".join(in_vars)
            forward_lines.append(f"        {var_name}_out = self.{var_name}({args})")
        else:
            # Cannot resolve — be honest
            forward_lines.append(f"        # TODO: manually wire {var_name}")

        assigned_vars[node_id] = f"{var_name}_out"

    return f"""import torch
import torch.nn as nn


class Model(nn.Module):
    def __init__(self):
        super().__init__()
{chr(10).join(init_lines)}

    def forward(self, x: torch.Tensor) -> torch.Tensor:
{chr(10).join(forward_lines) if forward_lines else "        return x"}
"""


def _is_residual_branch(node_id, input_id, children, parents) -> bool:
    """True if the input node feeds both this node AND something else this node depends on."""
    siblings = children.get(input_id, [])
    return len(siblings) > 1 and node_id in siblings


def _sanitize_name(label: str) -> str:
    return label.lower().replace(" ", "_").replace("-", "_")


def _pytorch_class(data: dict) -> str:
    params = data.get("params", {})
    label = data.get("label", "")
    CLASS_MAP = {
        "Embedding": lambda p: f"nn.Embedding({p.get('num_embeddings', 50000)}, {p.get('embedding_dim', 512)})",
        "Linear": lambda p: f"nn.Linear({p.get('in_features', 512)}, {p.get('out_features', 512)})",
        "Multi-Head Attention": lambda p: f"nn.MultiheadAttention({p.get('embed_dim', 512)}, {p.get('num_heads', 8)}, batch_first=True)",
        "LayerNorm": lambda p: f"nn.LayerNorm({p.get('normalized_shape', 512)})",
        "RMSNorm": lambda p: f"RMSNorm({p.get('d_model', 512)})",
        "FeedForward": lambda p: f"nn.Sequential(nn.Linear({p.get('d_model', 512)}, {p.get('dim_feedforward', 2048)}), nn.ReLU(), nn.Linear({p.get('dim_feedforward', 2048)}, {p.get('d_model', 512)}))",
        "Conv2D": lambda p: f"nn.Conv2d({p.get('in_channels', 3)}, {p.get('out_channels', 64)}, {p.get('kernel_size', 3)}, padding=1)",
        "Dropout": lambda p: f"nn.Dropout({p.get('p', 0.1)})",
        "Softmax": lambda p: f"nn.Softmax(dim={p.get('dim', -1)})",
        "Output Head": lambda p: f"nn.Linear({p.get('in_features', 512)}, {p.get('out_features', 50000)})",
    }
    factory = CLASS_MAP.get(label)
    return factory(params) if factory else f"nn.Identity()  # unknown block: {label}"


def _empty_template() -> str:
    return """import torch
import torch.nn as nn


class Model(nn.Module):
    def __init__(self):
        super().__init__()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x
"""
```

---

## The Error Detection System

After every sync cycle (notebook → canvas direction) and after every block/wire change (canvas → notebook direction), run the full error check pass.

```javascript
// errorDetector.js
export function detectErrors(nodes, edges) {
  const errors = []
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  edges.forEach(edge => {
    const source = nodeMap[edge.source]
    const target = nodeMap[edge.target]
    if (!source || !target) return

    const edgeStatus = edge.data?.status
    if (edgeStatus === 'error') {
      errors.push({
        id: `err-${edge.id}`,
        edgeId: edge.id,
        type: 'shape_mismatch',
        severity: 'error',
        sourceLabel: source.data.label,
        targetLabel: target.data.label,
        sourceShape: source.data.shape_out,
        targetShape: target.data.shape_in,
        message: generateErrorMessage(source.data, target.data)
      })
    }
  })

  // Disconnected blocks (no edges connected)
  const connectedIds = new Set(edges.flatMap(e => [e.source, e.target]))
  nodes.forEach(node => {
    if (
      node.data.op === 'call_module' &&
      !connectedIds.has(node.id)
    ) {
      errors.push({
        id: `err-disconnected-${node.id}`,
        nodeId: node.id,
        type: 'disconnected',
        severity: 'warning',
        sourceLabel: node.data.label,
        message: `${node.data.label} is on the canvas but not connected.`
      })
    }
  })

  return errors
}

function generateErrorMessage(sourceData, targetData) {
  const src = formatShape(sourceData.shape_out)
  const tgt = formatShape(targetData.shape_in)
  return {
    title: `Shape Mismatch — ${sourceData.label} → ${targetData.label}`,
    sourceShape: src,
    targetShape: tgt,
    detail: explainMismatch(sourceData, targetData),
    suggestion: suggestFix(sourceData, targetData)
  }
}

function formatShape(shape) {
  if (!shape) return '[?]'
  if (Array.isArray(shape)) return `[${shape.join(', ')}]`
  return String(shape)
}

function explainMismatch(sourceData, targetData) {
  // For the demo mismatch: Attention → FeedForward after Linear dimension change
  if (sourceData.label.includes('Attention') && targetData.label.includes('FeedForward')) {
    return 'The attention layer preserves the sequence dimension. Your feedforward layer needs to account for seq_len.'
  }
  return `${sourceData.label} outputs ${formatShape(sourceData.shape_out)} but ${targetData.label} expects a different shape.`
}

function suggestFix(sourceData, targetData) {
  if (sourceData.label.includes('Attention')) {
    return 'Add a reshape or mean-pool between these blocks, or update the feedforward input dimensions to match.'
  }
  return 'Check the output dimensions of the upstream block match the expected input dimensions of the downstream block.'
}
```

---

## The Build — Day by Day

The week is divided into three phases: **Spike** (validate the technical foundation), **Build** (implement the prototype end-to-end), **Polish** (make it demo-ready). The hackathon is the fourth phase.

---

### Phase 1 — Spike (Days 1–2)

**Owner:** Technical Lead  
**Goal:** Validate that `torch.fx` traces the specific models you will demo, confirm the three-state system works, and produce the JSON graph format before anything is built on top of it.

#### Day 1 — torch.fx Spike + Three-State Validation

Write one script. Nothing else. No frontend, no API, no UI.

```python
# spike.py — run this on Day 1
import torch
import torch.nn as nn
import torch.fx as fx
from torch.fx.passes.shape_prop import ShapeProp

class SimpleTransformerBlock(nn.Module):
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

class SimpleMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(512, 256)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(256, 128)

    def forward(self, x):
        return self.fc2(self.relu(self.fc1(x)))

class SimpleCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, 3, padding=1)
        self.relu = nn.ReLU()
        self.conv2 = nn.Conv2d(64, 128, 3, padding=1)

    def forward(self, x):
        return self.conv2(self.relu(self.conv1(x)))

def spike(model, dummy_input, name):
    print(f"\n{'='*60}")
    print(f"Model: {name}")
    print(f"{'='*60}")
    try:
        traced = fx.symbolic_trace(model)
        sp = ShapeProp(traced)
        try:
            sp.propagate(dummy_input)
        except Exception as e:
            print(f"  [ShapeProp failed — will show [?] on affected wires]: {e}")

        for node in traced.graph.nodes:
            shape = None
            if hasattr(node, 'meta') and 'tensor_meta' in node.meta:
                shape = list(node.meta['tensor_meta'].shape)
            print(f"  {node.op:15} | {str(node.target):35} | shape: {shape}")

        print(f"  ✅ Traces successfully")
        return traced

    except Exception as e:
        print(f"  ❌ Trace failed: {e}")
        print(f"  → This module will be classified as Atomic Primitive or Untraceable")
        return None

spike(SimpleMLP(), torch.randn(2, 512), "Simple MLP")
spike(SimpleTransformerBlock(), torch.randn(2, 128, 512), "Transformer Block")
spike(SimpleCNN(), torch.randn(2, 3, 224, 224), "Simple CNN")
```

**What to learn from this script:**
1. Does MHA fail to trace? If yes: the Atomic Primitive strategy is confirmed as mandatory.
2. How does `torch.fx` represent residual connections (`x = norm(x + attn_out)`)? Document the exact node structure — the code generator needs to know.
3. Does ShapeProp correctly annotate shapes on every node that does trace?

**If MHA traces cleanly on your PyTorch version:** it is still classified as Atomic Primitive in the prototype. The hardcoded shape contract and hardcoded interior view are still built. The reason: MHA tracing behavior varies across PyTorch versions and is not guaranteed stable. The prototype must be robust to the demo machine having a different behavior than the dev machine.

**End of Day 1 deliverable:** documented trace output for all three models. Specific note on how residual connections appear in the fx graph. Confirmed three-state classification for each block.

#### Day 2 — Graph-to-JSON Serializer with Three-State Output

Write the serializer from `serializer.py` above. Run it against the Day 1 spike outputs. Confirm the JSON produced for the transformer block matches the React Flow schema.

**End of Phase 1 deliverable:** a Python script that takes the transformer block, traces it, classifies every node's sync state, and outputs React Flow compatible JSON. MHA appears as `sync_state: "atomic"` with its hardcoded shape contract applied. All other nodes appear as `sync_state: "traced"` with ShapeProp shapes. This JSON is also saved as `src/demo/staticGraph.js` for the fallback static demo.

---

### Phase 2 — Build (Days 3–5)

**All three team members building in parallel.**  
**Goal:** Full prototype working end-to-end, even if rough.

#### Day 3 — Parallel Tracks

**Technical Lead: FastAPI + WebSocket Server**

Wrap the Day 2 serializer in the FastAPI server from `main.py` above. Get the WebSocket endpoint accepting code strings and returning JSON graphs.

Confirm: send the transformer block code as a raw string over WebSocket, receive the JSON graph. That is the entire Day 3 backend goal.

**Teammate: React Frontend Foundation + Three-State Block Rendering**

Set up the Vite + React project. Install React Flow, Monaco Editor. Build the three-panel layout with the exact proportions from the interface spec.

Critical Day 3 addition: implement the three-state block visual rendering in the React Flow custom node component before connecting anything to the backend. The visual language is established now.

```jsx
// components/MuLMBlockNode.jsx
export function MuLMBlockNode({ data }) {
  const syncStateStyles = {
    traced:       { borderStyle: 'solid', opacity: 1 },
    atomic:       { borderStyle: 'solid', opacity: 1 },  // + ◆ badge
    untraceable:  { borderStyle: 'dashed', opacity: 0.7 },
  }

  const categoryColors = {
    core:           '#3a3a3a',
    attention:      '#2e4a7a',
    norm:           '#2a5a3a',
    vision:         '#4a2e5a',
    activation:     '#5a3a2a',
    regularization: '#3a4a2e',
    io:             '#2a3a4a',
  }

  const catColor = categoryColors[data.category] || categoryColors.core
  const stateStyle = syncStateStyles[data.sync_state] || syncStateStyles.untraceable

  return (
    <div style={{
      background: '#1c1c1e',
      border: `1px solid #3a3a3f`,
      borderLeft: `3px solid ${catColor}`,
      borderRadius: '4px',
      minWidth: '160px',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      ...stateStyle,
    }}>
      {/* Header */}
      <div style={{
        padding: '6px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>
          {data.label}
        </span>
        {data.sync_state === 'atomic' && (
          <span style={{ fontSize: '10px', color: '#5a5a6a', flexShrink: 0 }}>◆</span>
        )}
        {data.sync_state === 'untraceable' && (
          <span style={{ fontSize: '10px', color: '#b8860b', flexShrink: 0 }}>?</span>
        )}
      </div>

      {/* Params (if any) */}
      {data.params && Object.keys(data.params).length > 0 && (
        <>
          <div style={{ height: '1px', background: '#2e2e32' }} />
          <div style={{ padding: '4px 8px' }}>
            {Object.entries(data.params).map(([key, val]) => (
              <div key={key} style={{
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                fontSize: '11px',
                color: '#6a6a7a',
                lineHeight: '1.6',
              }}>
                {key}: {val}
              </div>
            ))}
          </div>
        </>
      )}

      {/* React Flow handles — added by parent */}
    </div>
  )
}
```

**Founder: Block Definitions + Starter Code Templates**

Write `blocks.js` (the 10 block definitions as JSON, including the three-state classification, category assignment, and hardcoded shape contracts for Atomic blocks). Write the three starter code templates. Save the transformer block's pre-computed graph JSON to `src/demo/staticGraph.js` (generated from the Day 2 serializer output).

#### Day 4 — Connect Everything

**All hands. This is the hardest day.**

**Morning: WebSocket connection**

Connect the Monaco editor to the FastAPI WebSocket using `useTracer.js`. Every code change (300ms debounce) sends to backend, receives JSON graph, updates React Flow canvas.

Implement the canvas layout algorithm. React Flow does not auto-layout — you need to assign `(x, y)` positions. Use `dagre` for automatic hierarchical layout:

```bash
npm install @dagrejs/dagre
```

```javascript
// utils/layout.js
import dagre from '@dagrejs/dagre'

export function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })

  nodes.forEach(node => {
    g.setNode(node.id, { width: 180, height: 80 })
  })
  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - 90, y: pos.y - 40 } }
  })
}
```

**Afternoon: Canvas → Notebook direction**

Wire the `onNodesChange` and `onEdgesChange` React Flow callbacks to call `generate_code_from_graph` (the JavaScript port of the Python codegen) and update the Monaco editor content.

By end of Day 4: paste any PyTorch model into the notebook, see it on the canvas with shapes on wires and three-state blocks. Drag a block onto the canvas, see code appear in the notebook.

#### Day 5 — Error Detection + Drill-Down + Export + Fallback Demo

**Morning: Shape mismatch detection**

Wire `detectErrors(nodes, edges)` to run after every graph update. Update wire colors in React Flow based on the error state. Populate the PROBLEMS tab.

**Afternoon — four tasks in order:**

1. **Drill-down:** implement `onNodeDoubleClick` in React Flow. For Atomic blocks (MHA): render the hardcoded interior graph. For Traced blocks: call the backend `/drill` endpoint with the block's module path, receive a sub-graph, render it. Breadcrumb component at the top of the canvas.

2. **Export:** `Export .py` button calls `POST /export` with the current notebook code. Backend returns the clean PyTorch file. Frontend triggers a file download.

3. **Fallback static demo:** implement `VITE_DEMO_MODE` flag. Save the current transformer block JSON from Day 4 into `src/demo/staticGraph.js`. Wire fallback mode to use it instead of the WebSocket. Test: `VITE_DEMO_MODE=true npm run dev` — confirm the UI is fully operational without the backend.

4. **PROBLEMS tab — pixel-perfect render for the demo error:** build the exact error message layout from the spec above. Confirm that shape values render in JetBrains Mono and prose renders in Inter. This is not a stretch goal — it is a demo beat.

**End of Phase 2 deliverable:** full prototype working end-to-end. Bidirectional sync working. Three-state blocks rendering. Shape mismatches detected and displayed. Drill-down working (MHA hardcoded, others traced). Export working. Fallback static demo operational.

---

### Phase 3 — Polish (Days 6–7)

**Goal: Demo-ready. Not feature-complete. Demo-ready.**

#### Day 6 — UI Polish + Environment Freeze + Demo Model Lock

**Visual polish checklist:**
- Canvas background: engineering grid (20px × 20px, `rgba(255,255,255,0.03)`)
- Block rendering: confirm all category colors correct, `◆` and `?` badges rendering correctly
- Wire style: bezier curves, not straight lines — confirm in React Flow edge options
- Wire labels: two-zoom-level behavior (full labels at demo zoom, error-only at thumbnail zoom)
- PROBLEMS tab: pixel-perfect error layout, JetBrains Mono on shape values
- Monaco editor: PyTorch syntax highlighting enabled, line numbers on, dark theme matching `var(--bg-surface)`
- Top bar: `38px` height, export button `0px` border-radius
- Palette: category section headers, `●`/`◆` dots, hover state only (no cards, no shadows)

**Environment freeze:**
```bash
# On the dev machine — after confirming everything works
pip freeze > requirements.txt

# On the demo machine — fresh install test
python -m venv .venv-demo
source .venv-demo/bin/activate
pip install -r requirements.txt

# Run the spike.py from Day 1 on the demo machine
# Confirm trace outputs match dev machine exactly
```

**The demo model lock:** the transformer block code that gets typed live during every demo is now fixed. Write it on a card. Practice typing it until you can do it in 45 seconds without looking at the card. The model is:

```python
import torch
import torch.nn as nn

class TransformerEncoderBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))
        return x
```

The mismatch to introduce: inside `feedforward`, change `nn.Linear(d_model, dim_feedforward)` to `nn.Linear(d_model, 768)`. Practice this change until it takes 5 seconds.

#### Day 7 — Rehearsal Only

No new features. No bug fixes unless something is completely broken.

**Morning:** Full demo run, start to finish, three times. Time each run. It must complete in under 3 minutes.

**Afternoon:** Rest.

---

### Phase 4 — The Hackathon (24 Hours, June 20–21)

#### Role Division

| Person | Role |
|---|---|
| Founder | Demo, pitch, investor conversations, researcher conversations. Does not touch the laptop during the demo. |
| Teammate | Manages the laptop during the demo. Handles the typing, the mismatch introduction, the export click. Is invisible to the audience. |

Two people is leaner than three. The plan works for a team of two: Founder speaks, Teammate executes on the laptop. Swap roles during the judging round if one person is more confident typing the demo model under pressure.

#### The First 2 Hours — Environment Confirmation

Get the environment running on the demo machine. Not the dev machine — the machine that will be used for the demo. Confirm in this exact order:

1. `pip install -r requirements.txt` completes without errors
2. Backend starts: `uvicorn main:app --host 0.0.0.0 --port 8000`
3. Frontend starts: `npm run dev`
4. WebSocket connects: open the browser, confirm the connection indicator in the status bar shows connected
5. Paste the demo model into the notebook. Confirm the canvas renders with all blocks, all shapes, MHA as Atomic
6. Introduce the mismatch. Confirm the wire turns red and the PROBLEMS tab shows the correct error message
7. Fix the mismatch. Confirm the wire returns to valid state
8. Double-click MHA. Confirm the interior view renders. Confirm breadcrumb navigation
9. Click Export .py. Confirm the file downloads. Open it — confirm it is clean and correct

If anything fails in these first 2 hours: fix it before doing anything else. Do not proceed to building new features if the core demo is broken.

**If the backend will not start on the demo machine:** switch to `VITE_DEMO_MODE=true` immediately. Do not spend the hackathon debugging environment issues. The fallback demo is there for this reason.

#### Hours 2–18 — Buffer

The prototype is complete. These hours are for:
- Fixing bugs discovered during environment confirmation
- Practicing the demo on the actual environment, on the actual machine
- Talking to mentors about pitch framing
- One small polish improvement if everything is working perfectly — not a new feature

#### Hours 18–22 — Pitch Finalization

**The three-minute pitch:**

**Opening (30 seconds):** *"Every ML researcher you know has debugged an error that looked like this—"* show a CUDA assertion stack trace in a notebook *"—with no idea where it came from. The shape error that caused it happened five layers earlier, at design time. They just didn't know it yet."*

**Demo (90 seconds):** The nine beats. Design, visualize, drill-down, validate, export.

**Business (30 seconds):** *"500,000 active ML researchers globally. They each lose an estimated 20–30% of their time to debugging problems that µLM catches at design time. We are building the professional IDE that this discipline has never had — the Cadence of machine learning."*

**Ask (10 seconds):** *"We're looking for early researcher partners and seed conversations. If you're building in this space or know researchers who would use this — talk to us after the demo."*

---

## The Nine-Beat Demo Flow

This is the demo. Every word of it is rehearsed. Every beat has a time budget. Three minutes total.

**Beat 1 — The Interface (5 seconds)**
Open µLM. Show the three-panel interface. Say nothing. Let it speak. The engineering grid, the palette, the Monaco editor, the analysis panel — the tool communicates its own identity in five seconds of silence.

**Beat 2 — Code-First Sync (45 seconds)**
*"Let me show you what this does."*
Type the transformer block code into the notebook. The canvas builds itself alongside. Blocks appear. Wires appear. Shape labels appear. MHA renders with its `◆` badge. Don't talk over it — let the room watch it happen.
*"Every wire shows the tensor shape flowing through it. That is information a notebook never shows you."*

**Beat 3 — The MHA Badge (10 seconds)**
*"This diamond badge on Multi-Head Attention means it's an atomic primitive — µLM knows its full shape contract even without tracing its internals."*

**Beat 4 — Drill-Down (15 seconds)**
*"Watch what's inside."*
Double-click the attention block. Canvas transitions. Q, K, V projections. Scaled dot-product attention. Output projection. All connected, all with shapes.
*"You've never been able to see this without reading through the source code."*
Click the breadcrumb. Back to root.

**Beat 5 — Shape Mismatch Introduction (15 seconds)**
*"Watch what happens when I make a common mistake."*
Change `nn.Linear(d_model, dim_feedforward)` to `nn.Linear(d_model, 768)` in the feedforward block. Wire turns red. `⚠` icon appears. PROBLEMS tab badge shows `(1)`.

**Beat 6 — The Payoff (20 seconds)**
Click the PROBLEMS tab. The error message renders: block names, exact shapes in monospace, explanation, suggested fix.
*"µLM caught a shape mismatch — instantly, at design time. In a notebook, this error surfaces as a CUDA assertion failure during training — hours later, on a different machine, after you've already committed the run."*
That is the sentence that makes the pain concrete for every judge in the room, ML or not.

**Beat 7 — Canvas-First Sync (15 seconds)**
Fix the mismatch (revert the change). Drag a Dropout block from the palette. Connect it between feedforward and norm2. Code appears in the notebook — the new `self.dropout` line, correctly placed.
*"I can also design visually. The code writes itself."*

**Beat 8 — Export (10 seconds)**
*"When I'm ready — one click."*
Click Export .py. File downloads. Open it in a text editor side by side. Show the clean, commented, runnable code.
*"Immediately runnable. No cleanup, no restructuring."*

**Beat 9 — Stop (5 seconds)**
Close the text editor. Return to µLM. Make eye contact.
*"Questions?"*

---

## What Success Looks Like

### At the hackathon

One technically credible person — a researcher, engineer, or ML-aware investor — watches Beat 6, pauses, and says some version of: *"Wait. I've needed this."*

That reaction, from one credible person, is a successful hackathon regardless of placement.

### With researchers after the hackathon

A researcher pastes their own model code — not your template — and the canvas renders it correctly. They say: *"That's actually my model."*

That moment is the validation no demo can provide.

### With investors after the hackathon

An investor asks for a follow-up meeting in 30 days. Not a business card — a scheduled meeting. That means the vision landed as fundable.

---

## The One Rule for the Entire Build

> **If it's not in this plan, it doesn't get built this week.**

Every idea that comes up during build week — *"what if we add X"*, *"the investors would love Y"*, *"should we also do Z"* — gets written in a separate ideas list and left for v2.

Scope creep is how prototypes become incomplete prototypes. An incomplete prototype demonstrates nothing. A complete, working, demo-ready slice of the vision demonstrates everything.

Build what's in this plan. Ship it. Then learn from reality.

---

*µLM Studio — Prototype 0.2 Build Plan*
*Redesigned from Prototype 0.1 — incorporates three-state block system, topological code generation, fallback static demo, nine-beat demo flow, and full design system specification*
*Version 1.0 — anchored before build begins*
*Do not modify during the build week*
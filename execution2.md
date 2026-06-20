# µLM Studio — Validation + Build Completion Plan

### Hackathon Edition: From Current State to Submission-Ready

**Written:** Mid-hackathon, ~13 hours to submission (9:30 AM)
**Purpose:** First validate exactly what exists, then build what's missing in safe order
**Rule:** Every prompt includes explicit "do not break" guards. No prompt touches
more than one concern at a time. Validate before building.

---

## How to Use This Document

Read Phase 0 completely before running any prompt. Phase 0 is a
validation-only phase — no code changes, just confirmation of current state.
The results of Phase 0 determine which prompts in Phase 1 you actually run.
Do not skip Phase 0 to "save time." You will spend that time debugging instead.

Each prompt is labeled with:

* TOOL: which AI tool to use (Claude / Codex / Gemini / You)
* TIME: realistic estimate
* DEPENDS ON: what must be confirmed working before this runs
* DO NOT TOUCH: explicit list of files/features this prompt must not modify

---

## Phase 0 — Validation (You, 30 minutes, no AI needed)

Run these checks in order. For each one, record the result as
PASS / FAIL / PARTIAL. The build plan in Phase 1 is conditioned on these results.

### V1 — Backend Health

```bash
# With your venv activated and uvicorn running:
curl http://localhost:8000/health

```

Expected: `{"status":"ok","torch_version":"2.3.1+cu121","cuda_available":true,"python_version":"3.11.6"}`
Record: PASS / FAIL

```bash
curl http://localhost:8000/palette | python -m json.tool | head -20

```

Expected: JSON with "categories" array and "blocks_by_category" with 6 keys
Record: PASS / FAIL

```bash
curl http://localhost:8000/demo | python -m json.tool | python -c "
import json,sys
d=json.load(sys.stdin)
print('nodes:', len(d['nodes']))
print('edges:', len(d['edges']))
"

```

Expected: `nodes: 13`, `edges: 14`
Record: PASS / FAIL + actual counts

```bash
curl "http://localhost:8000/demo?view=mha_interior" | python -m json.tool | python -c "
import json,sys
d=json.load(sys.stdin)
print('interior nodes:', len(d['nodes']))
print('interior edges:', len(d['edges']))
"

```

Expected: `interior nodes: 7`, `interior edges: 8`
Record: PASS / FAIL + actual counts

---

### V2 — Live WebSocket Trace: Default d_model=512

Open a new terminal. Run:

```bash
# Install wscat if not present
npm install -g wscat 2>/dev/null

wscat -c ws://localhost:8000/ws/trace <<'EOF'
{"code": "import torch\nimport torch.nn as nn\n\nclass TransformerEncoderBlock(nn.Module):\n    def __init__(self, d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1):\n        super().__init__()\n        self.attention = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)\n        self.norm1 = nn.LayerNorm(d_model)\n        self.norm2 = nn.LayerNorm(d_model)\n        self.feedforward = nn.Sequential(nn.Linear(d_model, dim_feedforward), nn.ReLU(), nn.Dropout(dropout), nn.Linear(dim_feedforward, d_model))\n        self.dropout = nn.Dropout(dropout)\n    def forward(self, x):\n        attn_out, _ = self.attention(x, x, x)\n        x = self.norm1(x + self.dropout(attn_out))\n        ff_out = self.feedforward(x)\n        x = self.norm2(x + self.dropout(ff_out))\n        return x", "input_shape": [2, 128, 512]}
EOF

```

In the response JSON, run this check:

```bash
# Pipe the response to this checker
python -c "
import json, sys
r = json.load(sys.stdin)
if r['status'] != 'success':
    print('FAIL: status =', r['status'])
    sys.exit(1)

g = r['graph']
nodes_by_id = {n['id']: n for n in g['nodes']}
shapes_unknown = [n['id'] for n in g['nodes'] if n['data'].get('shape') in (None, '[unknown]', 'unknown')]
mha = next((n for n in g['nodes'] if 'attention' in n['id'].lower() or n['data'].get('sync_state') == 'atomic'), None)

print('Total nodes:', len(g['nodes']))
print('Total edges:', len(g['edges']))
print('Nodes with unknown shape:', shapes_unknown)
print('MHA node found:', mha['id'] if mha else 'NOT FOUND')
if mha:
    print('MHA sync_state:', mha['data'].get('sync_state'))
    print('MHA shape:', mha['data'].get('shape'))
    print('MHA type:', mha.get('type'))
"

```

Expected:

* Total nodes: 13
* Total edges: 14
* Nodes with unknown shape: [] (empty — this is the key check)
* MHA sync_state: atomic
* MHA shape: [2, 128, 512] (not unknown)

Record: PASS / FAIL / PARTIAL (note which nodes have unknown shapes)

---

### V3 — Live WebSocket Trace: Changed d_model=256

```bash
wscat -c ws://localhost:8000/ws/trace <<'EOF'
{"code": "import torch\nimport torch.nn as nn\n\nclass TransformerEncoderBlock(nn.Module):\n    def __init__(self, d_model=256, nhead=8, dim_feedforward=2048, dropout=0.1):\n        super().__init__()\n        self.attention = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)\n        self.norm1 = nn.LayerNorm(d_model)\n        self.norm2 = nn.LayerNorm(d_model)\n        self.feedforward = nn.Sequential(nn.Linear(d_model, dim_feedforward), nn.ReLU(), nn.Dropout(dropout), nn.Linear(dim_feedforward, d_model))\n        self.dropout = nn.Dropout(dropout)\n    def forward(self, x):\n        attn_out, _ = self.attention(x, x, x)\n        x = self.norm1(x + self.dropout(attn_out))\n        ff_out = self.feedforward(x)\n        x = self.norm2(x + self.dropout(ff_out))\n        return x", "input_shape": [2, 128, 256]}
EOF

```

Pipe response to same checker as V2, but expect:

* Nodes with unknown shape: [] (still empty)
* MHA shape: [2, 128, 256] (updated to 256)

This is the bug from the screenshot. If this FAILS (unknown shapes appear), Fix B1
in Phase 1 is mandatory. If this PASSES, Fix B1 is already done.

Record: PASS / FAIL

---

### V4 — Mismatch Detection

```bash
# Send a model with a deliberate shape mismatch
wscat -c ws://localhost:8000/ws/trace <<'EOF'
{"code": "import torch\nimport torch.nn as nn\n\nclass BrokenTransformer(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.attention = nn.MultiheadAttention(512, 8, batch_first=True)\n        self.norm1 = nn.LayerNorm(512)\n        self.feedforward = nn.Linear(512, 768)\n        self.norm2 = nn.LayerNorm(768)\n    def forward(self, x):\n        attn_out, _ = self.attention(x, x, x)\n        x = self.norm1(x + attn_out)\n        x = self.feedforward(x)\n        x = self.norm2(x)\n        return x", "input_shape": [2, 128, 512]}
EOF

```

Check: does any edge in the response have `"status": "error"` or `"status": "mismatch"`?

```bash
python -c "
import json, sys
r = json.load(sys.stdin)
g = r['graph']
error_edges = [e for e in g['edges'] if e['data'].get('status') not in ('valid', 'unknown')]
print('Error edges:', error_edges)
"

```

Expected: at least one edge with error/mismatch status between feedforward and norm2
Record: PASS (errors detected in backend) / FAIL (all edges show valid)

---

### V5 — Export Endpoint

```bash
python -c "
import requests, json

code = '''import torch
import torch.nn as nn

class TransformerEncoderBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.feedforward = nn.Sequential(nn.Linear(d_model, dim_feedforward), nn.ReLU(), nn.Dropout(dropout), nn.Linear(dim_feedforward, d_model))
        self.dropout = nn.Dropout(dropout)
    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attn_out))
        ff_out = self.feedforward(x)
        x = self.norm2(x + self.dropout(ff_out))
        return x'''

r = requests.post('http://localhost:8000/export', json={'code': code, 'model_name': 'TransformerEncoderBlock'})
print('Status:', r.status_code)
content = r.text if r.headers.get('content-type','').startswith('text') else r.json()
print('First 200 chars:', str(content)[:200])
"

```

Expected: status 200, content starts with `# =====` or `import torch`
Record: PASS / FAIL

---

### V6 — Frontend: What's Rendering

Open the browser. Run these checks visually and in the browser console (F12):

**V6a — Console errors on load:**
Open DevTools → Console. Reload the page. Count any red errors.
Record: 0 errors / N errors (note what they are)

**V6b — Notebook → Canvas sync:**
Type or paste the transformer block code into the Monaco editor.
Wait 500ms. Does the canvas update?
Record: PASS / FAIL / PARTIAL

**V6c — Shape labels visible:**
After canvas renders, are shape labels visible on wires?
Are they showing actual numbers like `[2, 128, 512]` or `[unknown]`?
Record: PASS (numbers showing) / FAIL (unknown) / FAIL (no labels at all)

**V6d — MHA block rendering:**
Is the MHA block showing a `◆` badge?
Record: PASS / FAIL

**V6e — PROBLEMS tab on mismatch:**
In Monaco, change `nn.Linear(d_model, dim_feedforward)` to
`nn.Linear(d_model, 768)` inside the feedforward Sequential.
Wait 500ms. Does the PROBLEMS tab show an error?
Does the wire turn red?
Record: PASS / FAIL / PARTIAL (which part works)

**V6f — Canvas → Notebook direction:**
Drag any block from the palette onto the canvas.
Does code appear in the Monaco editor?
Record: PASS / FAIL / NOT IMPLEMENTED

**V6g — Drill-down:**
Double-click the MHA block on the canvas.
Does a drill-down interior view appear?
Record: PASS / FAIL / NOT IMPLEMENTED

**V6h — Export button:**
Click "Export .py" in the top bar.
Does a file download?
Is it valid Python?
Record: PASS / FAIL

**V6i — Block deletion:**
Click a block on the canvas. Press Delete or Backspace.
Does the block disappear from the canvas?
Does the code in Monaco update?
Record: PASS / FAIL / NOT IMPLEMENTED

**V6j — Monaco highlight on click:**
Click any block on the canvas.
Does the Monaco editor highlight the corresponding lines?
Record: PASS / FAIL / NOT IMPLEMENTED

---

### V0 Results Table (Fill This In Before Continuing)

| Check | Expected | Result | Action Required |
| --- | --- | --- | --- |
| V1 — Backend health | All endpoints respond |  |  |
| V2 — Trace d_model=512 | 0 unknown shapes |  |  |
| V3 — Trace d_model=256 | 0 unknown shapes, 256 in shapes |  | Fix B1 if FAIL |
| V4 — Mismatch detection | Error edges in backend response |  | Fix B2 if FAIL |
| V5 — Export | Status 200, valid Python |  |  |
| V6a — Console errors | 0 |  | Fix before anything else |
| V6b — Notebook→canvas | Canvas updates |  |  |
| V6c — Shape labels | Numbers, not [unknown] |  | Fix F1 if FAIL |
| V6d — MHA ◆ badge | Badge visible |  |  |
| V6e — PROBLEMS on mismatch | Error shown |  | Fix F2 if FAIL |
| V6f — Canvas→notebook | Code appears |  | Note status |
| V6g — Drill-down | Interior view |  | Note status |
| V6h — Export button | File downloads |  |  |
| V6i — Block deletion | Block + code removed |  | Note status |
| V6j — Monaco highlight | Lines highlight |  | Note status |

**STOP HERE. Fill in the table. Then proceed to Phase 1 based on results.**

---

## Phase 1 — Backend Fixes (Only if Validation Failed)

Run only the prompts where validation showed FAIL or PARTIAL.
If V2 and V3 both PASSED, skip B1 entirely.
If V4 PASSED, skip B2 entirely.

---

### B1 — Fix: Dynamic dummy input / d_model=256 shows [unknown]

**Tool:** Claude
**Time:** 25 minutes
**Depends on:** V3 FAILED
**DO NOT TOUCH:** graph_to_json output schema, atomic block classification,
the /export endpoint, any frontend file

```
I have a FastAPI + torch.fx backend for µLM Studio. Here is my current
main.py and serializer.py [paste both files in full].

PROBLEM: when I send this payload to /ws/trace:
{"code": "<transformer block with d_model=256>", "input_shape": [2, 128, 256]}

...the response has `"shape": "[unknown]"` on most nodes. When I send
the same model with d_model=512 (and no input_shape key, or input_shape
[2, 128, 512]), shapes are correct.

ROOT CAUSE I've identified: ShapeProp is being called with a hardcoded
`torch.randn(2, 128, 512)` dummy input regardless of what d_model actually
is. When d_model=256, the forward pass crashes inside ShapeProp because
the model expects embed_dim=256 but gets a 512-wide tensor.

REQUIRED FIX (implement exactly this, do not change anything else):

1. In the WebSocket handler, accept an optional "input_shape" key from
   the frontend payload. Pass it through to trace_code().

2. Replace the hardcoded dummy input in trace_code() with this function:

   def get_dummy_input(model, user_input_shape=None):
       if user_input_shape and len(user_input_shape) >= 2:
           return torch.randn(*user_input_shape)
       
       # Infer from first module that reveals the expected shape
       for name, module in model.named_modules():
           if isinstance(module, nn.MultiheadAttention):
               embed_dim = module.embed_dim
               return torch.randn(2, 128, embed_dim)
           if isinstance(module, nn.Conv2d):
               in_c = module.in_channels
               return torch.randn(2, in_c, 64, 64)
           if isinstance(module, nn.Embedding):
               return torch.randint(0, 1000, (2, 128))
           if isinstance(module, nn.Linear):
               in_f = module.in_features
               return torch.randn(2, 128, in_f)
       
       return torch.randn(2, 512)

3. For nodes classified as "atomic" (MultiheadAttention), the shape_out
   in graph_to_json must be derived from the module's actual .embed_dim
   attribute AND the dummy input shape — not from ShapeProp (which may
   return None for MHA). Specifically:
   
   If a node is "atomic" and the module is MultiheadAttention:
     shape_out = [dummy_input.shape[0], dummy_input.shape[1], module.embed_dim]
   
   This ensures MHA always shows the correct output shape even when
   ShapeProp fails on it.

4. DO NOT change: the graph_to_json output schema (node/edge structure),
   the classify_sync_state function, the /export endpoint, the
   /demo endpoint, the /palette endpoint, the MHA interior view builder,
   the frontend's useTracer.js, or any React component.

After making the change, show me the diff only — not the full files.
Then tell me: what is the exact dummy tensor shape that will be used for
the d_model=256 transformer block given input_shape=[2,128,256]?
Expected answer: torch.Size([2, 128, 256]).

```

**After running:** re-run V3 validation check. Confirm 0 unknown shapes.

---

### B2 — Fix: Mismatch detection not triggering in backend

**Tool:** Claude
**Time:** 20 minutes
**Depends on:** V4 FAILED
**DO NOT TOUCH:** anything the mismatch detection doesn't touch

```
I have a µLM Studio backend. Here is my serializer.py [paste file].

PROBLEM: when I send a model with a deliberate shape mismatch (Linear(512→768)
feeding into LayerNorm(768) which feeds into a Linear expecting 512), the
edges in the graph response all show "status": "valid". No mismatch is
detected.

I need a function check_wire_compatibility(source_node, target_node, named_modules,
dummy_input_shape) that runs after ShapeProp and checks:

For Linear → anything: does source output shape[-1] match target's
expected input shape[-1]? If target is a Linear, check in_features.
If target is a LayerNorm, check normalized_shape[0].

For anything → MultiheadAttention (atomic): skip — MHA has flexible input,
no mismatch possible at prototype scope.

For shape-unknown nodes: return "unknown" status, not "valid" or "error".

The function must return one of: "valid" | "error" | "unknown"

Wire this into graph_to_json so each edge's data.status field is set
by this function, not hardcoded to "valid".

Also: return a top-level "errors" array in the graph JSON alongside
"nodes" and "edges", containing one entry per error edge:
{
  "edge_id": "norm1→feedforward_0",
  "headline": "Shape Mismatch — norm1 → feedforward.0 (Linear)",
  "source_label": "LayerNorm",
  "target_label": "Linear",
  "source_shape": "[2, 128, 512]",
  "target_shape": "[2, 128, 768]",
  "detail": "LayerNorm outputs 512 features but the next Linear expects 768.",
  "suggestion": "Change the Linear's in_features to 512, or add a projection layer."
}

DO NOT change: the node schema, the atomic classification, the export
endpoint, the WS handler structure, any frontend file.

Show me the diff only. Then show me the exact "errors" array for the
BrokenTransformer test case:
  attention(512) → norm1(512) → Linear(512→768) → norm2(768)
I expect exactly one error entry between Linear and norm2.

```

**After running:** re-run V4. Confirm error edges appear.

---

### B3 — Fix: Sequential sub-module labels (feedforward.0 (Linear))

**Tool:** You (30 seconds, no AI needed)
**Depends on:** backend running
**DO NOT TOUCH:** anything except get_display_label

Find `get_display_label` in your serializer. It currently returns the
dotted path with class name appended. Change it to this:

```python
def get_display_label(node, named_modules):
    if node.op == "placeholder":
        return "Input"
    if node.op == "output":
        return "Output"
    if node.op == "call_function":
        fn = getattr(node.target, '__name__', str(node.target))
        return {'add': 'Add', 'mul': 'Multiply'}.get(fn, fn.title())
    if node.op == "call_module":
        module = named_modules.get(str(node.target))
        if module is None:
            return str(node.target)
        return module.__class__.__name__
    return node.name

```

Save. Restart uvicorn. Re-run V2 trace. Confirm labels show `Linear`
not `feedforward.0 (Linear)`.

---

## Phase 2 — Frontend Fixes (Only if Validation Failed)

### F1 — Fix: Shape labels showing [unknown] on canvas

**Tool:** Codex
**Time:** 20 minutes
**Depends on:** V6c FAILED, AND B1 must be done first
**DO NOT TOUCH:** useTracer.js WS connection logic, canvas layout,
Monaco editor, palette, any backend file

```
Context: µLM Studio React frontend. The backend now returns correct
shape data in edge.data.shape (format: "[2, 128, 512]"). But the canvas
is showing "[unknown]" labels on some or all wires.

Here is my current edge rendering code / custom edge component [paste
the relevant component or the section of App.jsx that maps edges].

PROBLEM: one of these is happening (determine which from the code):
A) The edge component is reading from the wrong field
   (e.g., edge.label instead of edge.data.shape)
B) The edges returned from the backend are not reaching the edge
   component's data prop (state mapping issue)
C) The shape label is only shown when edge.data.status === "valid",
   so unknown-state edges get no label

FIX: ensure every edge shows its shape label from edge.data.shape
regardless of status. If shape is null/undefined/"[unknown]", show
"[?]" in amber (#B8860B). If shape is a valid string like "[2, 128, 512]",
show it in muted grey (#7A8194).

The label style:
- Font: JetBrains Mono, 11px
- Background: #1D2027 (--bg-elevated)
- Border: 1px solid #2C313C (--border-default)
- Border-radius: 3px (rectangular, not pill)
- Padding: 1px 5px

Use React Flow's labelStyle + labelBgStyle props on the edge object,
OR implement a custom edge component — whichever approach your current
code already uses. Do not switch approaches.

DO NOT change: node components, palette, useTracer.js, the WS
connection, any backend file.

Show me the diff only.

```

---

### F2 — Fix: PROBLEMS tab not showing errors

**Tool:** Codex
**Time:** 30 minutes
**Depends on:** V6e FAILED, AND B2 must be done first (backend must
return "errors" array in graph JSON)
**DO NOT TOUCH:** useTracer.js WS send/receive logic, any backend file,
any node/edge rendering, the Monaco editor

```
Context: µLM Studio. The backend now returns a graph JSON with three
top-level keys: "nodes", "edges", and "errors". The "errors" array
contains objects like:
{
  "edge_id": "...",
  "headline": "Shape Mismatch — X → Y",
  "source_label": "...",
  "target_label": "...",
  "source_shape": "[2, 128, 512]",
  "target_shape": "[2, 128, 768]",
  "detail": "...",
  "suggestion": "..."
}

Here is my current AnalysisPanel.jsx [paste file] and useTracer.js
[paste relevant section showing what the frontend does with the WS response].

PROBLEM: the PROBLEMS tab shows "No problems detected" even when the
backend returns errors.

DIAGNOSIS: determine which of these is the cause:
A) The "errors" array is not being extracted from the WS response
   and stored in state
B) The "errors" array is in state but AnalysisPanel is not reading it
C) AnalysisPanel is reading it but the render condition is wrong

FIX:
1. Ensure graph state includes the errors array from the backend response
2. Pass errors to AnalysisPanel as a prop
3. In AnalysisPanel, render the PROBLEMS tab as follows:

If errors.length === 0:
  Show: green dot + "No problems detected" (current behavior — keep this)

If errors.length > 0:
  Show a badge on the PROBLEMS tab: "PROBLEMS (N)" where N = count
  
  For each error, render one row:
  [⚠] {error.headline}                        [Explain ↗]
      {error.source_shape} → {error.target_shape}
      {error.detail}
      {error.suggestion}
  
  Styling:
  - ⚠ icon: color #C0392B
  - Headline: Inter 500, 13px, #E4E6EB
  - Shapes: JetBrains Mono, 12px, #E4E6EB (source/target side by side)
  - Detail + suggestion: Inter 400, 12px, #7A8194
  - Row background on hover: #1D2027
  - Row border-bottom: 1px solid #2C313C
  - "Explain ↗" button: stub it for now (onClick: console.log) —
     we will wire it in a later prompt
  
4. Also: when errors.length > 0, the corresponding edges on the canvas
   should turn red. If the edge components read from edge.data.status,
   ensure the frontend updates edge statuses from the errors array.
   Specifically: for each error, find the edge with id === error.edge_id
   and set its data.status = "error".

DO NOT change: useTracer.js WS connection/send logic, node components,
palette, any backend file, the Monaco editor, the OUTPUT/DEBUG/TERMINAL
tabs.

Show me the diff only. After the diff, tell me: for the BrokenTransformer
test case, what exact text will appear in the first error row's headline?

```

---

## Phase 3 — New Features (Build in This Order)

Run these only after Phase 0–2 checks pass. Do not start a new feature
while a previous fix is unverified.

### F3 — Click Block → Highlight Monaco Lines

**Tool:** Claude
**Time:** 45 minutes
**Depends on:** V6b PASS, V6c PASS, Monaco editor mounted and accessible
**DO NOT TOUCH:** useTracer.js, canvas layout, palette, backend,
edge rendering, analysis panel

```
Context: µLM Studio. Monaco editor on the right (via @monaco-editor/react,
accessed via onMount callback). React Flow canvas in the center. Each
canvas node has node.data.target = the PyTorch module attribute name
(e.g., "norm1", "attention", "feedforward_0" for feedforward.0).

Here is my App.jsx or Canvas component [paste the file or the section
with onNodeClick].

TASK: when a user single-clicks any node on the canvas, highlight the
corresponding lines in the Monaco editor.

IMPLEMENTATION — follow this exactly:

1. Store the Monaco editor instance in a ref: editorRef.
   In the Monaco onMount callback: editorRef.current = editor

2. Store active decoration IDs in a ref: decorationIdsRef = useRef([])

3. Write a function highlightBlockInEditor(moduleTarget):
   - If moduleTarget is null/undefined, clear all decorations and return
   - Search Monaco content for lines containing "self.{moduleTarget}"
     (both __init__ and forward references)
   - Use editor.getModel().findMatches("self." + moduleTarget, true, false, false, null, true)
     to get all match ranges
   - If no matches found, try searching for just the moduleTarget string
   - Apply decorations using editor.deltaDecorations(decorationIdsRef.current, newDecorations)
   - Store new decoration IDs in decorationIdsRef.current
   - Scroll to the first match: editor.revealLineInCenter(firstMatchLine)
   
   Decoration spec:
   - className: "mulm-block-highlight" (CSS class — see below)
   - glyphMarginClassName: "mulm-block-gutter"
   - isWholeLine: true
   
   CSS (add to index.css or App.css, do NOT use inline styles for Monaco decorations):
   .mulm-block-highlight {
     background: rgba(91, 141, 184, 0.12);  /* --border-focus at 12% opacity */
   }
   .mulm-block-gutter::before {
     content: "▌";
     color: #5B8DB8;  /* --border-focus */
     font-size: 10px;
   }

4. In React Flow's onNodeClick callback:
   highlightBlockInEditor(node.data.target)

5. In React Flow's onPaneClick callback (clicking canvas background):
   highlightBlockInEditor(null)  /* clears decorations */

6. On node deselect (if React Flow provides an onSelectionChange callback):
   if selection is empty: highlightBlockInEditor(null)

IMPORTANT: the Monaco editor instance may not be mounted when the first
node click fires. Guard every editorRef.current access with:
   if (!editorRef.current) return;

DO NOT change: useTracer.js, palette, analysis panel, backend,
canvas layout algorithm, edge rendering, block node components.

Show me the diff only. After the diff: what line number would be
highlighted if I click the "norm1" block in the standard transformer
block code (which has self.norm1 = nn.LayerNorm(d_model) at line 11)?
Expected: line 11 highlighted, AND the forward() reference line.

```

**Verify immediately after:** click norm1 block. Does line 11 highlight? Does forward() reference highlight? Does clicking canvas background clear it?

---

### F4 — CNN and Tissue LLM Templates

**Tool:** You (no AI needed)
**Time:** 25 minutes
**Depends on:** V6b PASS
**DO NOT TOUCH:** anything except the template data and the template switcher UI

Find wherever your current transformer template is stored/loaded
(likely a constant in App.jsx or a templates.js file). Add these two:

```javascript
// In your templates file or wherever TEMPLATES is defined:

export const TEMPLATES = {
  transformer: {
    name: "Transformer Encoder Block",
    description: "Standard transformer encoder with MHA + FFN + LayerNorm",
    inputShape: [2, 128, 512],
    code: `import torch
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
        return x`
  },

  cnn: {
    name: "Simple CNN Classifier",
    description: "Two conv layers + adaptive pooling + linear classifier",
    inputShape: [2, 3, 64, 64],
    code: `import torch
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
        return self.classifier(x)`
  },

  tissue_llm: {
    name: "Tissue LLM Cell",
    description: "Compressed micro-LM cell from the Tissue LLM architecture",
    inputShape: [2, 128],
    code: `import torch
import torch.nn as nn

class TissueLLMCell(nn.Module):
    """A compressed micro-LM cell from the Tissue LLM architecture.
    
    20 of these cells, organized into tissues, vote together to recover
    the accuracy of a full-scale LLM at a fraction of the compute.
    """
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
        return self.output_head(x)`
  }
}

```

In the UI: add a template selector to the notebook panel header.
Three buttons or a dropdown: "Transformer" | "CNN" | "Tissue LLM".
On click: set Monaco content to that template's code, set inputShape
in state (so the next WS trace sends the right input_shape), trigger
the debounced sync.

The template selector is a simple `<select>` or three `<button>` elements.
No animation, no transitions. The Tissue LLM template is the one to open
when a judge asks "what was this built for?"

---

### F5 — File Upload (.py and .ipynb)

**Tool:** Codex
**Time:** 40 minutes
**Depends on:** V6b PASS, Monaco editor accessible
**DO NOT TOUCH:** useTracer.js, canvas, backend, analysis panel,
palette, any existing template logic

```
Context: µLM Studio. Monaco editor is the notebook panel on the right.
I need a file upload button that loads .py and .ipynb files into Monaco.

TASK: add an upload button to the notebook panel header (top-right corner,
small — not dominant).

IMPLEMENTATION:

1. A hidden <input type="file" accept=".py,.ipynb"> element, triggered
   by a visible small button labeled "Upload" or an upload icon.
   On the visible button click: programmatically click the hidden input.
   Do not use a library for this — native file input only.

2. On file selection (onChange on the hidden input):
   
   For .py files:
   - Read as text: reader.readAsText(file)
   - On load: set Monaco content to reader.result
   - Trigger the existing notebook→canvas sync (the WS debounce fires
     naturally from the content change — do not manually call trace)
   
   For .ipynb files:
   - Read as text, then JSON.parse()
   - Extract: file.cells.filter(c => c.cell_type === "code")
                .map(c => c.source.join(""))
                .join("\n\n")
   - Set Monaco content to this concatenated string
   - Trigger sync same as above
   
   For any other extension: show a brief inline message in the notebook
   header: "Only .py and .ipynb supported" — disappears after 2 seconds

3. After successful load, show a 2-second status in the notebook header:
   "Loaded: {filename}" in Inter 400, #7A8194 color. Then clear it.

4. The upload button styling:
   - Small: height 24px, padding 0 8px
   - Background: transparent
   - Border: 1px solid #2C313C
   - Color: #7A8194
   - Font: Inter 500, 11px
   - On hover: border-color #5B8DB8, color #E4E6EB
   - No border-radius above 3px

DO NOT change: useTracer.js, canvas, backend, analysis panel, palette,
any template logic, the export button.

Show me the diff only.

```

---

### F6 — AI Error Explanation in PROBLEMS Tab ("Explain ↗" button)

**Tool:** Claude
**Time:** 1 hour
**Depends on:** F2 DONE (PROBLEMS tab showing errors), Graph Copilot
/api/ask endpoint confirmed working (ask your teammate
who built it — does POST /api/ask return a response?)
**DO NOT TOUCH:** useTracer.js, canvas, node rendering, palette,
backend trace/export endpoints, template logic,
the error detection logic itself

First: confirm /api/ask is built. Run:

```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "test", "graph_json": {}, "current_errors": []}'

```

If this returns 404: the endpoint is not built. Skip F6 entirely.
Do not build /api/ask now — it's a 2-hour job and you're out of time.
Use the hardcoded fallback path only (see below).

If 200: proceed with F6.

```
Context: µLM Studio. The PROBLEMS tab now shows error rows with an
"Explain ↗" stub button (wired in F2). The /api/ask endpoint exists
at POST http://localhost:8000/api/ask and accepts:
{ "question": str, "graph_json": {...}, "current_errors": [...] }

Here is my AnalysisPanel.jsx [paste file].
Here is my current graph state structure [paste the shape of graphData
in state — nodes, edges, errors arrays].

TASK: wire the "Explain ↗" button to call /api/ask and show the result.

IMPLEMENTATION:

1. In AnalysisPanel, add local state per error row:
   explanations: {} (object, keyed by error.edge_id)
   loadingIds: Set() (which rows are currently loading)

2. On "Explain ↗" click for a given error:
   a. Add error.edge_id to loadingIds (shows spinner)
   b. Call /api/ask with:
      {
        "question": "Explain this error and the simplest fix: " + error.headline,
        "graph_json": graphData,  /* pass from parent as prop */
        "current_errors": [error]
      }
   c. Set a 6-second client-side timeout using AbortController:
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      fetch('/api/ask', { signal: controller.signal, ... })
   d. On success: store response.answer in explanations[error.edge_id]
   e. On timeout/abort/error: store the HARDCODED fallback in
      explanations[error.edge_id]:
      "The output shape of {error.source_label} is {error.source_shape},
       but {error.target_label} expects {error.target_shape}. The simplest
       fix is to update the layer dimensions so the shapes match at this
       connection."
   f. Remove error.edge_id from loadingIds
   
3. Render the explanation below the shapes row when
   explanations[error.edge_id] exists:
   - Inter 400, 12px, #7A8194
   - Padding: 4px 0 4px 20px (indented under the row)
   - No box, no background — just text

4. The "Explain ↗" button text changes:
   - Default: "Explain ↗"
   - Loading: "···" (three dots, animated with a simple CSS keyframe)
   - Done: "Explained ✓" in #7A8194 (muted — not calling attention)
   - Clicking "Explained ✓" re-fetches (in case the graph changed)

5. The "More info" link (bottom right of expanded row):
   Clicking toggles the raw traceback/detail panel:
   A pre-formatted <pre> block showing error.detail + error.suggestion
   in JetBrains Mono, 11px, #7A8194, background #16181D (--bg-base),
   1px border #2C313C, 3px radius, padding 8px.
   This toggles open/closed — not a modal, not a new panel.

DO NOT change: the error detection logic, useTracer.js, canvas,
backend trace endpoints, palette, Monaco editor, template logic.

Show me the diff only. After the diff: what exact text will the fallback
show for the Attention→FeedForward mismatch where source_shape is
"[2, 128, 512]" and target_shape is "[2, 128, 768]"?

```

---

### F7 — OUTPUT / DEBUG / TERMINAL Tabs: Minimal Functional Content

**Tool:** Codex
**Time:** 30 minutes
**Depends on:** F2 DONE (so the tab component is stable before touching it)
**DO NOT TOUCH:** PROBLEMS tab logic, useTracer.js connection logic,
canvas, backend, Monaco, palette

```
Context: µLM Studio AnalysisPanel.jsx has four tabs: PROBLEMS | OUTPUT |
DEBUG | TERMINAL. PROBLEMS works. The other three show placeholder text.

Here is my AnalysisPanel.jsx [paste file].
Here is my App.jsx or wherever graph state and WS events live [paste].

TASK: add minimal but real content to OUTPUT, DEBUG, and TERMINAL.
This is NOT a full implementation. It is "not embarrassingly empty."

OUTPUT tab:
- A running log of sync events. Each event is one line.
- Log entries format (append new entries at TOP, newest first):
  [HH:MM:SS] {event}
  
  Event types:
  - On successful trace: "[HH:MM:SS] Traced {ModelName} — {N} nodes, {N} edges, {Nms}ms"
  - On trace error: "[HH:MM:SS] Trace error — {error.type}" (in --status-error color)
  - On export: "[HH:MM:SS] Exported {filename}"
  - On template load: "[HH:MM:SS] Loaded template: {templateName}"
  
  These events come from the WS message flow. Pass a logEntry(text, type)
  callback from App.jsx into the panel. Call it from useTracer.js after
  each receive.
  
  Styling: JetBrains Mono 12px, #7A8194 background transparent,
  no border, scrollable, max-height fills the panel.

DEBUG tab:
- When a node is selected on canvas: show that node's full data object
  as formatted JSON with syntax highlighting.
  Pass selectedNode as a prop from App.jsx (set via onNodeClick).
  
  Render:
  Header: "Selected: {node.data.label}" — Inter 600, 13px, #E4E6EB
  Body: JSON.stringify(node.data, null, 2) in a <pre> block
  JetBrains Mono 11px, #7A8194, background #16181D, padding 8px
  
  JSON key coloring (simple CSS, not a full JSON library):
  - This is optional and low-priority. Plain monospace text is fine.
  
  When nothing is selected: "Select a block to inspect its properties."
  Inter 400, 13px, #7A8194

TERMINAL tab:
- A log of raw WebSocket messages (truncated).
  Each message: 
  "→ {HH:MM:SS} SEND {first 80 chars}..."
  "← {HH:MM:SS} RECV status:{status} nodes:{N}"
  
  Pass these events from useTracer.js via the same logEntry mechanism
  as OUTPUT, but to a separate terminalLog state array.
  
  Styling: same as OUTPUT tab.

IMPORTANT: add a logEntry function to useTracer.js that accepts
{type: "output"|"terminal", text: string} and calls a callback prop.
Do NOT restructure useTracer.js in any other way.
The PROBLEMS tab must not be touched.

Show me the diff only.

```

---

### F8 — Block Deletion + Canvas→Code Sync

**Tool:** Claude
**Time:** 1.5 hours
**Depends on:** V6f PASS (canvas→code direction must already be working),
F3 DONE (Monaco highlight — deletion should clear highlights)
**DO NOT TOUCH:** useTracer.js WS connection, backend, palette drag logic,
analysis panel, Monaco editor mount

Only run this if you have time after F3–F7 are done and verified.
If you're past the 9.5-hour mark from the start of this plan, skip F8.

```
Context: µLM Studio. Canvas→notebook direction exists (drag palette block
→ code appears in Monaco). Node click → Monaco highlight is implemented.

Here is my App.jsx [paste]. Here is my codegen.js (topological sort
code generator) [paste].

TASK: implement block deletion with bidirectional sync.

SPECIFIC BEHAVIORS REQUIRED:

1. Delete key on selected node:
   React Flow's onNodesDelete callback fires when Delete/Backspace is
   pressed on a selected node. In this callback:
   a. Remove the node from React Flow nodes state
   b. Remove all edges connected to that node from edges state
   c. Run the existing codegen (topological sort) on the remaining graph
   d. Set Monaco content to the generated code
   e. Clear Monaco decorations (call highlightBlockInEditor(null))
   f. Run error detection on the remaining graph
   
   Do NOT send the deletion to the backend. The backend will re-trace
   when Monaco content changes (via the WS debounce), which is fine.

2. Right-click context menu on a node:
   A minimal context menu — not a library, just a positioned <div>:
   - "Remove block" (color: #C0392B on hover)
   - "View source" (highlights the block in Monaco, same as F3 click behavior)
   
   Position: {x: event.clientX, y: event.clientY}
   Dismiss: on click outside, on Escape key, on any other action
   
   Styling:
   background: #1D2027
   border: 1px solid #2C313C
   border-radius: 3px
   padding: 4px 0
   Each item: padding 6px 16px, Inter 400, 13px, #E4E6EB
   On hover: background #2C313C

3. Edge deletion:
   React Flow's onEdgesDelete callback:
   a. Remove edge from state
   b. Re-run codegen
   c. In the generated code, the disconnected connection becomes a
      comment: # NOTE: {sourceBlock} is not connected to {targetBlock}
   d. Update Monaco content

4. Codegen safety: the topological sort codegen must handle partial graphs
   without crashing. If a node has no incoming edges and is not the input
   node, it generates: "{varName} = self.{moduleName}(???)  # disconnected"
   Never crash on deletion.

DO NOT change: useTracer.js WS send/receive, any backend file, palette,
analysis panel, the Monaco editor mount, the node rendering components.

Show me the diff only. After the diff: what code does codegen produce
if I delete the norm1 block from the transformer encoder (which removes
the connection between add→norm1→feedforward)?
Expected: forward() has a # disconnected comment where norm1 was, and
feedforward receives add's output directly or also has a disconnected note.

```

---

### F9 — Copilot Animation on Block Add (if time allows)

**Tool:** Codex
**Time:** 30 minutes
**Depends on:** V6f PASS, F8 done (so the canvas→code direction is stable)
**DO NOT TOUCH:** anything except the animation CSS and the trigger point

Only run this if F3–F8 are all done and verified. This is polish,
not substance.

```
Context: µLM Studio. When a block is dragged from the palette and dropped
on the canvas, the codegen runs and new lines are inserted into Monaco.

TASK: when new lines are inserted into Monaco from a canvas action (not
from the notebook→canvas direction), briefly highlight the new lines with
a fade-out animation — exactly like GitHub Copilot's accepted-suggestion
animation.

IMPLEMENTATION:

1. Add a direction flag ref in App.jsx:
   const syncDirectionRef = useRef('notebook-to-canvas')
   
   Set to 'canvas-to-notebook' immediately before calling setMonacoContent
   from codegen. Set back to 'notebook-to-canvas' after.

2. In the Monaco content-change handler (or wherever Monaco content is
   set from codegen):
   - If syncDirectionRef.current === 'canvas-to-notebook':
     - Diff old content vs new content (split by \n, compare)
     - Find which line numbers are new
     - Apply decoration with className "mulm-copilot-flash"
     - After 1200ms: add className "mulm-copilot-fade"
     - After 1600ms: remove decoration entirely
   - If 'notebook-to-canvas': do nothing (no animation)

3. CSS (add to index.css):
   .mulm-copilot-flash {
     background: rgba(46, 204, 113, 0.18);
     transition: background 0.4s ease;
   }
   .mulm-copilot-fade {
     background: rgba(46, 204, 113, 0);
   }

DO NOT change: useTracer.js, backend, palette, analysis panel,
the canvas layout, node/edge components.

Show me the diff only.

```

---

## Phase 4 — Pre-Submission Checklist

Run this after all features are built and before touching the README
or submission portal.

### Full Demo Rehearsal (Both people, 30 minutes)

Run the Nine Beats three times. Time each run.
Target: under 3 minutes per run.
After the third run: stop building. If something is still slightly wrong
visually, it stays as-is. A rehearsed tool beats a polished one.

**The one sentence to memorize for Beat 6:**
"In a notebook, this surfaces as a CUDA assertion error during training —
hours later, on a different machine, after you've already committed the
run."

That sentence converts ML-unfamiliar judges. Say it every time. Don't
paraphrase it.

### Submission Artifacts (You, 45 minutes)

**README.md** — must include per handbook:

```markdown
# µLM Studio

Visual IDE for ML architecture design — the Cadence/Simulink of machine learning.

## What it does
Researchers design PyTorch architectures visually. Every connection shows
the tensor shape flowing through it. Shape mismatches are caught at design
time, not at training time. The notebook and canvas stay synchronized
bidirectionally — write code, see the diagram; draw the diagram, see the code.

## Problem it solves
ML researchers lose 20–30% of debugging time to shape errors that are invisible
at design time but surface as cryptic CUDA assertions during training.
µLM catches these before a single training step runs.

## Tech stack
- Backend: Python 3.11, PyTorch 2.3.1, torch.fx, FastAPI, WebSocket
- Frontend: React 18, Vite, React Flow, Monaco Editor
- AI: torch.fx symbolic tracing (deterministic static analysis, no LLM at runtime)
  + GPT-based Graph Copilot for grounded Q&A (optional, requires API key)

## Setup & run
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
# Open http://localhost:5173

```

## Models & data

No training data. No model weights. torch.fx is deterministic static analysis.
The Graph Copilot uses gpt-4o-mini via the OpenAI API (set OPENAI_API_KEY).

## Evaluation & guardrails

Three-state block system: traced (shapes known) / atomic (contract hardcoded) /
untraceable (explicitly marked [?], never silently wrong).

## Known limitations

* Drill-down: one level only (MHA interior is hardcoded)
* Canvas→code: handles linear chains and additive residuals; complex topologies
get # TODO comments
* No persistence: single-session only
* Export: .py only (Jupyter export is v2)

## Team

[Names, roles, contacts]

```

**AI Impact Statement** (≤200 words):


```

µLM Studio uses two AI mechanisms with a strict separation:

1. DETERMINISTIC: torch.fx symbolic tracing + ShapeProp (zero LLM involvement).
This is the source of truth for every number displayed — tensor shapes,
parameter counts, sync states. It cannot hallucinate because it is static
analysis, not generation. The three-state block system (traced/atomic/untraceable)
makes uncertainty explicit: untraceable code is never silently misrepresented.
2. GROUNDED AGENT: a GPT-based Graph Copilot (gpt-4o-mini) answers free-form
questions about the architecture via function calling. The agent is constrained
by design — it cannot state a shape or parameter count without first calling
get_graph_fact() to retrieve it from the actual traced graph. It is structurally
prohibited from generating facts; it can only retrieve and explain them.

Model: gpt-4o-mini (low latency, bounded context — appropriate for a narrow
grounded Q&A task, not a reasoning-depth problem)
Data: researcher's own code, in-session only, never stored
Guardrails: tool-calling constraint enforced structurally; 6-second timeout with
hardcoded fallback; three-state uncertainty system in the core engine
Expected impact: faster architecture iteration; shape errors caught at design time
instead of hours into a training run

```

---

## Time Budget Summary

| Phase | Tasks | Estimated Time |
|---|---|---|
| Phase 0 — Validation | V1–V6 checks | 30 min |
| Phase 1 — Backend fixes | B1, B2, B3 (only if needed) | 0–45 min |
| Phase 2 — Frontend fixes | F1, F2 (only if needed) | 0–50 min |
| F3 — Monaco highlight on click | Must do | 45 min |
| F4 — CNN + Tissue LLM templates | Must do | 25 min |
| F5 — File upload | Should do | 40 min |
| F6 — AI error explanation | Do if /api/ask exists | 60 min |
| F7 — OUTPUT/DEBUG/TERMINAL | Do if time permits | 30 min |
| F8 — Block delete + sync | Do if time permits | 90 min |
| F9 — Copilot animation | Only if everything else done | 30 min |
| Phase 4 — Rehearsal + submission | Non-negotiable | 75 min |
| **TOTAL (must-do path)** | | **~5.5 hrs** |
| **TOTAL (full path)** | | **~10 hrs** |

The must-do path (Phase 0 + fixes + F3 + F4 + rehearsal + submission)
is 5.5 hours. You have ~13 hours. The remaining 7.5 hours are for F5–F9
and for the inevitable "this doesn't work, debug it" time.

**Hard stop at hour 11.5: stop building. Start rehearsal. Submit by 9:20 AM.**

```
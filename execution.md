# µLM Studio — Execution Plan
### AI Tooling, Build Sequence, and Design System for Prototype 0.2

This is your single reference doc for the 7-day pre-build. It covers three things:

1. **Tool allocation** — which AI tool does which job, and why, given your actual constraints (antigravity 5hr Claude windows, 2× Gemini Pro with 0 extra credits, ChatGPT Plus/Codex, $100 OpenAI API credits)
2. **Day-by-day build sequence** mapped to Plan 0.2's four phases, with the exact prompts to use at each step
3. **The design system** — a from-scratch visual identity for µLM, specified to the level a human designer would hand to an engineer

---

## Part 1 — Understanding Your Constraints Before Allocating Tools

Three of your four tools are **windowed, not metered**, which changes the strategy completely from "spend credits efficiently" to "schedule usage so windows don't collide."

| Tool | Constraint type | What this means for you |
|---|---|---|
| Claude (via antigravity) | 5-hour rolling usage window | You get a burst, then a cooldown. Burning it on boilerplate is the most expensive mistake you can make this week. |
| Gemini 2× Pro (2 Google accounts) | Subscription, 0 extra credits — so you're on included quota only | Same windowing logic likely applies; having 2 accounts means you can run 2 parallel windows if needed, but don't assume infinite headroom |
| ChatGPT Plus → Codex | 5-hour rolling window (confirmed — this is how Codex billing works on Plus as of mid-2026) | Same shape of constraint as Claude. Two windowed tools means you should **stagger them**, not run them simultaneously on the same task. |
| OpenAI API ($100 credit) | Metered, pay-per-token | This is your only **not-windowed** resource. It's also your relief valve — when both windowed tools are on cooldown, the API key still works. |

**The strategic implication:** your two windowed code-gen tools (Claude, Codex) should be treated like two separate 5-hour shifts you can stagger across the day — not run in parallel on the same problem. Gemini is your overflow/verification tool. The API credits are your insurance policy for when you're between windows and need *something* to keep moving — and your dedicated tool for narrow, well-specified tasks where a full agentic session is overkill.

### Why this matters more than "which model is smartest"

For a 7-day build with two people touching code, the actual bottleneck isn't model quality — it's **never being blocked**. A mediocre response right now that keeps you moving beats a perfect response in 40 minutes after your window resets. Plan around availability first, capability second.

---

## Part 2 — Tool Role Assignment

### Claude (antigravity, 5hr windows) — **Architecture & the hard sync engine**
Use Claude's windows for the highest-stakes, highest-context work: the torch.fx spike, the three-state classifier, the WebSocket sync layer, the topological-sort code generator. This is the code where a subtle bug (wrong execution order, a state misclassification) silently breaks your demo. Long context, multi-file reasoning, and "hold the whole sync contract in mind while writing this" tasks belong here.

**Don't** spend Claude windows on: Tailwind class tweaking, copy editing, icon selection, README formatting. That's burning your scarcest resource on commodity work.

### Codex (ChatGPT Plus, 5hr windows) — **Parallel execution track, frontend scaffolding & tests**
Run Codex on a *separate* track from Claude — literally have it working on a different part of the codebase at the same time, e.g. React Flow canvas + palette UI while Claude works the backend tracer. Codex is well-suited to "go implement this fully-specified component" tasks where the spec is already locked (which Plan 0.2 gives you — it's unusually precise).

Also good for: writing the demo-model fixtures, the static fallback graph JSON, test scripts that validate tracing on Day 1–2.

### Gemini ×2 (no extra credits) — **Second opinion, code review, and burst overflow**
Since you have zero extra credits, treat each Gemini account's included quota as precious, not free. Best uses:
- **Code review pass**: paste Claude's or Codex's output into Gemini and ask it to find bugs, not to write new code. Review is cheaper in tokens than generation.
- **Overflow window**: when both Claude and Codex are on cooldown at the same moment, one Gemini account picks up a well-scoped task so you're never fully blocked.
- **Second account = parallelism insurance**: keep account #2 untouched until you actually hit a moment where account #1 is also cooling down — don't burn both simultaneously out of habit.

### OpenAI API ($100 credits) — **Two jobs, not one**

**Job A — narrow, scriptable tasks that don't need an agent.** Direct API calls (not Codex) for things like: generating the 10 block icon SVGs in a consistent style via a structured prompt loop, generating the procedural shape-mismatch error message text variations, batch-validating that your 3 starter templates all trace cleanly. These are single-shot or few-shot tasks — paying per-token directly is both cheaper and faster than spinning up an agentic session.

**Job B — the actual AI Impact Statement disclosure.** Since µLM's runtime doesn't call an LLM at all (torch.fx is deterministic), if you want this prototype itself to demonstrate any "AI-powered" surface for the demo's sake, the API credits are also your only metered (= predictable cost) option. More on this in Part 4.

**Budget math** (current GPT-5.x API pricing, per current rates): a 2M input + 500K output token month on GPT-5.4 runs roughly $12–15. Routing simple tasks to mini or nano models before reaching for the flagship model, and using Batch or Flex pricing for asynchronous work, are the standard ways to control this cost. For a one-week build with narrow scripted tasks, you will not come close to exhausting $100 — the risk is the opposite: don't reach for full-agent API loops (i.e., don't build your own mini-Codex via raw API calls) when Codex itself already does that job inside your flat-rate Plus subscription.

---

## Part 3 — Day-by-Day Build Sequence with Concrete Prompts

This follows Plan 0.2's four phases exactly. Each day lists: owner, primary tool, and the actual prompt(s) to run. Prompts are written to be pasted close to verbatim — adjust file paths to your repo.

### Phase 1 — Spike (Days 1–2)

#### Day 1 — torch.fx Spike + Three-State Validation
**Owner:** Technical Lead · **Tool:** Claude (this is the highest-risk, highest-context task — protect a window for it)

```
I'm validating torch.fx symbolic tracing for a visual ML architecture tool.
Write a standalone Python script (no frontend, no API) that:

1. Defines three test models: a simple MLP, a transformer encoder block
   using nn.MultiheadAttention(batch_first=True), and a simple CNN
2. Attempts torch.fx.symbolic_trace on each
3. For models that trace successfully, runs ShapeProp and prints every
   node with its op type, target, and inferred shape
4. For models that fail to trace, catches the exception and prints the
   full error — I need to know exactly why MultiheadAttention fails
   tracing in the installed PyTorch version
5. Includes a classify_sync_state(node, model) function that returns
   "traced", "atomic", or "untraceable" — atomic is hardcoded for
   nn.MultiheadAttention specifically

After writing it, tell me: does the failure mode for MHA match the
"tuple return + internal control flow" explanation, or is it something
else in this PyTorch version? I need this confirmed before I build the
three-state UI around it.
```

**Why this prompt works:** it asks Claude to confirm the *specific* failure mode rather than assume Plan 0.2's explanation is correct — your plan's "why" for the MHA atomic state should be empirically verified on Day 1, not assumed from the planning doc.

#### Day 2 — Graph-to-JSON Serializer with Three-State Output
**Owner:** Technical Lead · **Tool:** Claude (continuation of Day 1 context — same window family if possible)

```
Using the classify_sync_state function and trace results from yesterday,
write serializer.py: a function graph_to_json(traced_graph, model,
shape_props) that converts a torch.fx Graph into React Flow-compatible
JSON.

Output shape:
{ "nodes": [...], "edges": [...] }

Each node needs: id, type, data: { label, op, shape, sync_state,
category }, position (leave as {x:0,y:0}, frontend handles layout).

Each edge needs: id, source, target, data: { shape, status: "valid" |
"mismatch" | "unknown" }.

For nodes classified as "atomic" (MultiheadAttention), still populate
shape data using the hardcoded contract: input [batch, seq, d_model] x3,
output [batch, seq, d_model] — even though ShapeProp can't trace through it.

Write a second function, build_mha_interior_view() that returns a static
hardcoded JSON graph for the drill-down: Q/K/V projections -> scaled
dot-product attention -> output projection, four nodes, properly wired.

Test both functions against the transformer block from Day 1's spike.
Print the resulting JSON.
```

In parallel: **Codex** starts the frontend skeleton (see below) while Claude works this serializer — no reason to wait.

### Phase 2 — Build (Days 3–5)

#### Day 3 — Parallel Tracks
**Track A (Claude):** FastAPI backend — WebSocket endpoint, the `/ws/trace` handler wired to your serializer, the export endpoint.

```
Build a FastAPI backend with:

1. A WebSocket endpoint at /ws/trace that receives {"code": "<python
   source>"}, executes it in a restricted namespace to extract the
   nn.Module class, runs symbolic_trace + ShapeProp, calls
   graph_to_json(), and sends back {"status": "success", "graph": {...}}
   or {"status": "error", "error": "<message>"} on failure

2. Handle partial failures per this contract: if tracing fails entirely,
   return the error but DO NOT crash the connection — the frontend holds
   last-valid-state on its end, but the backend must stay alive and
   accept the next code update

3. A REST endpoint POST /export that takes the current graph JSON +
   notebook code and returns a downloadable clean .py file (see the
   export format spec I'll paste in next)

4. Restrict the code execution sandbox sensibly — this only needs to be
   safe against accidental errors (infinite loops, bad imports), not
   adversarial input, since it's a single-user local prototype. Use a
   timeout on the exec call.

Write this defensively: a malformed or partial code string from the
notebook (user mid-typing) should never 500 the server.
```

**Track B (Codex):** React Flow canvas + Monaco notebook panel, three-panel layout shell, palette component with the 10 blocks. Give Codex the **exact** layout ASCII diagram and block table from Plan 0.2 (Sections "Three-Panel Interface" and "10 Blocks") verbatim — it's already spec-complete, don't paraphrase it.

```
Build the three-panel IDE shell in React using this exact layout spec:
[paste the ASCII diagram and palette/canvas/notebook/analysis-panel spec
from Plan 0.2 verbatim]

Use React Flow for the canvas, Monaco editor for the notebook panel.
Build the palette as a static list of the 10 blocks from this table:
[paste the 10-block table verbatim]

Each block in the three-state system renders differently:
- "traced": solid 1px border in category color
- "atomic": solid border + a small diamond badge top-right
- "untraceable": dashed border + amber "?" badge

Don't wire up the WebSocket yet — stub the canvas with one hardcoded
example graph so the layout is visually testable today. I'll connect
live data tomorrow.
```

#### Day 4 — Connect Everything
**Owner:** Both, paired · **Tool:** Whichever window is fresh — this is integration work, not architecture, so it's a reasonable place to use Gemini if both Claude/Codex are cooling down.

```
I have a working FastAPI backend with a /ws/trace WebSocket endpoint
[paste backend interface] and a React frontend with a stubbed canvas
[paste frontend component]. Write the useTracer hook that connects them:
debounced (300ms) code-change -> WebSocket send -> graph update on
canvas. Include automatic reconnection on disconnect (silent, 1s retry,
no error shown to user) since a demo-time WebSocket drop must not look
like a crash.
```

Also Day 4: wire Canvas→Notebook code generation (drag block → code appears). This is the topological-sort piece Plan 0.2 flags as the trickiest correctness risk — give it back to Claude if you have a window, since silent wrong-order code generation is worse than a visible `# TODO` fallback.

#### Day 5 — Error Detection + Drill-Down + Export + Fallback Demo
**Owner:** Split — Technical Lead on shape-mismatch detection + fallback demo (Claude), Teammate on drill-down UI + export polish (Codex).

```
Backend: write detect_mismatches(graph_json) that walks every edge,
compares upstream output shape to downstream expected input shape
(using the hardcoded contract for atomic nodes), and returns a list of
{ edge_id, message } where message follows this exact format:

⚠  Shape Mismatch — {SourceBlock} → {TargetBlock}
   {SourceBlock} output:    {shape}
   {TargetBlock} expects:   {shape}

   {one-sentence explanation specific to the actual shapes}

   Suggested fix: {one-sentence suggestion}

Pre-build the exact pixel-perfect version of this message for the
Attention -> FeedForward demo mismatch (changing Linear(512,512) to
Linear(512,768)) as a hardcoded constant — that's the one guaranteed to
render correctly live regardless of the procedural generator's edge cases.
```

```
Build the fallback static demo: a STATIC_TRANSFORMER_GRAPH constant
containing the exact JSON output of tracing the transformer block
(frozen from today's real trace output — paste it in). Wire a
VITE_DEMO_MODE env flag that, when true, skips the WebSocket entirely
and renders this static graph instead. Include a second pre-computed
version with the mismatch already introduced, toggled by Cmd+Shift+E,
for the demo-safety fallback path.
```

### Phase 3 — Polish (Days 6–7)

#### Day 6 — UI Polish + Environment Freeze + Demo Model Lock
This is where the design system in Part 5 below gets applied. Hand the full design token spec to Codex as one big styling pass rather than piecemeal requests — see the prompt template in Part 5.

Also: freeze the exact demo machine setup today, not tomorrow. Run the full first-2-hours checklist from Plan 0.2 *today* so any environment surprise has a full day of slack, not zero.

#### Day 7 — Rehearsal Only
No tool usage planned. This is intentional — if you're still prompting AI tools on Day 7, the build overran. Use this as a hard forcing function.

### Phase 4 — Hackathon (24 Hours)
Per Plan 0.2: no new features. If something breaks in the first 2 hours, Codex (if your window allows) is the faster tool for "fix this specific bug" turnaround since it's optimized for diff-and-patch style work over multi-file architecture changes.

---

## Part 4 — The AI Impact Statement (≤200 words, required submission artifact)

Flagging this now because neither prototype plan addresses it and it's a hard submission requirement, not optional. Draft on Day 6, not Sunday morning.

**Note:** the framing below assumes no runtime LLM. If you build the Graph Copilot agent from Part 6, use the *updated* AI Impact Statement structure in that section instead — it supersedes this one.

Since µLM's runtime is fully deterministic (torch.fx tracing, no LLM calls), your honest answer is straightforward and actually a *strength* to state plainly: no hallucination surface exists in the prototype because no generative model runs at inference time. Structure:

- **What the AI is doing:** torch.fx symbolic tracing and ShapeProp — static analysis, not generation. No LLM in the runtime path.
- **Model(s) used and why:** none at runtime. (If you used GPT/Claude/Codex to *build* the tool, that's a build-process note, not a product-AI note — keep these separate so judges don't conflate "AI-assisted coding" with "the product uses AI.")
- **Data provenance:** no training data — the tool operates on the researcher's own pasted code, locally, in-session.
- **Guardrails:** the three-state system itself *is* the guardrail — untraceable code is never silently misrepresented, it's explicitly marked unknown.
- **Expected impact:** faster architecture-design iteration, fewer late-stage shape-mismatch failures during training.

This framing also pre-empts a judge question ("where's the AI?") — your answer is "the AI is in what we don't fake," which is a stronger story than bolting on an unnecessary LLM call.

---

## Part 5 — The Design System (From Scratch)

### Design brief, restated in my own words

µLM is not a SaaS dashboard and not a marketing site — it's an instrument panel for a precision technical task. The reference class isn't Notion or Linear, it's Cadence, KiCad, oscilloscope UIs, and VS Code: tools designed by and for people who stare at them for eight hours and need them to disappear into the work. The single biggest tell of "AI-generated" in 2026 is a near-black background with one neon accent color and a sans-serif everywhere — competent, generic, forgettable. I'm deliberately steering away from that.

### The signature element

**Tensor shapes rendered as instrument-grade data, not UI chrome.** Every other part of this interface is quiet on purpose so that the one place numbers appear — the shape pill on a wire — reads like a multimeter reading, not a tooltip. This is the single thing a judge should remember about how it *looked*, separate from what it *did*.

### Color — 6 named values, desaturated and industrial, not trend-driven

| Token | Hex | Role |
|---|---|---|
| `--bg-base` | `#16181D` | Canvas/app background — a graphite, not pure black. Pure black (#000) reads as "default dark mode"; this has a faint warm-grey lift to it. |
| `--bg-elevated` | `#1D2027` | Panels, palette cards, the analysis tray |
| `--border-default` | `#2C313C` | Standard hairlines between panels and around blocks |
| `--border-focus` | `#5B8DB8` | A muted slate-blue, used *only* for the atomic-primitive badge and focus rings — not a glowing accent, a steel-blue like an oscilloscope trace |
| `--text-primary` | `#E4E6EB` | Off-white, not pure white — reduces eye strain over a 24-hour build, signals intentionality |
| `--text-muted` | `#7A8194` | Secondary labels, port counts, hints |
| `--status-error` | `#C0392B` | Already specified in Plan 0.2 — a brick red, reads as "instrument warning" not "app crashed." Keep this exact value; it's correct. |
| `--status-unknown` | `#B8860B` | Dark goldenrod amber for `[?]` states — warm, not alarming |

Category accent dots (palette grouping only, used sparingly — small 3px dots, never large fills):
- CORE: `#6B7280` (neutral slate)
- ATTENTION: `#5B8DB8` (same steel-blue as focus — attention IS the focus block)
- NORM: `#5A9B7C` (muted sage green)
- VISION: `#9B7CB8` (muted violet)
- REGULARIZATION / ACTIVATION: `#8A8E99` (low-saturation grey-blue)

**Why this works against the "AI slop" tell:** no pure black, no saturated neon, no purple-to-blue gradient anywhere. Every color is desaturated enough that it could be a real EDA tool's palette. The one place saturation shows up at all is the error red and the focus steel-blue — both load-bearing, not decorative.

### Typography — three faces, each with a job

| Role | Face | Why |
|---|---|---|
| UI text (labels, panel titles, palette names) | **Inter**, weights 400/500/600 | Neutral, extremely legible at small sizes, doesn't editorialize. This is correctly chosen in Plan 0.2 already — keep it. |
| Code (notebook panel) | **JetBrains Mono** | Already specified for shape labels in Plan 0.2 — extend this to the Monaco editor itself for consistency. Has real ligature support and was designed specifically for code reading, not repurposed. |
| Data (tensor shapes, the one signature element) | **JetBrains Mono**, but set apart: 11px, `letter-spacing: 0.02em`, in `--text-primary` against the elevated background of the pill | This is the typographic signature: data gets its own visual register, distinct from both UI labels (Inter) and code (also mono, but in-context). The shape pill is the one place mono type is foregrounded rather than just "the editor font." |

**Avoid:** any serif anywhere (instantly wrong register for this product), any geometric/rounded sans like Poppins or Quicksand (reads as consumer app, not instrument), any default system font stack (reads as unstyled).

### Layout signature: the engineering grid

Plan 0.2 already specifies a 20×20px grid background on the canvas at low opacity — this is correct and should stay, but make it *real* graph paper, not a generic dot-grid: thin lines, not dots, at `--border-default` and roughly 8% opacity, with every 5th line marginally more visible (like real engineering graph paper has a major/minor grid). This is a small detail but it's the kind of thing that separates "I downloaded a grid texture" from "I thought about what graph paper actually looks like."

### What to deliberately NOT do (the anti-patterns to avoid)

- **No drop shadows for elevation** — use a single 1px border in `--border-default` to separate panels, the way real IDEs (VS Code, JetBrains) do. Soft shadows read as "design tool default," hard borders read as "engineering tool."
- **No border-radius above 4px anywhere.** Blocks, panels, buttons — keep corners close to square. Rounded-2xl everything is the single most common AI-generated-UI tell in 2026. µLM's blocks should have a `3px` radius at most; the analysis panel tabs should be flush rectangles.
- **No gradients.** Not on buttons, not on the background, not on the logo. Flat color only.
- **No icon library default set (Lucide/Heroicons) used decoratively.** Plan 0.2 already correctly specifies "no icons" in the palette — hold this line. Where an icon is genuinely needed (export button, connection-status dot), use a single consistent weight and keep it monochrome, never colored just to add visual interest.
- **Motion: almost none.** The only animated things should be: the live sync (canvas building itself — this is real, not decorative), the red wire's `drop-shadow` glow on a mismatch, and a 150ms ease on panel collapse/expand. No page-load stagger animations, no hover-scale on buttons, no confetti on export. Plan 0.2's restraint here is already correct — protect it during Day 6 polish, since "let's add a little animation here" is exactly the scope-creep impulse that makes a prototype look like a demo reel instead of a tool.

### The "no learning curve" requirement, addressed directly

Zero-learning-curve for an IDE-style tool means: every interactive element looks exactly as interactive as it is, and nothing more.
- Draggable palette blocks get a `grab` cursor on hover and a 1px elevation change — no instructional tooltip needed, the cursor *is* the instruction.
- The PROBLEMS tab badge count `(1)` next to the tab name is the entire error-discovery mechanism — no toast, no modal, no "you have an error!" interruption. A researcher who's used any IDE already knows to check the problems panel; don't teach them something they already know differently.
- Empty states matter: a fresh canvas (before any code is typed) should show one quiet line of muted text — `Write or paste a PyTorch module to begin` — not an illustration, not an onboarding carousel. This follows the principle that an empty screen is an invitation to act, stated plainly.

### Component-level prompt template for Day 6 styling pass

Use this as the actual prompt to Codex once the functional build is done — give it the whole token table at once rather than styling component-by-component, so visual consistency isn't accidental:

```
Apply this design system to the existing µLM Studio frontend. Do not
change any component logic or layout structure — this is a styling
pass only.

Design tokens (CSS custom properties, add to :root):
[paste the full color table above as CSS variables]
[paste the typography table above]

Rules to enforce across every component:
- No border-radius above 4px anywhere
- No box-shadow for elevation — use 1px solid var(--border-default)
  instead
- No gradients
- No icon library decorative icons — only functional icons (export
  button, connection status), monochrome, single weight
- Tensor shape labels: JetBrains Mono 11px, letter-spacing 0.02em,
  rendered in a rectangular pill (3px radius) per the spec, NOT a
  fully-rounded pill
- Canvas grid background: thin lines not dots, 8% opacity, every 5th
  line at 16% opacity (major/minor grid like real graph paper)
- Motion: only on live sync rendering, error wire glow, and panel
  collapse (150ms ease). No hover-scale, no load animations, no
  transition on static elements.

Go component by component: palette, canvas blocks (all three sync
states), wires, shape pills, analysis panel tabs, export button,
notebook panel chrome. Show me the palette and one canvas block first
before continuing to the rest, so I can confirm direction.
```

That last line matters — ask for a checkpoint after the first 1–2 components rather than letting the agent run the whole pass unsupervised. Course-correct early, not after every component is styled the same wrong way.

---

## Part 6 — The Runtime Agent (Graph Copilot)

This is a deliberate addition beyond the original Plan 0.2 scope, made after weighing a real tradeoff: µLM's strongest pitch was "no hallucination surface, because nothing here generates anything." Adding an LLM agent at runtime only strengthens the product — rather than undermining that pitch — if it's scoped so the agent can **never** override or contradict what torch.fx actually computed. The rule below is the single thing that makes this addition safe rather than risky. Everything else in this section follows from it.

> **The non-negotiable design rule:** the agent never generates a shape, dtype, or parameter count from its own knowledge or "memory" of what these architectures usually look like. Every numeric fact it states must be read verbatim out of the graph JSON passed into its context. This is enforced structurally — via tool calling, not by asking nicely in a system prompt — because a prompt-only guarantee is exactly the kind of thing that quietly fails under an unusual judge question.

### What it replaces and what it adds

**Replaces:** the existing `suggestFix()` / `explainMismatch()` functions (two hardcoded string branches — see your existing `errorDetection.js`). These become the agent's fallback path, not dead code — more on this below.

**Adds:** a chat surface in the analysis panel — a fourth tab alongside PROBLEMS, INFO, EXPORT — called **ASK**, where a researcher can type a free-form question about the current graph ("why does this output a different shape than I expected", "what would happen if I removed the dropout block", "explain what this block does") and get a grounded answer.

### Architecture: tool-calling, not free generation

The agent is a single GPT call (not an open-ended agent loop — important for latency and demo safety) using **function calling** with one tool exposed to the model:

```
get_graph_fact(query_type, node_id?) -> structured data from the
actual graph JSON currently on the canvas (shapes, op types, edges,
sync_state, current PROBLEMS list)
```

The model is instructed to call this tool for *any* factual claim about the graph before answering, and the system prompt explicitly forbids stating a shape or architectural fact that didn't come from a tool result. This is the structural enforcement of the non-negotiable rule above — the model literally cannot cite a shape it didn't just look up.

```
Backend: build a /api/ask endpoint (REST, not WebSocket — this is
request/response, not streaming sync) that:

1. Accepts { "question": str, "graph_json": {...}, "current_errors": [...] }
2. Calls the OpenAI API with function calling enabled, exposing one
   tool: get_graph_fact(query_type: "node_shape" | "node_op" |
   "edge_status" | "full_graph" | "error_list", node_id: optional str)
   — implement this tool to look up directly from the graph_json
   passed in, never from any external knowledge
3. System prompt: "You are a graph analysis assistant for µLM, a
   PyTorch architecture visualization tool. You can ONLY state shapes,
   ops, or edge facts that you have retrieved via get_graph_fact in
   this conversation. If asked about a node not in the graph, say so —
   never guess. If asked something unrelated to this specific graph
   (general ML questions, unrelated coding help, anything off-topic),
   politely redirect: 'I'm scoped to this graph — ask me about the
   architecture on your canvas.' Keep answers under 3 sentences unless
   the user asks for more detail."
4. Set max_tokens conservatively (300) and a 6-second timeout. On
   timeout or API error, return a specific fallback signal (see below)
   — never let this endpoint hang during a demo.
5. Log every question + answer pair to a local file during the
   hackathon — useful both for debugging and as a "look what people
   asked it" artifact if a judge wants to see real usage.
```

### The fallback path (this is what makes it demo-safe)

Your existing `suggestFix()`/`explainMismatch()` functions don't get deleted — they become the **guaranteed fallback** when the live API call fails, times out, or when `VITE_DEMO_MODE` is active. This mirrors the static-graph fallback pattern Plan 0.2 already uses for the WebSocket sync, applied to the same problem one layer up:

```
Frontend: build the AskPanel component. On submit, call /api/ask with
a 6-second client-side timeout. On success, render the agent's answer.
On timeout/error, silently fall back to: if the question matches (or
is close to) a known PROBLEMS entry, render the existing hardcoded
explainMismatch()/suggestFix() text instead, prefixed with nothing
special — it should look like a normal answer, not a degraded one.
If the question doesn't match any known error, show: "I can answer
questions about errors in the PROBLEMS tab right now — live graph
Q&A needs a network connection." Never show a raw error or stack trace.
```

For the **specific** demo question you plan to ask live (Beat 6's mismatch, or a drill-down question about MHA), pre-test it enough times during Day 6–7 rehearsal that you know its real latency and answer quality cold — don't discover live what the model says about your own demo's signature error.

### Where this fits in the Nine-Beat Demo Flow

Don't disrupt Beats 1–9 — they're tightly timed and already strong. Add this as an extension of **Beat 6**, since that's where PROBLEMS is already on screen:

> **Beat 6, extended (+15 seconds):** After showing the rendered error message, click the ASK tab. Type: *"why does this break?"* — or better, something that sounds like a real researcher question rather than a restatement of the error, e.g. *"what's the simplest fix that keeps the feedforward dimension at 768?"* The agent answers, grounded in the actual graph. Say: *"This isn't a canned message — it's reasoning over the actual architecture on your screen right now."*

That last line is doing real work: it's the moment you explicitly tell judges this is a real agent, not a template — directly answering the "is this actually computed" skepticism a sharp judge might otherwise silently have.

### Updated AI Impact Statement framing

Part 4 above said "no LLM in the runtime path" — that's no longer accurate once you build this, and the statement needs to change accordingly. Revised structure:

- **What the AI is doing:** two separate things, and the distinction matters — (1) torch.fx tracing and shape inference is deterministic static analysis, zero LLM involvement, the source of truth for every number shown; (2) a GPT-based agent answers free-form questions about the graph, constrained to only cite facts retrieved from (1) via tool calling.
- **Model used and why:** name your actual model choice (see below) — justify briefly (cost/latency tradeoff for a bounded, low-token task).
- **Guardrails:** this is your strongest paragraph now — explain the tool-calling constraint specifically. This is a concrete, technical guardrail a judge can evaluate, not a vague "we're careful" claim.
- **Expected impact:** faster debugging loop — a researcher gets an explanation in natural language without leaving the canvas, while the underlying facts remain provably correct since they're sourced from real tracing, not generation.

### Model choice and cost, given your $100 credit

This task is genuinely well-suited to a smaller/cheaper model, not your flagship: the context is small (one graph's worth of JSON, not a huge document), the task is narrow (grounded Q&A with tool calling), and you need low latency for a live demo, not maximum reasoning depth. Use a mini-tier model for this — check current model names/pricing against the product-self-knowledge skill or OpenAI's pricing page right before you build, since names and prices shift, but budget-wise: a few hundred tokens in, a few hundred out, per question, at mini-tier pricing is fractions of a cent per call. Even with heavy rehearsal (hundreds of test calls across Day 6–7) and live hackathon usage, this stays well inside your existing "$20 of $100" budget from Part 1 — it doesn't change your overall budget picture, it just gives that budget a real runtime job instead of only a build-time one.

### Build sequencing — where this lands in the week

Slot this into **Day 5**, alongside the error detection work, since it depends on the graph JSON shape and PROBLEMS list already existing by then. Don't start it earlier — building the agent against a graph schema that's still changing (Days 1–4) wastes a window re-doing the tool's data access layer every time the schema shifts.

```
Owner: whoever isn't doing fallback-demo-mode that day · Tool: Claude
(this has the same "subtle bug undermines credibility" risk profile as
the tracer — the tool-calling constraint must actually hold, not just
look like it holds in casual testing)

Prompt: Build the /api/ask endpoint and get_graph_fact tool exactly as
specified above. After building it, run 10 adversarial test questions
against it and show me the transcripts: (1) ask about a node that
doesn't exist in the graph, (2) ask it to state a shape, then check the
shape it states against the actual graph_json value character-for-
character, (3) ask an off-topic question ("write me a sorting
algorithm"), (4) ask it to guess what would happen with a hypothetical
architecture change. I need to see it either tool-call correctly,
decline correctly, or redirect correctly on all 10 — not just the
happy path.
```

That adversarial-test instruction matters more than the happy-path build — a judge asking one weird question live is exactly the scenario you're protecting against, and you want to have already seen it fail (and fixed it) in private before Day 7.

---

## Quick-reference summary

| Day | Primary owner | Primary tool | Key output |
|---|---|---|---|
| 1 | Tech Lead | Claude | Confirmed torch.fx failure modes, classify_sync_state() |
| 2 | Tech Lead | Claude | graph_to_json() serializer + MHA hardcoded interior |
| 3 | Both (parallel) | Claude (backend) + Codex (frontend shell) | FastAPI WS/export endpoints; static three-panel UI |
| 4 | Both | Claude (topo-sort) / Gemini (integration glue) | Live bidirectional sync working end-to-end |
| 5 | Split | Claude (mismatch detection, fallback demo, **Graph Copilot agent**) + Codex (drill-down, export polish, **AskPanel UI**) | Error detection, fallback demo mode, drill-down, runtime agent Q&A |
| 6 | Both | Codex (styling pass) | Full design system applied; environment frozen |
| 7 | Both | None | Rehearsal only, AI Impact Statement drafted |

Total OpenAI API spend across the week, on narrow scripted tasks only: expect well under $20 of your $100 credit. Keep the rest as slack for icon/asset generation or last-minute scripted validation during the hackathon itself.
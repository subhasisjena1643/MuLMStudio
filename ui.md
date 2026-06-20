### Design brief, restated in my own words

µLM is not a SaaS dashboard and not a marketing site — it's an instrument panel for a precision technical task. The reference class isn't Notion or Linear, it's Cadence, KiCad, oscilloscope UIs, and VS Code: tools designed by and for people who stare at them for eight hours and need them to disappear into the work. The single biggest tell of "AI-generated" in 2026 is a near-black background with one neon accent color and a sans-serif everywhere — competent, generic, forgettable. I'm deliberately steering away from that.

### The signature element

**Tensor shapes rendered as instrument-grade data, not UI chrome.** Every other part of this interface is quiet on purpose so that the one place numbers appear — the shape pill on a wire — reads like a multimeter reading, not a tooltip. This is the single thing a judge should remember about how it *looked*, separate from what it *did*.

### Color — 6 named values, desaturated and industrial, not trend-driven

| Token              | Hex       | Role                                                                                                                                           |
| --------------------| -----------| ------------------------------------------------------------------------------------------------------------------------------------------------|
| `--bg-base`        | `#16181D` | Canvas/app background — a graphite, not pure black. Pure black (#000) reads as "default dark mode"; this has a faint warm-grey lift to it.     |
| `--bg-elevated`    | `#1D2027` | Panels, palette cards, the analysis tray                                                                                                       |
| `--border-default` | `#2C313C` | Standard hairlines between panels and around blocks                                                                                            |
| `--border-focus`   | `#5B8DB8` | A muted slate-blue, used *only* for the atomic-primitive badge and focus rings — not a glowing accent, a steel-blue like an oscilloscope trace |
| `--text-primary`   | `#E4E6EB` | Off-white, not pure white — reduces eye strain over a 24-hour build, signals intentionality                                                    |
| `--text-muted`     | `#7A8194` | Secondary labels, port counts, hints                                                                                                           |
| `--status-error`   | `#C0392B` | Already specified in Plan 0.2 — a brick red, reads as "instrument warning" not "app crashed." Keep this exact value; it's correct.             |
| `--status-unknown` | `#B8860B` | Dark goldenrod amber for `[?]` states — warm, not alarming                                                                                     |

Category accent dots (palette grouping only, used sparingly — small 3px dots, never large fills):
- CORE: `#6B7280` (neutral slate)
- ATTENTION: `#5B8DB8` (same steel-blue as focus — attention IS the focus block)
- NORM: `#5A9B7C` (muted sage green)
- VISION: `#9B7CB8` (muted violet)
- REGULARIZATION / ACTIVATION: `#8A8E99` (low-saturation grey-blue)

**Why this works against the "AI slop" tell:** no pure black, no saturated neon, no purple-to-blue gradient anywhere. Every color is desaturated enough that it could be a real EDA tool's palette. The one place saturation shows up at all is the error red and the focus steel-blue — both load-bearing, not decorative.

### Typography — three faces, each with a job

| Role                                            | Face                                                                                                                               | Why                                                                                                                                                                                                                                            |
| -------------------------------------------------| ------------------------------------------------------------------------------------------------------------------------------------| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UI text (labels, panel titles, palette names)   | **Inter**, weights 400/500/600                                                                                                     | Neutral, extremely legible at small sizes, doesn't editorialize. This is correctly chosen in Plan 0.2 already — keep it.                                                                                                                       |
| Code (notebook panel)                           | **JetBrains Mono**                                                                                                                 | Already specified for shape labels in Plan 0.2 — extend this to the Monaco editor itself for consistency. Has real ligature support and was designed specifically for code reading, not repurposed.                                            |
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
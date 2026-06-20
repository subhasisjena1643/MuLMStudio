/**
 * App.jsx
 * µLM Studio — three-panel IDE shell.
 *
 * Layout:
 *   TitleBar (36px)
 *   ─────────────────────────────────────────────────
 *   PalettePanel (200px) │ CanvasPanel (flex) │ right-panel (400px)
 *                        │                   ├── NotebookPanel (flex)
 *                        │                   └── AnalysisPanel (220px)
 *
 * Data flow (live):
 *   code state → debounce 300ms → WebSocket → { graph } → canvas nodes/edges
 *   canvas drop (palette block) → useCodeGen (topo-sort) → notebook code
 *
 * Data flow (DEMO_MODE):
 *   STATIC_GRAPH_CLEAN on load.
 *   Ctrl+Shift+E  → toggle to STATIC_GRAPH_MISMATCH (red wire + PROBLEMS badge)
 *   Ctrl+Shift+E  → toggle back to STATIC_GRAPH_CLEAN
 *
 * Mode flag: VITE_DEMO_MODE=true in .env.local
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import PalettePanel  from './components/PalettePanel';
import CanvasPanel   from './components/CanvasPanel';
import NotebookPanel from './components/NotebookPanel';
import AnalysisPanel from './components/AnalysisPanel';
import { useTracer }  from './hooks/useTracer';
import { useCodeGen } from './hooks/useCodeGen';
import {
  STATIC_GRAPH_CLEAN,
  STATIC_GRAPH_MISMATCH,
  DEMO_MISMATCH_MESSAGE,
  DEMO_CODE_CLEAN,
  DEMO_CODE_MISMATCH,
} from './data/staticDemoGraphs';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {

  // ── Demo mode state ─────────────────────────────────────────────────────────
  // mismatching: true = STATIC_GRAPH_MISMATCH displayed; false = CLEAN
  const [mismatching, setMismatching] = useState(false);

  // ── Graph state ──────────────────────────────────────────────────────────────
  // In DEMO_MODE: always the static graph (toggled by Ctrl+Shift+E).
  // In live mode: starts as clean stub, updated by WS on every trace.
  const activeStaticGraph = mismatching ? STATIC_GRAPH_MISMATCH : STATIC_GRAPH_CLEAN;

  const [canvasNodes, setCanvasNodes] = useState(
    DEMO_MODE ? activeStaticGraph.nodes : STATIC_GRAPH_CLEAN.nodes,
  );
  const [canvasEdges, setCanvasEdges] = useState(
    DEMO_MODE ? activeStaticGraph.edges : STATIC_GRAPH_CLEAN.edges,
  );

  // Sync canvas when demo toggle changes
  useEffect(() => {
    if (!DEMO_MODE) return;
    setCanvasNodes(activeStaticGraph.nodes);
    setCanvasEdges(activeStaticGraph.edges);
  }, [mismatching]); // eslint-disable-line react-hooks/exhaustive-deps

  // The last graph received from the backend — used by the export endpoint
  const lastGraphRef = useRef({ nodes: STATIC_GRAPH_CLEAN.nodes, edges: STATIC_GRAPH_CLEAN.edges });

  // Track the model name for the canvas badge
  const [modelName, setModelName] = useState('TransformerEncoderBlock');

  // ── Notebook code state ──────────────────────────────────────────────────────
  // liveCode is a REF, not state — user keystrokes must NEVER trigger a re-render.
  // Only codeSource transitions (user↔canvas) cause re-renders.
  const liveCodeRef                 = useRef(DEMO_CODE_CLEAN);
  const [codeSource, setCodeSource] = useState('user'); // 'user' | 'canvas'

  // In DEMO_MODE show the pre-written demo code matching the current graph state
  const demoNotebookCode = mismatching ? DEMO_CODE_MISMATCH : DEMO_CODE_CLEAN;

  // ── CodeGen hook (canvas-drag mode only) ─────────────────────────────────────
  const { code: generatedCode, problems: codeGenProblems } = useCodeGen(
    codeSource === 'canvas' ? canvasNodes : [],
    codeSource === 'canvas' ? canvasEdges : [],
  );

  // What Monaco shows:
  //   DEMO_MODE  → pre-built demo code (switches with Ctrl+Shift+E)
  //   canvas mode → topological-sort generated code
  //   user mode   → whatever the user typed
  const notebookCode = DEMO_MODE
    ? demoNotebookCode
    : codeSource === 'canvas'
      ? generatedCode
      : liveCodeRef.current;

  // ── Analysis panel problems ───────────────────────────────────────────────────
  const [traceError, setTraceError]     = useState(null);
  const [liveProblems, setLiveProblems] = useState([]);

  // In DEMO_MODE mismatch state → inject the pre-built hardcoded message
  const demoProblems = mismatching
    ? [{ id: 'demo-mismatch', severity: 'error', message: DEMO_MISMATCH_MESSAGE }]
    : [];

  const allProblems = DEMO_MODE
    ? demoProblems
    : [
        ...(traceError ? [{ id: 'trace-error', severity: 'error', message: traceError }] : []),
        ...liveProblems,
        ...codeGenProblems,
      ];

  // ── Ctrl+Shift+E / Cmd+Shift+E toggle ────────────────────────────────────────
  // Demo-safety: silently toggle between clean and mismatch states.
  // Works during any key combination so it can fire mid-demo without mouse movement.
  useEffect(() => {
    if (!DEMO_MODE) return;

    const handler = (e) => {
      const isMod = e.ctrlKey || e.metaKey;   // Ctrl on Win/Linux, Cmd on Mac
      if (isMod && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setMismatching((m) => !m);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // mount once — DEMO_MODE is a compile-time constant

  // ── WebSocket hook (no-op in DEMO_MODE) ──────────────────────────────────────
  const handleGraph = useCallback((graph) => {
    if (DEMO_MODE) return;
    const laidNodes = graph.nodes.map((n) => ({ ...n, position: n.position ?? { x: 0, y: 0 } }));
    setCanvasNodes(laidNodes);
    setCanvasEdges(graph.edges);
    lastGraphRef.current = graph;
    setTraceError(null);

    // Surface backend mismatches in the analysis panel
    if (graph.mismatches && graph.mismatches.length > 0) {
      setLiveProblems(graph.mismatches.map((m) => ({
        id:       m.edge_id,
        severity: 'error',
        message:  m.message,
      })));
    } else {
      setLiveProblems([]);
    }

    // Extract model class name for the canvas badge
    const callNodes = graph.nodes.filter((n) => n.data?.op === 'call_module');
    if (callNodes.length > 0) {
      setModelName('Live model');
    }
  }, []);

  const handleTraceError = useCallback((msg) => {
    setTraceError(msg);
    // Don't clear canvas — hold last valid state
  }, []);

  const { sendCode, wsStatus } = useTracer(
    DEMO_MODE ? () => {} : handleGraph,
    DEMO_MODE ? () => {} : handleTraceError,
  );

  // ── Monaco change handler ────────────────────────────────────────────────────
  const handleCodeChange = useCallback((value) => {
    if (DEMO_MODE) return;   // notebook is read-only in demo mode
    const v = value ?? '';
    liveCodeRef.current = v;   // ref update — zero React re-renders
    setCodeSource('user');     // no-op if already 'user' (React bails out)
    sendCode(v);
  }, [sendCode]);

  // ── Canvas drop handler (palette → canvas) ───────────────────────────────────
  const handleCanvasNodesChange = useCallback((nodes) => {
    setCanvasNodes(nodes);
    setCodeSource('canvas');
  }, []);

  const handleCanvasEdgesChange = useCallback((edges) => {
    setCanvasEdges(edges);
    setCodeSource('canvas');
  }, []);

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (DEMO_MODE) {
      // In demo mode, export the current demo code directly as a download
      const blob = new Blob([notebookCode], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'TransformerEncoderBlock.py';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    try {
      const resp = await fetch('http://localhost:8000/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: lastGraphRef.current,
          code:  notebookCode,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'mulm_export.py';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setTraceError(`Export failed: ${err.message}`);
    }
  };

  // ── WS status indicator ──────────────────────────────────────────────────────
  const statusColor = DEMO_MODE
    ? '#5A9B7C'                                          // always green in demo
    : wsStatus === 'open'       ? '#5A9B7C'
    : wsStatus === 'connecting' ? '#B8860B'
    : '#C0392B';

  const statusTitle = DEMO_MODE
    ? `Demo mode${mismatching ? ' — mismatch active (Ctrl+Shift+E to reset)' : ' — press Ctrl+Shift+E to show mismatch'}`
    : `WebSocket: ${wsStatus}`;

  return (
    <div className="app-shell">

      {/* ── Title bar ─────────────────────────────────────────────────────────── */}
      <header className="titlebar">
        <span className="titlebar__logo">
          <span className="titlebar__logo-accent">µ</span>
          LM Studio
        </span>
        <span className="titlebar__sep">·</span>
        <span className="titlebar__title">
          Prototype 0.1{DEMO_MODE ? ' · DEMO' : ''}
        </span>

        {/* Status dot */}
        <div
          title={statusTitle}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            marginLeft: 8, flexShrink: 0, alignSelf: 'center',
            // Pulse the dot red when mismatch is active in demo mode
            animation: DEMO_MODE && mismatching ? 'pulse-error 2s ease-in-out infinite' : 'none',
          }}
        />

        <div className="titlebar__spacer" />

        <button className="titlebar__btn" onClick={handleExport}>
          Export .py
        </button>
      </header>

      {/* ── Three-panel workspace ──────────────────────────────────────────────── */}
      <div className="workspace">

        <PalettePanel />

        <CanvasPanel
          nodes={canvasNodes}
          edges={canvasEdges}
          modelName={modelName}
          onNodesChange={handleCanvasNodesChange}
          onEdgesChange={handleCanvasEdgesChange}
        />

        <div className="right-panel">
          <NotebookPanel
            code={notebookCode}
            onChange={handleCodeChange}
            codeSource={DEMO_MODE ? 'demo' : codeSource}
          />
          <AnalysisPanel problems={allProblems} />
        </div>

      </div>
    </div>
  );
}

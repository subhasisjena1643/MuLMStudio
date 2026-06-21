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
import PalettePanel from './components/PalettePanel';
import CanvasPanel from './components/CanvasPanel';
import NotebookPanel from './components/NotebookPanel';
import AnalysisPanel from './components/AnalysisPanel';
import { useTracer } from './hooks/useTracer';
import { useCodeGen, generateCode } from './hooks/useCodeGen';
import {
  STATIC_GRAPH_CLEAN,
  STATIC_GRAPH_MISMATCH,
  DEMO_MISMATCH_MESSAGE,
  DEMO_CODE_CLEAN,
  DEMO_CODE_MISMATCH,
  STATIC_MHA_INTERIOR,
  DEMO_MISMATCH_STRUCTURED,
} from './data/staticDemoGraphs';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from './data/templates';
export default function App() {

  const [mismatching, setMismatching] = useState(false);

  // ── Drill-down state ─────────────────────────────────────────────────────────
  const [drilledPath, setDrilledPath] = useState(null);
  const drilledPathRef = useRef(null);

  // ── Graph state ──────────────────────────────────────────────────────────────
  // In DEMO_MODE: always the static graph (toggled by Ctrl+Shift+E).
  // In live mode: starts as clean stub, updated by WS on every trace.
  const activeStaticGraph = mismatching ? STATIC_GRAPH_MISMATCH : STATIC_GRAPH_CLEAN;

  const [canvasNodes, setCanvasNodes] = useState(
    DEMO_MODE ? activeStaticGraph.nodes : [],
  );
  const [canvasEdges, setCanvasEdges] = useState(
    DEMO_MODE ? activeStaticGraph.edges : [],
  );

  // Sync canvas when demo toggle changes
  useEffect(() => {
    if (!DEMO_MODE) return;
    if (drilledPathRef.current) return;
    setCanvasNodes(activeStaticGraph.nodes);
    setCanvasEdges(activeStaticGraph.edges);
  }, [mismatching]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillDown = useCallback(async (node) => {
    if (node.data?.sync_state !== 'atomic') return;

    const blockLabel = node.data?.label || 'MultiheadAttention';
    setDrilledPath(blockLabel);
    drilledPathRef.current = blockLabel;

    if (DEMO_MODE) {
      setCanvasNodes(STATIC_MHA_INTERIOR.nodes);
      setCanvasEdges(STATIC_MHA_INTERIOR.edges);
      return;
    }

    try {
      const res = await fetch('http://localhost:8002/demo?view=mha_interior');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const interior = await res.json();
      setCanvasNodes(interior.nodes);
      setCanvasEdges(interior.edges);
    } catch (err) {
      console.error('Drill-down failed:', err);
      setCanvasNodes(STATIC_MHA_INTERIOR.nodes);
      setCanvasEdges(STATIC_MHA_INTERIOR.edges);
    }
  }, []);

  const handleReturnToRoot = useCallback(() => {
    setDrilledPath(null);
    drilledPathRef.current = null;

    if (DEMO_MODE) {
      const activeStaticGraph = mismatching ? STATIC_GRAPH_MISMATCH : STATIC_GRAPH_CLEAN;
      setCanvasNodes(activeStaticGraph.nodes);
      setCanvasEdges(activeStaticGraph.edges);
      return;
    }

    if (lastGraphRef.current) {
      const rawNodes = lastGraphRef.current.nodes.map(({ position: _pos, ...rest }) => rest);
      setCanvasNodes(rawNodes);
      setCanvasEdges(lastGraphRef.current.edges);
    }
  }, [mismatching]);

  // The last graph received from the backend — used by the export endpoint
  const lastGraphRef = useRef({ nodes: [], edges: [] });

  // Track the model name for the canvas badge
  const [modelName, setModelName] = useState('');

  // ── Notebook code state ──────────────────────────────────────────────────────
  // liveCode is a REF, not state — user keystrokes must NEVER trigger a re-render.
  // Only codeSource transitions (user↔canvas) cause re-renders.
  const [selectedTemplate, setSelectedTemplate] = useState('tissue_llm');
  const [inputShape, setInputShape] = useState(TEMPLATES.tissue_llm.inputShape);
  const liveCodeRef = useRef(TEMPLATES.tissue_llm.code);
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
  const [traceError, setTraceError] = useState(null);
  const [liveProblems, setLiveProblems] = useState([]);

  // ── OUTPUT / TERMINAL / DEBUG log state ────────────────────────────────────
  const [outputLog,   setOutputLog]   = useState([]);  // { text, isError, ts }
  const [terminalLog, setTerminalLog] = useState([]);  // { text, ts }
  const [selectedNode, setSelectedNode] = useState(null); // node object | null

  // Tracing indicator: true while the backend is processing a WS request.
  // Displayed as a pulsing "Tracing…" badge in the title bar.
  const [isTracing, setIsTracing] = useState(false);
  const tracingTimerRef = useRef(null); // safety reset after 5s to avoid stuck badge

  // In DEMO_MODE mismatch state → inject the pre-built hardcoded message
  const demoProblems = mismatching
    ? [{
        id: 'demo-mismatch',
        severity: 'error',
        type: 'shape_mismatch',
        ...DEMO_MISMATCH_STRUCTURED,
      }]
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
    // Strip any backend-supplied positions so applyDagreLayout in CanvasPanel
    // can compute fresh positions from topology. If we pass {x:0,y:0} for every
    // node, dagre still runs but all nodes end up collapsed at the origin.
    const rawNodes = graph.nodes.map(({ position: _pos, ...rest }) => rest);
    lastGraphRef.current = {
      nodes: rawNodes,
      edges: graph.edges,
      errors: graph.errors,
    };
    setTraceError(null);

    // Surface backend mismatches in the analysis panel
    if (graph.mismatches && graph.mismatches.length > 0) {
      setLiveProblems(graph.mismatches.map((m) => ({
        id: m.edge_id,
        severity: 'error',
        type: 'shape_mismatch',
        ...m
      })));
    } else {
      setLiveProblems([]);
    }

    // Extract model class name for the canvas badge
    const firstCall = graph.nodes.find((n) => n.data?.op === 'call_module');
    setModelName(graph.model_name ?? firstCall?.data?.label ?? 'Live model');
    setIsTracing(false);
    clearTimeout(tracingTimerRef.current);

    if (drilledPathRef.current) {
      return;
    }
    setCanvasNodes(rawNodes);
    setCanvasEdges(graph.edges);
  }, []);

  const handleTraceError = useCallback((msg) => {
    setTraceError(msg);
    setIsTracing(false);
    clearTimeout(tracingTimerRef.current);
    // Don't clear canvas — hold last valid state
  }, []);

  // Must be a named const at top level — Rules of Hooks forbids inline useCallback
  // inside a regular function call's argument list (useTracer is not a hook receiver).
  const handleLog = useCallback(({ type, text, isError = false }) => {
    const ts = new Date().toTimeString().slice(0, 8); // HH:MM:SS
    const entry = { text: `[${ts}] ${text}`, isError, id: Date.now() + Math.random() };
    if (type === 'output')   setOutputLog((l) => [entry, ...l].slice(0, 200));
    if (type === 'terminal') setTerminalLog((l) => [entry, ...l].slice(0, 400));
  }, []);

  const { sendCode, wsStatus } = useTracer(
    DEMO_MODE ? () => { } : handleGraph,
    DEMO_MODE ? () => { } : handleTraceError,
    handleLog,
  );

  // ── Initial trace on first WS connection ─────────────────────────────────────
  // Fire once when the socket first opens so the canvas immediately shows the
  // architecture for the default template (tissue_llm) instead of the old
  // hard-coded static Transformer Encoder stub.
  const initialTraceSentRef = useRef(false);
  useEffect(() => {
    if (DEMO_MODE) return;
    if (wsStatus !== 'open') return;
    if (initialTraceSentRef.current) return;
    initialTraceSentRef.current = true;
    sendCode(liveCodeRef.current, TEMPLATES.tissue_llm.inputShape);
  }, [wsStatus, sendCode]);

  // ── Monaco node-click highlight ───────────────────────────────────────────────
  const editorRef = useRef(null);
  const decorationIdsRef = useRef([]);

  // ── Undo history stack ───────────────────────────────────────────────────────
  // Stores { nodes, edges, code } snapshots BEFORE each destructive action.
  // Max 50 entries. Newest entry is at index 0.
  const historyRef          = useRef([]);
  const codeHistoryTimerRef = useRef(null); // debounce for text-change pushes
  const MAX_HISTORY = 50;

  // ── Programmatic-change guard ────────────────────────────────────────────
  // Set to true before calling editorRef.setValue() imperatively so that the
  // Monaco onChange → handleCodeChange path is skipped. This prevents the
  // stale-inputShape race that breaks template switching after clearing canvas.
  const suppressOnChangeRef = useRef(false);

  const pushHistory = useCallback((nodes, edges, code) => {
    historyRef.current = [
      { nodes, edges, code },
      ...historyRef.current,
    ].slice(0, MAX_HISTORY);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const [prev, ...rest] = historyRef.current;
    historyRef.current = rest;
    setCanvasNodes(prev.nodes);
    setCanvasEdges(prev.edges);
    setCodeSource('canvas');
    if (editorRef.current) {
      editorRef.current.setValue(prev.code);
      liveCodeRef.current = prev.code;
    }
  }, []);

  // Global Ctrl+Z (capture phase) — only intercept when last action was
  // canvas-originated. When codeSource === 'user', Monaco handles its own
  // undo natively; we must not fight it.
  useEffect(() => {
    const handler = (e) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey)) return;
      if (DEMO_MODE) return;
      if (codeSource === 'canvas' && historyRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
      }
      // codeSource === 'user' → fall through, Monaco handles it
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [codeSource, handleUndo]);

  // ── Template switcher ────────────────────────────────────────────────────────
  // Declared here (after useTracer + editorRef) so sendCode and editorRef
  // are both in scope — avoids "Cannot access before initialization" TDZ error.
  const handleTemplateChange = useCallback((templateId) => {
    const template = TEMPLATES[templateId];
    if (!template) return;

    setSelectedTemplate(templateId);
    setInputShape(template.inputShape);
    liveCodeRef.current = template.code;
    setCodeSource('user');

    // Force Monaco to show the new code immediately (imperative API —
    // avoids a full re-render cycle and cursor-reset side-effects).
    // Suppress the resulting onChange so handleCodeChange doesn't fire with
    // a stale inputShape — we send the WS trace explicitly below with the
    // correct shape from the template object (not from React state).
    if (editorRef.current) {
      suppressOnChangeRef.current = true;
      editorRef.current.setValue(template.code);
      suppressOnChangeRef.current = false;
    }

    // Trigger the debounced WS trace with the correct (fresh) inputShape
    sendCode(template.code, template.inputShape);
  }, [sendCode]);

  const highlightBlockInEditor = useCallback((moduleTarget) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Clear all decorations when no target
    if (!moduleTarget) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    // Primary search: 'self.<target>' — hits both __init__ assignment and forward() call
    let matches = model.findMatches(
      'self.' + moduleTarget,
      /*searchOnlyEditableRange*/ true,
      /*isRegex*/ false,
      /*matchCase*/ false,
      /*wordSeparators*/ null,
      /*captureMatches*/ true,
    );

    // Fallback: bare target name (Input/output placeholder nodes, generated names)
    if (!matches || matches.length === 0) {
      matches = model.findMatches(
        moduleTarget,
        true, false, false, null, true,
      );
    }

    if (!matches || matches.length === 0) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const newDecorations = matches.map((m) => ({
      range: m.range,
      options: {
        isWholeLine: true,
        className: 'mulm-block-highlight',
        glyphMarginClassName: 'mulm-block-gutter',
      },
    }));

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      newDecorations,
    );

    editor.revealLineInCenter(matches[0].range.startLineNumber);
  }, []);

  // ── Monaco change handler ────────────────────────────────────────────────────
  const handleCodeChange = useCallback((value) => {
    if (DEMO_MODE) return;   // notebook is read-only in demo mode
    // Skip when this onChange was triggered by a programmatic setValue() call
    // (e.g. template switch) — we handle the WS send explicitly there with
    // the correct inputShape. Without this guard the stale React state value
    // of inputShape would be used, causing a wrong/failed trace.
    if (suppressOnChangeRef.current) return;
    const v = value ?? '';

    // Clear canvas immediately when code becomes empty — no need to wait for
    // the backend (which returns an error on empty input anyway).
    if (!v.trim()) {
      setCanvasNodes([]);
      setCanvasEdges([]);
      setIsTracing(false);
      clearTimeout(tracingTimerRef.current);
      liveCodeRef.current = v;
      setCodeSource('user');
      return; // no WS send needed
    }

    // Debounce-push a snapshot so a subsequent canvas action can undo past this text.
    clearTimeout(codeHistoryTimerRef.current);
    codeHistoryTimerRef.current = setTimeout(() => {
      pushHistory(canvasNodes, canvasEdges, v);
    }, 500);
    liveCodeRef.current = v;   // ref update — zero React re-renders
    setCodeSource('user');     // no-op if already 'user' (React bails out)

    // Show Tracing… badge; auto-reset after 5s in case the backend never replies.
    setIsTracing(true);
    clearTimeout(tracingTimerRef.current);
    tracingTimerRef.current = setTimeout(() => setIsTracing(false), 5000);

    sendCode(v, inputShape);
  }, [sendCode, pushHistory, canvasNodes, canvasEdges, inputShape]);

  // ── Canvas drop handler (palette → canvas) ───────────────────────────────────
  const handleCanvasNodesChange = useCallback((nodes) => {
    // Node count grew → a block was just dropped; snapshot current state first
    if (nodes.length > canvasNodes.length) {
      pushHistory(canvasNodes, canvasEdges, liveCodeRef.current);
    }
    setCanvasNodes(nodes);
    setCodeSource('canvas');
  }, [canvasNodes, canvasEdges, pushHistory]);

  const handleCanvasEdgesChange = useCallback((edges) => {
    // Edge count grew → user drew a new wire; snapshot current state first
    if (edges.length > canvasEdges.length) {
      pushHistory(canvasNodes, canvasEdges, liveCodeRef.current);
    }
    setCanvasEdges(edges);
    setCodeSource('canvas');
  }, [canvasNodes, canvasEdges, pushHistory]);

  // ── Node deletion (Delete / Backspace key or context menu) ───────────────────
  const handleNodesDelete = useCallback((deletedNodes) => {
    if (DEMO_MODE) return;
    // Snapshot BEFORE mutation so Ctrl+Z can restore the full previous state
    pushHistory(canvasNodes, canvasEdges, liveCodeRef.current);
    const deletedIds = new Set(deletedNodes.map((n) => n.id));

    setCanvasNodes((prev) => {
      const nextNodes = prev.filter((n) => !deletedIds.has(n.id));
      setCanvasEdges((prevEdges) => {
        const nextEdges = prevEdges.filter(
          (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
        );
        // Codegen on the surviving graph
        const { code } = generateCode(nextNodes, nextEdges);
        if (code && editorRef.current) {
          editorRef.current.setValue(code);
          liveCodeRef.current = code;
          sendCode(code, inputShape);
        }
        highlightBlockInEditor(null);
        setSelectedNode(null);
        setCodeSource('canvas');
        return nextEdges;
      });
      return nextNodes;
    });
  }, [sendCode, highlightBlockInEditor, pushHistory, canvasNodes, canvasEdges, inputShape]);

  // ── Edge deletion ────────────────────────────────────────────────────────
  const handleEdgesDelete = useCallback((deletedEdges) => {
    if (DEMO_MODE) return;
    // Snapshot BEFORE mutation
    pushHistory(canvasNodes, canvasEdges, liveCodeRef.current);
    const deletedIds = new Set(deletedEdges.map((e) => e.id));
    setCanvasEdges((prev) => {
      const nextEdges = prev.filter((e) => !deletedIds.has(e.id));
      const { code } = generateCode(canvasNodes, nextEdges);
      if (code && editorRef.current) {
        editorRef.current.setValue(code);
        liveCodeRef.current = code;
        sendCode(code, inputShape);
      }
      setCodeSource('canvas');
      return nextEdges;
    });
  }, [sendCode, canvasNodes, canvasEdges, pushHistory, inputShape]);

  // ── Right-click context menu ──────────────────────────────────────────────
  // contextMenu: null | { node, x, y }
  const [contextMenu, setContextMenu] = useState(null);

  const handleNodeContextMenu = useCallback((evt, node) => {
    evt.preventDefault();
    setContextMenu({ node, x: evt.clientX, y: evt.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (DEMO_MODE) {
      // In demo mode, export the current demo code directly as a download
      const blob = new Blob([notebookCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'TransformerEncoderBlock.py';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    try {
      const resp = await fetch('http://localhost:8002/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: lastGraphRef.current,
          code: notebookCode,
          model_name: modelName,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
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
    : wsStatus === 'open' ? '#5A9B7C'
      : wsStatus === 'connecting' ? 'var(--status-unknown, #B8860B)'
        : 'var(--status-unknown, #B8860B)';

  const statusLabel = DEMO_MODE
    ? 'LIVE'
    : wsStatus === 'open' ? 'LIVE' : 'RECONNECTING';

  const statusTitle = DEMO_MODE
    ? `Demo mode${mismatching ? ' — mismatch active (Ctrl+Shift+E to reset)' : ' — press Ctrl+Shift+E to show mismatch'}`
    : `WebSocket: ${wsStatus}`;

  return (
    <div className="app-shell" onClick={closeContextMenu}>

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

        {/* Status dot + label */}
        <div
          title={statusTitle}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            marginLeft: 8, flexShrink: 0,
          }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
            animation: DEMO_MODE && mismatching ? 'pulse-error 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            color: 'var(--text-muted)',
            fontFamily: 'Inter, var(--font-sans), sans-serif',
            fontWeight: 500,
            fontSize: 10,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Tracing… badge — visible while WS request is in-flight */}
        {isTracing && !DEMO_MODE && (
          <span style={{
            fontSize: 10,
            fontFamily: 'Inter, var(--font-sans), sans-serif',
            fontWeight: 500,
            color: '#5B8DB8',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            userSelect: 'none',
            marginLeft: 6,
            animation: 'tracing-pulse 1s ease-in-out infinite',
          }}>
            Tracing…
          </span>
        )}

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
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeClick={(_evt, node) => {
            closeContextMenu();
            highlightBlockInEditor(node.data?.target);
            setSelectedNode(node);
          }}
          onNodeDoubleClick={handleDrillDown}
          drilledPath={drilledPath}
          onReturnToRoot={handleReturnToRoot}
          onPaneClick={() => {
            closeContextMenu();
            highlightBlockInEditor(null);
            setSelectedNode(null);
          }}
          onSelectionChange={({ nodes: sel }) => {
            if (sel.length === 0) {
              highlightBlockInEditor(null);
              setSelectedNode(null);
            }
          }}
        />

        <div className="right-panel">
          <NotebookPanel
            code={notebookCode}
            onChange={handleCodeChange}
            codeSource={DEMO_MODE ? 'demo' : codeSource}
            onEditorMount={(ed) => { editorRef.current = ed; }}
            selectedTemplate={selectedTemplate}
            onTemplateChange={handleTemplateChange}
          />
          <AnalysisPanel
            problems={allProblems}
            outputLog={outputLog}
            terminalLog={terminalLog}
            selectedNode={selectedNode}
          />
        </div>

      </div>

      {/* ── Node right-click context menu ───────────────────────────────────────── */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onRemove={() => {
            handleNodesDelete([contextMenu.node]);
            closeContextMenu();
          }}
          onViewSource={() => {
            highlightBlockInEditor(contextMenu.node.data?.target);
            closeContextMenu();
          }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

// ── NodeContextMenu ───────────────────────────────────────────────────────────────────────
// Pure presentational — no hooks of its own except one useEffect for Escape.
// Positioned with fixed CSS at the mouse coordinates from onContextMenu.
// Dismisses on: click outside (App shell onClick closeContextMenu),
//               Escape key, any menu action.
function NodeContextMenu({ x, y, node: _node, onRemove, onViewSource, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position:     'fixed',
        left:         x,
        top:          y,
        zIndex:       9999,
        background:   '#1D2027',
        border:       '1px solid #2C313C',
        borderRadius: 3,
        padding:      '4px 0',
        minWidth:     140,
        boxShadow:    '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      <ContextMenuItem label="View source" onClick={onViewSource} />
      <ContextMenuItem label="Remove block" danger onClick={onRemove} />
    </div>
  );
}

function ContextMenuItem({ label, danger = false, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:    '6px 16px',
        fontFamily: 'Inter, var(--font-sans), sans-serif',
        fontWeight: 400,
        fontSize:   13,
        cursor:     'pointer',
        color:      hovered && danger ? '#C0392B' : '#E4E6EB',
        background: hovered ? '#2C313C' : 'transparent',
        userSelect: 'none',
        transition: 'background 80ms, color 80ms',
      }}
    >
      {label}
    </div>
  );
}

/**
 * CanvasPanel.jsx
 * Center panel — React Flow canvas with:
 *   - Engineering graph-paper grid (major/minor lines via SVG pattern)
 *   - Dagre auto-layout (TB, vertical) applied whenever graph data changes
 *   - Palette block drop-in: drag from PalettePanel, drop on canvas →
 *       new node added, onNodesChange / onEdgesChange callbacks fire → App → useCodeGen
 *   - Empty-state: muted "Write or paste a PyTorch module to begin" text
 *
 * Props:
 *   nodes          - React Flow node array (controlled from App)
 *   edges          - React Flow edge array (controlled from App)
 *   modelName      - string for the top-left badge
 *   onNodesChange  - (nodes: Node[]) => void — fires only on user-driven changes
 *   onEdgesChange  - (edges: Edge[]) => void — fires only on user-driven changes
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../nodes/nodeTypes';
import { edgeTypes } from '../edges/edgeTypes';
import { applyDagreLayout } from '../layout/dagre';
import { CATEGORY_COLORS } from '../data/palette';

// ── SVG graph-paper grid ──────────────────────────────────────────────────────

function CanvasGrid() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="minor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2C313C" strokeWidth="0.5" opacity="0.18" />
        </pattern>
        <pattern id="major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#minor-grid)" />
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#2C313C" strokeWidth="1" opacity="0.25" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#major-grid)" />
    </svg>
  );
}

function minimapColor(node) {
  return CATEGORY_COLORS[node.data?.category] || '#3C424F';
}

// ── Node type from palette block sync_state ───────────────────────────────────

function blockToNodeType(block) {
  if (block.sync_state === 'atomic')      return 'mlmAtomicNode';
  if (block.sync_state === 'untraceable') return 'mlmUntraceableNode';
  return 'mlmNode';
}

let _nodeCounter = 1000;
function nextNodeId() { return `dropped_${++_nodeCounter}`; }

// ── Inner component (has access to useReactFlow context) ──────────────────────

function CanvasPanelInner({
  nodes: propNodes,
  edges: propEdges,
  modelName,
  onNodesChange: notifyNodes,
  onEdgesChange: notifyEdges,
  onNodesDelete,
  onEdgesDelete,
  onNodeContextMenu,
  onNodeClick,
  onPaneClick,
  onSelectionChange,
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Stable refs to avoid stale closures in callbacks
  const notifyNodesRef = useRef(notifyNodes);
  const notifyEdgesRef = useRef(notifyEdges);
  useEffect(() => { notifyNodesRef.current = notifyNodes; }, [notifyNodes]);
  useEffect(() => { notifyEdgesRef.current = notifyEdges; }, [notifyEdges]);

  // Apply Dagre layout whenever propNodes / propEdges change (WS update or load).
  const layoutedNodes = useMemo(() => {
    if (!propNodes || propNodes.length === 0) return [];
    return applyDagreLayout(propNodes, propEdges ?? [], {
      rankdir: 'TB', nodesep: 60, ranksep: 100,
    });
  }, [propNodes, propEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(propEdges ?? []);

  // Sync prop changes into local RF state.
  // A ref guard prevents treating our own setNodes as a user-driven change.
  const syncingRef = useRef(false);

  useEffect(() => {
    syncingRef.current = true;
    setNodes(layoutedNodes);
    syncingRef.current = false;
    if (layoutedNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
    }
  }, [layoutedNodes, setNodes, fitView]);

  useEffect(() => {
    syncingRef.current = true;
    setEdges(propEdges ?? []);
    syncingRef.current = false;
  }, [propEdges, setEdges]);

  // ── Edge connect (user draws a wire) ─────────────────────────────────────────
  const onConnect = useCallback((params) => {
    setEdges((eds) => {
      const next = addEdge({ ...params, type: 'shapeEdge' }, eds);
      setTimeout(() => notifyEdgesRef.current?.(next), 0);
      return next;
    });
  }, [setEdges]);

  // ── Drop handler (palette → canvas) ──────────────────────────────────────────
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/mulm-block');
    if (!raw) return;

    let block;
    try { block = JSON.parse(raw); } catch { return; }

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const id = nextNodeId();

    const newNode = {
      id,
      type: blockToNodeType(block),
      position,
      data: {
        label:      block.label,
        op:         'call_module',
        target:     id,
        shape:      block.output_shape ?? '',
        sync_state: block.sync_state,
        category:   block.category,
        params:     block.default_params ?? {},
        block_id:   block.id,
      },
    };

    setNodes((nds) => {
      const next = [...nds, newNode];
      setTimeout(() => notifyNodesRef.current?.(next), 0);
      return next;
    });
  }, [screenToFlowPosition, setNodes]);

  const isEmpty = nodes.length === 0;

  return (
    <div className="canvas-panel">
      {isEmpty && (
        <div className="canvas-empty">
          Write or paste a PyTorch module to begin
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'shapeEdge' }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <CanvasGrid />

        <Controls showInteractive={false} style={{ bottom: 16, left: 16 }} />

        <MiniMap
          nodeColor={minimapColor}
          maskColor="rgba(22, 24, 29, 0.75)"
          style={{ bottom: 16, right: 16, height: 100, width: 150 }}
        />

        {!isEmpty && (
          <Panel position="top-left">
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 2,
              padding: '3px 8px',
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              userSelect: 'none',
            }}>
              {modelName ?? 'Model'} · {nodes.length} nodes
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// ── Public export — wraps in ReactFlowProvider ────────────────────────────────
export default function CanvasPanel(props) {
  return (
    <ReactFlowProvider>
      <CanvasPanelInner {...props} />
    </ReactFlowProvider>
  );
}

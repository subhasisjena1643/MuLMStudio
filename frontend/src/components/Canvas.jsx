import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useMemo } from 'react'

/* ─── Node type colour palette ─── */
const NODE_COLORS = {
  inputNode:  { bg: '#0f2a1e', border: '#22c55e', badge: '#22c55e', label: '#86efac' },
  moduleNode: { bg: '#0f1e35', border: '#3b82f6', badge: '#3b82f6', label: '#93c5fd' },
  opNode:     { bg: '#1e1530', border: '#a855f7', badge: '#a855f7', label: '#d8b4fe' },
  outputNode: { bg: '#2a1a0f', border: '#f97316', badge: '#f97316', label: '#fdba74' },
}

function shapeTag(shape) {
  if (!shape) return '?'
  if (Array.isArray(shape)) {
    if (shape.length === 0) return '?'
    // shape might be [null] from get_input_shapes when node has no inputs
    if (shape[0] === null) return '?'
    // it could be [[2,512]] — unwrap one level if nested
    if (Array.isArray(shape[0])) return shape[0].join('×')
    return shape.join('×')
  }
  return String(shape)
}

/* ─── Generic styled node ─── */
function StyledNode({ data, type }) {
  const colors = NODE_COLORS[type] || NODE_COLORS.moduleNode
  const shapeIn  = data.shape_in  ? shapeTag(data.shape_in[0])  : shapeTag(data.shape)
  const shapeOut = data.shape_out ? shapeTag(data.shape_out)     : null

  return (
    <div style={{
      background: colors.bg,
      border: `1.5px solid ${colors.border}`,
      borderRadius: 10,
      minWidth: 160,
      padding: '8px 14px',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      boxShadow: `0 0 18px ${colors.border}22`,
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top}
        style={{ background: colors.border, width: 8, height: 8, border: 'none' }} />

      {/* op badge */}
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
        color: colors.badge, textTransform: 'uppercase',
        display: 'block', marginBottom: 4,
      }}>
        {data.op}
      </span>

      {/* label */}
      <span style={{
        fontSize: 13, fontWeight: 600, color: colors.label,
        display: 'block', wordBreak: 'break-all', lineHeight: 1.3,
      }}>
        {data.label}
      </span>

      {/* shape pill row */}
      {(shapeIn || shapeOut) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {shapeIn && (
            <span style={pillStyle('#ffffff18', '#ffffff55')}>
              ↓ {shapeIn}
            </span>
          )}
          {shapeOut && shapeIn !== shapeOut && (
            <span style={pillStyle('#ffffff18', '#ffffff55')}>
              ↑ {shapeOut}
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom}
        style={{ background: colors.border, width: 8, height: 8, border: 'none' }} />
    </div>
  )
}

const pillStyle = (bg, color) => ({
  background: bg, color, fontSize: 10, padding: '1px 7px',
  borderRadius: 20, fontFamily: 'monospace',
})

/* ─── Custom animated edge with shape label ─── */
function ShapeEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const statusColor = data?.status === 'valid' ? '#3b82f6' : data?.status === 'mismatch' ? '#ef4444' : '#6b7280'
  const shapeLabel = data?.shape ? shapeTag(data.shape) : null

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: statusColor, strokeWidth: 1.5, opacity: 0.7 }} />
      {shapeLabel && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none',
            background: '#111827',
            border: `1px solid ${statusColor}44`,
            color: statusColor,
            fontSize: 9,
            padding: '1px 5px',
            borderRadius: 4,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}>
            {shapeLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

/* ─── Registered node/edge types (stable refs required by React Flow) ─── */
const nodeTypes = {
  inputNode:  (props) => <StyledNode {...props} type="inputNode" />,
  moduleNode: (props) => <StyledNode {...props} type="moduleNode" />,
  opNode:     (props) => <StyledNode {...props} type="opNode" />,
  outputNode: (props) => <StyledNode {...props} type="outputNode" />,
}

const edgeTypes = { shapeEdge: ShapeEdge }

export default function Canvas({ graph }) {
  const edges = useMemo(() =>
    graph.edges.map((e) => ({ ...e, type: 'shapeEdge' })),
    [graph.edges]
  )

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ReactFlow
        nodes={graph.nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#ffffff08" variant="dots" />
        <Controls
          style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
        />
        <MiniMap
          style={{ background: '#0d0d1a', border: '1px solid #333' }}
          nodeColor={(n) => NODE_COLORS[n.type]?.border ?? '#555'}
          maskColor="#00000088"
        />
      </ReactFlow>
    </div>
  )
}

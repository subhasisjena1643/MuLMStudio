/**
 * ShapeEdge.jsx
 * Custom React Flow edge that renders a shape pill centered on the wire.
 *
 * data.status: 'valid' | 'mismatch' | 'unknown'
 * data.shape:  '[2, 128, 512]'
 *
 * Wire colors:
 *   valid    → muted green  (#3D7A56)  — smoothstep path (clean right-angle bends)
 *   mismatch → brick red    (#C0392B)  — bezier path     (curve + drop-shadow glow)
 *   unknown  → border-default (#2C313C) — smoothstep path (dashed)
 *
 * Shape pill:
 *   Always rendered. Shows "[?]" in amber (#B8860B) when shape is
 *   null/undefined/"[unknown]". Shows actual shape in muted grey (#7A8194).
 */
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
} from '@xyflow/react';

const WIRE_COLORS = {
  valid:    '#3D7A56',
  mismatch: '#C0392B',
  unknown:  '#2C313C',
};

export default function ShapeEdge({
  id,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data = {},
}) {
  const status   = data.status || 'unknown';
  const color    = WIRE_COLORS[status] ?? WIRE_COLORS.unknown;
  const isMismatch = status === 'mismatch';

  // Mismatch → bezier (curved, draws attention with the glow)
  // Valid / unknown → smoothstep (clean right-angle bends, no unnecessary curves)
  const pathArgs = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [edgePath, labelX, labelY] = isMismatch
    ? getBezierPath(pathArgs)
    : getSmoothStepPath({ ...pathArgs, borderRadius: 8 });

  // Determine what label text and color to show.
  // Always render the pill — show "[?]" in amber for missing/unknown shapes.
  const shapeStr = data.shape;
  const isUnknownShape = !shapeStr || shapeStr === '[unknown]' || shapeStr === 'unknown';
  const labelText  = isUnknownShape ? '[?]' : shapeStr;
  const labelColor = isUnknownShape ? '#B8860B' : '#7A8194';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: status === 'unknown' ? '4 3' : undefined,
          filter: isMismatch
            ? 'drop-shadow(0 0 3px rgba(192, 57, 43, 0.7))'
            : undefined,
          animation: isMismatch
            ? 'mismatch-glow 2s ease-in-out infinite'
            : undefined,
        }}
      />

      {/* Shape pill — always rendered regardless of status */}
      <EdgeLabelRenderer>
        <div
          className={[
            'shape-edge-pill',
            isMismatch ? 'shape-edge-pill--mismatch' : '',
            status === 'unknown' ? 'shape-edge-pill--unknown' : '',
          ].join(' ')}
          style={{
            left:       labelX,
            top:        labelY,
            color:      labelColor,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize:   11,
            background: '#1D2027',
            border:     '1px solid #2C313C',
            borderRadius: 3,
            padding:    '1px 5px',
          }}
        >
          {labelText}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

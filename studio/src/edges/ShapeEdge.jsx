/**
 * ShapeEdge.jsx
 * Custom React Flow edge that renders a shape pill centered on the wire.
 *
 * data.status: 'valid' | 'mismatch' | 'unknown'
 * data.shape:  '[2, 128, 512]'
 *
 * Wire colors:
 *   valid    → muted green  (#3D7A56)
 *   mismatch → brick red    (#C0392B) + drop-shadow glow
 *   unknown  → border-default (#2C313C)
 */
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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
  const status = data.status || 'unknown';
  const color  = WIRE_COLORS[status] ?? WIRE_COLORS.unknown;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isMismatch = status === 'mismatch';

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

      {/* Shape pill — only render if shape data is present */}
      {data.shape && (
        <EdgeLabelRenderer>
          <div
            className={[
              'shape-edge-pill',
              isMismatch ? 'shape-edge-pill--mismatch' : '',
              status === 'unknown' ? 'shape-edge-pill--unknown' : '',
            ].join(' ')}
            style={{
              left: labelX,
              top: labelY,
              // Show only on edges that have meaningful shape info
              // (suppress for trivial/redundant edges)
            }}
          >
            {data.shape}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

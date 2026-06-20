/**
 * MlmNode.jsx — "traced" state
 * Standard block: solid border in category color, left accent strip.
 */
import { Handle, Position } from '@xyflow/react';
import { CATEGORY_COLORS, withAlpha, formatParams } from './shared';

export default function MlmNode({ data, selected }) {
  const color = CATEGORY_COLORS[data.category] || '#6B7280';
  const params = formatParams(data.params);

  return (
    <div
      className="mlm-node"
      style={{
        border: `1px solid ${withAlpha(color, 0.55)}`,
        outline: selected ? `1px solid ${color}` : 'none',
        outlineOffset: '2px',
      }}
    >
      {/* Left accent strip */}
      <div className="mlm-node__left-strip" style={{ background: color }} />

      {/* Content */}
      <div className="mlm-node__content">
        <div className="mlm-node__header">
          <div className="mlm-node__cat-dot" style={{ background: color }} />
          <div className="mlm-node__label" title={data.label}>{data.label}</div>
        </div>

        {data.shape && (
          <div className="mlm-node__shape">{data.shape}</div>
        )}

        {params.length > 0 && (
          <div className="mlm-node__params">
            {params.map((p) => (
              <span key={p} className="mlm-node__param-entry">{p}</span>
            ))}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} style={{ borderColor: withAlpha(color, 0.6) }} />
      <Handle type="source" position={Position.Bottom} style={{ borderColor: withAlpha(color, 0.6) }} />
    </div>
  );
}

/**
 * MlmUntraceableNode.jsx — "untraceable" state
 * Dashed amber border + amber "?" badge.
 * Used for modules torch.fx cannot trace statically.
 */
import { Handle, Position } from '@xyflow/react';
import { CATEGORY_COLORS, withAlpha, formatParams } from './shared';

export default function MlmUntraceableNode({ data, selected }) {
  const color = CATEGORY_COLORS[data.category] || '#6B7280';
  const params = formatParams(data.params);

  return (
    <div
      className="mlm-node"
      style={{
        border: '1px dashed #B8860B',
        outline: selected ? '1px solid #B8860B' : 'none',
        outlineOffset: '2px',
      }}
    >
      {/* Left accent strip — amber for untraceable */}
      <div className="mlm-node__left-strip" style={{ background: '#B8860B', opacity: 0.7 }} />

      {/* ? badge */}
      <div className="mlm-node__unknown-badge">?</div>

      {/* Content */}
      <div className="mlm-node__content">
        <div className="mlm-node__header">
          <div className="mlm-node__cat-dot" style={{ background: '#B8860B' }} />
          <div className="mlm-node__label" style={{ color: '#B8860B' }} title={data.label}>
            {data.label}
          </div>
        </div>

        {data.shape && (
          <div className="mlm-node__shape" style={{ color: 'var(--text-muted)' }}>
            {data.shape}
          </div>
        )}

        {params.length > 0 && (
          <div className="mlm-node__params">
            {params.map((p) => (
              <span key={p} className="mlm-node__param-entry">{p}</span>
            ))}
          </div>
        )}

        <div style={{
          fontSize: 9,
          color: '#B8860B',
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          untraceable · shapes estimated
        </div>
      </div>

      <Handle type="target" position={Position.Top} style={{ borderColor: withAlpha('#B8860B', 0.6) }} />
      <Handle type="source" position={Position.Bottom} style={{ borderColor: withAlpha('#B8860B', 0.6) }} />
    </div>
  );
}

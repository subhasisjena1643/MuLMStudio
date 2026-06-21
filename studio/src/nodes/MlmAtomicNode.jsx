/**
 * MlmAtomicNode.jsx — "atomic" state
 * Same as MlmNode but uses --border-focus (steel-blue) border
 * and renders a ◆ diamond badge in the top-right corner.
 * Double-click triggers the MHA interior drill-down.
 */
import { Handle, Position } from '@xyflow/react';
import { CATEGORY_COLORS, withAlpha, formatParams } from './shared';

export default function MlmAtomicNode({ data, selected }) {
  const color = CATEGORY_COLORS[data.category] || '#5B8DB8';
  const params = formatParams(data.params);

  return (
    <div
      className="mlm-node"
      style={{
        border: '1px solid #5B8DB8',
        outline: selected ? '1px solid #5B8DB8' : 'none',
        outlineOffset: '2px',
        cursor: 'pointer',
      }}
      title="Double-click to inspect interior"
    >
      {/* Left accent strip — always steel-blue for atomic */}
      <div className="mlm-node__left-strip" style={{ background: '#5B8DB8' }} />

      {/* ◆ atomic badge */}
      <div className="mlm-node__atomic-badge">◆</div>

      {/* Content */}
      <div className="mlm-node__content">
        <div className="mlm-node__header">
          <div className="mlm-node__cat-dot" style={{ background: '#5B8DB8' }} />
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

        <div style={{
          fontSize: 9,
          color: '#5B8DB8',
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          atomic primitive · double-click to inspect
        </div>
      </div>

      <Handle type="target" position={Position.Top} style={{ borderColor: '#5B8DB8' }} />
      <Handle type="source" position={Position.Bottom} style={{ borderColor: '#5B8DB8' }} />
    </div>
  );
}

/**
 * MlmFunctionNode.jsx — residual ops (Add, Mul, etc.)
 * Compact inline node — no left strip, just the op symbol and shape.
 */
import { Handle, Position } from '@xyflow/react';

const OP_SYMBOL = {
  Add: '+',
  Mul: '×',
  Sub: '−',
  Div: '÷',
};

export default function MlmFunctionNode({ data }) {
  const symbol = OP_SYMBOL[data.label] || data.label;

  return (
    <div className="mlm-function-node">
      <Handle type="target" position={Position.Top} />

      <span className="mlm-function-node__op">{symbol}</span>
      {data.shape && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
        }}>
          {data.shape}
        </span>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

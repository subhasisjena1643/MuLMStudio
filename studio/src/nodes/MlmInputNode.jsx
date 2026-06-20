/**
 * MlmInputNode.jsx — graph entry point (placeholder op)
 */
import { Handle, Position } from '@xyflow/react';

export default function MlmInputNode({ data }) {
  return (
    <div className="mlm-io-node">
      <div style={{ letterSpacing: '0.06em', fontSize: 10 }}>INPUT</div>
      {data.shape && <div className="mlm-io-node__shape">{data.shape}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

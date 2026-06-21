/**
 * MlmOutputNode.jsx — graph exit point (output op)
 */
import { Handle, Position } from '@xyflow/react';

export default function MlmOutputNode({ data }) {
  return (
    <div className="mlm-io-node">
      <Handle type="target" position={Position.Top} />
      <div style={{ letterSpacing: '0.06em', fontSize: 10 }}>OUTPUT</div>
      {data.shape && <div className="mlm-io-node__shape">{data.shape}</div>}
    </div>
  );
}

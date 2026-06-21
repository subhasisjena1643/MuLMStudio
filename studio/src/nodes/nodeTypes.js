/**
 * nodeTypes.js
 * Maps the type strings from graph_to_json() to React components.
 * Must match the type values set in serializer.py.
 */
import MlmNode            from './MlmNode';
import MlmAtomicNode      from './MlmAtomicNode';
import MlmInputNode       from './MlmInputNode';
import MlmOutputNode      from './MlmOutputNode';
import MlmFunctionNode    from './MlmFunctionNode';
import MlmUntraceableNode from './MlmUntraceableNode';

export const nodeTypes = {
  mlmNode:            MlmNode,
  mlmAtomicNode:      MlmAtomicNode,
  mlmInputNode:       MlmInputNode,
  mlmOutputNode:      MlmOutputNode,
  mlmFunctionNode:    MlmFunctionNode,
  mlmUntraceableNode: MlmUntraceableNode,
};

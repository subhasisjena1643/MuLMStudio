/**
 * useTracer.js
 * Hook: debounced code-change → WebSocket send → graph update.
 *
 * Contract with backend (tracer.py):
 *   send:    { code: string }
 *             (no input_shape — backend auto-detects from model structure;
 *              see _infer_dummy_input in tracer.py)
 *   receive: { status: "success", graph: { nodes, edges } }
 *          | { status: "error",   error: string }
 *
 * Reconnection: silent 1s retry on any disconnect — the connection dropping
 * must never look like a crash to the user.  The last valid graph is preserved
 * on error so the canvas is never blanked by a transient drop.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL        = 'ws://localhost:8002/ws/trace';
const DEBOUNCE_MS   = 300;
const RECONNECT_MS  = 1000;

/**
 * useTracer(onGraph, onError)
 *
 * @param {(graph: {nodes, edges}) => void} onGraph  - called on every successful trace
 * @param {(msg: string) => void}           onError  - called on trace errors (not on WS drops)
 *
 * Returns:
 *   sendCode(code: string) — call this on every Monaco onChange event.
 *   status: 'connecting' | 'open' | 'closed'
 */
export function useTracer(onGraph, onError, onLog) {
  const wsRef = useRef(null);
  const debounceRef = useRef(null);
  const reconnectRef = useRef(null);
  const mountedRef = useRef(true);   // prevent state updates after unmount
  const [status, setStatus] = useState('connecting');

  // ── stable refs so callbacks don't need to close over changing values ──────
  const onGraphRef = useRef(onGraph);
  const onErrorRef = useRef(onError);
  const onLogRef = useRef(onLog);
  useEffect(() => { onGraphRef.current = onGraph; }, [onGraph]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onLogRef.current = onLog; }, [onLog]);

  // ── WebSocket lifecycle ──────────────────────────────────────────────────────
  // Guard against React StrictMode double-mount: if a connection attempt is
  // already in-flight, don't open a second socket.
  const connectingRef = useRef(false);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (connectingRef.current) return;  // StrictMode: second mount, skip

    // Close any stale OPEN/CLOSING socket — but never close a CONNECTING one,
    // because that triggers the browser's "WebSocket closed before connection
    // established" error which is confusing and harmless but pollutes the console.
    if (wsRef.current) {
      const rs = wsRef.current.readyState;
      if (rs === WebSocket.OPEN || rs === WebSocket.CLOSING) {
        wsRef.current.onclose = null;  // suppress reconnect loop
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    connectingRef.current = true;
    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      connectingRef.current = false;
      setStatus('open');
      clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      let result;
      try {
        result = JSON.parse(event.data);
      } catch {
        return; // malformed frame — ignore silently
      }
      if (result.status === 'success' && result.graph) {
        // Stamp each edge with the shapeEdge type the canvas expects
        const graph = {
          nodes: result.graph.nodes ?? [],
          edges: (result.graph.edges ?? []).map((e) => ({
            ...e,
            type: e.type ?? 'shapeEdge',
          })),
          errors: result.graph.errors ?? [],
          model_name: result.model_name,
          mismatches: result.mismatches ?? [],
          trace_time_ms: result.trace_time_ms,
        };
        onLogRef.current?.({ type: 'terminal', text: `← RECV status:success nodes:${graph.nodes.length} edges:${graph.edges.length}` });
        onLogRef.current?.({ type: 'output', text: `Traced ${result.model_name ?? '?'} — ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${result.trace_time_ms ?? '?'}ms` });
        onGraphRef.current(graph);
      } else if (result.status === 'error') {
        // result.error is an object {phase, type, message, traceback}
        // Pass a structured object so AnalysisPanel can split headline from traceback.
        const err = result.error;
        let errorPayload;
        if (!err) {
          errorPayload = { headline: 'Trace error', traceback: null };
        } else if (typeof err === 'string') {
          errorPayload = { headline: err, traceback: null };
        } else {
          const label = err.type ? `${err.type}${err.phase ? ` (${err.phase})` : ''}` : 'Error';
          const body = err.message ?? JSON.stringify(err);
          errorPayload = {
            headline: `${label}: ${body}`,
            traceback: err.traceback ?? null,
          };
        }
        onLogRef.current?.({ type: 'terminal', text: `← RECV status:error type:${result.error?.type ?? '?'}` });
        onLogRef.current?.({ type: 'output', text: `Trace error — ${result.error?.type ?? 'unknown'}`, isError: true });
        onErrorRef.current?.(errorPayload);
      }
    };

    ws.onerror = () => {
      connectingRef.current = false;
      // onerror is always followed by onclose — let onclose handle reconnect
    };

    ws.onclose = () => {
      connectingRef.current = false;
      if (!mountedRef.current) return;
      setStatus('closed');
      // Silent 1s retry
      reconnectRef.current = setTimeout(connect, RECONNECT_MS);
    };
  }, []); // no deps — stable callback, refs handle changing values

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    connectingRef.current = false;  // ← ADD THIS LINE: reset on every mount
    connect();
    return () => {
      mountedRef.current = false;
      connectingRef.current = false;  // ← ADD THIS LINE: reset on unmount too
      clearTimeout(debounceRef.current);
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;        // ← ADD THIS LINE: null the ref on cleanup
      }
    };
  }, [connect]);

  // ── sendCode — debounced 300ms ───────────────────────────────────────────────
  const sendCode = useCallback((code, inputShape = null) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = { code };
        if (inputShape) payload.input_shape = inputShape;
        ws.send(JSON.stringify(payload));
        onLogRef.current?.({ type: 'terminal', text: `→ SEND ${JSON.stringify(payload).slice(0, 80)}…` });
      }
      // If socket is not open, the update is silently dropped —
      // the reconnect loop will re-establish, and the next keystroke
      // will trigger a new send.
    }, DEBOUNCE_MS);
  }, []);

  return { sendCode, wsStatus: status };
}

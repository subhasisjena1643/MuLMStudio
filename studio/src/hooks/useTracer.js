/**
 * useTracer.js
 * Hook: debounced code-change → WebSocket send → graph update.
 *
 * Contract with backend (tracer.py):
 *   send:    { code: string, input_shape?: [number, number, number] }
 *   receive: { status: "success", graph: { nodes, edges } }
 *          | { status: "error",   error: string }
 *
 * Reconnection: silent 1s retry on any disconnect — the connection dropping
 * must never look like a crash to the user.  The last valid graph is preserved
 * on error so the canvas is never blanked by a transient drop.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL        = 'ws://localhost:8000/ws/trace';
const DEBOUNCE_MS   = 300;
const RECONNECT_MS  = 1000;

/**
 * useTracer(onGraph, onError)
 *
 * @param {(graph: {nodes, edges}) => void} onGraph  - called on every successful trace
 * @param {(msg: string) => void}           onError  - called on trace errors (not on WS drops)
 * @param {Array}                           inputShape - [batch, seq, d_model]
 *
 * Returns:
 *   sendCode(code: string) — call this on every Monaco onChange event.
 *   status: 'connecting' | 'open' | 'closed'
 */
export function useTracer(onGraph, onError, inputShape = [2, 128, 512]) {
  const wsRef         = useRef(null);
  const debounceRef   = useRef(null);
  const reconnectRef  = useRef(null);
  const mountedRef    = useRef(true);   // prevent state updates after unmount
  const [status, setStatus] = useState('connecting');

  // ── stable refs so callbacks don't need to close over changing values ──────
  const onGraphRef  = useRef(onGraph);
  const onErrorRef  = useRef(onError);
  const shapeRef    = useRef(inputShape);
  useEffect(() => { onGraphRef.current  = onGraph;    }, [onGraph]);
  useEffect(() => { onErrorRef.current  = onError;    }, [onError]);
  useEffect(() => { shapeRef.current    = inputShape; }, [inputShape]);

  // ── WebSocket lifecycle ──────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Close any stale socket first
    if (wsRef.current) {
      wsRef.current.onclose = null;   // suppress the onclose → reconnect loop
      wsRef.current.close();
    }

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
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
        };
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
          const label    = err.type ? `${err.type}${err.phase ? ` (${err.phase})` : ''}` : 'Error';
          const body     = err.message ?? JSON.stringify(err);
          errorPayload = {
            headline:  `${label}: ${body}`,
            traceback: err.traceback ?? null,
          };
        }
        onErrorRef.current?.(errorPayload);
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('closed');
      // Silent 1s retry
      reconnectRef.current = setTimeout(connect, RECONNECT_MS);
    };
  }, []); // no deps — stable callback, refs handle changing values

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(debounceRef.current);
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // don't reconnect on teardown
        wsRef.current.close();
      }
    };
  }, [connect]);

  // ── sendCode — debounced 300ms ───────────────────────────────────────────────
  const sendCode = useCallback((code) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          code,
          input_shape: shapeRef.current,
        }));
      }
      // If socket is not open, the update is silently dropped —
      // the reconnect loop will re-establish, and the next keystroke
      // will trigger a new send.
    }, DEBOUNCE_MS);
  }, []);

  return { sendCode, wsStatus: status };
}

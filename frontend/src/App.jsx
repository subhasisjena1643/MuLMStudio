import { useState, useCallback, useEffect, useRef } from 'react'
import Canvas from './components/Canvas'
import NotebookPanel from './components/NotebookPanel'
import { useTracer } from './hooks/useTracer'

const STARTER_CODE = `import torch
import torch.nn as nn

class TransformerBlock(nn.Module):
    def __init__(self):
        super().__init__()
        self.attention = nn.MultiheadAttention(512, 8, batch_first=True)
        self.norm1 = nn.LayerNorm(512)
        self.ff = nn.Sequential(nn.Linear(512, 2048), nn.ReLU(), nn.Linear(2048, 512))
        self.norm2 = nn.LayerNorm(512)

    def forward(self, x):
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + attn_out)
        x = self.norm2(x + self.ff(x))
        return x
`

/* Simple vertical auto-layout — positions nodes top-to-bottom with centre-x */
function autoLayout(nodes) {
  const NODE_H = 110
  const CENTER_X = 300
  return nodes.map((n, i) => ({
    ...n,
    position: { x: CENTER_X, y: i * NODE_H },
  }))
}

/* Compact status indicator in header */
function StatusDot({ status }) {
  const cfg = {
    connected:    { color: '#22c55e', label: 'connected' },
    tracing:      { color: '#f59e0b', label: 'tracing…' },
    error:        { color: '#ef4444', label: 'error' },
    disconnected: { color: '#6b7280', label: 'disconnected' },
  }[status] ?? { color: '#6b7280', label: status }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: cfg.color }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: cfg.color,
        boxShadow: `0 0 6px ${cfg.color}`,
        display: 'inline-block',
        animation: status === 'tracing' ? 'pulse 1s ease-in-out infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  )
}

export default function App() {
  const [code, setCode]   = useState(STARTER_CODE)
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [error, setError] = useState(null)
  const [wsStatus, setWsStatus] = useState('disconnected')
  const nodeCount = graph.nodes.length

  const handleGraphUpdate = useCallback((newGraph) => {
    const positioned = autoLayout(newGraph.nodes)
    setGraph({ nodes: positioned, edges: newGraph.edges })
    setError(null)
    setWsStatus('connected')
  }, [])

  const handleError = useCallback((msg) => {
    setError(msg)
    setWsStatus('error')
    // recover status after 2 s if nothing else happens
    setTimeout(() => setWsStatus((s) => s === 'error' ? 'connected' : s), 2000)
  }, [])

  useTracer(code, handleGraphUpdate, handleError)

  // mark as "tracing" briefly on every code change
  const tracingTimer = useRef(null)
  const handleCodeChange = (val) => {
    setCode(val)
    setWsStatus('tracing')
    clearTimeout(tracingTimer.current)
    tracingTimer.current = setTimeout(() => {
      setWsStatus((s) => s === 'tracing' ? 'connected' : s)
    }, 600)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b0b14', color: '#e2e8f0' }}>

      {/* ── Top bar ── */}
      <header style={{
        height: 44,
        background: 'linear-gradient(90deg, #0f0f1e 0%, #111827 100%)',
        borderBottom: '1px solid #1f2937',
        display: 'flex', alignItems: 'center', padding: '0 18px', gap: 14,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>µLM Studio</span>
          <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>v0.1</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: '#1f2937' }} />

        {/* Node count badge */}
        {nodeCount > 0 && (
          <span style={{
            fontSize: 11, color: '#93c5fd',
            background: '#1e3a5f', border: '1px solid #3b82f630',
            borderRadius: 20, padding: '1px 10px',
          }}>
            {nodeCount} nodes
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        <StatusDot status={wsStatus} />
      </header>

      {/* ── Main split ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Canvas — left 60% */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {graph.nodes.length === 0 ? (
            <EmptyCanvas />
          ) : (
            <Canvas graph={graph} />
          )}
        </div>

        {/* Resizer visual */}
        <div style={{ width: 1, background: '#1f2937', flexShrink: 0 }} />

        {/* Notebook — right 40% */}
        <div style={{ width: '40%', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <NotebookPanel code={code} onChange={handleCodeChange} />
        </div>
      </div>

      {/* ── Error bar ── */}
      {error && (
        <div style={{
          padding: '0 18px',
          height: 36, display: 'flex', alignItems: 'center',
          background: '#1a0a0a',
          borderTop: '1px solid #7f1d1d',
          color: '#fca5a5', fontSize: 12, gap: 8, flexShrink: 0,
        }}>
          <span style={{ color: '#ef4444', fontSize: 14 }}>⚠</span>
          <span style={{ fontFamily: 'monospace', flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}
          >✕</button>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .react-flow__controls button {
          background: #1a1a2e !important;
          border-color: #2d3748 !important;
          color: #a0aec0 !important;
        }
        .react-flow__controls button:hover {
          background: #2d3748 !important;
        }
      `}</style>
    </div>
  )
}

function EmptyCanvas() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#374151', userSelect: 'none', gap: 12,
    }}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        <line x1="10" y1="6.5" x2="14" y2="6.5"/>
        <line x1="10" y1="17.5" x2="14" y2="17.5"/>
        <line x1="6.5" y1="10" x2="6.5" y2="14"/>
        <line x1="17.5" y1="10" x2="17.5" y2="14"/>
      </svg>
      <span style={{ fontSize: 14, letterSpacing: '0.04em' }}>
        Paste a PyTorch model → graph appears here
      </span>
      <span style={{ fontSize: 11, color: '#1f2937' }}>
        Waiting for backend · ws://localhost:8001
      </span>
    </div>
  )
}

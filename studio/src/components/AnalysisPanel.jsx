/**
 * AnalysisPanel.jsx
 * Bottom panel — PROBLEMS | OUTPUT | DEBUG | TERMINAL tabs.
 *
 * Each problem entry shows:
 *   [ERR/WARN badge]  [one-line headline message]
 *                     [Show details ↓]   ← text toggle, collapsed by default
 *                     [full traceback]   ← expands on click, JetBrains Mono, muted
 *
 * problem shape:
 *   { id, severity: 'error'|'warn', message: string | { headline, traceback } }
 */
import { useState } from 'react';

const TABS = ['PROBLEMS', 'OUTPUT', 'DEBUG', 'TERMINAL'];

export default function AnalysisPanel({ problems = [], outputLog = [], terminalLog = [], selectedNode = null }) {
  const [activeTab, setActiveTab] = useState('PROBLEMS');

  return (
    <div className="analysis-panel">
      {/* Tab bar */}
      <div className="analysis-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`analysis-panel__tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'PROBLEMS' && problems.length > 0 && (
              <span className="analysis-panel__badge">{problems.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="analysis-panel__body">
        {activeTab === 'PROBLEMS' && (
          problems.length === 0 ? (
            <div className="analysis-panel__empty">
              <div className="analysis-panel__ok-dot" />
              No problems detected
            </div>
          ) : (
            problems.map((p, i) => (
              <ProblemRow key={p.id ?? i} problem={p} />
            ))
          )
        )}
        {activeTab === 'OUTPUT' && (
          outputLog.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              — ready —
            </div>
          ) : (
            <div style={{ fontFamily: "'JetBrains Mono','Consolas',monospace", fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {outputLog.map((e) => (
                <div key={e.id} style={{ color: e.isError ? 'var(--status-error)' : 'var(--text-muted)', whiteSpace: 'pre', lineHeight: 1.5 }}>
                  {e.text}
                </div>
              ))}
            </div>
          )
        )}
        {activeTab === 'DEBUG' && (
          selectedNode ? (
            <div>
              <div style={{ fontFamily: 'Inter, var(--font-ui), sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                Selected: {selectedNode.data?.label ?? selectedNode.id}
              </div>
              <pre style={{
                fontFamily: "'JetBrains Mono','Consolas',monospace",
                fontSize: 11,
                color: 'var(--text-muted)',
                background: 'var(--bg-base)',
                padding: 8,
                margin: 0,
                borderRadius: 2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6,
                overflowX: 'auto',
              }}>
                {JSON.stringify(selectedNode.data, null, 2)}
              </pre>
            </div>
          ) : (
            <div style={{ fontFamily: 'Inter, var(--font-ui), sans-serif', fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}>
              Select a block to inspect its properties.
            </div>
          )
        )}
        {activeTab === 'TERMINAL' && (
          terminalLog.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              — no messages yet —
            </div>
          ) : (
            <div style={{ fontFamily: "'JetBrains Mono','Consolas',monospace", fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {terminalLog.map((e) => (
                <div key={e.id} style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {e.text}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── ProblemRow ────────────────────────────────────────────────────────────────

function ProblemRow({ problem }) {
  const [expanded, setExpanded] = useState(false);
  const isError = problem.severity === 'error';

  if (problem.type === 'shape_mismatch') {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #2C313C',
          fontSize: 12,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#1D2027'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#C0392B', fontWeight: 600, fontSize: 13 }}>⚠</span>
            <span style={{
              color: '#E4E6EB',
              fontFamily: 'Inter, var(--font-sans), sans-serif',
              fontWeight: 500,
              fontSize: 13,
            }}>
              {problem.headline}
            </span>
          </div>
          <button
            onClick={() => console.log('Explain mismatch:', problem)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-accent, #5B8DB8)',
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            Explain ↗
          </button>
        </div>

        <div style={{ paddingLeft: 18, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Shapes comparison */}
          <div style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', var(--font-mono), monospace",
            fontSize: 12,
            color: '#E4E6EB',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>{problem.source_shape}</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span>{problem.target_shape}</span>
          </div>

          {/* Detail */}
          <div style={{
            fontFamily: 'Inter, var(--font-sans), sans-serif',
            fontSize: 12,
            color: '#7A8194',
            lineHeight: 1.4,
          }}>
            {problem.detail}
          </div>

          {/* Suggestion */}
          <div style={{
            fontFamily: 'Inter, var(--font-sans), sans-serif',
            fontSize: 12,
            color: '#7A8194',
            lineHeight: 1.4,
            fontStyle: 'italic',
          }}>
            {problem.suggestion}
          </div>
        </div>
      </div>
    );
  }

  // message can be a plain string (from codeGen / demo) or
  // a structured { headline, traceback } object (from useTracer live errors).
  const msg = problem.message;
  let headline, traceback;
  if (msg && typeof msg === 'object') {
    headline  = msg.headline  ?? JSON.stringify(msg);
    traceback = msg.traceback ?? null;
  } else {
    // Plain string — treat whole thing as headline, no traceback
    headline  = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
    traceback = null;
  }

  const hasDetails = Boolean(traceback);

  return (
    <div style={{
      padding: '6px 0',
      borderBottom: '1px solid var(--border-default)',
      fontSize: 11,
    }}>
      {/* Badge + headline row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* ERR / WARN badge */}
        <span style={{
          color:       isError ? 'var(--status-error)' : 'var(--status-unknown)',
          fontWeight:  600,
          flexShrink:  0,
          fontFamily:  'var(--font-mono)',
          fontSize:    10,
          lineHeight:  '18px',   // vertically align with text
        }}>
          {isError ? 'ERR' : 'WARN'}
        </span>

        {/* Headline message — single line with word-break for long identifiers */}
        <span style={{
          color:      'var(--text-primary)',
          flex:       1,
          whiteSpace: 'pre-wrap',
          wordBreak:  'break-word',
          lineHeight: 1.5,
        }}>
          {headline}
        </span>
      </div>

      {/* "Show details" toggle — only when traceback exists */}
      {hasDetails && (
        <div style={{ paddingLeft: 32, marginTop: 3 }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background:    'none',
              border:        'none',
              padding:       0,
              cursor:        'pointer',
              color:         'var(--text-muted)',
              fontFamily:    'var(--font-sans)',
              fontWeight:    400,
              fontSize:      10,
              letterSpacing: '0.01em',
              userSelect:    'none',
            }}
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>

          {/* Expanded traceback */}
          {expanded && (
            <pre style={{
              margin:      '6px 0 2px',
              padding:     0,
              fontFamily:  "'JetBrains Mono', 'Fira Code', var(--font-mono), monospace",
              fontSize:    10,
              color:       'var(--text-muted)',
              whiteSpace:  'pre-wrap',
              wordBreak:   'break-word',
              lineHeight:  1.6,
              overflowX:   'auto',
            }}>
              {traceback}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

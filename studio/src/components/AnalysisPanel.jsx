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

export default function AnalysisPanel({ problems = [] }) {
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
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            — ready —
          </div>
        )}
        {(activeTab === 'DEBUG' || activeTab === 'TERMINAL') && (
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {activeTab.toLowerCase()} output will appear here
          </div>
        )}
      </div>
    </div>
  );
}

// ── ProblemRow ────────────────────────────────────────────────────────────────

function ProblemRow({ problem }) {
  const [expanded, setExpanded] = useState(false);
  const isError = problem.severity === 'error';

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

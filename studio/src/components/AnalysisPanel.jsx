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
import { useClaude } from '../hooks/useClaude';

const TABS = ['PROBLEMS', 'CHECKS', 'OUTPUT', 'DEBUG', 'TERMINAL'];

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
            <>
              <div style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                padding: '4px 10px',
                borderBottom: '1px solid var(--border-default)',
                fontFamily: 'var(--font-mono)'
              }}>
                Errors are shown per-block. Downstream effects are not yet computed.
              </div>
              {problems.map((p, i) => (
                <ProblemRow key={p.id ?? i} problem={p} />
              ))}
            </>
          )
        )}
        {activeTab === 'CHECKS' && (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Status badges */}
            <div style={{
              display: 'flex', gap: '12px', paddingBottom: '8px',
              borderBottom: '1px solid var(--border-default)',
              fontSize: '11px', fontFamily: 'var(--font-mono)'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Graph: <span style={{ color: '#3D7A56' }}>clean</span>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                Values: <span style={{ opacity: 0.4 }}>not yet checked</span>
              </span>
            </div>

            {/* Check cards */}
            {[
              {
                name: 'Overfit-one-batch',
                status: 'off',
                reason: 'Declare a loss and an optimizer to enable this check. µLM will not invent a training loop for you.'
              },
              {
                name: 'Loss-at-init',
                status: 'off',
                reason: 'Requires a declared loss function and data sample.'
              },
              {
                name: 'Reproducibility',
                status: 'off',
                reason: 'Requires a declared training step to seed and compare.'
              }
            ].map((check, i) => (
              <div key={i} style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-default)',
                borderRadius: '3px',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{
                    display: 'inline-block', width: '8px', height: '8px',
                    borderRadius: '2px', background: '#555'
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {check.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {check.status}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', lineHeight: '1.4' }}>
                  ■ {check.reason}
                </div>
              </div>
            ))}

            <div style={{
              fontSize: '10px', color: 'var(--text-muted)',
              fontStyle: 'italic', marginTop: '4px'
            }}>
              Value-level checks execute your real code — they are unaffected by
              yellow (partially modeled) regions on the canvas.
            </div>
          </div>
        )}
        {activeTab === 'OUTPUT' && (
          outputLog.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              — ready —
            </div>
          ) : (
            <div style={{ fontFamily: "'JetBrains Mono','Consolas',monospace", fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {outputLog.map((e) => (
                <div key={e.id} style={{ color: e.isError ? 'var(--status-error)' : 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
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
  const { explainMismatch, isLoading: claudeLoading } = useClaude();
  const [explanations, setExplanations] = useState({});
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
            onClick={async () => {
              const key = problem.edge_id || problem.headline || problem.id;
              setExplanations(prev => ({ ...prev, [key]: { loading: true } }));
              const result = await explainMismatch(problem);
              setExplanations(prev => ({ ...prev, [key]: { loading: false, text: result.text } }));
            }}
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
            {claudeLoading ? '⏳ Asking Claude…' : 'Ask Claude ↗'}
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

          {/* Claude diagnosis */}
          {explanations[problem.edge_id || problem.headline || problem.id] && (
            <div style={{
              marginTop: '6px',
              padding: '8px 10px',
              background: 'rgba(61, 122, 86, 0.08)',
              border: '1px solid rgba(61, 122, 86, 0.2)',
              borderRadius: '3px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {explanations[problem.edge_id || problem.headline || problem.id].loading
                ? '⏳ Claude is analyzing the shape mismatch…'
                : explanations[problem.edge_id || problem.headline || problem.id].text}
            </div>
          )}
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

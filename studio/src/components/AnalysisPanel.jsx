/**
 * AnalysisPanel.jsx
 * Bottom panel — PROBLEMS | CHECKS | OUTPUT | DEBUG | TERMINAL tabs.
 *
 * Each problem entry shows:
 *   [ERR/WARN badge]  [one-line headline message]
 *                     [Show details ↓]   ← text toggle, collapsed by default
 *                     [full traceback]   ← expands on click, JetBrains Mono, muted
 *   Claude diagnosis is fetched automatically once per distinct problem
 *   (both shape_mismatch and generic trace errors) — see ProblemRow.
 *
 * problem shape:
 *   { id, severity: 'error'|'warn', message: string | { headline, traceback } }
 *
 * checks shape (from the backend, via useTracer → App.jsx; null until a real
 * training-signal trace runs, or always null in DEMO_MODE):
 *   { overfit_one_batch: {status, reason}, loss_at_init: {...}, reproducibility: {...} }
 *   status ∈ 'off' | 'pass' | 'fail'
 */
import { useState, useEffect } from 'react';
import { useClaude } from '../hooks/useClaude';

const TABS = ['PROBLEMS', 'CHECKS', 'OUTPUT', 'DEBUG', 'TERMINAL'];

const CHECK_DEFS = [
  {
    key: 'overfit_one_batch',
    name: 'Overfit-one-batch',
    reason: 'Declare a loss and an optimizer to enable this check. µLM will not invent a training loop for you.',
  },
  {
    key: 'loss_at_init',
    name: 'Loss-at-init',
    reason: 'Requires a declared loss function and data sample.',
  },
  {
    key: 'reproducibility',
    name: 'Reproducibility',
    reason: 'Requires a declared training step to seed and compare.',
  },
];

const STATUS_COLOR = {
  off: '#555',
  pass: '#3D7A56',
  fail: '#C0392B',
};

export default function AnalysisPanel({ problems = [], outputLog = [], terminalLog = [], selectedNode = null, checks = null }) {
  const [activeTab, setActiveTab] = useState('PROBLEMS');

  const ranChecks = checks ? Object.values(checks).filter((c) => c.status === 'pass' || c.status === 'fail') : [];
  const passedChecks = ranChecks.filter((c) => c.status === 'pass');
  const valuesLabel = ranChecks.length > 0 ? `${passedChecks.length}/${ranChecks.length} passing` : 'not yet checked';
  const valuesColor = ranChecks.length === 0 ? undefined : (passedChecks.length === ranChecks.length ? '#3D7A56' : '#C0392B');

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
                Values: <span style={{ color: valuesColor, opacity: valuesColor ? 1 : 0.4 }}>{valuesLabel}</span>
              </span>
            </div>

            {/* Check cards */}
            {CHECK_DEFS.map((def) => {
              const result = checks?.[def.key];
              const status = result?.status ?? 'off';
              const reason = result?.reason ?? def.reason;
              return (
                <div key={def.key} style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '3px',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{
                      display: 'inline-block', width: '8px', height: '8px',
                      borderRadius: '2px', background: STATUS_COLOR[status] ?? '#555'
                    }} />
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {def.name}
                    </span>
                    <span style={{ color: STATUS_COLOR[status] ?? 'var(--text-muted)', marginLeft: 'auto', textTransform: status === 'off' ? 'none' : 'uppercase', fontWeight: status === 'off' ? 400 : 600 }}>
                      {status}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', lineHeight: '1.4' }}>
                    ■ {reason}
                  </div>
                </div>
              );
            })}

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
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '8px 10px' }}>
              — ready —
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px' }}>
              {outputLog.map((e) => (
                e.kind === 'claude' ? (
                  <div key={e.id} style={{
                    fontFamily: 'Inter, var(--font-sans), sans-serif',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    lineHeight: 1.6,
                    background: 'rgba(91, 141, 184, 0.06)',
                    border: '1px solid rgba(91, 141, 184, 0.18)',
                    borderRadius: 4,
                    padding: '10px 12px',
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                      color: 'var(--text-accent, #5B8DB8)', marginBottom: 6,
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontFamily: 'Inter, var(--font-sans), sans-serif',
                    }}>
                      <span>🤖</span> Claude Model Map
                    </div>
                    {renderClaudeText(e.text)}
                  </div>
                ) : (
                  <div key={e.id} style={{
                    color: e.isError ? 'var(--status-error)' : 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono','Consolas',monospace",
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                    padding: '2px 4px',
                  }}>
                    {e.text}
                  </div>
                )
              ))}
            </div>
          )
        )}
        {activeTab === 'DEBUG' && (
          <DebugPanelBody selectedNode={selectedNode} />
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

// ── Rich-text rendering for Claude output ──────────────────────────────────────
// Claude's replies sometimes carry light markdown (**bold**, `code`). Render
// just enough of it to stop that markup from showing up as literal asterisks
// and backticks — this is not a general markdown renderer.

function renderClaudeInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((p) => p !== '');
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`${keyPrefix}-${i}`} style={{
          fontFamily: "'JetBrains Mono','Consolas',monospace",
          fontSize: '0.92em',
          background: 'rgba(255,255,255,0.07)',
          padding: '1px 4px',
          borderRadius: 2,
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderClaudeText(text) {
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim() !== '');
  if (paragraphs.length === 0) return null;
  return paragraphs.map((para, i) => (
    <p key={i} style={{ margin: i === 0 ? '0 0 6px' : '6px 0 0', padding: 0 }}>
      {renderClaudeInline(para, i)}
    </p>
  ));
}

// ── DebugPanelBody ────────────────────────────────────────────────────────────
// Powered by Claude: auto-explains the selected block in plain English.
// Raw JSON stays available behind a "Show raw data" toggle for power users.

function DebugPanelBody({ selectedNode }) {
  const { explainNode } = useClaude();
  // Only ever set from the resolved promise below — "loading" is derived at
  // render time by comparing result.nodeId to the current selection, rather
  // than tracked as its own state flip inside the effect.
  const [result, setResult] = useState(null); // { nodeId, text }
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!selectedNode) return undefined;
    let cancelled = false;
    explainNode(selectedNode.data).then((res) => {
      if (!cancelled) setResult({ nodeId: selectedNode.id, text: res.text });
    });
    return () => { cancelled = true; };
    // Re-fetch only when the selected block changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return (
      <div style={{ fontFamily: 'Inter, var(--font-ui), sans-serif', fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}>
        Select a block to inspect its properties.
      </div>
    );
  }

  const current = result?.nodeId === selectedNode.id ? result : null;

  return (
    <div>
      <div style={{ fontFamily: 'Inter, var(--font-ui), sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
        Selected: {selectedNode.data?.label ?? selectedNode.id}
      </div>

      <div style={{
        fontFamily: 'Inter, var(--font-sans), sans-serif',
        fontSize: 12,
        color: 'var(--text-primary)',
        lineHeight: 1.6,
        background: 'rgba(91, 141, 184, 0.06)',
        border: '1px solid rgba(91, 141, 184, 0.18)',
        borderRadius: 4,
        padding: '10px 12px',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: 'var(--text-accent, #5B8DB8)', marginBottom: 6,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>🤖</span> Claude
        </div>
        {!current ? '⏳ Reading this block…' : renderClaudeText(current.text)}
      </div>

      <button
        onClick={() => setShowRaw((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
          fontSize: 10,
          letterSpacing: '0.01em',
          userSelect: 'none',
        }}
      >
        {showRaw ? 'Hide raw data' : 'Show raw data'}
      </button>

      {showRaw && (
        <pre style={{
          fontFamily: "'JetBrains Mono','Consolas',monospace",
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-base)',
          padding: 8,
          margin: '6px 0 0',
          borderRadius: 2,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.6,
          overflowX: 'auto',
        }}>
          {JSON.stringify(selectedNode.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── ProblemRow ────────────────────────────────────────────────────────────────
// Claude diagnosis is fetched automatically once per distinct problem (keyed
// upstream by a stable id — see App.jsx's allProblems construction), covering
// both shape_mismatch rows and generic trace-error rows. A manual "Re-ask"
// affordance re-fetches on demand.

function ProblemRow({ problem }) {
  const [expanded, setExpanded] = useState(false);
  const { explainMismatch, explainError } = useClaude();
  // null = no answer for the current `attempt` yet (i.e. loading). Only ever
  // set from a resolved promise — see the effect below — so a fresh "attempt"
  // is how we ask for a re-fetch, rather than setting a loading flag directly.
  const [claudeText, setClaudeText] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const isError = problem.severity === 'error';
  const isMismatch = problem.type === 'shape_mismatch';

  // message can be a plain string (from codeGen / demo) or
  // a structured { headline, traceback } object (from useTracer live errors).
  const msg = problem.message;
  let headline, traceback;
  if (isMismatch) {
    headline = problem.headline;
    traceback = null;
  } else if (msg && typeof msg === 'object') {
    headline  = msg.headline  ?? JSON.stringify(msg);
    traceback = msg.traceback ?? null;
  } else {
    headline  = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
    traceback = null;
  }

  // Auto-fires once when this row first mounts (attempt starts at 0), and
  // again whenever the "Re-ask" button bumps `attempt`. React reuses the
  // same component instance across re-renders as long as the parent's key
  // for this problem is unchanged, so this does not re-fire on every
  // debounced retrace of an already-explained problem — only when a
  // genuinely new problem (new key) appears or a re-ask is requested.
  useEffect(() => {
    let cancelled = false;
    const run = isMismatch ? explainMismatch(problem) : explainError(headline, traceback);
    run.then((result) => { if (!cancelled) setClaudeText(result.text); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const claudeCard = (
    <div style={{
      marginTop: '6px',
      padding: '8px 10px',
      background: 'rgba(91, 141, 184, 0.06)',
      border: '1px solid rgba(91, 141, 184, 0.18)',
      borderRadius: '3px',
      fontSize: '12px',
      fontFamily: 'Inter, var(--font-sans), sans-serif',
      color: 'var(--text-primary)',
      lineHeight: '1.6',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: claudeText === null ? 0 : 4,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: 'var(--text-accent, #5B8DB8)', display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>🤖</span> Claude
        </span>
        <button
          onClick={() => { setClaudeText(null); setAttempt((a) => a + 1); }}
          title="Re-ask Claude"
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto', lineHeight: 1,
          }}
        >
          ↻
        </button>
      </div>
      {claudeText === null ? '⏳ Analyzing…' : renderClaudeText(claudeText)}
    </div>
  );

  if (isMismatch) {
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

          {claudeCard}
        </div>
      </div>
    );
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
          fontFamily: "'JetBrains Mono', 'Fira Code', var(--font-mono), monospace",
        }}>
          {headline}
        </span>
      </div>

      <div style={{ paddingLeft: 32 }}>
        {claudeCard}

        {/* "Show details" toggle — only when traceback exists */}
        {hasDetails && (
          <div style={{ marginTop: 6 }}>
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
              {expanded ? 'Hide raw traceback' : 'Show raw traceback'}
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
    </div>
  );
}

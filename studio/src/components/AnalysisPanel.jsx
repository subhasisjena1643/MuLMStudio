/**
 * AnalysisPanel.jsx
 * Bottom panel — PROBLEMS | OUTPUT | DEBUG | TERMINAL tabs.
 * PROBLEMS active by default. Stub: 0 problems for now.
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
              <ProblemRow key={i} problem={p} />
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

function ProblemRow({ problem }) {
  const isError = problem.severity === 'error';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '5px 0',
      borderBottom: '1px solid var(--border-default)',
      fontSize: 11,
    }}>
      <span style={{
        color: isError ? 'var(--status-error)' : 'var(--status-unknown)',
        fontWeight: 600,
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
      }}>
        {isError ? 'ERR' : 'WARN'}
      </span>
      <span style={{ color: 'var(--text-primary)', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {typeof problem.message === 'string' ? problem.message : JSON.stringify(problem.message, null, 2)}
        </span>
      {problem.node && (
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {problem.node}
        </span>
      )}
    </div>
  );
}

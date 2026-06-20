import Editor from '@monaco-editor/react'

export default function NotebookPanel({ code, onChange }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        background: '#111827',
        borderBottom: '1px solid #1f2937',
        gap: 8,
      }}>
        <span style={{
          fontSize: 11,
          color: '#60a5fa',
          background: '#1e3a5f',
          border: '1px solid #3b82f640',
          borderRadius: 4,
          padding: '2px 10px',
          fontFamily: 'monospace',
          letterSpacing: '0.03em',
        }}>
          model.py
        </span>
        <span style={{ fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>
          Python · torch.fx
        </span>
      </div>

      {/* Monaco editor */}
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(val) => onChange(val ?? '')}
          options={{
            fontSize: 13,
            fontFamily: '"Fira Code", "Cascadia Code", monospace',
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            renderLineHighlight: 'gutter',
            padding: { top: 12 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  )
}

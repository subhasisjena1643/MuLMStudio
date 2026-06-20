/**
 * NotebookPanel.jsx
 * Right-panel top section — Monaco editor with JetBrains Mono, custom mulm-dark theme.
 * Pre-filled with stub TransformerEncoderBlock code.
 * onChange fires on every keystroke — drives WebSocket via useTracer.
 *
 * KEY FIX: uses defaultValue (not value) so Monaco is uncontrolled.
 * External code changes (demo toggle, canvas codegen) are pushed via
 * editorRef.setValue() in a useEffect, avoiding full re-renders.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';

// Configure Monaco to load from CDN (default) — no bundler config needed
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' } });

/** µLM-dark Monaco theme — matches our CSS custom properties exactly */
const MULM_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '4A5568', fontStyle: 'italic' },
    { token: 'keyword', foreground: '5B8DB8' },  // steel-blue for keywords
    { token: 'string', foreground: '5A9B7C' },  // muted sage for strings
    { token: 'number', foreground: 'B8860B' },  // amber for numbers
    { token: 'type.identifier', foreground: 'E4E6EB' },
    { token: 'identifier', foreground: 'E4E6EB' },
  ],
  colors: {
    'editor.background': '#1D2027',
    'editor.foreground': '#E4E6EB',
    'editor.lineHighlightBackground': '#1A1D24',
    'editor.selectionBackground': '#2C313C',
    'editor.inactiveSelectionBackground': '#252830',
    'editorLineNumber.foreground': '#4A5568',
    'editorLineNumber.activeForeground': '#7A8194',
    'editorCursor.foreground': '#5B8DB8',
    'editorIndentGuide.background': '#2C313C',
    'editorIndentGuide.activeBackground': '#3C424F',
    'editorGutter.background': '#1A1D24',
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#2C313C80',
    'scrollbarSlider.hoverBackground': '#3C424F80',
    'editorWidget.background': '#1D2027',
    'editorSuggestWidget.background': '#1D2027',
    'editorSuggestWidget.border': '#2C313C',
  },
};

import { TEMPLATES } from '../data/templates';
export default function NotebookPanel({
  code,
  onChange,
  codeSource,
  onEditorMount,
  selectedTemplate,
  onTemplateChange
}) {
  const editorRef = useRef(null);
  const prevCodeRef = useRef(code);
  const fileInputRef  = useRef(null);
  const statusTimerRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null); // null | string

  // ── File upload handler ────────────────────────────────────────────────────
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name;
    const ext  = name.slice(name.lastIndexOf('.')).toLowerCase();

    // Show a timed status message (success or error)
    const showStatus = (msg) => {
      setUploadStatus(msg);
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setUploadStatus(null), 2000);
    };

    if (ext !== '.py' && ext !== '.ipynb') {
      showStatus('Only .py and .ipynb supported');
      return;
    }

    const reader = new FileReader();

    reader.onload = (ev) => {
      let content = ev.target.result;

      if (ext === '.ipynb') {
        try {
          const nb    = JSON.parse(content);
          const cells = nb.cells ?? nb.worksheets?.[0]?.cells ?? [];
          content = cells
            .filter((c) => c.cell_type === 'code')
            .map((c) => (Array.isArray(c.source) ? c.source.join('') : c.source))
            .join('\n\n');
        } catch {
          showStatus('Failed to parse .ipynb');
          return;
        }
      }

      // Push into Monaco imperatively — keeps cursor stable, fires onChange
      // which triggers the existing WS debounce naturally.
      const editor = editorRef.current;
      if (editor) {
        editor.setValue(content);
      }

      showStatus(`Loaded: ${name}`);
    };

    reader.onerror = () => showStatus('Read error — try again');
    reader.readAsText(file);
  }, []);

  // When the code prop changes from an EXTERNAL source (not user typing),
  // push it into Monaco imperatively. This covers:
  //   - demo mode toggle (Ctrl+Shift+E)
  //   - canvas-mode codegen
  // We skip when codeSource === 'user' because the user is already typing
  // inside Monaco — pushing the value back would reset their cursor.
  useEffect(() => {
    if (codeSource === 'user') return;
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== code) {
      const pos = editor.getPosition();
      editor.setValue(code ?? '');
      if (pos) editor.setPosition(pos);
    }
  }, [code, codeSource]);

  return (
    <div className="notebook-panel">
      {/* Header */}
      <div className="notebook-panel__header">
        <span className="notebook-panel__header-label">Notebook</span>

        {/* 2-second status message (upload feedback) */}
        {uploadStatus && (
          <span style={{
            fontSize: 11,
            fontFamily: 'Inter, var(--font-ui), sans-serif',
            fontWeight: 400,
            color: '#7A8194',
            flexShrink: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 180,
          }}>
            {uploadStatus}
          </span>
        )}

        <select
          value={selectedTemplate}
          onChange={(e) => onTemplateChange(e.target.value)}
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '3px',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="tissue_llm">Tissue LLM</option>
          <option value="transformer">Transformer</option>
          <option value="cnn">CNN</option>
        </select>

        {/* Hidden native file input — triggered by the Upload button below */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".py,.ipynb"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          onClick={(e) => { e.target.value = ''; }}
        />

        {/* Upload button — opens the hidden input */}
        <button
          className="notebook-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload .py or .ipynb file"
        >
          Upload
        </button>

        <div
          className="notebook-panel__sync-dot"
          title="Synced with canvas"
        />
      </div>

      {/* Monaco editor — uncontrolled via defaultValue */}
      <div className="notebook-panel__editor">
        <Editor
          height="100%"
          language="python"
          defaultValue={code}
          onChange={onChange}
          onMount={(editor) => {
            editorRef.current = editor;
            onEditorMount?.(editor);
          }}
          theme="mulm-dark"
          beforeMount={(monaco) => {
            // Define the custom theme once before the editor mounts
            monaco.editor.defineTheme('mulm-dark', MULM_THEME);
          }}
          options={{
            fontFamily: '"JetBrains Mono", "Consolas", monospace',
            fontSize: 12,
            lineHeight: 20,
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'line',
            renderWhitespace: 'none',
            smoothScrolling: true,
            cursorBlinking: 'phase',
            cursorSmoothCaretAnimation: 'on',
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'off',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
            // Disable most decorative features — this is an instrument, not an IDE
            folding: false,
            glyphMargin: true,
            lightbulb: { enabled: 'off' },
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            parameterHints: { enabled: false },
          }}
        />
      </div>
    </div>
  );
}

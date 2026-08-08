/**
 * config.js
 * Single source of truth for where the FastAPI backend lives.
 *
 * Local dev: defaults to http://localhost:8002 — no .env needed.
 * Deployed:  set VITE_BACKEND_URL to the backend's public URL (e.g. a
 *            Render/Railway/Fly.io deployment of tracer.py). The frontend
 *            never needs the Anthropic API key itself — see useClaude.js,
 *            which calls this backend's /claude/messages proxy instead of
 *            api.anthropic.com directly.
 */

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8002';

// Strip any trailing slash so callers can safely do `${BACKEND_URL}/path`.
export const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');

// http(s):// -> ws(s):// — regex only touches the "http" prefix, so
// "https://" correctly becomes "wss://" and "http://" becomes "ws://".
export const WS_TRACE_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws/trace';

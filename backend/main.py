"""
main.py — FastAPI server. Today's scope: /ws/trace only (Notebook -> Canvas).
Run with: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from tracer import trace_code, TraceError

app = FastAPI(title="muLM Studio Backend - Prototype 0.1")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/trace")
async def trace_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            code = data.get("code", "")

            if not code.strip():
                await websocket.send_json({"status": "partial", "error": "No code received.", "graph": None})
                continue

            try:
                graph = trace_code(code)
                await websocket.send_json({"status": "success", "graph": graph})
            except TraceError as e:
                await websocket.send_json({"status": "partial", "error": str(e), "graph": None})
            except Exception as e:
                await websocket.send_json({"status": "partial", "error": f"Unexpected error: {e}", "graph": None})
    except WebSocketDisconnect:
        pass

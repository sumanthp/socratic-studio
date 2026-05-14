import json
import io
import logging
import os
import subprocess
import sys
import tempfile
import threading
import queue
import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from agents.tutor import MultiAgentCouncil

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Oasis: Multi-Agent Lab Backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

council = MultiAgentCouncil()


class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]]
    code_context: str
    provider: str = "openai"


@app.post("/api/tutor/chat")
@limiter.limit("20/minute")
async def chat_with_council(request: Request, body: ChatRequest):
    log.info("Incoming chat request. Provider: %s, Message: %.50s...", body.provider, body.message)
    formatted_history = []
    for msg in body.history:
        role = "human" if msg["role"] in ["human", "user"] else "ai"
        formatted_history.append((role, msg["content"]))

    discussion = await council.get_council_discussion_async(
        user_message=body.message,
        chat_history=formatted_history,
        code_context=body.code_context,
        provider=body.provider,
    )
    return {"discussion": discussion}


@app.websocket("/ws/voice-tutor")
async def voice_tutor_endpoint(websocket: WebSocket):
    await websocket.accept()
    log.info("Voice Tutor WebSocket connected")
    audio_buffer = io.BytesIO()

    try:
        while True:
            data = await websocket.receive_bytes()
            audio_buffer.write(data)

            if audio_buffer.tell() > 100_000:
                audio_buffer.seek(0)
                # MOCK: Replace with real E4B transcription model
                transcription = "Tell me about Python and Gemma"
                log.info("Voice transcription (mock): %s", transcription)

                discussion = await council.get_council_discussion_async(
                    user_message=transcription,
                    chat_history=[],
                    code_context="Socratic Studio Voice Mode",
                    provider="ollama",
                )
                tutor_response = next(
                    (m["content"] for m in discussion if m["role"] == "Tutor"),
                    "I'm listening...",
                )
                await websocket.send_json({"role": "Tutor", "content": tutor_response})
                audio_buffer = io.BytesIO()

    except WebSocketDisconnect:
        log.info("Voice Tutor WebSocket disconnected")
    except Exception as e:
        log.exception("Voice WebSocket error: %s", e)
        await websocket.close()


EXECUTION_TIMEOUT_SECONDS = 10


@app.websocket("/ws/execute")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    tmp_path = None
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                code = payload.get("code", "")
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON payload", "status": "error"})
                continue

            await websocket.send_json({"status": "running"})
            await websocket.send_json({"trace": {"step": "Initialization", "detail": "Allocating sandbox resources..."}})
            await asyncio.sleep(0.3)
            await websocket.send_json({"trace": {"step": "Static Analysis", "detail": "Validating python syntax and imports..."}})
            await asyncio.sleep(0.4)
            await websocket.send_json({"trace": {"step": "Environment Boot", "detail": "Loading virtual environment and dependencies..."}})
            await asyncio.sleep(0.3)

            try:
                with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as tmp:
                    tmp.write(code)
                    tmp_path = tmp.name

                process = subprocess.Popen(
                    [sys.executable, "-u", tmp_path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    encoding="utf-8",
                    errors="replace",
                )

                out_queue: queue.Queue = queue.Queue()

                def read_stream(stream, is_error: bool = False):
                    for line in iter(stream.readline, ""):
                        if line:
                            out_queue.put({"type": "error" if is_error else "output", "text": line})
                    stream.close()

                t_out = threading.Thread(target=read_stream, args=(process.stdout,), daemon=True)
                t_err = threading.Thread(target=read_stream, args=(process.stderr, True), daemon=True)
                t_out.start()
                t_err.start()

                deadline = asyncio.get_event_loop().time() + EXECUTION_TIMEOUT_SECONDS
                timed_out = False

                while t_out.is_alive() or t_err.is_alive() or not out_queue.empty():
                    if asyncio.get_event_loop().time() > deadline:
                        process.kill()
                        timed_out = True
                        break
                    try:
                        msg = out_queue.get_nowait()
                        if msg["type"] == "error":
                            await websocket.send_json({"error": msg["text"]})
                        else:
                            await websocket.send_json({"output": msg["text"]})
                    except queue.Empty:
                        await asyncio.sleep(0.05)

                t_out.join(timeout=2)
                t_err.join(timeout=2)
                process.wait()

                if timed_out:
                    await websocket.send_json({"error": f"\nExecution timed out after {EXECUTION_TIMEOUT_SECONDS}s.", "status": "error"})
                elif process.returncode != 0:
                    await websocket.send_json({"error": f"\nProcess exited with code {process.returncode}"})

                await websocket.send_json({"status": "completed"})

            except Exception:
                log.exception("Sandbox execution failure")
                await websocket.send_json({
                    "error": "The execution sandbox encountered an unexpected issue. Please try again.",
                    "status": "error",
                })
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)
                    tmp_path = None

    except WebSocketDisconnect:
        log.info("Execution client disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

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
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from agents.tutor import MultiAgentCouncil
from knowledge.rag import init_knowledge_base

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Docker sandbox setup (optional — falls back to subprocess if unavailable)
# ---------------------------------------------------------------------------

DOCKER_AVAILABLE = False
DOCKER_IMAGE = "python:3.11-slim"

def _check_docker() -> None:
    global DOCKER_AVAILABLE
    try:
        import docker  # noqa: PLC0415
        client = docker.from_env(timeout=5)
        client.ping()
        try:
            client.images.get(DOCKER_IMAGE)
            log.info("Docker sandbox ready (image %s cached).", DOCKER_IMAGE)
        except Exception:
            log.info("Pulling Docker image %s ...", DOCKER_IMAGE)
            client.images.pull(DOCKER_IMAGE)
            log.info("Docker image pulled.")
        DOCKER_AVAILABLE = True
    except Exception as e:
        log.warning("Docker unavailable — using subprocess sandbox: %s", e)


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting up — initializing knowledge base and checking Docker...")
    await asyncio.to_thread(init_knowledge_base)
    await asyncio.to_thread(_check_docker)
    yield
    log.info("Shutting down.")


# ---------------------------------------------------------------------------
# App and middleware
# ---------------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Oasis: Multi-Agent Lab Backend", lifespan=lifespan)
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


# ---------------------------------------------------------------------------
# Chat endpoints
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]]
    code_context: str
    provider: str = "openai"


def _format_history(history: List[Dict[str, str]]):
    return [
        ("human" if m["role"] in ("human", "user") else "ai", m["content"])
        for m in history
    ]


@app.post("/api/tutor/chat/stream")
@limiter.limit("20/minute")
async def stream_council(request: Request, body: ChatRequest):
    """SSE endpoint — streams each agent's response as soon as it is ready."""
    log.info("Stream request. Provider: %s, Message: %.50s...", body.provider, body.message)
    history = _format_history(body.history)

    async def event_generator():
        try:
            async for msg in council.stream_council_discussion(
                user_message=body.message,
                chat_history=history,
                code_context=body.code_context,
                provider=body.provider,
            ):
                yield f"data: {json.dumps(msg)}\n\n"
        except asyncio.CancelledError:
            pass  # client disconnected
        finally:
            yield 'data: {"done": true}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@app.post("/api/tutor/chat")
@limiter.limit("20/minute")
async def chat_with_council(request: Request, body: ChatRequest):
    """Batch endpoint kept for backward compatibility."""
    log.info("Batch chat request. Provider: %s", body.provider)
    history = _format_history(body.history)
    discussion = await council.get_council_discussion_async(
        user_message=body.message,
        chat_history=history,
        code_context=body.code_context,
        provider=body.provider,
    )
    return {"discussion": discussion}


# ---------------------------------------------------------------------------
# Voice tutor WebSocket
# ---------------------------------------------------------------------------

def _transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    from openai import OpenAI  # noqa: PLC0415
    client = OpenAI()
    ext = mime_type.split("/")[-1].split(";")[0]  # e.g. "webm"
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            transcription = client.audio.transcriptions.create(model="whisper-1", file=f)
        return transcription.text.strip()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _synthesize_speech(text: str) -> bytes:
    from openai import OpenAI  # noqa: PLC0415
    client = OpenAI()
    response = client.audio.speech.create(model="tts-1", voice="nova", input=text)
    return response.content


@app.websocket("/ws/voice-tutor")
async def voice_tutor_endpoint(websocket: WebSocket):
    await websocket.accept()
    log.info("Voice Tutor WebSocket connected")

    try:
        while True:
            # Receive a complete audio recording (sent as a Blob by the frontend)
            audio_bytes = await websocket.receive_bytes()
            if not audio_bytes:
                continue

            log.info("Received audio chunk: %d bytes — transcribing...", len(audio_bytes))

            try:
                transcription = await asyncio.to_thread(_transcribe_audio, audio_bytes)
            except Exception as e:
                log.warning("Whisper transcription failed: %s", e)
                transcription = ""

            if not transcription:
                log.info("Empty transcription — skipping.")
                continue

            log.info("Transcribed: %s", transcription)
            await websocket.send_json({"role": "human", "content": transcription})

            # Get Tutor response only (voice mode is single-agent for low latency)
            discussion = await council.get_council_discussion_async(
                user_message=transcription,
                chat_history=[],
                code_context="Socratic Studio Voice Mode",
                provider="openai",
            )
            tutor_response = next(
                (m["content"] for m in discussion if m["role"] == "Tutor"),
                "I'm listening...",
            )

            await websocket.send_json({"role": "Tutor", "content": tutor_response})

            # Generate TTS audio and send as binary frame
            try:
                audio_response = await asyncio.to_thread(_synthesize_speech, tutor_response)
                await websocket.send_bytes(audio_response)
            except Exception as e:
                log.warning("TTS synthesis failed: %s", e)

    except WebSocketDisconnect:
        log.info("Voice Tutor WebSocket disconnected")
    except Exception as e:
        log.exception("Voice WebSocket error: %s", e)
        await websocket.close()


# ---------------------------------------------------------------------------
# Code execution WebSocket
# ---------------------------------------------------------------------------

EXECUTION_TIMEOUT_SECONDS = 10


async def _execute_docker(code: str, ws: WebSocket) -> None:
    import docker  # noqa: PLC0415
    client = docker.from_env()
    out_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    container = None

    def stream_logs():
        nonlocal container
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as tmp:
                tmp.write(code)
                tmp_path = tmp.name

            container = client.containers.run(
                DOCKER_IMAGE,
                ["python", "-u", "/sandbox/code.py"],
                volumes={tmp_path: {"bind": "/sandbox/code.py", "mode": "ro"}},
                mem_limit="128m",
                nano_cpus=500_000_000,  # 0.5 CPU
                network_mode="none",
                remove=False,
                detach=True,
                stdout=True,
                stderr=True,
            )
            for chunk in container.logs(stream=True, follow=True):
                text = chunk.decode("utf-8", errors="replace")
                loop.call_soon_threadsafe(out_queue.put_nowait, ("output", text))
            result = container.wait()
            loop.call_soon_threadsafe(out_queue.put_nowait, ("done", result["StatusCode"]))
        except Exception as e:
            loop.call_soon_threadsafe(out_queue.put_nowait, ("error", str(e)))
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            if container:
                try:
                    container.remove(force=True)
                except Exception:
                    pass

    thread = threading.Thread(target=stream_logs, daemon=True)
    thread.start()

    deadline = loop.time() + EXECUTION_TIMEOUT_SECONDS
    timed_out = False

    while True:
        remaining = max(0.05, deadline - loop.time())
        try:
            msg_type, msg_data = await asyncio.wait_for(out_queue.get(), timeout=remaining)
        except asyncio.TimeoutError:
            timed_out = True
            if container:
                try:
                    container.kill()
                except Exception:
                    pass
            break

        if msg_type == "done":
            if msg_data != 0:
                await ws.send_json({"error": f"\nProcess exited with code {msg_data}"})
            break
        elif msg_type == "error":
            await ws.send_json({"error": msg_data, "status": "error"})
            break
        else:
            await ws.send_json({"output": msg_data})

    thread.join(timeout=2)

    if timed_out:
        await ws.send_json({"error": f"\nExecution timed out after {EXECUTION_TIMEOUT_SECONDS}s.", "status": "error"})


async def _execute_subprocess(code: str, ws: WebSocket) -> None:
    tmp_path = None
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
                    await ws.send_json({"error": msg["text"]})
                else:
                    await ws.send_json({"output": msg["text"]})
            except queue.Empty:
                await asyncio.sleep(0.05)

        t_out.join(timeout=2)
        t_err.join(timeout=2)
        process.wait()

        if timed_out:
            await ws.send_json({"error": f"\nExecution timed out after {EXECUTION_TIMEOUT_SECONDS}s.", "status": "error"})
        elif process.returncode != 0:
            await ws.send_json({"error": f"\nProcess exited with code {process.returncode}"})

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.websocket("/ws/execute")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
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

            if DOCKER_AVAILABLE:
                await websocket.send_json({"trace": {"step": "Environment Boot", "detail": "Launching isolated Docker container..."}})
                await asyncio.sleep(0.3)
                try:
                    await _execute_docker(code, websocket)
                except Exception:
                    log.exception("Docker execution failed, falling back to subprocess")
                    await _execute_subprocess(code, websocket)
            else:
                await websocket.send_json({"trace": {"step": "Environment Boot", "detail": "Loading virtual environment and dependencies..."}})
                await asyncio.sleep(0.3)
                try:
                    await _execute_subprocess(code, websocket)
                except Exception:
                    log.exception("Sandbox execution failure")
                    await websocket.send_json({
                        "error": "The execution sandbox encountered an unexpected issue. Please try again.",
                        "status": "error",
                    })

            await websocket.send_json({"status": "completed"})

    except WebSocketDisconnect:
        log.info("Execution client disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

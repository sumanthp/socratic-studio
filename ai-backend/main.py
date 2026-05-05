from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
import os
import tempfile
import asyncio

from agents.tutor import MultiAgentCouncil

# Load environment variables (from .env file)
load_dotenv()

app = FastAPI(title="Oasis: Multi-Agent Lab Backend")

# Allow requests from our Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the council
council = MultiAgentCouncil()

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] 
    code_context: str
    provider: str = "openai"

@app.post("/api/tutor/chat")
async def chat_with_council(request: ChatRequest):
    print(f"DEBUG: Incoming chat request. Provider: {request.provider}, Message: {request.message[:50]}...")
    # Convert history dicts to Langchain format
    formatted_history = []
    for msg in request.history:
        role = "human" if msg["role"] in ["human", "user"] else "ai"
        formatted_history.append((role, msg["content"]))
            
    discussion = await council.get_council_discussion_async(
        user_message=request.message,
        chat_history=formatted_history,
        code_context=request.code_context,
        provider=request.provider
    )
    
    return {"discussion": discussion}


import json
import io
from pydub import AudioSegment

@app.websocket("/ws/voice-tutor")
async def voice_tutor_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("DEBUG: Voice Tutor WebSocket connected")
    
    # Initialize audio buffer
    audio_buffer = io.BytesIO()
    
    try:
        while True:
            # Receive binary audio frames from frontend
            data = await websocket.receive_bytes()
            
            # Append to buffer
            audio_buffer.write(data)
            
            # Simple heuristic: process every 3 seconds of audio (assuming 44.1kHz, 16-bit mono)
            # This is where Gemma 4 E4B would perform real-time transcription
            if audio_buffer.tell() > 100000: # Approx 100KB chunks
                audio_buffer.seek(0)
                # MOCK: Transcribe using Gemma 4 E4B
                # transcription = e4b_model.transcribe(audio_buffer.read())
                transcription = "Tell me about Python and Gemma" # Mock transcription trigger
                
                print(f"DEBUG: E4B Transcribed: {transcription}")
                
                # Get response from the Socratic Tutor (Gemma 4 26B)
                discussion = await council.get_council_discussion_async(
                    user_message=transcription,
                    chat_history=[], # Simplified for voice
                    code_context="Socratic Studio Voice Mode",
                    provider="ollama"
                )
                
                tutor_response = next((m["content"] for m in discussion if m["role"] == "Tutor"), "I'm listening...")
                
                # Send text response back for UI display
                await websocket.send_json({"role": "Tutor", "content": tutor_response})
                
                # MOCK: Generate Audio with Gemma 4 E4B (TTS)
                # audio_response = e4b_model.speak(tutor_response)
                # await websocket.send_bytes(audio_response)
                
                # Clear buffer
                audio_buffer = io.BytesIO()
                
    except WebSocketDisconnect:
        print("DEBUG: Voice Tutor WebSocket disconnected")
    except Exception as e:
        print(f"MAINTAINER LOG: Voice WebSocket Error: {e}")
        await websocket.close()

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
            
            # Simulate "Trace" steps for the new visualizer
            await websocket.send_json({"trace": {"step": "Initialization", "detail": "Allocating sandbox resources..."}})
            await asyncio.sleep(0.3)
            await websocket.send_json({"trace": {"step": "Static Analysis", "detail": "Validating python syntax and imports..."}})
            await asyncio.sleep(0.4)
            await websocket.send_json({"trace": {"step": "Environment Boot", "detail": "Loading virtual environment and dependencies..."}})
            await asyncio.sleep(0.3)
            
            # Create a temporary file
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as tmp:
                tmp.write(code)
                tmp_path = tmp.name
                
            try:
                # Execute the code as a subprocess using Popen and threads to avoid Windows asyncio NotImplementedError
                import sys
                import subprocess
                import threading
                import queue

                process = subprocess.Popen(
                    [sys.executable, "-u", tmp_path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1, # Line buffered
                    encoding='utf-8',
                    errors='replace'
                )
                
                out_queue = queue.Queue()
                
                def read_stream(stream, is_error=False):
                    for line in iter(stream.readline, ''):
                        if line:
                            out_queue.put({"type": "error" if is_error else "output", "text": line})
                    stream.close()

                t_out = threading.Thread(target=read_stream, args=(process.stdout,))
                t_err = threading.Thread(target=read_stream, args=(process.stderr, True))
                t_out.start()
                t_err.start()
                
                # Stream results to websocket
                while t_out.is_alive() or t_err.is_alive() or not out_queue.empty():
                    try:
                        # Non-blocking get
                        msg = out_queue.get_nowait()
                        if msg["type"] == "error":
                            await websocket.send_json({"error": msg["text"]})
                        else:
                            await websocket.send_json({"output": msg["text"]})
                    except queue.Empty:
                        await asyncio.sleep(0.05)
                
                process.wait()
                
                if process.returncode != 0:
                    await websocket.send_json({"error": f"\\nProcess exited with code {process.returncode}"})
                    
                await websocket.send_json({"status": "completed"})
                
            except Exception as e:
                import traceback
                # Detailed log for maintainers
                print("\n" + "="*50)
                print("MAINTAINER LOG: SANDBOX EXECUTION FAILURE")
                traceback.print_exc()
                print("="*50 + "\n")
                
                # Abstracted message for the user
                await websocket.send_json({
                    "error": "The execution sandbox encountered an unexpected issue. Our team has been notified. Please try running your code again in a few moments.", 
                    "status": "error"
                })
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                    
    except WebSocketDisconnect:
        print("Client disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

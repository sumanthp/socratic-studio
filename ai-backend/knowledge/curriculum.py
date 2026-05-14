"""
Curriculum documents for the Socratic Studio knowledge base.
Each document covers a discrete concept and is stored as a vector in ChromaDB.
"""

CURRICULUM_DOCUMENTS = [
    {
        "id": "python-basics",
        "topic": "Python Basics",
        "content": (
            "Python is a high-level, interpreted, dynamically typed programming language. "
            "Variables are assigned with `=` and do not require type declarations. "
            "Core data types include int, float, str, bool, list, tuple, dict, and set. "
            "Indentation (4 spaces by convention) defines code blocks — there are no curly braces. "
            "Common built-ins: print(), len(), range(), type(), isinstance(), enumerate(), zip(). "
            "Python uses duck typing: if an object has the required methods, it works."
        ),
    },
    {
        "id": "python-functions",
        "topic": "Python Functions and Scope",
        "content": (
            "Functions are defined with `def name(params):`. "
            "Default argument values are evaluated once at definition time — never use mutable defaults like `def f(x=[])`. "
            "Use `*args` for variadic positional arguments and `**kwargs` for variadic keyword arguments. "
            "Python uses LEGB scope resolution: Local → Enclosing → Global → Built-in. "
            "First-class functions: functions are objects and can be passed as arguments or returned. "
            "Lambda expressions create anonymous functions: `lambda x: x * 2`. "
            "Decorators wrap a function with another function using `@decorator` syntax."
        ),
    },
    {
        "id": "python-classes",
        "topic": "Python OOP and Classes",
        "content": (
            "Classes are defined with `class Name:`. The `__init__` method is the constructor. "
            "`self` is the conventional name for the instance reference, passed implicitly. "
            "Inheritance: `class Child(Parent):`. Call `super().__init__()` to initialize the parent. "
            "Dunder (magic) methods like `__str__`, `__repr__`, `__len__`, `__eq__` customise behaviour. "
            "Dataclasses (`@dataclass`) auto-generate `__init__`, `__repr__`, and `__eq__`. "
            "Use `@property` to create read-only or computed attributes. "
            "Class variables are shared across all instances; instance variables are per-object."
        ),
    },
    {
        "id": "python-async",
        "topic": "Python Async/Await and asyncio",
        "content": (
            "Python's async model uses a single-threaded event loop. "
            "`async def` defines a coroutine. `await` suspends execution until the awaitable completes. "
            "Only one coroutine runs at a time, but IO-bound waits yield control to other coroutines. "
            "`asyncio.gather()` runs multiple coroutines concurrently. "
            "`asyncio.to_thread()` offloads blocking (synchronous) calls to a thread pool. "
            "Never call blocking functions (file IO, requests, time.sleep) inside async code without `to_thread`. "
            "Common mistake: creating coroutine objects without awaiting them — they silently do nothing."
        ),
    },
    {
        "id": "genai-fundamentals",
        "topic": "Generative AI Fundamentals",
        "content": (
            "Generative AI models learn the statistical distribution of their training data and sample new outputs from it. "
            "Large Language Models (LLMs) are trained on vast text corpora using next-token prediction. "
            "Foundation models are general-purpose; fine-tuned models are specialised for a task. "
            "Capabilities: text generation, summarisation, translation, classification, code generation, question answering. "
            "Limitations: hallucination (confident fabrication), knowledge cutoffs, context window limits, sensitivity to prompt wording. "
            "Responsible use requires awareness of bias, privacy, and the risk of generating harmful content."
        ),
    },
    {
        "id": "tokens-tokenization",
        "topic": "Tokens and Tokenization",
        "content": (
            "LLMs do not process raw characters — they operate on tokens, which are word fragments. "
            "GPT-4 uses the tiktoken library with the cl100k_base vocabulary (~100k tokens). "
            "1 token ≈ 4 characters of English text; 1000 tokens ≈ 750 words. "
            "Pricing and context limits are measured in tokens, not words. "
            "Rare words, non-English text, and code are tokenised less efficiently (more tokens per word). "
            "The context window is the maximum number of tokens the model can process in one call (input + output combined). "
            "Exceeding the context window causes the model to lose earlier parts of the conversation."
        ),
    },
    {
        "id": "temperature-sampling",
        "topic": "Temperature, Top-p, and Sampling",
        "content": (
            "At each generation step, the model produces a probability distribution over all possible next tokens. "
            "Temperature scales this distribution: low temperature (0.1) makes it sharply peaked (deterministic); "
            "high temperature (1.0+) flattens it (more random and creative). "
            "Top-p (nucleus sampling) restricts sampling to the smallest set of tokens whose cumulative probability exceeds p. "
            "Top-k limits choices to the k most probable tokens. "
            "For factual Q&A or code generation, use temperature ~0.1. "
            "For creative writing or brainstorming, use temperature 0.7–1.0. "
            "Setting temperature=0 makes the model fully deterministic (greedy decoding)."
        ),
    },
    {
        "id": "prompt-engineering-basics",
        "topic": "Prompt Engineering — System Prompts",
        "content": (
            "A prompt consists of a system message (persona and instructions), conversation history, and the user turn. "
            "The system prompt sets the model's role, tone, constraints, and output format. "
            "Be explicit: vague instructions produce vague outputs. "
            "Use positive framing ('always respond in JSON') rather than negative ('don't respond in plain text'). "
            "Ordering matters: place the most important constraints at the start and end of the system prompt. "
            "Prompt injection is an attack where user input overrides system instructions — always sanitise user input in agentic systems. "
            "Structured output (JSON mode, response_format) enforces parseable replies from the model."
        ),
    },
    {
        "id": "few-shot-prompting",
        "topic": "Prompt Engineering — Few-Shot Learning",
        "content": (
            "Few-shot prompting provides examples of the desired input→output mapping within the prompt itself. "
            "No gradient updates occur — the model adapts in-context using its pre-trained priors. "
            "Structure: system instructions → example 1 (user + assistant) → example 2 → ... → actual query. "
            "3–8 diverse, representative examples typically yield the best results. "
            "Zero-shot prompting relies on instructions alone; one-shot on a single example. "
            "Label quality matters more than quantity: one perfect example beats three inconsistent ones. "
            "Chain-of-thought few-shot prompting includes the reasoning steps in each example, not just the final answer."
        ),
    },
    {
        "id": "chain-of-thought",
        "topic": "Chain-of-Thought and Reasoning Prompts",
        "content": (
            "Chain-of-thought (CoT) prompting asks the model to reason step-by-step before giving the final answer. "
            "Adding 'Let's think step by step' to a prompt significantly improves accuracy on multi-step problems. "
            "CoT is most effective for arithmetic, logical reasoning, and multi-hop questions. "
            "Self-consistency: sample multiple CoT paths and take the majority answer to reduce variance. "
            "Tree-of-thought extends CoT by exploring multiple reasoning branches simultaneously. "
            "ReAct (Reason + Act) interleaves reasoning steps with tool use (search, code execution). "
            "Extended thinking / scratchpad mode: some models support a dedicated reasoning token budget."
        ),
    },
    {
        "id": "rag-concept",
        "topic": "Retrieval-Augmented Generation (RAG)",
        "content": (
            "RAG grounds model responses in retrieved external documents, reducing hallucination. "
            "Pipeline: (1) user query → (2) semantic search over a document store → (3) top-k documents injected into the prompt → (4) model generates an answer citing the documents. "
            "Advantages: up-to-date knowledge without retraining, reduced hallucination, source attribution. "
            "Key design decisions: chunk size, overlap, embedding model, retrieval strategy (dense, sparse, hybrid), reranker. "
            "Common failure modes: irrelevant chunks retrieved, chunks that are too large or too small, out-of-date index. "
            "Advanced patterns: HyDE (hypothetical document embeddings), multi-query retrieval, FLARE."
        ),
    },
    {
        "id": "embeddings",
        "topic": "Vector Embeddings",
        "content": (
            "An embedding is a dense, fixed-length vector that encodes the semantic meaning of text. "
            "Semantically similar sentences have vectors that are close together in embedding space. "
            "Similarity is measured with cosine similarity: dot product of unit vectors (1 = identical, 0 = unrelated, -1 = opposite). "
            "Popular embedding models: OpenAI text-embedding-3-small, sentence-transformers (all-MiniLM-L6-v2), Cohere embed-v3. "
            "Embeddings are produced by the encoder part of a transformer — they capture global context, not just keywords. "
            "Typical dimension: 384 (small), 768 (base), 1536 (OpenAI small), 3072 (OpenAI large). "
            "Embeddings are static per chunk — they must be recomputed when the document changes."
        ),
    },
    {
        "id": "vector-databases",
        "topic": "Vector Databases",
        "content": (
            "A vector database stores embeddings and supports fast approximate nearest-neighbour (ANN) search. "
            "Popular options: ChromaDB (local, open-source), Qdrant (self-hosted/cloud), Pinecone (cloud), Weaviate, Milvus. "
            "ANN indexes (HNSW, IVF-Flat, LSH) trade recall for speed vs. exact search. "
            "Metadata filtering allows combining semantic search with structured filters (e.g., topic='python'). "
            "ChromaDB usage: `client.create_collection('name')`, `collection.add(ids, documents, embeddings)`, `collection.query(query_texts, n_results)`. "
            "Hybrid search combines dense (embedding) and sparse (BM25/keyword) retrieval for better recall. "
            "Rerankers (cross-encoders) reorder top-k results by scoring query–document pairs jointly."
        ),
    },
    {
        "id": "langchain-basics",
        "topic": "LangChain Basics",
        "content": (
            "LangChain is a framework for building LLM-powered applications using composable primitives. "
            "Core abstractions: LLM/ChatModel, PromptTemplate, Chain, Memory, Tool, Agent, Retriever. "
            "LangChain Expression Language (LCEL) uses the `|` pipe operator to compose chains: `prompt | llm | parser`. "
            "ChatPromptTemplate builds structured prompts with system, human, and AI turns. "
            "MessagesPlaceholder inserts a list of messages (conversation history) into the prompt. "
            "`chain.invoke(inputs)` runs the chain synchronously; `chain.ainvoke(inputs)` is the async version. "
            "LCEL chains are lazy — they execute only when `.invoke()` or `.stream()` is called."
        ),
    },
    {
        "id": "langchain-tools-agents",
        "topic": "LangChain Tools and Agents",
        "content": (
            "A Tool is a Python function the LLM can call to interact with the outside world. "
            "Define tools with the `@tool` decorator from `langchain_core.tools`. "
            "Bind tools to a model with `llm.bind_tools([tool1, tool2])`. "
            "When the model decides to call a tool, it emits a `tool_calls` attribute on the response instead of text. "
            "Your code must then execute the tool and feed the result back to the model for a final answer. "
            "LangGraph is the recommended framework for multi-step agentic workflows with state management. "
            "AgentExecutor (legacy) runs a ReAct loop automatically; LangGraph gives explicit control over each step."
        ),
    },
    {
        "id": "openai-api",
        "topic": "OpenAI API — Chat Completions",
        "content": (
            "The OpenAI Chat Completions API accepts a list of messages and returns a model response. "
            "Message roles: `system` (instructions), `user` (human turn), `assistant` (model turn), `tool` (tool result). "
            "Key parameters: `model` (e.g., gpt-4o-mini), `messages`, `temperature`, `max_tokens`, `stream`, `response_format`. "
            "Streaming: set `stream=True` to receive tokens incrementally as server-sent events. "
            "Function/tool calling: pass `tools=[...]` and `tool_choice` to let the model call defined functions. "
            "The response includes `usage` (prompt_tokens, completion_tokens, total_tokens) for cost tracking. "
            "Rate limits: requests per minute (RPM) and tokens per minute (TPM) vary by tier."
        ),
    },
    {
        "id": "openai-whisper-tts",
        "topic": "OpenAI Whisper and TTS",
        "content": (
            "Whisper is OpenAI's speech recognition model, available via the `audio.transcriptions.create()` API. "
            "Accepts audio files up to 25MB in formats: mp3, mp4, wav, webm, ogg, flac. "
            "Returns a transcription string; also supports word-level timestamps and language detection. "
            "The TTS (text-to-speech) API (`audio.speech.create()`) converts text to audio using neural voices. "
            "Available voices: alloy, echo, fable, onyx, nova, shimmer. "
            "Output formats: mp3 (default), opus, aac, flac, wav, pcm. "
            "Both APIs are billed per minute (Whisper) or per million characters (TTS)."
        ),
    },
    {
        "id": "ollama-local-models",
        "topic": "Ollama and Local LLMs",
        "content": (
            "Ollama is a tool for running large language models locally on consumer hardware. "
            "It manages model downloads, GPU offloading, and exposes an OpenAI-compatible REST API at localhost:11434. "
            "Commands: `ollama pull <model>`, `ollama run <model>`, `ollama list`, `ollama rm <model>`. "
            "Model library: Llama 3, Gemma, Mistral, Phi, Qwen, DeepSeek, and many others. "
            "GGUF format: quantised models (q4, q5, q8) that trade accuracy for smaller size and faster inference. "
            "GPU acceleration: Ollama automatically uses Metal (macOS), CUDA (NVIDIA), or ROCm (AMD). "
            "The LangChain `ChatOllama` class connects to Ollama using the same interface as `ChatOpenAI`."
        ),
    },
    {
        "id": "gemma-model",
        "topic": "Gemma Model Family",
        "content": (
            "Gemma is Google's family of open-weight language models, derived from the Gemini research. "
            "Model sizes: Gemma 2B, 7B, 9B, 27B; Gemma 4 introduces 1B, 4B (E4B), and 26B variants. "
            "Gemma 4 E4B is a 4-billion-parameter model using Expert architecture — efficient on consumer hardware. "
            "Gemma 4 26B is a 26-billion-parameter model suited for complex reasoning tasks via Ollama. "
            "Instruction-tuned variants (suffix `-it`) are fine-tuned to follow chat instructions. "
            "Gemma uses a shared vocabulary with Gemini and supports multilingual text. "
            "License: permissive for research and commercial use, with usage policies."
        ),
    },
    {
        "id": "multi-agent-systems",
        "topic": "Multi-Agent Systems",
        "content": (
            "A multi-agent system divides complex tasks among specialised agents that collaborate. "
            "Each agent has a focused role (e.g., planner, coder, critic, reviewer) and its own system prompt. "
            "Agent patterns: sequential pipeline, parallel fan-out, hierarchical orchestrator/worker, debate/council. "
            "Communication: agents share a common message bus, memory store, or pass structured outputs directly. "
            "Failure modes: agent disagreement loops, context window overflow, inconsistent state, hallucinated tool calls. "
            "LangGraph models multi-agent workflows as directed graphs with typed state transitions. "
            "Key design principle: each agent should have a single, well-defined responsibility and explicit silence rules."
        ),
    },
    {
        "id": "fastapi-basics",
        "topic": "FastAPI Basics",
        "content": (
            "FastAPI is a modern Python web framework for building APIs with automatic OpenAPI docs. "
            "Routes are defined with decorators: `@app.get()`, `@app.post()`, `@app.websocket()`. "
            "Request bodies are defined as Pydantic models — FastAPI validates and parses them automatically. "
            "Dependency injection: `Depends()` injects shared resources (DB sessions, auth) into route handlers. "
            "WebSocket endpoints accept a `WebSocket` parameter and use `await websocket.send_json()` / `receive_text()`. "
            "Streaming responses: use `StreamingResponse` with an async generator for SSE or chunked HTTP. "
            "Background tasks: `BackgroundTasks` runs work after the response is sent, without blocking the client."
        ),
    },
    {
        "id": "sse-streaming",
        "topic": "Server-Sent Events (SSE) and Streaming",
        "content": (
            "Server-Sent Events (SSE) is a unidirectional HTTP protocol for pushing data from server to client. "
            "The content-type is `text/event-stream`. Each event is formatted as `data: <payload>\\n\\n`. "
            "The browser's `EventSource` API handles SSE for GET requests. "
            "For POST requests with SSE, use `fetch()` with `response.body.getReader()` to consume the stream. "
            "FastAPI SSE: return `StreamingResponse(generator(), media_type='text/event-stream')`. "
            "Set header `X-Accel-Buffering: no` to disable nginx buffering in production. "
            "SSE supports automatic reconnect (via `retry:` field) and named events (via `event:` field)."
        ),
    },
    {
        "id": "docker-containers",
        "topic": "Docker and Container Sandboxing",
        "content": (
            "Docker containers provide process isolation, resource limits, and a reproducible environment. "
            "Key resource limits: `mem_limit` (memory cap), `nano_cpus` (CPU quota), `network_mode=none` (no network). "
            "The Python Docker SDK (`import docker`) allows programmatic container management. "
            "`client.containers.run()` creates and starts a container; `detach=True` returns immediately. "
            "`container.logs(stream=True, follow=True)` streams output line-by-line. "
            "`container.wait()` blocks until exit; `container.kill()` sends SIGKILL for timeout enforcement. "
            "Always call `container.remove(force=True)` after execution to prevent container leaks."
        ),
    },
    {
        "id": "ai-safety",
        "topic": "AI Safety and Responsible Use",
        "content": (
            "Hallucination: LLMs generate plausible-sounding but factually incorrect text with high confidence. "
            "Mitigation: RAG grounding, citation requirements, human review for high-stakes outputs. "
            "Bias: models reflect biases present in training data — test across demographics before deployment. "
            "Prompt injection: malicious user input that hijacks the model's instructions. "
            "Mitigation: separate system and user content, never interpolate user input directly into system prompts. "
            "Privacy: do not send PII to external APIs without consent; use local models for sensitive data. "
            "Over-reliance: AI-assisted outputs still require human verification, especially in medicine, law, and finance."
        ),
    },
]

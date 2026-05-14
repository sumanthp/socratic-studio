"""
Structured GenAI learning path served via /api/curriculum.
Each module has a starter code template, learning objective, project brief,
and references to RAG document IDs for targeted retrieval.
"""

LEARNING_PATH = {
    "path_id": "genai_foundations",
    "title": "GenAI Foundations",
    "description": "Build production-ready AI applications in Python from scratch, one module at a time.",
    "modules": [
        {
            "id": "m1_api_basics",
            "order": 1,
            "title": "API Basics & Chat Completions",
            "milestone": "API Basics & Prompting",
            "objective": "Connect to the OpenAI Chat Completions API and generate your first AI-powered response.",
            "project": (
                "Build a `generate_socratic_question(topic)` function that calls the OpenAI API "
                "and returns a thought-provoking question about the given topic."
            ),
            "concepts": ["openai-api", "tokens-tokenization", "python-functions"],
            "estimated_minutes": 30,
            "starter_code": """\
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def generate_socratic_question(topic: str) -> str:
    \"\"\"
    Calls the OpenAI Chat Completions API to generate a Socratic question
    about the given topic.

    TODO:
    1. Create a messages list with a system prompt and a user message.
    2. Call client.chat.completions.create() with the right model and messages.
    3. Return the content of the first choice's message.

    Hint: What role does the system message play?
    \"\"\"
    pass


if __name__ == "__main__":
    question = generate_socratic_question("Python decorators")
    print(question)
""",
        },
        {
            "id": "m2_prompt_engineering",
            "order": 2,
            "title": "Prompt Engineering",
            "milestone": "Prompt Engineering",
            "objective": "Master system prompts, few-shot examples, and chain-of-thought prompting.",
            "project": (
                "Build a multi-persona chatbot where the AI adapts its style based on the chosen persona "
                "(teacher, expert, Socratic tutor). Add two few-shot examples per persona."
            ),
            "concepts": ["prompt-engineering-basics", "few-shot-prompting", "chain-of-thought"],
            "estimated_minutes": 45,
            "starter_code": """\
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

PERSONAS = {
    "teacher": "You are a patient teacher who explains ideas using simple analogies and everyday examples.",
    "expert": "You are a world-class expert who speaks precisely, technically, and concisely.",
    "socratic": "You NEVER give direct answers. You ONLY respond with guiding questions that lead the student to discover the answer themselves.",
}

# Few-shot examples per persona (add 2 user/assistant pairs each)
FEW_SHOT_EXAMPLES: dict[str, list[dict]] = {
    "teacher": [],     # TODO: Add 2 teacher-style examples
    "expert": [],      # TODO: Add 2 expert-style examples
    "socratic": [],    # TODO: Add 2 Socratic-style examples
}

def chat_with_persona(persona: str, user_message: str) -> str:
    \"\"\"
    Sends a message to the AI using the given persona.

    TODO:
    1. Build a messages list: system prompt, then few-shot pairs, then the user message.
    2. Call the API and return the response content.

    Hint: What happens when you change the order of the messages?
    \"\"\"
    if persona not in PERSONAS:
        raise ValueError(f"Unknown persona: {persona}")
    pass


if __name__ == "__main__":
    for persona in ["teacher", "socratic", "expert"]:
        print(f"\\n=== {persona.upper()} ===")
        print(chat_with_persona(persona, "What is a Python decorator?"))
""",
        },
        {
            "id": "m3_rag",
            "order": 3,
            "title": "RAG & Vector Search",
            "milestone": "RAG Implementation",
            "objective": "Ground your AI in external documents using semantic search and ChromaDB.",
            "project": (
                "Build a document Q&A system: add documents to ChromaDB, retrieve the most relevant "
                "ones for any question, and use them as context for the AI's answer."
            ),
            "concepts": ["rag-concept", "embeddings", "vector-databases"],
            "estimated_minutes": 60,
            "starter_code": """\
import os
from openai import OpenAI
import chromadb

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
chroma = chromadb.EphemeralClient()
collection = chroma.create_collection("my_docs")

SAMPLE_DOCS = [
    "Python lists are ordered, mutable sequences. Use append() to add and pop() to remove items.",
    "Python dictionaries store key-value pairs. Access values with dict[key] or dict.get(key, default).",
    "Python functions are first-class objects. Use *args for variadic positional arguments.",
    "Asyncio runs coroutines on a single event loop. Never call blocking functions without asyncio.to_thread().",
    "RAG (Retrieval-Augmented Generation) grounds LLM responses in retrieved documents to reduce hallucination.",
]

def get_embedding(text: str) -> list[float]:
    \"\"\"Returns an OpenAI embedding vector for the given text.\"\"\"
    # TODO: Call client.embeddings.create() with model="text-embedding-3-small"
    # Return response.data[0].embedding
    pass


def add_documents(docs: list[str]) -> None:
    \"\"\"Adds documents to ChromaDB using OpenAI embeddings.\"\"\"
    # TODO: Generate embeddings for each doc
    # TODO: Call collection.add(ids=..., embeddings=..., documents=...)
    pass


def query_docs(question: str, n_results: int = 2) -> list[str]:
    \"\"\"Returns the n most relevant documents for the question.\"\"\"
    # TODO: Generate embedding for the question
    # TODO: Call collection.query(query_embeddings=..., n_results=...)
    # Return results["documents"][0]
    pass


def rag_answer(question: str) -> str:
    \"\"\"Retrieves relevant docs and uses them to answer the question.\"\"\"
    # TODO: Retrieve docs with query_docs()
    # TODO: Build a prompt that includes the docs as context
    # TODO: Call the OpenAI API and return the answer
    pass


if __name__ == "__main__":
    add_documents(SAMPLE_DOCS)
    print(rag_answer("How do I remove items from a Python list?"))
    print(rag_answer("What is RAG and why does it help?"))
""",
        },
        {
            "id": "m4_agents",
            "order": 4,
            "title": "Agents & Tool Use",
            "milestone": "Agentic System",
            "objective": "Give your AI the ability to use tools and run multi-step reasoning loops.",
            "project": (
                "Build a ReAct-style research agent that decides when to call a search tool, "
                "incorporates the results, and loops until it can produce a confident final answer."
            ),
            "concepts": ["langchain-tools-agents", "multi-agent-systems", "openai-api"],
            "estimated_minutes": 60,
            "starter_code": """\
import os
import json
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Tool schema for the OpenAI function-calling API
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the internet for up-to-date information on a topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query string."},
                },
                "required": ["query"],
            },
        },
    },
]

def mock_search(query: str) -> str:
    \"\"\"Mock search — replace with a real search API (SerpAPI, Brave, etc.).\"\"\"
    return (
        f"[MOCK SEARCH RESULT for '{query}']\\n"
        "RAG combines retrieval from a vector database with LLM generation. "
        "Fine-tuning updates the model weights on new data. RAG is cheaper, "
        "updatable at inference time, and supports source attribution."
    )

def run_agent(task: str, max_iterations: int = 5) -> str:
    \"\"\"
    Runs a ReAct-style agent loop.

    TODO:
    1. Build an initial messages list (system + user task).
    2. In a loop (up to max_iterations):
       a. Call client.chat.completions.create() with tools=TOOLS.
       b. If response.choices[0].finish_reason == 'tool_calls', execute each tool
          and append the results as 'tool' role messages.
       c. Otherwise, return the final text response.
    3. Return a timeout message if max_iterations is reached.

    Hint: What is finish_reason == 'stop' telling you?
    \"\"\"
    pass


if __name__ == "__main__":
    result = run_agent(
        "What are the main differences between RAG and fine-tuning for LLMs? "
        "Which one should I use for a customer support chatbot?"
    )
    print(result)
""",
        },
        {
            "id": "m5_local_models",
            "order": 5,
            "title": "Local Models with Ollama",
            "milestone": "Local AI Deployment",
            "objective": "Run open-source models entirely on your machine — no API key, no cost, full privacy.",
            "project": (
                "Port your agent from Module 4 to use Gemma via Ollama. "
                "Compare the responses of different local models on the same prompt."
            ),
            "concepts": ["ollama-local-models", "gemma-model", "temperature-sampling"],
            "estimated_minutes": 45,
            "starter_code": """\
import os
from openai import OpenAI  # Ollama is OpenAI-API compatible

# Point the client at Ollama — no real API key needed
client = OpenAI(
    base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434") + "/v1",
    api_key="ollama",
)

DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:4b")

def ask_local_model(
    question: str,
    model: str = DEFAULT_MODEL,
    system_prompt: str = "You are a helpful AI assistant.",
    temperature: float = 0.7,
    stream: bool = False,
) -> str:
    \"\"\"
    Sends a question to a local Ollama model.

    TODO:
    1. Build a messages list with the system prompt and the question.
    2. Call client.chat.completions.create() with stream=stream.
    3. If streaming, iterate over the response and collect the delta content.
    4. Return the full response string.

    Hint: What changes in the response structure when stream=True?
    \"\"\"
    pass


def compare_models(question: str, models: list[str]) -> None:
    \"\"\"Runs the same question through multiple models and prints results side-by-side.\"\"\"
    for model in models:
        print(f"\\n{'='*50}")
        print(f"MODEL: {model}")
        print('='*50)
        try:
            response = ask_local_model(question, model=model)
            print(response)
        except Exception as e:
            print(f"[Error: {e}]")


if __name__ == "__main__":
    # Try a single model
    print(ask_local_model("Explain Python decorators like I'm 10 years old."))

    # Uncomment to compare multiple models:
    # compare_models(
    #     "What is the difference between supervised and unsupervised learning?",
    #     models=["gemma4:4b", "gemma4:26b"],
    # )
""",
        },
    ],
}


def get_module_by_id(module_id: str) -> dict | None:
    return next((m for m in LEARNING_PATH["modules"] if m["id"] == module_id), None)

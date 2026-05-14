import logging
import os

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

from .curriculum import CURRICULUM_DOCUMENTS

log = logging.getLogger(__name__)

_collection = None


def get_collection() -> chromadb.Collection:
    global _collection
    if _collection is not None:
        return _collection

    db_path = os.environ.get("CHROMA_DB_PATH", "./chroma_db")
    client = chromadb.PersistentClient(path=db_path)
    ef = DefaultEmbeddingFunction()
    _collection = client.get_or_create_collection(
        name="curriculum",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


def init_knowledge_base() -> None:
    collection = get_collection()
    if collection.count() > 0:
        log.info("Knowledge base already contains %d documents — skipping init.", collection.count())
        return

    log.info("Initializing knowledge base with %d curriculum documents...", len(CURRICULUM_DOCUMENTS))
    collection.add(
        ids=[doc["id"] for doc in CURRICULUM_DOCUMENTS],
        documents=[doc["content"] for doc in CURRICULUM_DOCUMENTS],
        metadatas=[{"topic": doc["topic"]} for doc in CURRICULUM_DOCUMENTS],
    )
    log.info("Knowledge base ready.")


def query_rag(query: str, n_results: int = 3) -> str:
    collection = get_collection()
    count = collection.count()
    if count == 0:
        return "Knowledge base is empty. Guide the student to explore this concept from first principles."

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, count),
    )
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    if not docs:
        return "Information not found in textbook. Please guide the student to explore this concept from first principles."

    parts = [f"[{meta['topic']}]\n{doc}" for doc, meta in zip(docs, metas)]
    return "\n\n---\n\n".join(parts)

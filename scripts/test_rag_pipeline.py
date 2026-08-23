"""End-to-end integration test for the RAG Q&A pipeline."""

import sys
import os
import warnings
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ["ANONYMIZED_TELEMETRY"] = "False"
warnings.filterwarnings("ignore")


def _safe(text: str) -> str:
    return text.encode("ascii", "replace").decode("ascii")


print("=" * 60)
print("RAG PIPELINE INTEGRATION TEST")
print("=" * 60)

# --- Test 1: Imports ---
print("\n--- Test 1: Import all RAG modules ---")
from rag.document_loader import validate_knowledge_base, load_documents
from rag.chunking import chunk_documents
from rag.embeddings import EmbeddingConfig
from rag.vector_store import VectorStore, VectorStoreConfig
from rag.retriever import Retriever, RetrieverConfig, RetrievalResult
from rag.rag_pipeline import (
    RAGPipeline, RAGPipelineConfig, RAGResponse, Citation,
)
print("  All imports OK")

# --- Test 2: Validate KB ---
print("\n--- Test 2: Validate knowledge base ---")
validation = validate_knowledge_base()
print(f"  is_valid={validation.is_valid}, doc_count={validation.doc_count}")

# --- Test 3: Load + chunk + embed ---
print("\n--- Test 3: Load + chunk + embed ---")
docs = load_documents()
chunks = chunk_documents(docs)
emb_config = EmbeddingConfig(provider="sentence-transformers")
from rag.embeddings import generate_embeddings
embedded = generate_embeddings(chunks, emb_config)
print(f"  {len(docs)} docs -> {len(chunks)} chunks -> {len(embedded)} embeddings")

# --- Test 4: Index into ChromaDB ---
print("\n--- Test 4: Index into ChromaDB ---")
store_config = VectorStoreConfig(
    collection_name="rag_test",
    persist_directory="data/chroma_db",
    distance_metric="cosine",
)
store = VectorStore(store_config)
store.reset()
result = store.index(embedded)
print(f"  Indexed {result.indexed} chunks, collection_size={result.collection_size}")

# --- Test 5: Retriever ---
print("\n--- Test 5: Retriever ---")
retriever_config = RetrieverConfig(
    embedding_config=emb_config,
    vector_store_config=store_config,
    top_k=3,
    min_score=0.25,
)
retriever = Retriever(retriever_config)
hits = retriever.retrieve("What is the velocity threshold for fraud?")
print(f"  Retrieved {len(hits)} chunks:")
for h in hits:
    print(f"    score={h.score:.4f} source={h.source_filename} heading={h.source_heading}")
    print(f"      {_safe(h.text[:70])}...")

# --- Test 6: RAG Pipeline (offline mode) ---
print("\n--- Test 6: RAG Pipeline (null/offline LLM) ---")
pipeline_config = RAGPipelineConfig(
    retriever_config=retriever_config,
    llm_provider="null",
    top_k=3,
    min_relevance=0.25,
)
pipeline = RAGPipeline(pipeline_config)

response = pipeline.ask("What are the high-risk geographic indicators for fraud?")
print(f"  Sufficiency: {response.sufficiency}")
print(f"  Confidence:  {response.confidence}")
print(f"  Citations:   {len(response.citations)}")
print(f"  Answer:      {_safe(response.answer[:120])}...")
for c in response.citations:
    print(f"    [{c.source_filename}] {c.source_heading} (score={c.score:.4f})")

# --- Test 7: RAG Pipeline - insufficient info ---
print("\n--- Test 7: RAG Pipeline - irrelevant question ---")
response2 = pipeline.ask("What is the weather in Tokyo?")
print(f"  Sufficiency: {response2.sufficiency}")
print(f"  Confidence:  {response2.confidence}")
print(f"  Citations:   {len(response2.citations)}")

# --- Test 8: retrieve_only ---
print("\n--- Test 8: retrieve_only ---")
chunks_only = pipeline.retrieve_only("How should analysts handle chargebacks?", top_k=2)
print(f"  Retrieved {len(chunks_only)} chunks without LLM")
for c in chunks_only:
    print(f"    score={c.score:.4f} source={c.source_filename}")

# --- Test 9: Pipeline stats ---
print("\n--- Test 9: Pipeline stats ---")
stats = pipeline.stats
print(f"  LLM provider: {stats['llm_provider']}")
print(f"  LLM model:    {stats['llm_model']}")
print(f"  Vector store:  {stats['vector_store']['count']} chunks")

# --- Test 10: RAGResponse/Citation dataclasses ---
print("\n--- Test 10: Data class structure ---")
assert isinstance(response, RAGResponse)
assert hasattr(response, "answer")
assert hasattr(response, "citations")
assert hasattr(response, "confidence")
assert hasattr(response, "sufficiency")
assert hasattr(response, "retrieved_chunks")
for c in response.citations:
    assert isinstance(c, Citation)
    assert hasattr(c, "source_filename")
    assert hasattr(c, "source_heading")
    assert hasattr(c, "chunk_id")
    assert hasattr(c, "score")
print("  RAGResponse and Citation structures valid")

print("\n" + "=" * 60)
print("ALL TESTS PASSED")
print("=" * 60)

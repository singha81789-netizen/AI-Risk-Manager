"""End-to-end integration test for the RAG vector store."""

import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from rag.document_loader import validate_knowledge_base, load_documents
from rag.chunking import ChunkConfig, chunk_documents
from rag.embeddings import EmbeddingConfig, generate_embeddings
from rag.vector_store import VectorStore, VectorStoreConfig

print("--- Test 1: Import all RAG modules ---")
print("  All imports OK")

print()
print("--- Test 2: Validate knowledge base ---")
validation = validate_knowledge_base()
print(f"  is_valid={validation.is_valid}, doc_count={validation.doc_count}")

print()
print("--- Test 3: Load documents ---")
docs = load_documents()
print(f"  Loaded {len(docs)} documents")
for d in docs:
    cc = d.metadata.get("char_count", "?")
    print(f"    {d.filename}: {cc} chars")

print()
print("--- Test 4: Chunk documents ---")
chunks = chunk_documents(docs)
print(f"  Generated {len(chunks)} chunks")
for c in chunks[:3]:
    print(f"    {c.chunk_id}: {len(c.content)} chars, heading={c.source_heading}")

print()
print("--- Test 5: Generate embeddings ---")
config = EmbeddingConfig(provider="sentence-transformers", batch_size=32)
embedded = generate_embeddings(chunks, config)
dim = embedded[0].embedding.shape[0]
print(f"  Embedded {len(embedded)} chunks, dim={dim}")

print()
print("--- Test 6: Index into ChromaDB ---")
store = VectorStore(VectorStoreConfig(
    collection_name="test_run",
    persist_directory="data/chroma_db",
    distance_metric="cosine",
))
store.reset()
result = store.index(embedded)
print(f"  Indexed {result.indexed}/{result.total} chunks, collection_size={result.collection_size}")

print()
print("--- Test 7: Similarity search ---")
hits = store.search("high-value suspicious international transactions", top_k=3)
for i, h in enumerate(hits):
    print(f"  #{i+1} score={h.score:.4f} chunk_id={h.chunk_id}")
    print(f"       source={h.source_filename}, heading={h.source_heading}")
    print(f"       text={h.text[:80]}...")

print()
print("--- Test 8: Collection stats ---")
stats = store.get_stats()
print(f"  {stats}")

print()
print("--- Test 9: Search with metadata filter ---")
hits2 = store.search(
    "velocity checks",
    top_k=2,
    where={"source_filename": "analyst_investigation_procedures.md"},
)
print(f"  Filtered search returned {len(hits2)} results")
for h in hits2:
    print(f"    score={h.score:.4f} source={h.source_filename}")

print()
print("--- Test 10: Idempotent re-index ---")
result2 = store.index(embedded)
print(f"  Re-indexed {result2.indexed}/{result2.total}, collection_size={result2.collection_size}")

print()
print("=== ALL TESTS PASSED ===")

"""
RAG (Retrieval-Augmented Generation) module for the AI Risk Manager.

Provides document ingestion, validation, chunking, embedding, retrieval,
and question-answering for the fraud knowledge base.

Quick start — ask a question::

    from rag import RAGPipeline

    pipeline = RAGPipeline()
    response = pipeline.ask("What is the velocity threshold for fraud alerts?")
    print(response.answer)
    for c in response.citations:
        print(f"  [{c.source_filename}] {c.source_heading}")

Build the index::

    from rag import build_index

    result = build_index()
"""

from rag.document_loader import (
    KBValidationResult,
    LoadedDocument,
    get_document_stats,
    load_documents,
    validate_knowledge_base,
)
from rag.chunking import (
    ChunkConfig,
    DocumentChunk,
    chunk_document,
    chunk_documents,
    estimate_tokens,
)

# Lazy imports for heavy ML dependencies — only loaded when actually used
_embedding_imports_loaded = False
_vector_imports_loaded = False
_retriever_imports_loaded = False
_pipeline_imports_loaded = False


def _load_embedding_imports():
    global _embedding_imports_loaded
    if not _embedding_imports_loaded:
        global EmbeddingConfig, EmbeddingPipelineResult, EmbeddedChunk
        global build_embedding_index, generate_embeddings
        from rag.embeddings import (
            EmbeddingConfig,
            EmbeddingPipelineResult,
            EmbeddedChunk,
            build_embedding_index,
            generate_embeddings,
        )
        _embedding_imports_loaded = True


def _load_vector_imports():
    global _vector_imports_loaded
    if not _vector_imports_loaded:
        global IndexResult, SearchHit, VectorStore, VectorStoreConfig
        from rag.vector_store import (
            IndexResult,
            SearchHit,
            VectorStore,
            VectorStoreConfig,
        )
        _vector_imports_loaded = True


def _load_retriever_imports():
    global _retriever_imports_loaded
    if not _retriever_imports_loaded:
        global Retriever, RetrieverConfig, RetrievalResult
        from rag.retriever import (
            Retriever,
            RetrieverConfig,
            RetrievalResult,
        )
        _retriever_imports_loaded = True


def _load_pipeline_imports():
    global _pipeline_imports_loaded
    if not _pipeline_imports_loaded:
        global Citation, RAGPipeline, RAGPipelineConfig, RAGResponse
        from rag.rag_pipeline import (
            Citation,
            RAGPipeline,
            RAGPipelineConfig,
            RAGResponse,
        )
        _pipeline_imports_loaded = True


def __getattr__(name):
    """Lazy-load heavy ML-dependent symbols on first access."""
    _lazy_map = {
        "EmbeddingConfig": _load_embedding_imports,
        "EmbeddingPipelineResult": _load_embedding_imports,
        "EmbeddedChunk": _load_embedding_imports,
        "build_embedding_index": _load_embedding_imports,
        "generate_embeddings": _load_embedding_imports,
        "IndexResult": _load_vector_imports,
        "SearchHit": _load_vector_imports,
        "VectorStore": _load_vector_imports,
        "VectorStoreConfig": _load_vector_imports,
        "Retriever": _load_retriever_imports,
        "RetrieverConfig": _load_retriever_imports,
        "RetrievalResult": _load_retriever_imports,
        "Citation": _load_pipeline_imports,
        "RAGPipeline": _load_pipeline_imports,
        "RAGPipelineConfig": _load_pipeline_imports,
        "RAGResponse": _load_pipeline_imports,
    }
    if name in _lazy_map:
        _lazy_map[name]()
        return globals()[name]
    raise AttributeError(f"module 'rag' has no attribute '{name}'")


__all__ = [
    # Document loading
    "validate_knowledge_base",
    "load_documents",
    "get_document_stats",
    "LoadedDocument",
    "KBValidationResult",
    # Chunking
    "chunk_document",
    "chunk_documents",
    "ChunkConfig",
    "DocumentChunk",
    "estimate_tokens",
    # Embeddings
    "EmbeddingConfig",
    "EmbeddedChunk",
    "EmbeddingPipelineResult",
    "generate_embeddings",
    "build_embedding_index",
    # Vector store
    "VectorStore",
    "VectorStoreConfig",
    "SearchHit",
    "IndexResult",
    # Retriever
    "Retriever",
    "RetrieverConfig",
    "RetrievalResult",
    # RAG pipeline
    "RAGPipeline",
    "RAGPipelineConfig",
    "RAGResponse",
    "Citation",
    # Convenience aliases
    "validate_kb",
    "load_kb_documents",
    "chunk_kb_documents",
    "embed_chunks",
    "build_index",
]


# ---------------------------------------------------------------------------
# Convenience wrappers
# ---------------------------------------------------------------------------

def validate_kb() -> KBValidationResult:
    """Validate the default knowledge base directory.

    Returns
    -------
    KBValidationResult
        Validation result with ``is_valid`` flag, document count, and errors.
    """
    return validate_knowledge_base()


def load_kb_documents() -> list[LoadedDocument]:
    """Load all documents from the default knowledge base directory.

    Returns
    -------
    list[LoadedDocument]
        Loaded documents ready for chunking.

    Raises
    ------
    FileNotFoundError
        If the knowledge base directory does not exist.
    ValueError
        If no valid documents are found.
    """
    return load_documents()


def chunk_kb_documents(
    docs: list[LoadedDocument] | None = None,
    config: ChunkConfig | None = None,
) -> list[DocumentChunk]:
    """Load (optionally) and chunk all knowledge base documents.

    Parameters
    ----------
    docs:
        Pre-loaded documents.  If ``None``, documents are loaded from the
        default knowledge base directory.
    config:
        Chunking configuration.

    Returns
    -------
    list[DocumentChunk]
        All chunks ready for embedding and indexing.
    """
    if docs is None:
        docs = load_kb_documents()
    return chunk_documents(docs, config)


def embed_chunks(
    chunks: list[DocumentChunk] | None = None,
    config: "EmbeddingConfig | None" = None,
) -> list["EmbeddedChunk"]:
    """Chunk (optionally) and embed all knowledge base documents.

    Parameters
    ----------
    chunks:
        Pre-chunked chunks.  If ``None``, documents are loaded and
        chunked from the default knowledge base directory.
    config:
        Embedding configuration.

    Returns
    -------
    list[EmbeddedChunk]
        Chunks paired with their embedding vectors.
    """
    _load_embedding_imports()
    if chunks is None:
        chunks = chunk_kb_documents()
    return generate_embeddings(chunks, config)


def build_index(
    kb_dir=None,
    chunk_config: ChunkConfig | None = None,
    embedding_config: "EmbeddingConfig | None" = None,
) -> "EmbeddingPipelineResult":
    """End-to-end pipeline: load documents -> chunk -> embed.

    This is the primary entry point for building the knowledge base
    embedding index.

    Parameters
    ----------
    kb_dir:
        Knowledge base directory.  Defaults to ``src.config.KNOWLEDGE_BASE_DIR``.
    chunk_config:
        Chunking configuration.
    embedding_config:
        Embedding configuration.

    Returns
    -------
    EmbeddingPipelineResult
        Embedded chunks with metadata, ready for vector-store indexing.
    """
    _load_embedding_imports()
    return build_embedding_index(kb_dir, chunk_config, embedding_config)

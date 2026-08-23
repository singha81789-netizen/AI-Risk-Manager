"""
RAG (Retrieval-Augmented Generation) module for the AI Risk Manager.

Provides document ingestion, validation, chunking, and embedding for the
fraud knowledge base.  The retrieval and generation layers are not yet
implemented — this module covers the ingestion-to-embedding pipeline.

Quick start::

    from rag import build_index

    # One-call pipeline: load -> chunk -> embed
    result = build_index()

    # Access embeddings
    matrix = result.embeddings_matrix        # (n_chunks, dim) numpy array
    chunks  = result.embedded_chunks         # list[EmbeddedChunk]

Individual steps are also available::

    from rag import validate_kb, load_kb_documents, chunk_kb_documents, embed_chunks

    docs   = load_kb_documents()
    chunks = chunk_kb_documents(docs)
    embedded = embed_chunks(chunks)
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
from rag.embeddings import (
    EmbeddingConfig,
    EmbeddingPipelineResult,
    EmbeddedChunk,
    build_embedding_index,
    generate_embeddings,
)
from rag.vector_store import (
    IndexResult,
    SearchHit,
    VectorStore,
    VectorStoreConfig,
)

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
    config: EmbeddingConfig | None = None,
) -> list[EmbeddedChunk]:
    """Chunk (optionally) and embed all knowledge base documents.

    Parameters
    ----------
    chunks:
        Pre-chunked documents.  If ``None``, documents are loaded and
        chunked from the default knowledge base directory.
    config:
        Embedding configuration.

    Returns
    -------
    list[EmbeddedChunk]
        Chunks paired with their embedding vectors.
    """
    if chunks is None:
        chunks = chunk_kb_documents()
    return generate_embeddings(chunks, config)


def build_index(
    kb_dir=None,
    chunk_config: ChunkConfig | None = None,
    embedding_config: EmbeddingConfig | None = None,
) -> EmbeddingPipelineResult:
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
    return build_embedding_index(kb_dir, chunk_config, embedding_config)

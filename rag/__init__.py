"""
RAG (Retrieval-Augmented Generation) module for the AI Risk Manager.

Provides document ingestion, validation, and chunking for the fraud
knowledge base.  The full retrieval pipeline (embeddings, vector store,
retrieval) is not yet implemented — this module focuses on the ingestion
layer that prepares documents for future embedding and indexing.

Usage::

    from rag import validate_kb, load_kb_documents, chunk_kb_documents

    # Validate the knowledge base exists and is well-formed
    result = validate_kb()
    if not result.is_valid:
        raise RuntimeError(result.errors)

    # Load and chunk documents
    docs = load_kb_documents()
    chunks = chunk_kb_documents(docs)
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
    # Convenience aliases
    "validate_kb",
    "load_kb_documents",
    "chunk_kb_documents",
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

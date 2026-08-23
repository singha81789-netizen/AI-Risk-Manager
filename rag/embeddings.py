"""
Embedding generation for the AI Risk Manager RAG knowledge base.

Provides a self-contained embedding pipeline that:

1. Accepts ``DocumentChunk`` objects produced by ``rag.chunking``.
2. Generates dense vector embeddings using ``sentence-transformers``.
3. Returns ``EmbeddedChunk`` objects that pair each chunk's text and
   metadata with its embedding vector.

The module is deliberately decoupled from the fraud prediction pipeline —
it operates exclusively on knowledge-base documents and never touches
transaction data.

Supported backends
------------------
* **sentence-transformers** (default) — local model, no API key required.
  Uses ``all-MiniLM-L6-v2`` (22 M params, 384-dim) by default.
* **OpenAI** — set ``EMBEDDING_PROVIDER=openai`` and ``OPENAI_API_KEY``.
  Uses ``text-embedding-3-small`` (1536-dim).

Configuration is read from ``src.config`` and can be overridden via
environment variables.
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np

from rag.chunking import ChunkConfig, DocumentChunk, chunk_documents
from rag.document_loader import LoadedDocument, load_documents

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class EmbeddingConfig:
    """Configuration for the embedding pipeline.

    Attributes
    ----------
    provider:
        Embedding backend: ``"sentence-transformers"`` or ``"openai"``.
    model_name:
        Model identifier.  Default depends on the provider.
    batch_size:
        Number of chunks to embed per forward pass.
    normalize:
        If ``True``, L2-normalise embeddings to unit length.
    device:
        Torch device string (``"cpu"``, ``"cuda"``, ``"mps"``).
        Only used by sentence-transformers.
    """

    provider: str = "sentence-transformers"
    model_name: str = "all-MiniLM-L6-v2"
    batch_size: int = 32
    normalize: bool = True
    device: str = "cpu"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class EmbeddedChunk:
    """A document chunk paired with its embedding vector.

    Attributes
    ----------
    chunk:
        The original ``DocumentChunk`` with text and metadata.
    embedding:
        Dense embedding vector as a numpy array of shape ``(dim,)``.
    """

    chunk: DocumentChunk
    embedding: np.ndarray

    @property
    def chunk_id(self) -> str:
        return self.chunk.chunk_id

    @property
    def text(self) -> str:
        return self.chunk.content

    @property
    def source_filename(self) -> str:
        return self.chunk.source_filename

    @property
    def metadata(self) -> dict:
        """Chunk metadata merged with embedding metadata."""
        merged = dict(self.chunk.metadata)
        merged["embedding_provider"] = ""
        merged["embedding_model"] = ""
        merged["embedding_dim"] = int(self.embedding.shape[0])
        return merged


@dataclass
class EmbeddingPipelineResult:
    """Output of the full embedding pipeline."""

    embedded_chunks: List[EmbeddedChunk]
    provider: str
    model_name: str
    embedding_dim: int
    total_chunks: int
    total_documents: int

    @property
    def embeddings_matrix(self) -> np.ndarray:
        """Stacked embedding matrix of shape ``(n_chunks, embedding_dim)``."""
        if not self.embedded_chunks:
            return np.empty((0, 0))
        return np.stack([ec.embedding for ec in self.embedded_chunks])


# ---------------------------------------------------------------------------
# Abstract embedding backend
# ---------------------------------------------------------------------------

class EmbeddingBackend(ABC):
    """Interface for embedding model backends."""

    @abstractmethod
    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """Embed a list of texts and return an array of shape ``(n, dim)``."""

    @abstractmethod
    def get_dim(self) -> int:
        """Return the embedding dimension."""


# ---------------------------------------------------------------------------
# sentence-transformers backend
# ---------------------------------------------------------------------------

class SentenceTransformersBackend(EmbeddingBackend):
    """Embedding backend using ``sentence-transformers``."""

    def __init__(self, model_name: str, device: str = "cpu") -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError(
                "sentence-transformers is required for local embeddings. "
                "Install it with:  pip install sentence-transformers"
            )

        logger.info(f"Loading sentence-transformers model: {model_name}")
        self._model = SentenceTransformer(model_name, device=device)
        self._dim = self._model.get_sentence_embedding_dimension()
        logger.info(
            f"Model loaded — embedding dim={self._dim}, device={device}"
        )

    def embed_texts(self, texts: List[str]) -> np.ndarray:
        return self._model.encode(
            texts,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

    def get_dim(self) -> int:
        return self._dim


# ---------------------------------------------------------------------------
# OpenAI backend
# ---------------------------------------------------------------------------

class OpenAIBackend(EmbeddingBackend):
    """Embedding backend using the OpenAI embeddings API."""

    def __init__(self, model_name: str = "text-embedding-3-small") -> None:
        try:
            import openai
        except ImportError:
            raise ImportError(
                "openai package is required for OpenAI embeddings. "
                "Install it with:  pip install openai"
            )

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required "
                "for the OpenAI embedding backend."
            )

        self._client = openai.OpenAI(api_key=api_key)
        self._model = model_name
        # text-embedding-3-small is 1536-dim
        self._dim = 1536
        logger.info(f"OpenAI embedding backend initialised: {model_name}")

    def embed_texts(self, texts: List[str]) -> np.ndarray:
        # OpenAI API has a batch limit of 2048 per request
        all_embeddings: list[np.ndarray] = []
        batch_size = 2048

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            response = self._client.embeddings.create(
                model=self._model,
                input=batch,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

        return np.array(all_embeddings, dtype=np.float32)

    def get_dim(self) -> int:
        return self._dim


# ---------------------------------------------------------------------------
# Backend factory
# ---------------------------------------------------------------------------

def _create_backend(config: EmbeddingConfig) -> EmbeddingBackend:
    """Instantiate the appropriate embedding backend."""
    if config.provider == "sentence-transformers":
        return SentenceTransformersBackend(config.model_name, config.device)
    elif config.provider == "openai":
        return OpenAIBackend(config.model_name)
    else:
        raise ValueError(
            f"Unknown embedding provider: {config.provider!r}. "
            f"Supported: 'sentence-transformers', 'openai'"
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_embeddings(
    chunks: List[DocumentChunk],
    config: Optional[EmbeddingConfig] = None,
) -> List[EmbeddedChunk]:
    """Generate embeddings for a list of document chunks.

    Parameters
    ----------
    chunks:
        Chunks produced by ``rag.chunking.chunk_documents()``.
    config:
        Embedding configuration.  Uses sensible defaults if not provided.

    Returns
    -------
    list[EmbeddedChunk]
        Chunks paired with their embedding vectors.

    Raises
    ------
    ValueError
        If ``chunks`` is empty.
    """
    if not chunks:
        raise ValueError("Cannot embed an empty chunk list.")

    config = config or EmbeddingConfig()
    backend = _create_backend(config)

    texts = [c.content for c in chunks]
    logger.info(
        f"Embedding {len(texts)} chunks with "
        f"{config.provider}/{config.model_name}..."
    )

    embeddings = backend.embed_texts(texts)

    embedded: List[EmbeddedChunk] = []
    for chunk, vec in zip(chunks, embeddings):
        embedded.append(EmbeddedChunk(chunk=chunk, embedding=vec))

    logger.info(
        f"Embedding complete — {len(embedded)} vectors, "
        f"dim={backend.get_dim()}"
    )
    return embedded


def build_embedding_index(
    kb_dir=None,
    chunk_config: Optional[ChunkConfig] = None,
    embedding_config: Optional[EmbeddingConfig] = None,
) -> EmbeddingPipelineResult:
    """End-to-end pipeline: load documents -> chunk -> embed.

    This is the primary entry point for building the knowledge base
    embedding index.  It loads all documents from ``data/knowledge_base/``,
    splits them into chunks, and generates embeddings for every chunk.

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
    from src.config import KNOWLEDGE_BASE_DIR

    kb_dir = kb_dir or KNOWLEDGE_BASE_DIR
    chunk_config = chunk_config or ChunkConfig()
    embedding_config = embedding_config or EmbeddingConfig()

    # Step 1: Load documents
    docs = load_documents(kb_dir)
    logger.info(f"Loaded {len(docs)} documents from {kb_dir}")

    # Step 2: Chunk
    chunks = chunk_documents(docs, chunk_config)
    logger.info(f"Split into {len(chunks)} chunks")

    # Step 3: Embed
    embedded = generate_embeddings(chunks, embedding_config)

    # Determine embedding dim from first vector
    dim = int(embedded[0].embedding.shape[0]) if embedded else 0

    return EmbeddingPipelineResult(
        embedded_chunks=embedded,
        provider=embedding_config.provider,
        model_name=embedding_config.model_name,
        embedding_dim=dim,
        total_chunks=len(embedded),
        total_documents=len(docs),
    )

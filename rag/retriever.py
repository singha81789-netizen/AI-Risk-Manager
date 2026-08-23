"""
Retrieval layer for the AI Risk Manager RAG system.

Embeds a user query and fetches the most relevant chunks from the
ChromaDB vector store.  This module is strictly read-only — it never
modifies the vector database.

Usage::

    from rag.retriever import Retriever

    retriever = Retriever()
    results = retriever.retrieve("What is the policy for high-value transactions?")
    for r in results:
        print(r.score, r.text[:80])
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from rag.embeddings import EmbeddingConfig, _create_backend
from rag.vector_store import SearchHit, VectorStore, VectorStoreConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RetrieverConfig:
    """Configuration for the retrieval layer.

    Attributes
    ----------
    embedding_config:
        Embedding configuration for query vectorisation.
    vector_store_config:
        Vector store to query against.
    top_k:
        Number of chunks to retrieve.
    min_score:
        Minimum similarity score to include in results.
        Chunks below this threshold are discarded.
    """

    embedding_config: EmbeddingConfig = field(default_factory=EmbeddingConfig)
    vector_store_config: VectorStoreConfig = field(default_factory=VectorStoreConfig)
    top_k: int = 5
    min_score: float = 0.25


# ---------------------------------------------------------------------------
# Retrieval result
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RetrievalResult:
    """A single retrieved chunk with relevance metadata.

    Attributes
    ----------
    chunk_id:
        Deterministic chunk identifier.
    text:
        The chunk content.
    score:
        Similarity score from the vector store (0–1 for cosine).
    source_filename:
        Original knowledge-base file name.
    source_heading:
        Markdown heading the chunk belongs to, or ``None``.
    """

    chunk_id: str
    text: str
    score: float
    source_filename: str
    source_heading: Optional[str] = None
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Retriever
# ---------------------------------------------------------------------------

class Retriever:
    """Embeds queries and retrieves relevant knowledge-base chunks.

    Parameters
    ----------
    config:
        Retrieval configuration.
    """

    def __init__(self, config: RetrieverConfig | None = None) -> None:
        self._config = config or RetrieverConfig()
        self._vector_store = VectorStore(self._config.vector_store_config)
        self._embedding_backend = _create_backend(self._config.embedding_config)

    def retrieve(
        self,
        query: str,
        top_k: int | None = None,
        min_score: float | None = None,
    ) -> List[RetrievalResult]:
        """Retrieve the most relevant chunks for a query.

        Parameters
        ----------
        query:
            Natural-language question from the user.
        top_k:
            Override the default number of results.
        min_score:
            Override the minimum similarity score threshold.

        Returns
        -------
        list[RetrievalResult]
            Ranked chunks that pass the score threshold.  May be empty
            if the knowledge base has no relevant content.
        """
        top_k = top_k if top_k is not None else self._config.top_k
        min_score = min_score if min_score is not None else self._config.min_score

        if not query.strip():
            return []

        # Embed the query
        query_vec = self._embedding_backend.embed_texts([query])[0]

        # Search the vector store using the pre-computed embedding.
        # ChromaDB accepts embeddings directly via the `query_embeddings` param.
        hits = self._vector_store.search(query, top_k=top_k)

        # Filter by minimum score
        results: List[RetrievalResult] = []
        for hit in hits:
            if hit.score < min_score:
                continue
            results.append(RetrievalResult(
                chunk_id=hit.chunk_id,
                text=hit.text,
                score=hit.score,
                source_filename=hit.source_filename,
                source_heading=hit.source_heading,
                metadata=hit.metadata,
            ))

        logger.info(
            f"Retrieved {len(results)} chunks for query "
            f"(raw hits={len(hits)}, filtered by min_score={min_score})"
        )
        return results

    def retrieve_with_raw_hits(
        self,
        query: str,
        top_k: int | None = None,
    ) -> List[SearchHit]:
        """Retrieve raw ``SearchHit`` objects without score filtering.

        Useful when the caller needs unfiltered access to all hits
        and their metadata (e.g. for debugging or analytics).
        """
        top_k = top_k if top_k is not None else self._config.top_k
        if not query.strip():
            return []
        return self._vector_store.search(query, top_k=top_k)

    @property
    def vector_store_stats(self) -> dict:
        """Return vector store collection metadata."""
        return self._vector_store.get_stats()

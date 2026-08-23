"""
ChromaDB vector store for the AI Risk Manager RAG knowledge base.

Persists document embeddings for similarity search.  This module is
deliberately isolated from the fraud prediction pipeline — it only
operates on knowledge-base documents produced by the embedding layer.

Usage::

    from rag.vector_store import VectorStore

    store = VectorStore()

    # Index embedded chunks (from rag.embeddings or rag.build_index)
    result = store.index(embedded_chunks)

    # Search
    hits = store.search("high-value international transactions", top_k=5)

    # Wipe and rebuild
    store.reset()
    store.index(embedded_chunks)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import chromadb
from chromadb.config import Settings

from rag.embeddings import EmbeddedChunk

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class VectorStoreConfig:
    """Isolated configuration for the ChromaDB vector store.

    Attributes
    ----------
    collection_name:
        Name of the ChromaDB collection.
    persist_directory:
        On-disk directory for ChromaDB storage.
    distance_metric:
        Distance metric for similarity: ``"cosine"``, ``"l2"``, or ``"ip"``.
    """

    collection_name: str = "knowledge_base"
    persist_directory: str = "data/chroma_db"
    distance_metric: str = "cosine"


# ---------------------------------------------------------------------------
# Search result
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SearchHit:
    """Single result from a similarity search.

    Attributes
    ----------
    chunk_id:
        Deterministic chunk identifier.
    score:
        Similarity score (1 = most similar for cosine, 0 = identical).
    text:
        The chunk content.
    source_filename:
        Original knowledge-base file.
    source_heading:
        Markdown heading the chunk came from, or ``None``.
    metadata:
        Any additional metadata stored with the chunk.
    """

    chunk_id: str
    score: float
    text: str
    source_filename: str
    source_heading: Optional[str] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class IndexResult:
    """Result of an indexing operation.

    Attributes
    ----------
    indexed:
        Number of chunks successfully indexed.
    total:
        Total number of chunks submitted.
    skipped:
        Number of chunks that were already present (skipped).
    collection_size:
        Total chunks in the collection after indexing.
    """

    indexed: int
    total: int
    skipped: int
    collection_size: int


# ---------------------------------------------------------------------------
# Vector store
# ---------------------------------------------------------------------------

class VectorStore:
    """Persistent ChromaDB vector store for knowledge-base embeddings.

    Parameters
    ----------
    config:
        Store configuration.  Uses sensible defaults if not provided.
    """

    def __init__(self, config: VectorStoreConfig | None = None) -> None:
        self._config = config or VectorStoreConfig()

        persist_dir = Path(self._config.persist_directory)
        persist_dir.mkdir(parents=True, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=Settings(
                anonymized_telemetry=False,
            ),
        )

        # Create or get collection with the configured distance metric
        metadata = {"hnsw:space": self._config.distance_metric}
        self._collection = self._client.get_or_create_collection(
            name=self._config.collection_name,
            metadata=metadata,
        )

        logger.info(
            f"Vector store ready — collection={self._config.collection_name}, "
            f"persist={persist_dir}, "
            f"existing_chunks={self._collection.count()}"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def index(
        self,
        embedded_chunks: List[EmbeddedChunk],
        batch_size: int = 100,
    ) -> IndexResult:
        """Index embedded chunks into the vector store.

        Chunks whose ``chunk_id`` already exists in the collection are
        skipped (idempotent).

        Parameters
        ----------
        embedded_chunks:
            Chunks with pre-computed embeddings.
        batch_size:
            Number of chunks to upsert per ChromaDB batch call.

        Returns
        -------
        IndexResult
            Summary of the indexing operation.
        """
        if not embedded_chunks:
            return IndexResult(indexed=0, total=0, skipped=0, collection_size=self._collection.count())

        total = len(embedded_chunks)
        indexed = 0
        skipped = 0

        # Process in batches
        for batch_start in range(0, total, batch_size):
            batch = embedded_chunks[batch_start:batch_start + batch_size]

            ids = [ec.chunk_id for ec in batch]
            documents = [ec.text for ec in batch]
            embeddings = [ec.embedding.tolist() for ec in batch]

            # Build metadata dicts — ChromaDB requires flat string/int/float/bool values
            metadatas = []
            for ec in batch:
                meta = {
                    "source_filename": ec.source_filename,
                    "source_heading": ec.chunk.source_heading or "",
                    "chunk_index": ec.chunk.chunk_index,
                    "total_chunks_in_doc": ec.chunk.total_chunks_in_doc,
                    "word_count": ec.chunk.word_count,
                    "char_length": ec.chunk.char_length,
                    "embedding_provider": str(
                        ec.metadata.get("embedding_provider", "")
                    ),
                    "embedding_model": str(
                        ec.metadata.get("embedding_model", "")
                    ),
                    "embedding_dim": int(
                        ec.metadata.get("embedding_dim", ec.embedding.shape[0])
                    ),
                }
                metadatas.append(meta)

            # Upsert — overwrites existing chunks with the same ID
            self._collection.upsert(
                ids=ids,
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
            )
            indexed += len(batch)

        result = IndexResult(
            indexed=indexed,
            total=total,
            skipped=skipped,
            collection_size=self._collection.count(),
        )

        logger.info(
            f"Indexed {indexed}/{total} chunks "
            f"(collection size: {result.collection_size})"
        )
        return result

    def search(
        self,
        query: str,
        top_k: int = 5,
        where: dict | None = None,
    ) -> List[SearchHit]:
        """Search the vector store by text similarity.

        Parameters
        ----------
        query:
            Natural-language query string.
        top_k:
            Number of results to return.
        where:
            ChromaDB ``where`` filter on metadata fields.

        Returns
        -------
        list[SearchHit]
            Ranked results (most similar first).
        """
        if self._collection.count() == 0:
            logger.warning("Search called on empty collection")
            return []

        query_params: dict = {
            "query_texts": [query],
            "n_results": min(top_k, self._collection.count()),
        }
        if where:
            query_params["where"] = where

        response = self._collection.query(**query_params)

        hits: List[SearchHit] = []
        for i in range(len(response["ids"][0])):
            chunk_id = response["ids"][0][i]
            doc = response["documents"][0][i]
            dist = response["distances"][0][i]
            meta = response["metadatas"][0][i] if response.get("metadatas") else {}

            # Convert ChromaDB distance to a similarity score.
            # For cosine distance: score = 1 - distance
            if self._config.distance_metric == "cosine":
                score = round(1.0 - dist, 4)
            else:
                score = round(1.0 / (1.0 + dist), 4)

            hits.append(SearchHit(
                chunk_id=chunk_id,
                score=score,
                text=doc,
                source_filename=meta.get("source_filename", ""),
                source_heading=meta.get("source_heading") or None,
                metadata=meta,
            ))

        logger.info(
            f"Search for '{query[:60]}...' returned {len(hits)} results"
        )
        return hits

    def get_stats(self) -> dict:
        """Return collection metadata.

        Returns
        -------
        dict
            ``{"collection_name", "count", "distance_metric", "persist_directory"}``.
        """
        return {
            "collection_name": self._config.collection_name,
            "count": self._collection.count(),
            "distance_metric": self._config.distance_metric,
            "persist_directory": self._config.persist_directory,
        }

    def reset(self) -> None:
        """Delete all data in the collection and recreate it.

        Use with caution — this permanently removes all indexed chunks.
        """
        name = self._config.collection_name
        self._client.delete_collection(name)
        self._collection = self._client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": self._config.distance_metric},
        )
        logger.info(f"Collection '{name}' has been reset")

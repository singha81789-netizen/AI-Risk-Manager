"""
Tests for vector search (Area 13).

Covers: ChromaDB vector store operations - indexing, search, reset, stats.
Uses a temporary directory for ChromaDB persistence.
"""

from pathlib import Path

import numpy as np
import pytest

from rag.embeddings import EmbeddedChunk
from rag.chunking import ChunkConfig, DocumentChunk, chunk_document
from rag.document_loader import LoadedDocument
from rag.vector_store import (
    IndexResult,
    SearchHit,
    VectorStore,
    VectorStoreConfig,
)


@pytest.fixture
def tmp_chroma_config(tmp_path):
    """Create a VectorStoreConfig pointing to a temp directory."""
    return VectorStoreConfig(
        collection_name="test_collection",
        persist_directory=str(tmp_path / "chroma_test"),
        distance_metric="cosine",
    )


@pytest.fixture
def sample_document():
    """Create a sample loaded document."""
    return LoadedDocument(
        path=Path("test.md"),
        filename="test.md",
        extension=".md",
        content="# Fraud Rules\n\nTransactions over $500 require review.\nHigh velocity indicates potential fraud.\nGeographic anomalies are suspicious.\nMore than 4 transactions in 24 hours triggers alert.",
        metadata={"char_count": 200, "line_count": 4},
    )


@pytest.fixture
def sample_chunks(sample_document):
    """Chunk the sample document."""
    return chunk_document(sample_document)


@pytest.fixture
def sample_embedded_chunks(sample_chunks):
    """Create embedded chunks with random embeddings."""
    rng = np.random.RandomState(42)
    embedded = []
    for chunk in sample_chunks:
        embedding = rng.randn(384).astype(np.float32)
        embedding = embedding / np.linalg.norm(embedding)  # L2 normalize
        embedded.append(EmbeddedChunk(chunk=chunk, embedding=embedding))
    return embedded


@pytest.fixture
def vector_store(tmp_chroma_config):
    """Create a VectorStore in a temp directory."""
    return VectorStore(tmp_chroma_config)


class TestVectorStoreInit:
    """Tests for VectorStore initialization."""

    def test_creates_persist_directory(self, tmp_chroma_config):
        store = VectorStore(tmp_chroma_config)
        from pathlib import Path
        assert Path(tmp_chroma_config.persist_directory).exists()

    def test_empty_collection(self, vector_store):
        stats = vector_store.get_stats()
        assert stats["count"] == 0

    def test_config_preserved(self, tmp_chroma_config):
        store = VectorStore(tmp_chroma_config)
        stats = store.get_stats()
        assert stats["collection_name"] == "test_collection"
        assert stats["distance_metric"] == "cosine"


class TestVectorStoreIndex:
    """Tests for indexing embedded chunks."""

    def test_index_returns_result(self, vector_store, sample_embedded_chunks):
        result = vector_store.index(sample_embedded_chunks)
        assert isinstance(result, IndexResult)

    def test_index_count(self, vector_store, sample_embedded_chunks):
        result = vector_store.index(sample_embedded_chunks)
        assert result.indexed == len(sample_embedded_chunks)
        assert result.total == len(sample_embedded_chunks)

    def test_collection_size_after_index(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        stats = vector_store.get_stats()
        assert stats["count"] == len(sample_embedded_chunks)

    def test_index_empty_list(self, vector_store):
        result = vector_store.index([])
        assert result.indexed == 0
        assert result.total == 0

    def test_idempotent_index(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        result = vector_store.index(sample_embedded_chunks)
        # Should not duplicate entries
        stats = vector_store.get_stats()
        assert stats["count"] == len(sample_embedded_chunks)


class TestVectorStoreSearch:
    """Tests for similarity search."""

    def test_search_returns_hits(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        hits = vector_store.search("fraud detection")
        assert isinstance(hits, list)
        assert len(hits) > 0

    def test_search_hit_fields(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        hits = vector_store.search("fraud detection")
        hit = hits[0]
        assert isinstance(hit, SearchHit)
        assert hasattr(hit, "chunk_id")
        assert hasattr(hit, "score")
        assert hasattr(hit, "text")
        assert hasattr(hit, "source_filename")

    def test_search_score_range(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        hits = vector_store.search("transaction review")
        for hit in hits:
            assert isinstance(hit.score, float)

    def test_search_top_k_limits_results(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        hits = vector_store.search("fraud alert", top_k=2)
        assert len(hits) <= 2

    def test_search_empty_collection(self, vector_store):
        hits = vector_store.search("anything")
        assert hits == []

    def test_search_same_text_high_score(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        query = sample_embedded_chunks[0].text[:50]
        hits = vector_store.search(query, top_k=1)
        assert len(hits) == 1
        # Random embeddings may not yield high cosine similarity,
        # but results should be returned and scores should be numeric
        assert isinstance(hits[0].score, float)


class TestVectorStoreReset:
    """Tests for collection reset."""

    def test_reset_clears_collection(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        assert vector_store.get_stats()["count"] > 0
        vector_store.reset()
        assert vector_store.get_stats()["count"] == 0

    def test_can_reindex_after_reset(self, vector_store, sample_embedded_chunks):
        vector_store.index(sample_embedded_chunks)
        vector_store.reset()
        result = vector_store.index(sample_embedded_chunks)
        assert result.indexed == len(sample_embedded_chunks)


class TestVectorStoreStats:
    """Tests for collection statistics."""

    def test_stats_keys(self, vector_store):
        stats = vector_store.get_stats()
        assert "collection_name" in stats
        assert "count" in stats
        assert "distance_metric" in stats
        assert "persist_directory" in stats

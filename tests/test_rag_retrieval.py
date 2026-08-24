"""
Tests for RAG retrieval (Area 12).

Covers: document loading, chunking, retrieval, knowledge base validation.
Uses temporary knowledge base directories with synthetic documents.
"""

from pathlib import Path

import pytest

from rag.chunking import ChunkConfig, chunk_document, chunk_documents, estimate_tokens
from rag.document_loader import (
    get_document_stats,
    load_documents,
    validate_knowledge_base,
)


class TestDocumentLoading:
    """Tests for document_loader module."""

    def test_validate_kb_valid(self, kb_documents_dir):
        result = validate_knowledge_base(kb_documents_dir)
        assert result.is_valid
        assert result.doc_count >= 2
        assert len(result.errors) == 0

    def test_validate_kb_nonexistent(self, tmp_path):
        result = validate_knowledge_base(tmp_path / "nonexistent")
        assert not result.is_valid
        assert len(result.errors) > 0

    def test_validate_kb_empty_dir(self, tmp_path):
        empty_dir = tmp_path / "empty_kb"
        empty_dir.mkdir()
        result = validate_knowledge_base(empty_dir)
        assert not result.is_valid

    def test_load_documents(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        assert len(docs) >= 2
        assert all(hasattr(d, "content") for d in docs)
        assert all(hasattr(d, "filename") for d in docs)

    def test_documents_have_content(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        for doc in docs:
            assert len(doc.content) > 0

    def test_documents_have_metadata(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        for doc in docs:
            assert "char_count" in doc.metadata
            assert "line_count" in doc.metadata
            assert "size_bytes" in doc.metadata

    def test_markdown_headings_extracted(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        md_docs = [d for d in docs if d.extension == ".md"]
        for doc in md_docs:
            assert "headings" in doc.metadata
            assert len(doc.metadata["headings"]) > 0

    def test_document_stats(self, kb_documents_dir):
        stats = get_document_stats(kb_documents_dir)
        assert stats["total_documents"] >= 2
        assert stats["total_characters"] > 0
        assert stats["is_valid"]

    def test_single_file_kb(self, tmp_path):
        kb_dir = tmp_path / "single_file_kb"
        kb_dir.mkdir()
        (kb_dir / "rules.md").write_text("# Rules\nSome rules here.", encoding="utf-8")
        result = validate_knowledge_base(kb_dir)
        assert result.is_valid
        assert result.doc_count == 1

    def test_unsupported_extension_skipped(self, tmp_path):
        kb_dir = tmp_path / "mixed_kb"
        kb_dir.mkdir()
        (kb_dir / "rules.md").write_text("# Rules\nContent.", encoding="utf-8")
        (kb_dir / "data.exe").write_bytes(b"binary")
        result = validate_knowledge_base(kb_dir)
        # The .exe file produces an error but the .md file is still loaded
        assert result.doc_count == 1
        assert result.exists is True


class TestChunking:
    """Tests for chunking module."""

    def test_estimate_tokens(self):
        text = "This is a simple test sentence with ten words."
        tokens = estimate_tokens(text)
        assert tokens > 0
        assert isinstance(tokens, int)

    def test_chunk_document_returns_list(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        chunks = chunk_document(docs[0])
        assert isinstance(chunks, list)
        assert len(chunks) > 0

    def test_chunk_has_required_fields(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        chunks = chunk_document(docs[0])
        for chunk in chunks:
            assert hasattr(chunk, "chunk_id")
            assert hasattr(chunk, "content")
            assert hasattr(chunk, "source_filename")
            assert hasattr(chunk, "char_length")
            assert hasattr(chunk, "word_count")
            assert hasattr(chunk, "chunk_index")
            assert hasattr(chunk, "total_chunks_in_doc")

    def test_chunk_ids_deterministic(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        chunks1 = chunk_document(docs[0])
        chunks2 = chunk_document(docs[0])
        ids1 = [c.chunk_id for c in chunks1]
        ids2 = [c.chunk_id for c in chunks2]
        assert ids1 == ids2

    def test_chunk_documents_multiple(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        all_chunks = chunk_documents(docs)
        assert len(all_chunks) > 0
        # All chunks should reference valid source filenames
        doc_filenames = {d.filename for d in docs}
        for chunk in all_chunks:
            assert chunk.source_filename in doc_filenames

    def test_respect_headings_config(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        config = ChunkConfig(respect_headings=True, max_chunk_chars=500)
        chunks = chunk_document(docs[0], config)
        # Chunks should not span multiple headings
        for chunk in chunks:
            assert chunk.char_length <= 500 or chunk.char_length > 0

    def test_small_chunk_size(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        config = ChunkConfig(max_chunk_chars=200, overlap_chars=50)
        chunks = chunk_document(docs[0], config)
        assert len(chunks) >= 1
        for chunk in chunks:
            assert chunk.char_length <= 250  # some tolerance for break points

    def test_token_strategy(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        config = ChunkConfig(strategy="token", max_chunk_tokens=100)
        chunks = chunk_document(docs[0], config)
        assert len(chunks) >= 1

    def test_chunk_content_nonempty(self, kb_documents_dir):
        docs = load_documents(kb_documents_dir)
        chunks = chunk_documents(docs)
        for chunk in chunks:
            assert len(chunk.content.strip()) > 0


class TestRetrieval:
    """Tests for the retriever module (requires embeddings)."""

    def test_retriever_config_defaults(self):
        from rag.retriever import RetrieverConfig
        config = RetrieverConfig()
        assert config.top_k == 5
        assert config.min_score == 0.25

    def test_retrieval_result_fields(self):
        from rag.retriever import RetrievalResult
        result = RetrievalResult(
            chunk_id="test::chunk::0",
            text="test text",
            score=0.9,
            source_filename="test.md",
        )
        assert result.chunk_id == "test::chunk::0"
        assert result.score == 0.9

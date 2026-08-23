"""
Document chunking strategies for the AI Risk Manager knowledge base.

Provides configurable chunking that splits loaded documents into
overlapping text segments suitable for embedding and retrieval.

Two chunking strategies are available:

1. **Character-based** (default) — splits on character count with sentence
   boundary detection.  Fast and language-agnostic.
2. **Token-aware** — estimates token count using a simple heuristic
   (words * 1.3) to stay within embedding model context limits.  Better
   alignment with model behaviour but slightly slower.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional

from rag.document_loader import LoadedDocument


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ChunkConfig:
    """Configuration for document chunking.

    Attributes
    ----------
    max_chunk_chars:
        Maximum characters per chunk (character strategy).
    overlap_chars:
        Overlap between consecutive chunks in characters.
    min_chunk_chars:
        Minimum chunk size before forcing a break.
    respect_headings:
        If ``True``, never split across markdown heading boundaries.
    strategy:
        Chunking strategy: ``"character"`` or ``"token"``.
    max_chunk_tokens:
        Maximum estimated tokens per chunk (token strategy).
    overlap_tokens:
        Overlap between consecutive chunks in tokens (token strategy).
    """

    max_chunk_chars: int = 1000
    overlap_chars: int = 200
    min_chunk_chars: int = 100
    respect_headings: bool = True
    strategy: str = "character"
    max_chunk_tokens: int = 256
    overlap_tokens: int = 50


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DocumentChunk:
    """A single chunk extracted from a document.

    Attributes
    ----------
    chunk_id:
        Deterministic identifier: ``filename::heading_slug::index``.
    content:
        The chunk text ready for embedding.
    source_filename:
        Original filename the chunk came from.
    source_heading:
        Markdown heading this chunk falls under, or ``None``.
    char_offset:
        Character offset within the source document content.
    char_length:
        Character length of this chunk.
    word_count:
        Number of whitespace-separated words.
    chunk_index:
        Sequential index within the source document (0-based).
    total_chunks_in_doc:
        Total number of chunks produced from the source document.
    metadata:
        Arbitrary metadata dict propagated to embeddings.
    """

    chunk_id: str
    content: str
    source_filename: str
    source_heading: Optional[str] = None
    char_offset: int = 0
    char_length: int = 0
    word_count: int = 0
    chunk_index: int = 0
    total_chunks_in_doc: int = 0
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Token estimation (lightweight — no external dependency)
# ---------------------------------------------------------------------------

_WORD_RE = re.compile(r"\b\w+\b")


def estimate_tokens(text: str) -> int:
    """Estimate token count using a word-count heuristic.

    Uses ``ceil(word_count * 1.3)`` which approximates BPE tokenisation
    for English text.  Sufficient for chunk-size decisions without pulling
    in a full tokenizer dependency.
    """
    word_count = len(_WORD_RE.findall(text))
    # Rough BPE approximation: ~1.3 tokens per English word
    return int(word_count * 1.3) + 1


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


def _split_by_headings(text: str) -> List[tuple[Optional[str], str]]:
    """Split markdown text into sections by headings.

    Returns a list of ``(heading, body)`` tuples.  Text before the first
    heading is returned with ``heading=None``.
    """
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return [(None, text)]

    sections: list[tuple[Optional[str], str]] = []

    # Text before the first heading
    preamble = text[: matches[0].start()].strip()
    if preamble:
        sections.append((None, preamble))

    for i, match in enumerate(matches):
        heading = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append((heading, body))

    return sections


def _find_break_point(text: str, start: int, end: int) -> int:
    """Find a natural break point (sentence > paragraph > line > word)."""
    for sep in (". ", ".\n", "\n\n", "\n", " "):
        last_sep = text.rfind(sep, start, end)
        if last_sep > start:
            return last_sep + len(sep)
    return end


def _sliding_window_chars(
    text: str,
    max_chars: int,
    overlap: int,
    min_chars: int,
) -> List[str]:
    """Character-based sliding window with sentence-boundary detection."""
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = start + max_chars

        if end < len(text):
            end = _find_break_point(text, start + min_chars, end)

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = end - overlap

    return chunks


def _sliding_window_tokens(
    text: str,
    max_tokens: int,
    overlap_tokens: int,
) -> List[str]:
    """Token-aware sliding window.  Splits on natural boundaries while
    respecting the estimated token budget."""
    if estimate_tokens(text) <= max_tokens:
        return [text]

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        sent_tokens = estimate_tokens(sentence)

        if current_tokens + sent_tokens > max_tokens and current:
            chunks.append(" ".join(current))
            # Keep overlap
            overlap_words: list[str] = []
            overlap_tok = 0
            for s in reversed(current):
                st = estimate_tokens(s)
                if overlap_tok + st > overlap_tokens:
                    break
                overlap_words.insert(0, s)
                overlap_tok += st
            current = overlap_words
            current_tokens = overlap_tok

        current.append(sentence)
        current_tokens += sent_tokens

    if current:
        chunks.append(" ".join(current))

    return chunks


def _make_chunk_id(filename: str, heading: Optional[str], index: int) -> str:
    """Build a deterministic chunk identifier."""
    slug = "_".join(heading.split()) if heading else "preamble"
    return f"{filename}::{slug}::{index}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chunk_document(
    doc: LoadedDocument,
    config: Optional[ChunkConfig] = None,
) -> List[DocumentChunk]:
    """Split a loaded document into overlapping chunks.

    Parameters
    ----------
    doc:
        A loaded document with content and metadata.
    config:
        Chunking configuration.  Uses sensible defaults if not provided.

    Returns
    -------
    list[DocumentChunk]
        Ordered list of document chunks with full metadata.
    """
    config = config or ChunkConfig()
    chunks: List[DocumentChunk] = []

    if config.respect_headings and doc.extension == ".md":
        sections = _split_by_headings(doc.content)
    else:
        sections = [(None, doc.content)]

    # Pre-count total chunks to populate total_chunks_in_doc
    raw_section_chunks: list[tuple[Optional[str], List[str]]] = []
    for heading, body in sections:
        if config.strategy == "token":
            raw_chunks = _sliding_window_tokens(
                body, config.max_chunk_tokens, config.overlap_tokens,
            )
        else:
            raw_chunks = _sliding_window_chars(
                body, config.max_chunk_chars, config.overlap_chars,
                config.min_chunk_chars,
            )
        raw_section_chunks.append((heading, raw_chunks))

    total_chunks = sum(len(rc) for _, rc in raw_section_chunks)

    global_offset = 0
    chunk_index = 0

    for heading, raw_chunks in raw_section_chunks:
        for chunk_text in raw_chunks:
            word_count = len(chunk_text.split())
            chunk = DocumentChunk(
                chunk_id=_make_chunk_id(doc.filename, heading, chunk_index),
                content=chunk_text,
                source_filename=doc.filename,
                source_heading=heading,
                char_offset=global_offset,
                char_length=len(chunk_text),
                word_count=word_count,
                chunk_index=chunk_index,
                total_chunks_in_doc=total_chunks,
                metadata={
                    "extension": doc.extension,
                    "heading": heading,
                    "strategy": config.strategy,
                },
            )
            chunks.append(chunk)
            global_offset += len(chunk_text)
            chunk_index += 1

    return chunks


def chunk_documents(
    docs: List[LoadedDocument],
    config: Optional[ChunkConfig] = None,
) -> List[DocumentChunk]:
    """Chunk multiple documents.

    Parameters
    ----------
    docs:
        List of loaded documents.
    config:
        Chunking configuration.

    Returns
    -------
    list[DocumentChunk]
        All chunks from all documents, ordered by source file then position.
    """
    config = config or ChunkConfig()
    all_chunks: List[DocumentChunk] = []

    for doc in docs:
        doc_chunks = chunk_document(doc, config)
        all_chunks.extend(doc_chunks)

    return all_chunks

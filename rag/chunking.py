"""
Document chunking strategies for the AI Risk Manager knowledge base.

Provides configurable chunking that splits loaded documents into
overlapping text segments suitable for embedding and retrieval.
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
    """Configuration for document chunking."""

    max_chunk_chars: int = 1000
    overlap_chars: int = 200
    min_chunk_chars: int = 100
    respect_headings: bool = True


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DocumentChunk:
    """A single chunk extracted from a document."""

    chunk_id: str
    content: str
    source_filename: str
    source_heading: Optional[str] = None
    char_offset: int = 0
    char_length: int = 0
    metadata: dict = field(default_factory=dict)


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


def _sliding_window(
    text: str,
    max_chars: int,
    overlap: int,
    min_chars: int,
) -> List[str]:
    """Split text into overlapping windows of ``max_chars`` characters."""
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = start + max_chars

        if end < len(text):
            # Try to break at a sentence boundary
            for sep in (". ", ".\n", "\n\n", "\n", " "):
                last_sep = text.rfind(sep, start + min_chars, end)
                if last_sep > start:
                    end = last_sep + len(sep)
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = end - overlap

    return chunks


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
        Ordered list of document chunks.
    """
    config = config or ChunkConfig()
    chunks: List[DocumentChunk] = []

    if config.respect_headings and doc.extension == ".md":
        sections = _split_by_headings(doc.content)
    else:
        sections = [(None, doc.content)]

    global_offset = 0

    for heading, body in sections:
        raw_chunks = _sliding_window(
            body,
            max_chars=config.max_chunk_chars,
            overlap=config.overlap_chars,
            min_chars=config.min_chunk_chars,
        )

        for i, chunk_text in enumerate(raw_chunks):
            chunk_id = f"{doc.filename}::{'_'.join(heading.split()) if heading else 'preamble'}::{i}"
            chunks.append(
                DocumentChunk(
                    chunk_id=chunk_id,
                    content=chunk_text,
                    source_filename=doc.filename,
                    source_heading=heading,
                    char_offset=global_offset,
                    char_length=len(chunk_text),
                    metadata={
                        "extension": doc.extension,
                        "heading": heading,
                    },
                )
            )
            global_offset += len(chunk_text)

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

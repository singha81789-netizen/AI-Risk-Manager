"""
Document loading and validation for the AI Risk Manager knowledge base.

Supports loading Markdown, plain text, and CSV documents from the
``data/knowledge_base/`` directory.  Validates document existence and
readability at startup so that missing or corrupt files fail fast
instead of at query time.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from src.config import KNOWLEDGE_BASE_DIR

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported file extensions
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS = {".md", ".txt", ".csv"}

# Regex for extracting markdown headings (used for section metadata).
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LoadedDocument:
    """A single document loaded from the knowledge base.

    Attributes
    ----------
    path:
        Absolute path to the source file.
    filename:
        Bare filename (e.g. ``fraud_risk_indicators.md``).
    extension:
        File extension including the dot (e.g. ``.md``).
    content:
        Full text content of the document.
    metadata:
        Arbitrary metadata dict.  Always includes ``size_bytes``,
        ``line_count``, ``char_count``, and ``headings`` (for Markdown).
    """

    path: Path
    filename: str
    extension: str
    content: str
    metadata: dict = field(default_factory=dict)


@dataclass
class KBValidationResult:
    """Result of knowledge base validation."""

    kb_dir: Path
    exists: bool
    doc_count: int
    documents: List[LoadedDocument] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return self.exists and self.doc_count > 0 and len(self.errors) == 0


# ---------------------------------------------------------------------------
# Metadata extraction helpers
# ---------------------------------------------------------------------------

def _extract_markdown_headings(text: str) -> List[dict]:
    """Return a list of heading dicts with level and text."""
    headings: list[dict] = []
    for match in _HEADING_RE.finditer(text):
        level = len(match.group(1))  # number of '#' characters
        headings.append({
            "level": level,
            "text": match.group(2).strip(),
            "offset": match.start(),
        })
    return headings


def _extract_metadata(path: Path, content: str, ext: str) -> dict:
    """Build a metadata dict for a loaded document."""
    stat = path.stat()
    meta: dict = {
        "size_bytes": stat.st_size,
        "line_count": content.count("\n") + 1,
        "char_count": len(content),
    }
    if ext == ".md":
        meta["headings"] = _extract_markdown_headings(content)
        meta["heading_count"] = len(meta["headings"])
    return meta


# ---------------------------------------------------------------------------
# Loading helpers
# ---------------------------------------------------------------------------

def _load_markdown(path: Path) -> str:
    """Read a Markdown file and return its content."""
    return path.read_text(encoding="utf-8")


def _load_text(path: Path) -> str:
    """Read a plain text file and return its content."""
    return path.read_text(encoding="utf-8")


def _load_csv(path: Path) -> str:
    """Read a CSV file and convert to a text representation.

    Each row is rendered as ``header: value | header: value`` for
    downstream chunking and embedding.
    """
    text = path.read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[str] = []
    for row in reader:
        parts = [f"{k}: {v}" for k, v in row.items() if v]
        rows.append(" | ".join(parts))
    return "\n".join(rows)


_LOADERS = {
    ".md": _load_markdown,
    ".txt": _load_text,
    ".csv": _load_csv,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_knowledge_base(
    kb_dir: Optional[Path] = None,
) -> KBValidationResult:
    """Validate that the knowledge base directory exists and contains documents.

    Parameters
    ----------
    kb_dir:
        Path to the knowledge base directory.  Defaults to
        ``src.config.KNOWLEDGE_BASE_DIR``.

    Returns
    -------
    KBValidationResult
        Validation result with document list and any errors encountered.
    """
    kb_dir = kb_dir or KNOWLEDGE_BASE_DIR
    result = KBValidationResult(kb_dir=kb_dir, exists=False, doc_count=0)

    if not kb_dir.exists():
        result.errors.append(
            f"Knowledge base directory does not exist: {kb_dir}"
        )
        return result

    if not kb_dir.is_dir():
        result.errors.append(
            f"Knowledge base path is not a directory: {kb_dir}"
        )
        return result

    result.exists = True

    files = sorted(kb_dir.iterdir())
    docs: List[LoadedDocument] = []

    for fpath in files:
        if fpath.is_dir():
            continue

        ext = fpath.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            result.errors.append(
                f"Unsupported file type '{ext}': {fpath.name}"
            )
            continue

        try:
            loader = _LOADERS[ext]
            content = loader(fpath)
            if not content.strip():
                result.errors.append(f"Empty document: {fpath.name}")
                continue

            metadata = _extract_metadata(fpath, content, ext)
            doc = LoadedDocument(
                path=fpath,
                filename=fpath.name,
                extension=ext,
                content=content,
                metadata=metadata,
            )
            docs.append(doc)
        except Exception as exc:
            result.errors.append(f"Failed to load {fpath.name}: {exc}")

    result.documents = docs
    result.doc_count = len(docs)

    if result.doc_count == 0:
        result.errors.append(
            "Knowledge base is empty — no valid documents found"
        )

    return result


def load_documents(
    kb_dir: Optional[Path] = None,
) -> List[LoadedDocument]:
    """Load all supported documents from the knowledge base directory.

    Parameters
    ----------
    kb_dir:
        Path to the knowledge base directory.  Defaults to
        ``src.config.KNOWLEDGE_BASE_DIR``.

    Returns
    -------
    list[LoadedDocument]
        Loaded documents with content and metadata.

    Raises
    ------
    FileNotFoundError
        If the knowledge base directory does not exist.
    ValueError
        If no valid documents are found.
    """
    kb_dir = kb_dir or KNOWLEDGE_BASE_DIR

    if not kb_dir.exists():
        raise FileNotFoundError(
            f"Knowledge base directory not found: {kb_dir}"
        )

    result = validate_knowledge_base(kb_dir)

    if not result.is_valid:
        error_summary = "; ".join(result.errors)
        raise ValueError(
            f"Knowledge base validation failed: {error_summary}"
        )

    logger.info(
        f"Loaded {result.doc_count} documents from {kb_dir}"
    )
    return result.documents


def get_document_stats(
    kb_dir: Optional[Path] = None,
) -> dict:
    """Return summary statistics about the knowledge base.

    Returns
    -------
    dict
        Keys: ``total_documents``, ``total_characters``, ``total_bytes``,
        ``total_lines``, ``extensions``, ``filenames``.
    """
    kb_dir = kb_dir or KNOWLEDGE_BASE_DIR
    result = validate_knowledge_base(kb_dir)

    total_chars = sum(d.metadata.get("char_count", len(d.content)) for d in result.documents)
    total_bytes = sum(d.metadata.get("size_bytes", 0) for d in result.documents)
    total_lines = sum(d.metadata.get("line_count", 0) for d in result.documents)
    extensions = {}
    for doc in result.documents:
        extensions[doc.extension] = extensions.get(doc.extension, 0) + 1

    return {
        "total_documents": result.doc_count,
        "total_characters": total_chars,
        "total_bytes": total_bytes,
        "total_lines": total_lines,
        "extensions": extensions,
        "filenames": [d.filename for d in result.documents],
        "is_valid": result.is_valid,
        "errors": result.errors,
    }

#!/usr/bin/env python3
"""
Standalone knowledge base validation script.

Run directly to verify that the knowledge base directory exists and
contains valid documents::

    python scripts/validate_kb.py

Exit codes:
    0 — Knowledge base is valid.
    1 — Validation failed (missing directory, no documents, or errors).
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path so imports resolve.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.config import KB_MIN_DOCUMENTS, KNOWLEDGE_BASE_DIR
from rag.document_loader import validate_knowledge_base, get_document_stats


def main() -> int:
    print("=" * 60)
    print("AI Risk Manager — Knowledge Base Validation")
    print("=" * 60)
    print()

    # 1. Check directory
    print(f"Knowledge base directory: {KNOWLEDGE_BASE_DIR}")
    if not KNOWLEDGE_BASE_DIR.exists():
        print(f"  ERROR: Directory does not exist.")
        print()
        print("Create it with:")
        print(f"  mkdir -p {KNOWLEDGE_BASE_DIR}")
        return 1

    if not KNOWLEDGE_BASE_DIR.is_dir():
        print(f"  ERROR: Path exists but is not a directory.")
        return 1

    print(f"  OK — directory exists")
    print()

    # 2. Validate documents
    print("Validating documents...")
    result = validate_knowledge_base()

    if result.errors:
        print()
        for err in result.errors:
            print(f"  ERROR: {err}")
        print()

    if not result.exists:
        print("RESULT: FAIL — knowledge base directory is invalid")
        return 1

    if result.doc_count == 0:
        print("RESULT: FAIL — no valid documents found")
        return 1

    if result.doc_count < KB_MIN_DOCUMENTS:
        print(
            f"RESULT: FAIL — found {result.doc_count} document(s), "
            f"minimum required is {KB_MIN_DOCUMENTS}"
        )
        return 1

    # 3. Print document summary
    print(f"  Found {result.doc_count} document(s):")
    for doc in result.documents:
        size_kb = doc.metadata.get("size_bytes", 0) / 1024
        lines = doc.content.count("\n") + 1
        print(f"    - {doc.filename} ({size_kb:.1f} KB, {lines} lines)")
    print()

    # 4. Print stats
    stats = get_document_stats()
    print(f"  Total characters: {stats['total_characters']:,}")
    print(f"  Total bytes:      {stats['total_bytes']:,}")
    print(f"  Extensions:       {stats['extensions']}")
    print()

    print("RESULT: PASS — knowledge base is valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())

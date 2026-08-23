"""
RAG question-answering pipeline for the AI Risk Manager.

Orchestrates query embedding → retrieval → LLM generation into a single
call.  The generated answer is grounded **only** in the retrieved context.
If the knowledge base does not contain enough information, the pipeline
says so explicitly and never invents policy rules.

Usage::

    from rag.rag_pipeline import RAGPipeline

    pipeline = RAGPipeline()
    response = pipeline.ask("What is the velocity threshold for fraud alerts?")

    print(response.answer)
    for c in response.citations:
        print(f"  [{c.source_filename}] {c.source_heading}")

RAG is for **explanation, policy retrieval, and risk knowledge only**.
It must never be used to decide whether a transaction is fraudulent.
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

from rag.retriever import Retriever, RetrieverConfig, RetrievalResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RAGPipelineConfig:
    """Full configuration for the RAG pipeline.

    Attributes
    ----------
    retriever_config:
        Retrieval-layer configuration.
    llm_provider:
        LLM backend: ``"openai"`` or ``"null"`` (offline fallback).
    llm_model:
        Model identifier for the LLM provider.
    llm_temperature:
        Sampling temperature for the LLM.
    llm_max_tokens:
        Maximum tokens in the generated answer.
    top_k:
        Number of context chunks to retrieve.
    min_relevance:
        Minimum similarity score to include a chunk as context.
    """

    retriever_config: RetrieverConfig = field(default_factory=RetrieverConfig)
    llm_provider: str = "null"
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 512
    top_k: int = 5
    min_relevance: float = 0.25


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Citation:
    """A source document citation returned with the answer.

    Attributes
    ----------
    source_filename:
        Name of the knowledge-base file the chunk came from.
    source_heading:
        Section heading within the document.
    chunk_id:
        Deterministic chunk identifier.
    score:
        Similarity score of this chunk against the query.
    """

    source_filename: str
    source_heading: Optional[str]
    chunk_id: str
    score: float


@dataclass
class RAGResponse:
    """Complete response from the RAG pipeline.

    Attributes
    ----------
    answer:
        The generated answer (or a "not enough information" message).
    citations:
        Source documents and sections used to generate the answer.
    confidence:
        Overall confidence score (0–1).  Computed from the mean retrieval
        score and the fraction of chunks that contributed to the answer.
    retrieved_chunks:
        Raw retrieval results before LLM generation.
    sufficiency:
        One of ``"sufficient"``, ``"partial"``, or ``"insufficient"``.
    """

    answer: str
    citations: List[Citation] = field(default_factory=list)
    confidence: float = 0.0
    retrieved_chunks: List[RetrievalResult] = field(default_factory=list)
    sufficiency: str = "insufficient"  # "sufficient" | "partial" | "insufficient"


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a risk-management and fraud-prevention policy assistant for a
financial institution.  Your role is to answer analyst questions about
policies, procedures, risk indicators, and investigation guidelines.

RULES — follow these strictly:
1. Answer ONLY using the provided context.  If the context does not
   contain enough information to answer, say so clearly.  NEVER invent
   or infer policy rules that are not explicitly stated.
2. When citing a source, reference the document name and section heading.
3. If the context partially addresses the question, answer what you can
   and explain what is missing.
4. If the context contains no relevant information, respond with:
   "The knowledge base does not contain sufficient information to answer
   this question.  Please consult the relevant policy document or escalate
   to the risk management team."
5. Never provide specific transaction decisions (approve / decline /
   flag).  This tool is for policy and procedure knowledge only.
6. Keep your answer concise and actionable for a fraud analyst.
"""


def _build_context_block(chunks: List[RetrievalResult]) -> str:
    """Format retrieved chunks into a numbered context block for the LLM."""
    parts: list[str] = []
    for i, chunk in enumerate(chunks, 1):
        heading = chunk.source_heading or "(overview)"
        parts.append(
            f"[{i}] Source: {chunk.source_filename} — {heading}\n"
            f"    Relevance: {chunk.score:.2f}\n"
            f"    Content:\n{chunk.text}"
        )
    return "\n\n".join(parts)


def _build_user_message(query: str, context_block: str) -> str:
    """Compose the full user message for the LLM."""
    return (
        f"## Retrieved context\n\n{context_block}\n\n"
        f"## Analyst question\n\n{query}\n\n"
        f"## Instructions\n\n"
        f"Using ONLY the context above, provide a concise, actionable answer.\n"
        f"If the context is insufficient, say so explicitly."
    )


# ---------------------------------------------------------------------------
# LLM backends
# ---------------------------------------------------------------------------

class LLMBackend(ABC):
    """Interface for LLM generation backends."""

    @abstractmethod
    def generate(self, system_prompt: str, user_message: str) -> str:
        """Generate a completion given system and user messages."""


class NullLLMBackend(LLMBackend):
    """Offline fallback — returns the retrieved context verbatim.

    Useful when no LLM API key is configured or during testing.
    """

    def generate(self, system_prompt: str, user_message: str) -> str:
        return (
            "[Offline mode — no LLM configured]\n\n"
            "The retrieved context is provided above.  "
            "Configure OPENAI_API_KEY to enable generated answers."
        )


class OpenAIBackend(LLMBackend):
    """OpenAI chat completion backend."""

    def __init__(self, model: str = "gpt-4o-mini", temperature: float = 0.1,
                 max_tokens: int = 512) -> None:
        try:
            import openai
        except ImportError:
            raise ImportError(
                "openai package is required for LLM generation. "
                "Install it with:  pip install openai"
            )

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required "
                "for the OpenAI LLM backend."
            )

        self._client = openai.OpenAI(api_key=api_key)
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        logger.info(f"OpenAI LLM backend initialised: {model}")

    def generate(self, system_prompt: str, user_message: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=self._temperature,
            max_tokens=self._max_tokens,
        )
        return response.choices[0].message.content or ""


def _create_llm_backend(config: RAGPipelineConfig) -> LLMBackend:
    """Instantiate the appropriate LLM backend."""
    if config.llm_provider == "openai":
        return OpenAIBackend(
            model=config.llm_model,
            temperature=config.llm_temperature,
            max_tokens=config.llm_max_tokens,
        )
    elif config.llm_provider == "null":
        return NullLLMBackend()
    else:
        raise ValueError(
            f"Unknown LLM provider: {config.llm_provider!r}. "
            f"Supported: 'openai', 'null'"
        )


# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------

def _compute_confidence(chunks: List[RetrievalResult], answer: str) -> tuple[float, str]:
    """Score overall confidence and sufficiency.

    Returns
    -------
    (confidence, sufficiency)
        confidence: 0–1 float.
        sufficiency: "sufficient" | "partial" | "insufficient".
    """
    if not chunks:
        return 0.0, "insufficient"

    mean_score = sum(c.score for c in chunks) / len(chunks)

    # Check if the answer indicates insufficient information
    insufficient_signals = [
        "does not contain sufficient information",
        "knowledge base does not",
        "insufficient information",
        "no relevant information",
        "not enough information",
        "please consult",
        "offline mode",
    ]
    answer_lower = answer.lower()
    indicates_insufficient = any(s in answer_lower for s in insufficient_signals)

    if indicates_insufficient:
        return max(mean_score * 0.3, 0.0), "insufficient"

    # Heuristic: if the top chunk score is very high and we have multiple
    # good chunks, confidence is high
    top_score = chunks[0].score if chunks else 0.0
    good_chunks = sum(1 for c in chunks if c.score >= 0.4)
    coverage = good_chunks / len(chunks) if chunks else 0.0

    confidence = (mean_score * 0.4 + top_score * 0.3 + coverage * 0.3)
    confidence = round(min(max(confidence, 0.0), 1.0), 3)

    if confidence >= 0.6:
        sufficiency = "sufficient"
    elif confidence >= 0.35:
        sufficiency = "partial"
    else:
        sufficiency = "insufficient"

    return confidence, sufficiency


# ---------------------------------------------------------------------------
# RAG Pipeline
# ---------------------------------------------------------------------------

class RAGPipeline:
    """End-to-end RAG question-answering pipeline.

    This class is the primary entry point for the RAG system.  It is
    explicitly isolated from the fraud prediction pipeline — it answers
    policy and procedure questions only.

    Parameters
    ----------
    config:
        Full pipeline configuration.  Uses sensible defaults if not provided.
    """

    def __init__(self, config: RAGPipelineConfig | None = None) -> None:
        self._config = config or RAGPipelineConfig()
        self._retriever = Retriever(self._config.retriever_config)
        self._llm = _create_llm_backend(self._config)

    def ask(
        self,
        question: str,
        top_k: int | None = None,
        min_relevance: float | None = None,
    ) -> RAGResponse:
        """Answer a risk-related question from the knowledge base.

        Parameters
        ----------
        question:
            Natural-language question from a fraud analyst.
        top_k:
            Override the number of context chunks to retrieve.
        min_relevance:
            Override the minimum similarity score threshold.

        Returns
        -------
        RAGResponse
            Answer with citations, confidence score, and sufficiency flag.
        """
        top_k = top_k if top_k is not None else self._config.top_k
        min_relevance = min_relevance if min_relevance is not None else self._config.min_relevance

        logger.info(f"RAG query: {question[:80]}...")

        # Step 1: Retrieve relevant chunks
        chunks = self._retriever.retrieve(
            question, top_k=top_k, min_score=min_relevance,
        )

        # Step 2: Handle empty retrieval
        if not chunks:
            insufficient_answer = (
                "The knowledge base does not contain sufficient information "
                "to answer this question.  Please consult the relevant "
                "policy document or escalate to the risk management team."
            )
            return RAGResponse(
                answer=insufficient_answer,
                citations=[],
                confidence=0.0,
                retrieved_chunks=[],
                sufficiency="insufficient",
            )

        # Step 3: Build context and generate answer
        context_block = _build_context_block(chunks)
        user_message = _build_user_message(question, context_block)
        answer = self._llm.generate(_SYSTEM_PROMPT, user_message)

        # Step 4: Build citations
        citations = [
            Citation(
                source_filename=c.source_filename,
                source_heading=c.source_heading,
                chunk_id=c.chunk_id,
                score=c.score,
            )
            for c in chunks
        ]

        # Step 5: Compute confidence and sufficiency
        confidence, sufficiency = _compute_confidence(chunks, answer)

        response = RAGResponse(
            answer=answer,
            citations=citations,
            confidence=confidence,
            retrieved_chunks=chunks,
            sufficiency=sufficiency,
        )

        logger.info(
            f"RAG response: sufficiency={sufficiency}, "
            f"confidence={confidence}, citations={len(citations)}"
        )
        return response

    def retrieve_only(
        self,
        question: str,
        top_k: int | None = None,
        min_relevance: float | None = None,
    ) -> List[RetrievalResult]:
        """Retrieve relevant chunks without LLM generation.

        Useful when the caller wants to handle display/generation
        themselves, or for debugging the retrieval layer.
        """
        top_k = top_k if top_k is not None else self._config.top_k
        min_relevance = min_relevance if min_relevance is not None else self._config.min_relevance
        return self._retriever.retrieve(
            question, top_k=top_k, min_score=min_relevance,
        )

    @property
    def stats(self) -> dict:
        """Return pipeline and vector store metadata."""
        return {
            "llm_provider": self._config.llm_provider,
            "llm_model": self._config.llm_model,
            "vector_store": self._retriever.vector_store_stats,
        }

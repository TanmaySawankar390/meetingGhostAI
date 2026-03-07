"""
Meeting Ghost AI — Embedding Utilities
========================================
Helpers for text embedding and similarity calculations.
"""

import numpy as np
from typing import Optional
import logging

logger = logging.getLogger(__name__)

_encoder = None

def get_encoder():
    """Lazy-load the sentence transformer encoder."""
    global _encoder
    if _encoder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _encoder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer loaded.")
        except ImportError:
            logger.warning("sentence-transformers not available.")
    return _encoder


def encode_text(text: str) -> list[float]:
    """Convert text to a vector embedding."""
    encoder = get_encoder()
    if encoder:
        return encoder.encode(text).tolist()
    np.random.seed(hash(text) % 2**32)
    return np.random.randn(384).tolist()


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    a, b = np.array(vec_a), np.array(vec_b)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return float(dot / norm) if norm > 0 else 0.0


def batch_encode(texts: list[str]) -> list[list[float]]:
    """Encode multiple texts at once (more efficient)."""
    encoder = get_encoder()
    if encoder:
        embeddings = encoder.encode(texts)
        return [e.tolist() for e in embeddings]
    return [encode_text(t) for t in texts]


def find_most_similar(query: str, candidates: list[dict], text_key: str = "text", top_k: int = 5) -> list[dict]:
    """Find the most similar candidates to a query."""
    query_vec = encode_text(query)
    scored = []
    for candidate in candidates:
        cand_vec = encode_text(candidate[text_key])
        score = cosine_similarity(query_vec, cand_vec)
        scored.append({**candidate, "similarity": score})
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:top_k]

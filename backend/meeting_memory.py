"""
Meeting Ghost AI — Meeting Memory (Vector Database)
=====================================================
Stores and retrieves conversation context using vector similarity.
"""

from __future__ import annotations
import logging, time, uuid
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
from config import settings

logger = logging.getLogger(__name__)

@dataclass
class MemoryRecord:
    id: str
    speaker: str
    text: str
    timestamp: float
    topic: str = "General Discussion"
    embedding: Optional[list[float]] = None
    relevance_score: float = 0.0

@dataclass
class MemorySession:
    id: str
    created_at: float = field(default_factory=time.time)
    utterance_count: int = 0

TOPIC_KEYWORDS = {
    "api": "Backend Development", "backend": "Backend Development",
    "frontend": "Frontend Development", "ui": "Frontend Development",
    "design": "Design", "deadline": "Timeline", "timeline": "Timeline",
    "budget": "Budget", "marketing": "Marketing", "launch": "Product Launch",
    "deploy": "Deployment", "test": "Testing", "bug": "Bug Fix",
    "client": "Client Relations", "meeting": "Meeting Planning",
}

class MeetingMemory:
    def __init__(self):
        self.embedding_dim = 384
        self.encoder = None
        self.use_pinecone = False
        self.pinecone_index = None
        self._local_store: dict[str, list[MemoryRecord]] = {}
        self._init_encoder()
        self._init_pinecone()

    def _init_encoder(self):
        try:
            from sentence_transformers import SentenceTransformer
            self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer encoder loaded.")
        except ImportError:
            logger.warning("sentence-transformers not installed. Using random embeddings.")
        except Exception as e:
            logger.warning(f"SentenceTransformer failed to load: {e}. Using random embeddings.")

    def _init_pinecone(self):
        if not settings.use_pinecone or not settings.pinecone_api_key:
            logger.info("Pinecone disabled via settings or no API key. Using in-memory vector store.")
            return
            
        def connect_pinecone():
            from pinecone import Pinecone, ServerlessSpec
            pc = Pinecone(api_key=settings.pinecone_api_key)
            existing = [idx.name for idx in pc.list_indexes()]
            if settings.pinecone_index_name not in existing:
                pc.create_index(name=settings.pinecone_index_name, dimension=self.embedding_dim,
                                metric="cosine", spec=ServerlessSpec(cloud="aws", region="us-east-1"))
            return pc

        try:
            import concurrent.futures
            # Prevent indefinite hanging if network blocks api.pinecone.io
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(connect_pinecone)
                pc = future.result(timeout=5.0)  # 5 second timeout
                
            self.pinecone_index = pc.Index(settings.pinecone_index_name)
            self.use_pinecone = True
            logger.info("Pinecone connected successfully.")
        except concurrent.futures.TimeoutError:
            logger.warning("Pinecone connection timed out. Network might be blocking api.pinecone.io. Using in-memory store.")
        except Exception as e:
            logger.warning(f"Pinecone init failed: {e}. Using in-memory store.")

    def _encode(self, text: str) -> list[float]:
        if self.encoder is not None:
            return self.encoder.encode(text).tolist()
        np.random.seed(hash(text) % 2**32)
        return np.random.randn(self.embedding_dim).tolist()

    async def create_session(self, meeting_id: str) -> MemorySession:
        session = MemorySession(id=meeting_id)
        if not self.use_pinecone:
            self._local_store[meeting_id] = []
        logger.info(f"Created memory session: {meeting_id}")
        return session

    async def store_utterance(self, session_id: str, speaker: str, text: str, timestamp: float) -> str:
        record_id = f"{session_id}_{timestamp}_{uuid.uuid4().hex[:8]}"
        topic = self._extract_topic(text)
        embedding = self._encode(text)
        record = MemoryRecord(id=record_id, speaker=speaker, text=text, timestamp=timestamp, topic=topic, embedding=embedding)

        if self.use_pinecone:
            try:
                self.pinecone_index.upsert(vectors=[{
                    "id": record_id, "values": embedding,
                    "metadata": {"session_id": session_id, "speaker": speaker, "text": text, "timestamp": timestamp, "topic": topic}
                }], namespace=session_id)
            except Exception as e:
                logger.error(f"Pinecone upsert failed: {e}")
                self._store_local(session_id, record)
        else:
            self._store_local(session_id, record)
        return record_id

    def _store_local(self, session_id: str, record: MemoryRecord):
        if session_id not in self._local_store:
            self._local_store[session_id] = []
        self._local_store[session_id].append(record)

    async def get_relevant_context(self, session_id: str, query: str, top_k: int = 5) -> list[dict]:
        query_embedding = self._encode(query)
        if self.use_pinecone:
            try:
                results = self.pinecone_index.query(vector=query_embedding, top_k=top_k, namespace=session_id, include_metadata=True)
                return [{"speaker": m["metadata"]["speaker"], "text": m["metadata"]["text"],
                         "timestamp": m["metadata"]["timestamp"], "topic": m["metadata"].get("topic", ""),
                         "relevance_score": m["score"]} for m in results.get("matches", [])]
            except Exception as e:
                logger.error(f"Pinecone query failed: {e}")
        return self._search_local(session_id, query_embedding, top_k)

    def _search_local(self, session_id: str, query_embedding: list[float], top_k: int) -> list[dict]:
        records = self._local_store.get(session_id, [])
        if not records: return []
        query_vec = np.array(query_embedding)
        scored = []
        for r in records:
            if r.embedding:
                rv = np.array(r.embedding)
                dot = np.dot(query_vec, rv)
                norm = np.linalg.norm(query_vec) * np.linalg.norm(rv)
                sim = float(dot / norm) if norm > 0 else 0.0
                scored.append((r, sim))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [{"speaker": r.speaker, "text": r.text, "timestamp": r.timestamp, "topic": r.topic,
                 "relevance_score": s} for r, s in scored[:top_k]]

    async def get_recent_context(self, session_id: str, minutes: int = 10) -> list[dict]:
        if self.use_pinecone:
            try:
                cutoff = time.time() - (minutes * 60)
                results = self.pinecone_index.query(vector=[0.0]*self.embedding_dim, top_k=100,
                    namespace=session_id, include_metadata=True, filter={"timestamp": {"$gte": cutoff}})
                entries = [{"speaker": m["metadata"]["speaker"], "text": m["metadata"]["text"],
                           "timestamp": m["metadata"]["timestamp"]} for m in results.get("matches", [])]
                return sorted(entries, key=lambda x: x["timestamp"])
            except Exception as e:
                logger.error(f"Pinecone recent query failed: {e}")
        records = self._local_store.get(session_id, [])
        if not records: return []
        max_ts = max(r.timestamp for r in records)
        cutoff = max_ts - (minutes * 60)
        return sorted([{"speaker": r.speaker, "text": r.text, "timestamp": r.timestamp}
                       for r in records if r.timestamp >= cutoff], key=lambda x: x["timestamp"])

    async def get_full_transcript(self, session_id: str) -> list[dict]:
        if self.use_pinecone:
            try:
                results = self.pinecone_index.query(vector=[0.0]*self.embedding_dim, top_k=10000,
                    namespace=session_id, include_metadata=True)
                entries = [{"speaker": m["metadata"]["speaker"], "text": m["metadata"]["text"],
                           "timestamp": m["metadata"]["timestamp"]} for m in results.get("matches", [])]
                return sorted(entries, key=lambda x: x["timestamp"])
            except Exception as e:
                logger.error(f"Pinecone full query failed: {e}")
        records = self._local_store.get(session_id, [])
        return sorted([{"speaker": r.speaker, "text": r.text, "timestamp": r.timestamp}
                       for r in records], key=lambda x: x["timestamp"])

    async def get_session_speakers(self, session_id: str) -> list[str]:
        transcript = await self.get_full_transcript(session_id)
        return list(set(e["speaker"] for e in transcript))

    def _extract_topic(self, text: str) -> str:
        text_lower = text.lower()
        for kw, topic in TOPIC_KEYWORDS.items():
            if kw in text_lower: return topic
        return "General Discussion"

    async def clear_session(self, session_id: str):
        if self.use_pinecone:
            try: self.pinecone_index.delete(delete_all=True, namespace=session_id)
            except Exception as e: logger.error(f"Pinecone delete failed: {e}")
        if session_id in self._local_store: del self._local_store[session_id]

    def get_stats(self) -> dict:
        stats = {"backend": "pinecone" if self.use_pinecone else "in-memory",
                 "encoder": "sentence-transformers" if self.encoder else "random",
                 "embedding_dim": self.embedding_dim, "active_sessions": len(self._local_store)}
        if not self.use_pinecone:
            stats["total_records"] = sum(len(r) for r in self._local_store.values())
        return stats


# ── Shared singleton ─────────────────────────────────────
# All services must import and use this instance so they share the same in-memory store.
shared_memory = MeetingMemory()

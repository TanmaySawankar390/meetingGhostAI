"""
Meeting Ghost AI — Data Models
===============================
Pydantic models for API I/O and SQLAlchemy models for database persistence.
"""

from __future__ import annotations

import uuid
from datetime import datetime, date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    String,
    Text,
    Float,
    Boolean,
    Integer,
    DateTime,
    Date,
    ForeignKey,
    JSON,
    create_engine,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from config import settings


# ═══════════════════════════════════════════════════════════
# SQLAlchemy Database Setup
# ═══════════════════════════════════════════════════════════

Base = declarative_base()

try:
    engine = create_engine(settings.database_url, echo=False)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception:
    engine = None
    SessionLocal = None


def get_db():
    """FastAPI dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════
# SQLAlchemy ORM Models (Database Tables)
# ═══════════════════════════════════════════════════════════


class MeetingDB(Base):
    """Meetings table — stores meeting metadata and summaries."""

    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=True)
    calendar_event_id = Column(String(255), nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(50), default="scheduled")  # scheduled, active, completed
    participant_count = Column(Integer, default=0)
    summary = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    transcripts = relationship("TranscriptDB", back_populates="meeting", cascade="all, delete-orphan")
    action_items = relationship("ActionItemDB", back_populates="meeting", cascade="all, delete-orphan")


class TranscriptDB(Base):
    """Transcripts table — stores each utterance in a meeting."""

    __tablename__ = "transcripts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    speaker = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    timestamp = Column(Float, nullable=False)
    topic = Column(String(255), nullable=True)
    is_ai_response = Column(Boolean, default=False)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    meeting = relationship("MeetingDB", back_populates="transcripts")


class ActionItemDB(Base):
    """Action items table — extracted tasks from meetings."""

    __tablename__ = "action_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    task = Column(Text, nullable=False)
    assignee = Column(String(255), nullable=True)
    deadline = Column(Date, nullable=True)
    priority = Column(String(20), default="medium")  # high, medium, low
    status = Column(String(20), default="pending")  # pending, in_progress, done
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    meeting = relationship("MeetingDB", back_populates="action_items")


# ═══════════════════════════════════════════════════════════
# Pydantic Models (API Request / Response)
# ═══════════════════════════════════════════════════════════


class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"


class ActionItemPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ActionItemStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"


# ── Transcript Models ────────────────────────────────────


class TranscriptEntry(BaseModel):
    """A single transcript utterance."""

    speaker: str
    text: str
    timestamp: float
    topic: Optional[str] = None
    is_ai_response: bool = False
    confidence: Optional[float] = None


class TranscriptResponse(BaseModel):
    """Response containing meeting transcript."""

    meeting_id: str
    transcript: list[TranscriptEntry]
    total_entries: int


# ── Action Item Models ───────────────────────────────────


class ActionItemOut(BaseModel):
    """Action item output."""

    id: Optional[str] = None
    task: str
    assignee: Optional[str] = None
    deadline: Optional[str] = None
    priority: str = "medium"
    status: str = "pending"


# ── Meeting Models ────────────────────────────────────────


class MeetingCreate(BaseModel):
    """Request to create a new meeting."""

    title: Optional[str] = None
    calendar_event_id: Optional[str] = None
    start_time: Optional[datetime] = None


class MeetingSummary(BaseModel):
    """Structured meeting summary."""

    summary: str = ""
    key_points: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    action_items: list[ActionItemOut] = Field(default_factory=list)
    topics_discussed: list[str] = Field(default_factory=list)
    duration_minutes: Optional[int] = None
    participant_count: Optional[int] = None


class MeetingOut(BaseModel):
    """Meeting output for API responses."""

    id: str
    title: Optional[str] = None
    status: str = "scheduled"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    participant_count: int = 0
    has_summary: bool = False
    created_at: Optional[datetime] = None


class MeetingListResponse(BaseModel):
    """Response containing a list of meetings."""

    meetings: list[MeetingOut]
    total: int


class ActionItemUpdate(BaseModel):
    """Request to update an action item."""

    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    deadline: Optional[date] = None


# ── Late Join Models ─────────────────────────────────────


class LateJoinRequest(BaseModel):
    """Request for a late-join catch-up summary."""

    minutes: int = Field(default=10, ge=1, le=60)


class LateJoinResponse(BaseModel):
    """Late-join catch-up summary response."""

    current_topic: str = ""
    catch_up: str = ""
    key_points: list[str] = Field(default_factory=list)
    pending_questions: list[str] = Field(default_factory=list)


# ── Reasoning Models ─────────────────────────────────────


class ReasoningResult(BaseModel):
    """Result from the LLM reasoning engine."""

    should_respond: bool = False
    response_text: Optional[str] = None
    confidence: float = 0.0
    reasoning: str = ""


# ── WebSocket Message Models ─────────────────────────────


class WSAudioMessage(BaseModel):
    """WebSocket message containing audio data."""

    type: str = "audio"
    data: str  # base64-encoded audio


class WSTranscriptMessage(BaseModel):
    """WebSocket message containing a transcript update."""

    type: str = "transcript"
    speaker: str
    text: str
    timestamp: float
    is_final: bool = True


class WSResponseMessage(BaseModel):
    """WebSocket message containing an AI response."""

    type: str = "response"
    text: str
    audio: Optional[str] = None  # base64-encoded audio


class WSStatusMessage(BaseModel):
    """WebSocket message for status updates."""

    type: str = "status"
    message: str
    meeting_id: Optional[str] = None


class WSErrorMessage(BaseModel):
    """WebSocket message for errors."""

    type: str = "error"
    message: str
    code: Optional[str] = None

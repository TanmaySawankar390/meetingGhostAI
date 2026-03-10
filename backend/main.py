"""
Meeting Ghost AI — FastAPI Application Entry Point
====================================================
Defines all HTTP and WebSocket routes, configures middleware,
and initializes service dependencies.
"""

from __future__ import annotations
import logging, uuid
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import meeting_rooms
from meeting_listener import MeetingListener
from summary_generator import SummaryGenerator
from meeting_memory import shared_memory
from voice_response import VoiceResponseService
from config import settings
from models import (MeetingCreate, MeetingOut, MeetingListResponse, LateJoinRequest,
                    LateJoinResponse, TranscriptResponse, TranscriptEntry, ActionItemOut)

# ── Logging ─────────────────────────────────────────────
logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Services (singletons) ──────────────────────────────
listener = MeetingListener()
summarizer = SummaryGenerator()
memory = shared_memory
voice = VoiceResponseService()

# In-memory meeting registry (replace with DB in production)
meetings_registry: dict[str, dict] = {}

# ── Lifespan ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Meeting Ghost AI backend starting...")
    logger.info(f"   User name: {settings.user_name}")
    logger.info(f"   AWS enabled: {bool(settings.aws_access_key_id)}")
    logger.info(f"   Memory backend: {memory.get_stats()['backend']}")
    yield
    logger.info("Meeting Ghost AI backend shutting down.")

# ── FastAPI App ─────────────────────────────────────────
app = FastAPI(
    title="Meeting Ghost AI",
    description="Voice AI assistant that joins meetings, listens, responds, and summarizes.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# Include routers
app.include_router(meeting_rooms.router)

# ═══════════════════════════════════════════════════════
# WebSocket Endpoints
# ═══════════════════════════════════════════════════════

@app.websocket("/ws/meeting/{meeting_id}")
async def meeting_websocket(websocket: WebSocket, meeting_id: str):
    """Real-time meeting audio processing via WebSocket."""
    await websocket.accept()
    logger.info(f"WebSocket connected: {meeting_id}")

    # Register the meeting if it doesn't exist
    if meeting_id not in meetings_registry:
        meetings_registry[meeting_id] = {
            "id": meeting_id, "title": f"Meeting {meeting_id[:8]}", "status": "active",
            "start_time": datetime.utcnow().isoformat(), "end_time": None,
            "participant_count": 0, "summary": None, "created_at": datetime.utcnow().isoformat(),
        }

    meetings_registry[meeting_id]["status"] = "active"

    try:
        await listener.handle_meeting_stream(websocket, meeting_id)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {meeting_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {meeting_id}: {e}")
    finally:
        # Generate summary on disconnect
        try:
            summary = await summarizer.generate_meeting_summary(meeting_id)
            meetings_registry[meeting_id]["summary"] = summary
            meetings_registry[meeting_id]["status"] = "completed"
            meetings_registry[meeting_id]["end_time"] = datetime.utcnow().isoformat()
            logger.info(f"Summary generated for meeting {meeting_id}")
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")

# ═══════════════════════════════════════════════════════
# REST Endpoints
# ═══════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"name": "Meeting Ghost AI", "version": "1.0.0", "status": "running",
            "user": settings.user_name, "active_meetings": len(listener.get_active_meetings())}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "memory": memory.get_stats(),
            "active_meetings": len(listener.get_active_meetings())}

# ── Meetings ────────────────────────────────────────────

@app.post("/api/meetings", response_model=MeetingOut)
async def create_meeting(data: MeetingCreate):
    meeting_id = str(uuid.uuid4())
    meetings_registry[meeting_id] = {
        "id": meeting_id, "title": data.title or f"Meeting {meeting_id[:8]}",
        "status": "scheduled", "start_time": (data.start_time or datetime.utcnow()).isoformat(),
        "end_time": None, "participant_count": 0, "summary": None,
        "created_at": datetime.utcnow().isoformat(), "calendar_event_id": data.calendar_event_id,
    }
    return MeetingOut(id=meeting_id, title=meetings_registry[meeting_id]["title"],
                      status="scheduled", start_time=data.start_time, has_summary=False,
                      created_at=datetime.utcnow())

@app.get("/api/meetings")
async def list_meetings():
    meetings = []
    for mid, m in meetings_registry.items():
        meetings.append(MeetingOut(id=mid, title=m.get("title"), status=m.get("status", "scheduled"),
            has_summary=m.get("summary") is not None, participant_count=m.get("participant_count", 0)))
    return MeetingListResponse(meetings=meetings, total=len(meetings))

@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    if meeting_id not in meetings_registry:
        raise HTTPException(404, "Meeting not found")
    return meetings_registry[meeting_id]

@app.get("/api/meetings/{meeting_id}/summary")
async def get_summary(meeting_id: str):
    m = meetings_registry.get(meeting_id)
    if not m:
        raise HTTPException(404, "Meeting not found")
    if m.get("summary"):
        return m["summary"]
    summary = await summarizer.generate_meeting_summary(meeting_id)
    m["summary"] = summary
    return summary

@app.get("/api/meetings/{meeting_id}/transcript")
async def get_transcript(meeting_id: str, speaker: str = None):
    transcript = await memory.get_full_transcript(meeting_id)
    if speaker:
        transcript = [e for e in transcript if e["speaker"].lower() == speaker.lower()]
    entries = [TranscriptEntry(speaker=e["speaker"], text=e["text"], timestamp=e["timestamp"]) for e in transcript]
    return TranscriptResponse(meeting_id=meeting_id, transcript=entries, total_entries=len(entries))

@app.post("/api/meetings/{meeting_id}/late-join")
async def late_join(meeting_id: str, data: LateJoinRequest):
    result = await summarizer.generate_late_join_summary(meeting_id, data.minutes)
    return LateJoinResponse(**result)

# ── System ──────────────────────────────────────────────

@app.get("/api/active-meetings")
async def active_meetings():
    return {"active": listener.get_active_meetings()}

@app.get("/api/voices")
async def list_voices():
    return {"voices": voice.get_available_voices()}

@app.get("/api/stats")
async def system_stats():
    return {"memory": memory.get_stats(), "active_meetings": len(listener.get_active_meetings()),
            "total_meetings": len(meetings_registry), "user_name": settings.user_name}

# ── Run ─────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.backend_host, port=settings.backend_port, reload=True)

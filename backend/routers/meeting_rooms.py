from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict
import asyncio
import uuid
from datetime import timedelta
from livekit import api
from config import settings
from livekit_agent import start_agent_for_room, stop_agent_for_room, get_active_agents
from meeting_memory import shared_memory
from reasoning_engine import ReasoningEngine
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meetings", tags=["Meetings"])

# Manage active WebSockets per agent proxy
class ConnectionManager:
    def __init__(self):
        # key: f"{room_name}_{participant_name}"
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, room_name: str, participant_name: str, websocket: WebSocket):
        await websocket.accept()
        key = f"{room_name}_{participant_name}"
        self.active_connections[key] = websocket
        logger.info(f"WebSocket client connected for AI Proxy: {key}")

    def disconnect(self, room_name: str, participant_name: str):
        key = f"{room_name}_{participant_name}"
        if key in self.active_connections:
            del self.active_connections[key]
            logger.info(f"WebSocket client disconnected for AI Proxy: {key}")

    async def send_audio(self, room_name: str, participant_name: str, data: bytes):
        key = f"{room_name}_{participant_name}"
        if key in self.active_connections:
            websocket = self.active_connections[key]
            try:
                await websocket.send_bytes(data)
            except Exception as e:
                logger.error(f"Error sending audio to {key}: {e}")

manager = ConnectionManager()

class CreateMeetingRequest(BaseModel):
    title: str
    description: Optional[str] = ""

class CreateMeetingResponse(BaseModel):
    room_name: str
    host_token: str
    join_url: str

class JoinMeetingRequest(BaseModel):
    room_name: str
    participant_name: str

class JoinMeetingResponse(BaseModel):
    token: str

class AgentProxyRequest(BaseModel):
    participant_name: str


@router.post("/create", response_model=CreateMeetingResponse)
async def create_meeting(req: CreateMeetingRequest):
    """Create a new LiveKit room."""
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")
        
    room_name = f"meeting-{uuid.uuid4().hex[:8]}"
    
    token = api.AccessToken(
        settings.livekit_api_key, 
        settings.livekit_api_secret
    ).with_identity(
        "Host"
    ).with_name(
        settings.user_name
    ).with_grants(
        api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_publish_data=True,
            can_subscribe=True,
            room_create=True,
        )
    ).with_ttl(timedelta(hours=6)).to_jwt()
    
    return CreateMeetingResponse(
        room_name=room_name,
        host_token=token,
        join_url=f"/meet/{room_name}"
    )

@router.post("/join", response_model=JoinMeetingResponse)
async def join_meeting(req: JoinMeetingRequest):
    """Generate a token for a participant to join an existing room."""
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")
        
    identity = f"{req.participant_name.replace(' ', '_')}_{uuid.uuid4().hex[:4]}"
    
    token = api.AccessToken(
        settings.livekit_api_key, 
        settings.livekit_api_secret
    ).with_identity(
        identity
    ).with_name(
        req.participant_name
    ).with_grants(
        api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_publish_data=True,
            can_subscribe=True,
        )
    ).with_ttl(timedelta(hours=6)).to_jwt()
    
    return JoinMeetingResponse(token=token)


@router.post("/{room_name}/agent/start")
async def start_proxy_agent(room_name: str, req: AgentProxyRequest, background_tasks: BackgroundTasks):
    """Start the AI agent as a proxy for a specific participant in an existing room."""
    async def _join_agent():
        try:
            # Pass the connection manager so the agent can stream audio
            await start_agent_for_room(room_name, req.participant_name, manager)
            logger.info(f"🤖 AI Proxy Agent joined room: {room_name} for {req.participant_name}")
        except Exception as e:
            logger.error(f"Failed to join AI proxy to {room_name} for {req.participant_name}: {e}", exc_info=True)
            
    background_tasks.add_task(_join_agent)
    return {"status": "ok", "message": f"AI proxy requested to join {room_name} for {req.participant_name}"}


@router.delete("/{room_name}/agent")
async def remove_agent(room_name: str, participant_name: str):
    """Remove the specific user's AI proxy from a room."""
    await stop_agent_for_room(room_name, participant_name)
    return {"status": "ok", "message": f"Agent removed from {room_name} for {participant_name}"}


@router.get("/agents")
async def list_agents():
    """List all active AI agents."""
    return {"agents": get_active_agents()}
    

@router.get("/{room_name}/summary")
async def get_room_summary(room_name: str):
    """Generate a summary of the meeting so far from shared memory."""
    session_id = f"livekit-{room_name}"
    transcript = await shared_memory.get_full_transcript(session_id)
    
    if not transcript:
        return {"summary": "No discussion has been recorded yet."}
        
    # Format the transcript into a text block
    transcript_text = "\n".join(
        [f"[{t['timestamp']:.1f}s] {t['speaker']}: {t['text']}" for t in transcript]
    )
    
    reasoning = ReasoningEngine()
    summary = await reasoning.generate_summary_text(transcript_text)
    
    return {"summary": summary}


@router.websocket("/{room_name}/agent/stream/{participant_name}")
async def agent_audio_stream(websocket: WebSocket, room_name: str, participant_name: str):
    """
    WebSocket endpoint for the Next.js frontend to connect to.
    The `LiveKitGhostAgent` will pump generated TTS audio bytes 
    through `manager.send_audio()`, which routes them here.
    """
    await manager.connect(room_name, participant_name, websocket)
    try:
        while True:
            # We don't expect data from the client, just keep the connection alive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(room_name, participant_name)
    except Exception as e:
        logger.error(f"WebSocket error for {room_name}/{participant_name}: {e}")
        manager.disconnect(room_name, participant_name)

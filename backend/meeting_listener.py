"""
Meeting Ghost AI — Meeting Listener
=====================================
WebSocket handler for real-time meeting audio processing.
Orchestrates STT → Memory → Reasoning → TTS pipeline.
"""

from __future__ import annotations
import asyncio, json, logging, time
from fastapi import WebSocket, WebSocketDisconnect
from speech_to_text import SpeechToTextService
from reasoning_engine import ReasoningEngine
from meeting_memory import shared_memory
from voice_response import VoiceResponseService
from config import settings

logger = logging.getLogger(__name__)


class MeetingListener:
    """Handles the real-time meeting audio processing pipeline."""

    def __init__(self):
        self.stt = SpeechToTextService()
        self.reasoning = ReasoningEngine()
        self.memory = shared_memory
        self.voice = VoiceResponseService()
        self.active_sessions: dict[str, dict] = {}

    async def handle_meeting_stream(self, websocket: WebSocket, meeting_id: str):
        """
        Main WebSocket loop for meeting audio processing.

        Protocol:
        - Client sends: {"type": "audio", "data": "<base64>"}
        - Client sends: {"type": "text_input", "speaker": "...", "text": "..."}
        - Client sends: {"type": "end_meeting"}
        - Server sends: {"type": "transcript", "speaker": "...", "text": "...", "timestamp": 0.0}
        - Server sends: {"type": "response", "text": "...", "audio": "<base64>"}
        - Server sends: {"type": "status", "message": "..."}
        """
        session = await self.memory.create_session(meeting_id)
        stt_session = self.stt.create_session(meeting_id)

        self.active_sessions[meeting_id] = {
            "websocket": websocket,
            "start_time": time.time(),
            "message_count": 0,
        }

        await websocket.send_json({"type": "status", "message": "Connected. Listening...", "meeting_id": meeting_id})
        logger.info(f"Meeting stream started: {meeting_id}")

        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                    continue

                msg_type = message.get("type", "")

                if msg_type == "end_meeting":
                    await websocket.send_json({"type": "status", "message": "Meeting ended. Generating summary..."})
                    break

                elif msg_type == "audio":
                    await self._handle_audio(websocket, meeting_id, message)

                elif msg_type == "text_input":
                    await self._handle_text_input(websocket, meeting_id, message)

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                else:
                    await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {meeting_id}")
        except Exception as e:
            logger.error(f"Meeting stream error: {e}")
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass
        finally:
            self.stt.close_session(meeting_id)
            if meeting_id in self.active_sessions:
                del self.active_sessions[meeting_id]

    async def _handle_audio(self, websocket: WebSocket, meeting_id: str, message: dict):
        """Process audio chunk through STT → Memory → Reasoning → TTS."""
        audio_data = message.get("data", "")
        if not audio_data:
            return

        transcript = await self.stt.transcribe_chunk(audio_data=audio_data, session_id=meeting_id)

        if transcript and transcript.is_final and transcript.text.strip():
            elapsed = time.time() - self.active_sessions[meeting_id]["start_time"]
            self.active_sessions[meeting_id]["message_count"] += 1

            await self.memory.store_utterance(
                session_id=meeting_id, speaker=transcript.speaker,
                text=transcript.text, timestamp=elapsed)

            await websocket.send_json({
                "type": "transcript", "speaker": transcript.speaker,
                "text": transcript.text, "timestamp": elapsed, "is_final": True})

            await self._check_and_respond(websocket, meeting_id, transcript.text, transcript.speaker, elapsed)

    async def _handle_text_input(self, websocket: WebSocket, meeting_id: str, message: dict):
        """Handle direct text input (for testing / simulation)."""
        speaker = message.get("speaker", "Unknown")
        text = message.get("text", "")
        if not text: return

        elapsed = time.time() - self.active_sessions.get(meeting_id, {}).get("start_time", time.time())

        await self.memory.store_utterance(session_id=meeting_id, speaker=speaker, text=text, timestamp=elapsed)
        await websocket.send_json({"type": "transcript", "speaker": speaker, "text": text, "timestamp": elapsed, "is_final": True})
        await self._check_and_respond(websocket, meeting_id, text, speaker, elapsed)

    async def _check_and_respond(self, websocket: WebSocket, meeting_id: str,
                                  text: str, speaker: str, timestamp: float):
        """Check if AI should respond and send response if so."""
        context = await self.memory.get_relevant_context(session_id=meeting_id, query=text, top_k=5)
        result = await self.reasoning.should_respond(context=context, current_message=text, speaker=speaker)

        if result.should_respond and result.response_text:
            logger.info(f"AI responding (confidence: {result.confidence:.2f}): {result.response_text[:50]}...")

            audio_data = await self.voice.synthesize(text=result.response_text)

            await self.memory.store_utterance(
                session_id=meeting_id, speaker=f"{settings.user_name} (AI)",
                text=result.response_text, timestamp=timestamp + 0.5)

            await websocket.send_json({
                "type": "response", "text": result.response_text,
                "audio": audio_data, "confidence": result.confidence,
                "reasoning": result.reasoning})

    def get_active_meetings(self) -> list[dict]:
        """Return list of currently active meeting sessions."""
        return [
            {"meeting_id": mid, "start_time": info["start_time"],
             "message_count": info["message_count"],
             "duration_seconds": time.time() - info["start_time"]}
            for mid, info in self.active_sessions.items()
        ]

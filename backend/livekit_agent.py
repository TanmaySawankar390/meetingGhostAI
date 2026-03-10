"""
Meeting Ghost AI — LiveKit Native Agent
=========================================
Connects to a LiveKit room as an invisible audio-only participant.
Listens to all human audio tracks, transcribes via Deepgram,
reasons via Bedrock, and publishes AI voice responses back into the room.
"""

import asyncio
import logging
import time
import ctypes
from typing import Dict, Optional

from livekit import rtc, api
from config import settings
from speech_to_text import SpeechToTextService
from reasoning_engine import ReasoningEngine
from meeting_memory import shared_memory
from voice_response import VoiceResponseService

logger = logging.getLogger(__name__)

# Constants for LiveKit audio
SAMPLE_RATE = 48000       # LiveKit default WebRTC sample rate
NUM_CHANNELS = 1          # Mono
SAMPLES_PER_CHANNEL = 480 # 10ms frames at 48kHz


class LiveKitGhostAgent:
    """
    The AI Meeting Ghost — joins LiveKit rooms as a native participant.
    
    Pipeline per participant:
      Audio Track → Deepgram STT → Memory → Bedrock Reasoning → Polly TTS → Publish AudioTrack
    """

    def __init__(self, room_name: str, user_name: str, connection_manager):
        self.room_name = room_name
        self.user_name = user_name
        self.connection_manager = connection_manager
        self.room = rtc.Room()
        self.session_id = f"livekit-{room_name}"
        
        # Services
        self.stt = SpeechToTextService()
        self.reasoning = ReasoningEngine(user_name=self.user_name)
        self.memory = shared_memory
        self.voice = VoiceResponseService()
        
        # Audio state
        self._is_speaking = False
        
        # Track active audio processing tasks per participant
        self.audio_tasks: Dict[str, asyncio.Task] = {}
        self._start_time = time.time()
        
        # Setup event handlers
        self.room.on("track_subscribed", self._on_track_subscribed)
        self.room.on("track_unsubscribed", self._on_track_unsubscribed)
        self.room.on("participant_connected", self._on_participant_connected)
        self.room.on("participant_disconnected", self._on_participant_disconnected)

    async def start(self):
        """Connect the AI Ghost to the LiveKit room."""
        if not settings.livekit_url:
            logger.error("LiveKit URL not configured")
            return

        # Generate a token for the AI to join the room
        identity = f"ai_proxy_{self.user_name.replace(' ', '_')}"
        token = api.AccessToken(
            settings.livekit_api_key, 
            settings.livekit_api_secret
        ).with_identity(
            identity
        ).with_name(
            f"{self.user_name} (AI Proxy)"
        ).with_grants(
            api.VideoGrants(
                room_join=True,
                room=self.room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
                hidden=True, # Hide this backend proxy from the frontend UI
            )
        ).to_jwt()

        logger.info(f"🤖 AI Ghost connecting to room: {self.room_name}")
        await self.room.connect(settings.livekit_url, token)
        logger.info(f"🤖 AI Ghost connected to {self.room_name} successfully! (Silent Observer Mode)")
        
        # Initialize memory session
        await self.memory.create_session(self.session_id)

    async def disconnect(self):
        """Disconnect the AI from the room."""
        for task in self.audio_tasks.values():
            task.cancel()
        self.audio_tasks.clear()
        await self.room.disconnect()
        logger.info(f"🤖 AI disconnected from {self.room_name}")

    # ── Event Handlers ──────────────────────────────────────────────

    def _on_track_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        """Fired when a human enables their microphone."""
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        logger.info(f"🎙️ Subscribed to audio from: {participant.name} ({participant.identity})")

        # Start a background task to continuously read & transcribe this person's audio
        task = asyncio.create_task(
            self._process_audio_stream(track, participant)
        )
        self.audio_tasks[participant.identity] = task

    def _on_track_unsubscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        """Fired when a human disables their microphone."""
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        logger.info(f"🔇 Unsubscribed from audio of: {participant.name}")
        if participant.identity in self.audio_tasks:
            self.audio_tasks[participant.identity].cancel()
            del self.audio_tasks[participant.identity]

    def _on_participant_connected(self, participant: rtc.RemoteParticipant):
        logger.info(f"👤 Participant joined: {participant.name} ({participant.identity})")

    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant):
        logger.info(f"👤 Participant left: {participant.name} ({participant.identity})")
        if participant.identity in self.audio_tasks:
            self.audio_tasks[participant.identity].cancel()
            del self.audio_tasks[participant.identity]

    # ── Audio Processing Pipeline ───────────────────────────────────

    async def _process_audio_stream(
        self, track: rtc.Track, participant: rtc.RemoteParticipant
    ):
        """
        Continuously reads PCM frames from a participant's WebRTC track
        and feeds them into the Deepgram STT pipeline.
        When a final transcript is received, triggers the reasoning engine.
        """
        import base64
        
        # Request resampled audio at 16kHz mono for Deepgram
        audio_stream = rtc.AudioStream(track, sample_rate=16000, num_channels=1)
        
        # Create a dedicated STT session for this participant
        stt_session_id = f"{self.session_id}_{participant.identity}"
        self.stt.create_session(stt_session_id)

        try:
            async for event in audio_stream:
                # event.frame contains the PCM data
                pcm_data = bytes(event.frame.data)
                
                # Base64 encode for our existing STT pipeline
                b64_audio = base64.b64encode(pcm_data).decode("utf-8")
                
                # Push chunk into Deepgram
                result = await self.stt.transcribe_chunk(
                    audio_data=b64_audio, session_id=stt_session_id
                )

                if result and result.is_final and result.text.strip():
                    speaker_name = participant.name or participant.identity
                    elapsed = time.time() - self._start_time
                    
                    logger.info(f"📝 [{speaker_name}]: {result.text}")

                    # Store in memory
                    await self.memory.store_utterance(
                        session_id=self.session_id,
                        speaker=speaker_name,
                        text=result.text,
                        timestamp=elapsed,
                    )

                    # Check if AI should respond
                    await self._maybe_respond(result.text, speaker_name, elapsed)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error processing audio for {participant.identity}: {e}", exc_info=True)
        finally:
            self.stt.close_session(stt_session_id)

    async def _maybe_respond(self, text: str, speaker: str, timestamp: float):
        """Use the reasoning engine to decide if the AI should speak."""
        if self._is_speaking:
            return  # Don't interrupt ourselves
        
        try:
            context = await self.memory.get_relevant_context(
                session_id=self.session_id, query=text, top_k=5
            )
            result = await self.reasoning.should_respond(
                context=context, current_message=text, speaker=speaker
            )

            if result.should_respond and result.response_text:
                logger.info(
                    f"🤖 AI responding (confidence: {result.confidence:.2f}): "
                    f"{result.response_text[:80]}..."
                )

                # Store AI response in memory
                await self.memory.store_utterance(
                    session_id=self.session_id,
                    speaker=f"{self.user_name} (AI Proxy)",
                    text=result.response_text,
                    timestamp=timestamp + 0.5,
                )

                # Synthesize and publish audio
                await self._speak(result.response_text)

        except Exception as e:
            logger.error(f"Error in AI reasoning: {e}", exc_info=True)

    async def _speak(self, text: str):
        """
        Convert text to speech and push the raw PCM bytes to the frontend via WebSocket.
        """
        self._is_speaking = True
        try:
            # Get raw 16kHz 16-bit mono PCM from Polly
            pcm_bytes = await self.voice.synthesize_pcm(text)
            if not pcm_bytes:
                logger.warning("TTS returned empty audio")
                return

            logger.info(f"🔊 AI finished generating speech ({len(pcm_bytes)} bytes). Streaming to frontend...")
            
            # Send the exact bytes to the frontend via the connection manager
            await self.connection_manager.send_audio(self.room_name, self.user_name, pcm_bytes)

        except Exception as e:
            logger.error(f"Error publishing AI audio via WebSocket: {e}", exc_info=True)
        finally:
            self._is_speaking = False


# ── Global Agent Manager ────────────────────────────────────────────

_active_agents: Dict[str, LiveKitGhostAgent] = {}

def _get_agent_key(room_name: str, user_name: str) -> str:
    return f"{room_name}_{user_name}"

async def start_agent_for_room(room_name: str, user_name: str, connection_manager) -> LiveKitGhostAgent:
    """Start an AI proxy for a specific user in the specified room."""
    key = _get_agent_key(room_name, user_name)
    if key in _active_agents:
        logger.info(f"Agent already active for {user_name} in {room_name}")
        return _active_agents[key]

    agent = LiveKitGhostAgent(room_name, user_name, connection_manager)
    await agent.start()
    _active_agents[key] = agent
    return agent


async def stop_agent_for_room(room_name: str, user_name: str):
    """Stop the AI proxy for a specific user in the specified room."""
    key = _get_agent_key(room_name, user_name)
    if key in _active_agents:
        await _active_agents[key].disconnect()
        del _active_agents[key]


def get_active_agents() -> list:
    """List all currently active AI agents."""
    return [
        {"room_name": agent.room_name, "user_name": agent.user_name, "session_id": agent.session_id}
        for _, agent in _active_agents.items()
    ]

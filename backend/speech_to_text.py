"""
Meeting Ghost AI — Speech-to-Text Service
==========================================
Real-time audio transcription with a tiered provider strategy:

  1. Deepgram Nova-3  (cloud, ~300ms latency, speaker diarization)
  2. Whisper           (local, offline fallback)
  3. Simulation        (demo mode when nothing else is available)

Audio requirements (all providers):
  - PCM 16-bit signed little-endian
  - 16 kHz sample rate, mono channel
  - ~250 ms chunks (4 000 samples)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from scipy.signal import butter, sosfilt

from config import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════
# Data classes
# ═══════════════════════════════════════════════════════

@dataclass
class TranscriptResult:
    """A finalized transcript segment."""

    text: str
    speaker: str = "Unknown"
    timestamp: float = 0.0
    is_final: bool = True
    confidence: float = 0.0
    language: str = "en-US"


@dataclass
class STTSession:
    """Tracks state for an active transcription session."""

    session_id: str
    buffer: list[bytes] = field(default_factory=list)
    partial_text: str = ""
    speaker_map: dict = field(default_factory=dict)
    start_time: float = field(default_factory=time.time)
    utterance_count: int = 0

    # Deepgram-specific state
    dg_connection: object = field(default=None, repr=False)
    dg_transcript_queue: object = field(default=None, repr=False)
    dg_connected: bool = False


# ═══════════════════════════════════════════════════════
# Main service
# ═══════════════════════════════════════════════════════

class SpeechToTextService:
    """
    Real-time speech-to-text with automatic provider selection.

    Priority: Deepgram → Whisper → Simulation
    """

    # Meeting-context prompt helps Whisper expect professional vocabulary
    WHISPER_INITIAL_PROMPT = (
        "This is a professional meeting discussion between colleagues. "
        "Topics include project timelines, API development, deployments, "
        "design reviews, budgets, marketing, and action items."
    )

    def __init__(self):
        self.sample_rate = settings.stt_sample_rate
        self.chunk_duration_ms = settings.audio_chunk_duration_ms
        self.sessions: dict[str, STTSession] = {}

        # Pre-compute high-pass filter coefficients (remove < 80 Hz noise)
        self._hp_sos = butter(5, 80, btype="highpass", fs=self.sample_rate, output="sos")

        # ── Deepgram (preferred) ──────────────────────────
        self.deepgram_client = None
        self.use_deepgram = False
        try:
            if settings.deepgram_api_key:
                from deepgram import DeepgramClient
                self.deepgram_client = DeepgramClient(settings.deepgram_api_key)
                self.use_deepgram = True
                logger.info(
                    f"Deepgram STT initialized (model={settings.deepgram_model}, "
                    f"lang={settings.deepgram_language})"
                )
        except ImportError:
            logger.info("deepgram-sdk not installed. Trying Whisper fallback.")
        except Exception as e:
            logger.warning(f"Deepgram init failed: {e}. Trying Whisper fallback.")

        # ── Whisper (fallback) ────────────────────────────
        self.whisper_model = None
        if not self.use_deepgram:
            try:
                import whisper
                model_size = settings.whisper_model_size
                self.whisper_model = whisper.load_model(model_size)
                logger.info(f"Loaded local Whisper '{model_size}' model for STT fallback.")
            except ImportError:
                logger.info("Whisper not installed. STT will use simulation mode.")
            except Exception as e:
                logger.error(f"Failed to load Whisper model: {e}. STT will use simulation mode.")

        # Log the active provider
        provider = "deepgram" if self.use_deepgram else ("whisper" if self.whisper_model else "simulation")
        logger.info(f"Active STT provider: {provider}")

    # ───────────────────────────────────────────────────
    # Session management
    # ───────────────────────────────────────────────────

    def create_session(self, session_id: str) -> STTSession:
        """Create a new transcription session."""
        session = STTSession(
            session_id=session_id,
            dg_transcript_queue=asyncio.Queue() if self.use_deepgram else None,
        )
        self.sessions[session_id] = session
        logger.info(f"Created STT session: {session_id}")
        return session

    def close_session(self, session_id: str) -> None:
        """Clean up a transcription session."""
        session = self.sessions.get(session_id)
        if session:
            # Close Deepgram connection if active
            if session.dg_connection and session.dg_connected:
                try:
                    session.dg_connection.finish()
                    logger.info(f"Closed Deepgram connection for session: {session_id}")
                except Exception as e:
                    logger.warning(f"Error closing Deepgram connection: {e}")
            del self.sessions[session_id]
            logger.info(f"Closed STT session: {session_id}")

    # ───────────────────────────────────────────────────
    # Deepgram live connection
    # ───────────────────────────────────────────────────

    async def _ensure_deepgram_connection(self, session: STTSession) -> bool:
        """Create and start a Deepgram live transcription WebSocket if needed."""
        if session.dg_connected and session.dg_connection:
            return True

        # Don't retry endlessly — after 3 failed attempts, give up for this session
        fail_count = getattr(session, "_dg_fail_count", 0)
        if fail_count >= 3:
            return False

        try:
            from deepgram import LiveTranscriptionEvents

            dg_connection = self.deepgram_client.listen.live.v("1")

            # Use a plain dict for options to avoid SDK class compatibility issues.
            # Only include well-supported, documented parameters.
            options = {
                "model": settings.deepgram_model,
                "language": settings.deepgram_language,
                "encoding": "linear16",
                "sample_rate": self.sample_rate,
                "channels": 1,
                "smart_format": True,
                "diarize": True,
                "interim_results": False,
                "endpointing": 300,
            }

            # ── Event handlers ────────────────────────────
            def on_transcript(_, result, **kwargs):
                """Called when Deepgram emits a transcript."""
                try:
                    channel = result.channel
                    alt = channel.alternatives[0] if channel.alternatives else None
                    if not alt or not alt.transcript.strip():
                        return

                    text = alt.transcript.strip()
                    confidence = alt.confidence or 0.0

                    speaker = "Unknown"
                    if alt.words:
                        speaker_id = alt.words[0].speaker
                        if speaker_id is not None:
                            speaker = f"Speaker {speaker_id}"

                    elapsed = time.time() - session.start_time
                    session.utterance_count += 1

                    transcript_result = TranscriptResult(
                        text=text,
                        speaker=speaker,
                        timestamp=elapsed,
                        is_final=True,
                        confidence=confidence,
                    )

                    try:
                        session.dg_transcript_queue.put_nowait(transcript_result)
                    except Exception:
                        logger.warning("Deepgram transcript queue full, dropping result")

                except Exception as e:
                    logger.error(f"Deepgram transcript handler error: {e}")

            def on_error(_, error, **kwargs):
                logger.error(f"Deepgram stream error: {error}")

            def on_close(_, *args, **kwargs):
                logger.info(f"Deepgram connection closed for session: {session.session_id}")
                session.dg_connected = False

            dg_connection.on(LiveTranscriptionEvents.Transcript, on_transcript)
            dg_connection.on(LiveTranscriptionEvents.Error, on_error)
            dg_connection.on(LiveTranscriptionEvents.Close, on_close)

            logger.info(f"Starting Deepgram connection with options: {options}")
            started = dg_connection.start(options)
            if started:
                session.dg_connection = dg_connection
                session.dg_connected = True
                logger.info(f"Deepgram live connection started for: {session.session_id}")
                return True
            else:
                session._dg_fail_count = fail_count + 1
                logger.error(f"Deepgram connection failed (attempt {fail_count + 1}/3)")
                return False

        except Exception as e:
            session._dg_fail_count = getattr(session, "_dg_fail_count", 0) + 1
            logger.error(f"Deepgram connection error (attempt {session._dg_fail_count}/3): {e}")
            return False

    # ───────────────────────────────────────────────────
    # Core transcription entry point
    # ───────────────────────────────────────────────────

    async def transcribe_chunk(
        self,
        audio_data: str,
        session_id: str,
    ) -> Optional[TranscriptResult]:
        """
        Process a single audio chunk and return a transcript result
        if a complete utterance is detected.

        Args:
            audio_data: base64-encoded PCM audio (16kHz, mono, 16-bit)
            session_id: active session identifier

        Returns:
            TranscriptResult if a final segment is ready, else None
        """
        session = self.sessions.get(session_id)
        if not session:
            session = self.create_session(session_id)

        try:
            audio_bytes = base64.b64decode(audio_data)
        except Exception as e:
            logger.error(f"Failed to decode audio data: {e}")
            return None

        # ── Route to the active provider ──────────────
        if self.use_deepgram:
            return await self._transcribe_deepgram(audio_bytes, session)
        elif self.whisper_model is not None:
            return await self._transcribe_whisper(audio_bytes, session)
        else:
            return self._transcribe_simulated(audio_bytes, session)

    # ───────────────────────────────────────────────────
    # Deepgram provider
    # ───────────────────────────────────────────────────

    async def _transcribe_deepgram(
        self, audio_bytes: bytes, session: STTSession
    ) -> Optional[TranscriptResult]:
        """
        Stream audio to Deepgram and check for completed transcripts.

        Deepgram handles VAD, endpointing, and speaker diarization natively,
        so we just forward raw audio and poll the result queue.
        """
        # Ensure the Deepgram WebSocket is open
        connected = await self._ensure_deepgram_connection(session)
        if not connected:
            # Fall back to Whisper/simulation for this chunk
            logger.warning("Deepgram unavailable, falling back for this chunk")
            if self.whisper_model:
                session.buffer.append(audio_bytes)
                return await self._transcribe_whisper_buffered(session)
            return self._transcribe_simulated(audio_bytes, session)

        # Send audio directly to Deepgram (no buffering needed — Deepgram handles it)
        try:
            session.dg_connection.send(audio_bytes)
        except Exception as e:
            logger.error(f"Failed to send audio to Deepgram: {e}")
            session.dg_connected = False
            return None

        # Check if Deepgram has produced any transcript results
        try:
            result = session.dg_transcript_queue.get_nowait()
            return result
        except asyncio.QueueEmpty:
            return None

    # ───────────────────────────────────────────────────
    # Whisper provider (fallback)
    # ───────────────────────────────────────────────────

    async def _transcribe_whisper(
        self, audio_bytes: bytes, session: STTSession
    ) -> Optional[TranscriptResult]:
        """Buffer audio and transcribe with Whisper when enough is accumulated."""
        session.buffer.append(audio_bytes)
        return await self._transcribe_whisper_buffered(session)

    async def _transcribe_whisper_buffered(
        self, session: STTSession
    ) -> Optional[TranscriptResult]:
        """Transcribe buffered audio using local Whisper model."""
        # Accumulate ~2 seconds of audio before transcribing for better accuracy
        total_bytes = sum(len(b) for b in session.buffer)
        min_bytes = self.sample_rate * 2 * 2  # 2 seconds of 16-bit audio

        if total_bytes < min_bytes:
            return None

        # Combine buffered audio
        combined_audio = b"".join(session.buffer)
        session.buffer.clear()

        # Preprocess audio: normalize + high-pass filter
        combined_audio = self._preprocess_audio(combined_audio)

        # Detect if there's actual speech (simple VAD)
        if not self._has_speech(combined_audio):
            return None

        try:
            import tempfile
            import soundfile as sf

            audio_array = np.frombuffer(combined_audio, dtype=np.int16).astype(np.float32)
            audio_array = audio_array / 32768.0  # Normalize to [-1, 1]

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                sf.write(tmp.name, audio_array, self.sample_rate)
                tmp_path = tmp.name

            result = self.whisper_model.transcribe(
                tmp_path,
                fp16=False,
                language="en",
                initial_prompt=self.WHISPER_INITIAL_PROMPT,
                temperature=0.0,
                no_speech_threshold=0.5,
                condition_on_previous_text=True,
            )
            text = result.get("text", "").strip()

            if not text:
                return None

            session.utterance_count += 1
            elapsed = time.time() - session.start_time

            return TranscriptResult(
                text=text,
                speaker=self._detect_speaker(combined_audio, session),
                timestamp=elapsed,
                is_final=True,
                confidence=0.90,
            )

        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return None

    # ───────────────────────────────────────────────────
    # Simulation provider (demo mode)
    # ───────────────────────────────────────────────────

    def _transcribe_simulated(
        self, audio_bytes: bytes, session: STTSession
    ) -> Optional[TranscriptResult]:
        """Simulated transcription for development/testing."""
        # Simple buffer + VAD so we don't fire on every single chunk
        session.buffer.append(audio_bytes)
        total_bytes = sum(len(b) for b in session.buffer)
        if total_bytes < self.sample_rate * 2 * 2:
            return None
        session.buffer.clear()

        if not self._has_speech(audio_bytes):
            return None

        session.utterance_count += 1
        elapsed = time.time() - session.start_time

        simulated_phrases = [
            "Let's discuss the project timeline.",
            "I think we should prioritize the API.",
            "Can someone update the documentation?",
            f"{settings.user_name}, when will the backend be ready?",
            "The marketing team needs the assets by Friday.",
            "Let's schedule a follow-up meeting next week.",
            "I agree with the proposed approach.",
            "We need to allocate more resources to testing.",
            f"{settings.user_name}, can you handle the deployment?",
            "The client requested changes to the design.",
        ]

        phrase = simulated_phrases[session.utterance_count % len(simulated_phrases)]
        speakers = ["Manager", "Designer", "Developer", "QA Lead", "Product Owner"]
        speaker = speakers[session.utterance_count % len(speakers)]

        return TranscriptResult(
            text=phrase, speaker=speaker, timestamp=elapsed,
            is_final=True, confidence=1.0,
        )

    # ───────────────────────────────────────────────────
    # Audio utilities
    # ───────────────────────────────────────────────────

    def _preprocess_audio(self, audio_bytes: bytes) -> bytes:
        """
        Preprocess raw PCM audio to improve transcription accuracy.
        1. Normalize amplitude to use the full dynamic range.
        2. Apply a high-pass filter to remove low-frequency noise/hum.
        """
        try:
            audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
            if len(audio) == 0:
                return audio_bytes
            peak = np.max(np.abs(audio))
            if peak > 0:
                audio = audio * (32000.0 / peak)
            audio = sosfilt(self._hp_sos, audio)
            return audio.astype(np.int16).tobytes()
        except Exception as e:
            logger.warning(f"Audio preprocessing failed: {e}")
            return audio_bytes

    def _has_speech(self, audio_bytes: bytes, threshold: float = 200.0) -> bool:
        """Simple Voice Activity Detection based on RMS energy."""
        try:
            audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
            if len(audio_array) == 0:
                return False
            rms = np.sqrt(np.mean(audio_array**2))
            return rms > threshold
        except Exception:
            return True

    def _detect_speaker(self, audio_bytes: bytes, session: STTSession) -> str:
        """
        Basic speaker detection using audio characteristics.
        Used only for Whisper fallback — Deepgram provides native diarization.
        """
        try:
            audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
            rms = np.sqrt(np.mean(audio_array**2))
            spectral_centroid = np.mean(np.abs(np.fft.rfft(audio_array)))
            speaker_hash = int(rms * 100 + spectral_centroid) % 5
            speakers = ["Speaker A", "Speaker B", "Speaker C", "Speaker D", "Speaker E"]
            return speakers[speaker_hash]
        except Exception:
            return "Unknown"

    # ───────────────────────────────────────────────────
    # Info
    # ───────────────────────────────────────────────────

    def get_active_meetings(self) -> list[dict]:
        """Return list of currently active STT sessions."""
        return [
            {"session_id": sid, "start_time": s.start_time,
             "utterance_count": s.utterance_count,
             "provider": "deepgram" if s.dg_connected else ("whisper" if self.whisper_model else "simulation")}
            for sid, s in self.sessions.items()
        ]

    def get_session_stats(self, session_id: str) -> dict:
        """Get statistics for a transcription session."""
        session = self.sessions.get(session_id)
        if not session:
            return {}
        return {
            "session_id": session_id,
            "utterance_count": session.utterance_count,
            "duration_seconds": time.time() - session.start_time,
            "buffer_size": sum(len(b) for b in session.buffer),
            "provider": "deepgram" if session.dg_connected else ("whisper" if self.whisper_model else "simulation"),
        }

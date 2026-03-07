"""
Meeting Ghost AI — Voice Response Service
==========================================
Converts AI-generated text responses into natural-sounding speech
using Amazon Polly (or a local TTS fallback). Supports SSML for
enhanced prosody, emphasis, and pausing.
"""

from __future__ import annotations

import base64
import logging
import struct
import math
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from config import settings

logger = logging.getLogger(__name__)


class VoiceResponseService:
    """
    Text-to-speech synthesis for AI meeting responses.

    Supports:
    - Amazon Polly (neural voices) for production quality
    - Local tone generation as a development fallback
    - SSML markup for natural speech patterns
    """

    AVAILABLE_VOICES = {
        "Matthew": {"gender": "Male", "accent": "US English"},
        "Joanna": {"gender": "Female", "accent": "US English"},
        "Amy": {"gender": "Female", "accent": "British English"},
        "Brian": {"gender": "Male", "accent": "British English"},
        "Ivy": {"gender": "Female", "accent": "US English (Child)"},
        "Kendra": {"gender": "Female", "accent": "US English"},
        "Salli": {"gender": "Female", "accent": "US English"},
        "Joey": {"gender": "Male", "accent": "US English"},
    }

    def __init__(self):
        self.voice_id = settings.voice_id
        self.output_format = "mp3"

        # Initialize Amazon Polly client
        try:
            self.polly = boto3.client(
                "polly",
                region_name=settings.aws_default_region,
                aws_access_key_id=settings.aws_access_key_id or None,
                aws_secret_access_key=settings.aws_secret_access_key or None,
            )
            self.use_aws = bool(settings.aws_access_key_id)
        except Exception as e:
            logger.warning(f"Amazon Polly init failed: {e}. Using local TTS.")
            self.use_aws = False
            self.polly = None

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speech_rate: str = "medium",
        use_ssml: bool = True,
    ) -> str:
        """
        Convert text to speech.

        Args:
            text: The text to synthesize
            voice_id: Override default voice (e.g., "Matthew", "Joanna")
            speech_rate: Speed — "x-slow", "slow", "medium", "fast", "x-fast"
            use_ssml: Whether to wrap in SSML for enhanced prosody

        Returns:
            base64-encoded audio data (MP3 format)
        """
        if not text or not text.strip():
            logger.warning("Empty text provided for synthesis.")
            return ""

        voice = voice_id or self.voice_id

        if self.use_aws:
            return await self._synthesize_polly(text, voice, speech_rate, use_ssml)
        else:
            return self._synthesize_local(text)

    async def _synthesize_polly(
        self,
        text: str,
        voice_id: str,
        speech_rate: str,
        use_ssml: bool,
    ) -> str:
        """Synthesize speech using Amazon Polly."""
        try:
            if use_ssml:
                ssml_text = self._build_ssml(text, speech_rate)
                text_type = "ssml"
                synthesis_text = ssml_text
            else:
                text_type = "text"
                synthesis_text = text

            response = self.polly.synthesize_speech(
                Text=synthesis_text,
                TextType=text_type,
                OutputFormat=self.output_format,
                VoiceId=voice_id,
                Engine="neural",  # Neural voices are more natural
            )

            audio_bytes = response["AudioStream"].read()
            return base64.b64encode(audio_bytes).decode("utf-8")

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "TextLengthExceededException":
                logger.warning("Text too long for Polly. Truncating.")
                return await self._synthesize_polly(
                    text[:2900], voice_id, speech_rate, use_ssml
                )
            logger.error(f"Polly synthesis error: {e}")
            return self._synthesize_local(text)

        except Exception as e:
            logger.error(f"TTS error: {e}")
            return self._synthesize_local(text)

    def _build_ssml(self, text: str, rate: str = "medium") -> str:
        """
        Wrap text in SSML for natural speech output.

        SSML features used:
        - <prosody rate="..."> — control speaking speed
        - <break time="..."/> — insert natural pauses
        - Automatic sentence-level pacing
        """
        # Escape XML special characters in text
        escaped_text = (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )

        # Add natural pauses after sentences
        sentences = escaped_text.split(". ")
        ssml_body = '. <break time="300ms"/> '.join(sentences)

        return (
            f"<speak>"
            f'<prosody rate="{rate}">'
            f"{ssml_body}"
            f"</prosody>"
            f"</speak>"
        )

    def _synthesize_local(self, text: str) -> str:
        """
        Generate a simple audio placeholder locally.
        Produces a short sine wave tone as a speech indicator
        for development without AWS Polly.
        """
        sample_rate = 16000
        duration = min(len(text) * 0.05, 5.0)  # ~50ms per character, max 5s
        num_samples = int(sample_rate * duration)
        frequency = 440.0  # A4 note

        # Generate a sine wave with fade-in/out
        audio_data = []
        for i in range(num_samples):
            t = i / sample_rate
            # Sine wave with envelope
            envelope = min(t * 10, 1.0) * min((duration - t) * 10, 1.0)
            sample = int(
                32767 * 0.3 * envelope * math.sin(2 * math.pi * frequency * t)
            )
            audio_data.append(struct.pack("<h", max(-32768, min(32767, sample))))

        raw_audio = b"".join(audio_data)

        # Create a minimal WAV file
        wav_data = self._create_wav(raw_audio, sample_rate)
        return base64.b64encode(wav_data).decode("utf-8")

    def _create_wav(self, raw_audio: bytes, sample_rate: int) -> bytes:
        """Create a minimal WAV file from raw PCM data."""
        num_channels = 1
        bits_per_sample = 16
        data_size = len(raw_audio)
        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8

        header = struct.pack(
            "<4sI4s4sIHHIIHH4sI",
            b"RIFF",
            36 + data_size,
            b"WAVE",
            b"fmt ",
            16,  # chunk size
            1,  # PCM format
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b"data",
            data_size,
        )

        return header + raw_audio

    def get_available_voices(self) -> list[dict]:
        """List available TTS voices."""
        if self.use_aws:
            try:
                response = self.polly.describe_voices(LanguageCode="en-US")
                return [
                    {
                        "id": v["Id"],
                        "name": v["Name"],
                        "gender": v["Gender"],
                        "language": v.get("LanguageName", "English"),
                    }
                    for v in response["Voices"]
                    if v.get("SupportedEngines") and "neural" in v["SupportedEngines"]
                ]
            except Exception as e:
                logger.error(f"Failed to list voices: {e}")

        # Return static list as fallback
        return [
            {"id": vid, "name": vid, "gender": info["gender"], "language": info["accent"]}
            for vid, info in self.AVAILABLE_VOICES.items()
        ]

    def set_voice(self, voice_id: str) -> bool:
        """Change the active TTS voice."""
        if voice_id in self.AVAILABLE_VOICES or self.use_aws:
            self.voice_id = voice_id
            logger.info(f"Voice changed to: {voice_id}")
            return True
        logger.warning(f"Unknown voice ID: {voice_id}")
        return False

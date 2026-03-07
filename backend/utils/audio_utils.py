"""
Meeting Ghost AI — Audio Utilities
====================================
Helpers for audio format conversion, chunking, and validation.
"""

import base64, struct, math, io
from typing import Optional
import numpy as np


def pcm_to_wav(pcm_data: bytes, sample_rate: int = 16000, channels: int = 1, bits: int = 16) -> bytes:
    """Convert raw PCM data to WAV format."""
    byte_rate = sample_rate * channels * bits // 8
    block_align = channels * bits // 8
    data_size = len(pcm_data)
    header = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + data_size, b"WAVE", b"fmt ",
        16, 1, channels, sample_rate, byte_rate, block_align, bits, b"data", data_size)
    return header + pcm_data


def wav_to_pcm(wav_data: bytes) -> tuple[bytes, int]:
    """Extract PCM data and sample rate from WAV bytes."""
    if wav_data[:4] != b"RIFF":
        raise ValueError("Not a valid WAV file")
    sample_rate = struct.unpack("<I", wav_data[24:28])[0]
    data_start = wav_data.index(b"data") + 8
    return wav_data[data_start:], sample_rate


def chunk_audio(audio_bytes: bytes, chunk_duration_ms: int = 250, sample_rate: int = 16000) -> list[bytes]:
    """Split audio into chunks of specified duration."""
    bytes_per_sample = 2  # 16-bit
    samples_per_chunk = int(sample_rate * chunk_duration_ms / 1000)
    chunk_size = samples_per_chunk * bytes_per_sample
    return [audio_bytes[i:i + chunk_size] for i in range(0, len(audio_bytes), chunk_size)]


def audio_to_base64(audio_bytes: bytes) -> str:
    """Encode audio bytes to base64 string."""
    return base64.b64encode(audio_bytes).decode("utf-8")


def base64_to_audio(b64_string: str) -> bytes:
    """Decode base64 string to audio bytes."""
    return base64.b64decode(b64_string)


def calculate_rms(audio_bytes: bytes) -> float:
    """Calculate RMS energy of audio data."""
    try:
        audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        if len(audio) == 0:
            return 0.0
        return float(np.sqrt(np.mean(audio ** 2)))
    except Exception:
        return 0.0


def is_silence(audio_bytes: bytes, threshold: float = 300.0) -> bool:
    """Check if audio chunk is silence."""
    return calculate_rms(audio_bytes) < threshold


def generate_test_audio(text: str = "test", duration: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Generate a test audio signal (sine wave) as PCM bytes."""
    num_samples = int(sample_rate * duration)
    frequency = 440.0
    t = np.arange(num_samples) / sample_rate
    envelope = np.minimum(t * 10, 1.0) * np.minimum((duration - t) * 10, 1.0)
    signal = (32767 * 0.3 * envelope * np.sin(2 * np.pi * frequency * t)).astype(np.int16)
    return signal.tobytes()


def normalize_audio(audio_bytes: bytes, target_rms: float = 5000.0) -> bytes:
    """Normalize audio to target RMS level."""
    audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
    if len(audio) == 0:
        return audio_bytes
    current_rms = np.sqrt(np.mean(audio ** 2))
    if current_rms == 0:
        return audio_bytes
    scale = target_rms / current_rms
    audio = np.clip(audio * scale, -32768, 32767).astype(np.int16)
    return audio.tobytes()

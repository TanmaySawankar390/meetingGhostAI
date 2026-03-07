"""
Meeting Ghost AI — Configuration Module
========================================
Centralized configuration using pydantic-settings.
Loads from environment variables and .env file with sensible defaults.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field

# Project root directory
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application-wide settings loaded from environment variables."""

    # ── AWS ──────────────────────────────────────────────
    aws_access_key_id: str = Field(default="", description="AWS Access Key")
    aws_secret_access_key: str = Field(default="", description="AWS Secret Key")
    aws_default_region: str = Field(default="us-east-1", description="AWS Region")

    # ── Pinecone ─────────────────────────────────────────
    use_pinecone: bool = Field(default=False, description="Enable Pinecone Vector DB")
    pinecone_api_key: str = Field(default="", description="Pinecone API Key")
    pinecone_environment: str = Field(default="us-east-1")
    pinecone_index_name: str = Field(default="meeting-memory")

    # ── Deepgram ─────────────────────────────────────────
    deepgram_api_key: str = Field(default="", description="Deepgram API Key for real-time STT")
    deepgram_model: str = Field(default="nova-3", description="Deepgram model: nova-3, nova-2, etc.")
    deepgram_language: str = Field(default="en", description="Deepgram language code")

    # ── Database ─────────────────────────────────────────
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/meetingghost",
        description="PostgreSQL connection string",
    )

    # ── Redis ────────────────────────────────────────────
    redis_url: str = Field(default="redis://localhost:6379")

    # ── Google Calendar ──────────────────────────────────
    google_calendar_client_id: str = Field(default="")
    google_calendar_client_secret: str = Field(default="")

    # ── Application ──────────────────────────────────────
    user_name: str = Field(default="Rahul", description="Name the AI represents")
    voice_id: str = Field(default="Matthew", description="Amazon Polly voice ID")
    log_level: str = Field(default="INFO")
    max_response_tokens: int = Field(default=300)
    llm_temperature: float = Field(default=0.3)
    confidence_threshold: float = Field(default=0.7)
    audio_chunk_duration_ms: int = Field(default=250)
    stt_sample_rate: int = Field(default=16000)
    whisper_model_size: str = Field(
        default="medium",
        description="Whisper model size: tiny, base, small, medium, large-v3",
    )
    data_retention_days: int = Field(default=90)

    # ── LLM Model IDs ───────────────────────────────────
    stt_model_id: str = Field(default="amazon.nova-sonic-v1")
    llm_model_id: str = Field(default="amazon.nova-lite-v1:0")
    tts_engine: str = Field(default="polly", description="polly or nova-sonic")

    # ── Server ───────────────────────────────────────────
    backend_host: str = Field(default="0.0.0.0")
    backend_port: int = Field(default=8000)
    frontend_url: str = Field(default="http://localhost:3000")

    # ── Paths ────────────────────────────────────────────
    prompts_dir: str = Field(
        default=str(BASE_DIR / "ai_prompts"),
        description="Directory containing AI prompt templates",
    )

    model_config = {
        "env_file": str(BASE_DIR / ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# Singleton settings instance
settings = Settings()

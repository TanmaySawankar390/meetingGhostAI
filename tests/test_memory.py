"""Tests for Meeting Memory."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
import asyncio
from meeting_memory import MeetingMemory


@pytest.fixture
def memory():
    return MeetingMemory()


@pytest.mark.asyncio
async def test_create_session(memory):
    session = await memory.create_session("test-meeting-001")
    assert session.id == "test-meeting-001"


@pytest.mark.asyncio
async def test_store_and_retrieve(memory):
    await memory.create_session("test-002")
    await memory.store_utterance("test-002", "Manager", "When will the API be ready?", 10.0)
    await memory.store_utterance("test-002", "Developer", "The API is almost done.", 15.0)
    await memory.store_utterance("test-002", "Designer", "I need the design assets.", 20.0)

    results = await memory.get_relevant_context("test-002", "API status update", top_k=2)
    assert len(results) <= 2
    assert all("speaker" in r and "text" in r for r in results)


@pytest.mark.asyncio
async def test_full_transcript(memory):
    await memory.create_session("test-003")
    await memory.store_utterance("test-003", "A", "Hello", 1.0)
    await memory.store_utterance("test-003", "B", "Hi there", 2.0)

    transcript = await memory.get_full_transcript("test-003")
    assert len(transcript) == 2
    assert transcript[0]["timestamp"] <= transcript[1]["timestamp"]


@pytest.mark.asyncio
async def test_topic_extraction(memory):
    topic = memory._extract_topic("When will the API be ready?")
    assert topic == "Backend Development"

    topic = memory._extract_topic("Let's discuss the marketing campaign")
    assert topic == "Marketing"

    topic = memory._extract_topic("Good morning everyone")
    assert topic == "General Discussion"


@pytest.mark.asyncio
async def test_clear_session(memory):
    await memory.create_session("test-004")
    await memory.store_utterance("test-004", "A", "Test", 1.0)
    await memory.clear_session("test-004")
    transcript = await memory.get_full_transcript("test-004")
    assert len(transcript) == 0


def test_stats(memory):
    stats = memory.get_stats()
    assert "backend" in stats
    assert "embedding_dim" in stats

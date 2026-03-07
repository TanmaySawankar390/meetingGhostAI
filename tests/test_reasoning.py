"""Tests for the Reasoning Engine."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
import asyncio
from reasoning_engine import ReasoningEngine


@pytest.fixture
def engine():
    return ReasoningEngine()


def test_parse_reasoning_yes(engine):
    raw = "RESPOND: yes\nCONFIDENCE: 0.9\nREASONING: Directed at user\nRESPONSE: I'll have it done by Friday."
    result = engine._parse_reasoning_output(raw)
    assert result.should_respond is True
    assert result.confidence == 0.9
    assert result.response_text == "I'll have it done by Friday."


def test_parse_reasoning_no(engine):
    raw = "RESPOND: no\nCONFIDENCE: 0.8\nREASONING: Not directed at user"
    result = engine._parse_reasoning_output(raw)
    assert result.should_respond is False
    assert result.response_text is None


def test_parse_empty_output(engine):
    result = engine._parse_reasoning_output("")
    assert result.should_respond is False
    assert result.confidence == 0.0


def test_format_context(engine):
    context = [
        {"timestamp": 10.0, "speaker": "Manager", "text": "Let's discuss the API"},
        {"timestamp": 20.0, "speaker": "Dev", "text": "Working on it"},
    ]
    formatted = engine._format_context(context)
    assert "Manager" in formatted
    assert "API" in formatted


@pytest.mark.asyncio
async def test_should_respond_self_message(engine):
    """AI should not respond to messages from the user themselves."""
    result = await engine.should_respond(
        context=[], current_message="I'll work on it", speaker="Rahul"
    )
    assert result.should_respond is False


@pytest.mark.asyncio
async def test_should_respond_directed_question(engine):
    """AI should respond when directly addressed."""
    result = await engine.should_respond(
        context=[],
        current_message="Rahul, when will the API be ready?",
        speaker="Manager",
    )
    # In local mode, this should detect the directed question
    assert result.should_respond is True
    assert result.response_text is not None

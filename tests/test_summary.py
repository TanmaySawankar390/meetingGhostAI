"""Tests for Summary Generator."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
from summary_generator import SummaryGenerator


@pytest.fixture
def gen():
    return SummaryGenerator()


def test_format_transcript(gen):
    entries = [
        {"speaker": "Manager", "text": "Let's begin", "timestamp": 0.0},
        {"speaker": "Dev", "text": "Ready", "timestamp": 5.0},
    ]
    result = gen._format_transcript(entries)
    assert "Manager" in result
    assert "Let's begin" in result


def test_parse_summary_structured(gen):
    raw = """SUMMARY:
A productive sprint planning meeting.

KEY_POINTS:
- API deadline set to Friday
- Design review scheduled for Thursday

DECISIONS:
- Use microservices architecture

ACTION_ITEMS:
- Complete API docs | Assignee: Rahul | Deadline: Friday | Priority: high

TOPICS:
- Backend Development
- Design"""

    result = gen._parse_summary(raw, [])
    assert "productive" in result["summary"].lower() or len(result["summary"]) > 0
    assert len(result["key_points"]) >= 1


def test_parse_late_join(gen):
    raw = """CURRENT_TOPIC: API Development
WHAT_YOU_MISSED:
- Sprint goals discussed
- Design mockups reviewed
KEY_DECISIONS:
- API due Friday
PENDING_QUESTIONS:
- Budget for Q2?"""

    result = gen._parse_late_join(raw, [])
    assert result["current_topic"] == "API Development"
    assert len(result["key_points"]) >= 1

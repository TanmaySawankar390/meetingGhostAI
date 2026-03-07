"""
Meeting Ghost AI — Summary Generator
======================================
Post-meeting intelligence: generates structured summaries, extracts
action items, and provides late-join catch-up summaries.
"""

from __future__ import annotations
import json, logging, re
from typing import Optional
from config import settings
from meeting_memory import shared_memory
from reasoning_engine import ReasoningEngine
from models import ActionItemOut

logger = logging.getLogger(__name__)


class SummaryGenerator:
    def __init__(self):
        self.memory = shared_memory
        self.reasoning = ReasoningEngine()

    async def generate_meeting_summary(self, meeting_id: str) -> dict:
        """Generate a comprehensive summary after meeting ends."""
        transcript = await self.memory.get_full_transcript(meeting_id)
        if not transcript:
            return {"summary": "No transcript available.", "key_points": [],
                    "decisions": [], "action_items": [], "topics_discussed": []}

        transcript_text = self._format_transcript(transcript)
        raw_summary = await self.reasoning.generate_summary_text(transcript_text)
        parsed = self._parse_summary(raw_summary, transcript)

        speakers = await self.memory.get_session_speakers(meeting_id)
        parsed["participant_count"] = len(speakers)

        if transcript:
            duration = transcript[-1]["timestamp"] - transcript[0]["timestamp"]
            parsed["duration_minutes"] = max(1, int(duration / 60))

        return parsed

    async def generate_late_join_summary(self, meeting_id: str, minutes: int = 10) -> dict:
        """Generate catch-up summary for late joiners."""
        recent = await self.memory.get_recent_context(session_id=meeting_id, minutes=minutes)
        if not recent:
            return {"current_topic": "Meeting just started", "catch_up": "No discussion yet.",
                    "key_points": [], "pending_questions": []}

        transcript_text = self._format_transcript(recent)
        raw = await self.reasoning.generate_late_join_text(transcript_text, minutes)
        return self._parse_late_join(raw, recent)

    def _format_transcript(self, entries: list[dict]) -> str:
        return "\n".join(f"[{e.get('timestamp', 0):.1f}s] {e['speaker']}: {e['text']}" for e in entries)

    def _parse_summary(self, raw: str, transcript: list[dict]) -> dict:
        result = {"summary": "", "key_points": [], "decisions": [], "action_items": [], "topics_discussed": []}
        if not raw:
            return result

        # Try parsing structured output
        sections = {"SUMMARY": "summary", "KEY_POINTS": "key_points", "DECISIONS": "decisions",
                     "ACTION_ITEMS": "action_items", "TOPICS": "topics_discussed"}
        current_section = None
        current_items = []

        for line in raw.strip().split("\n"):
            line = line.strip()
            upper = line.upper().rstrip(":")
            if upper in sections:
                if current_section and current_items:
                    key = sections[current_section]
                    if key == "summary":
                        result[key] = " ".join(current_items)
                    else:
                        result[key] = current_items
                current_section = upper
                current_items = []
            elif line.startswith("- ") or line.startswith("• "):
                current_items.append(line[2:].strip())
            elif line and current_section:
                if current_section == "SUMMARY":
                    current_items.append(line)
                elif "|" in line:  # Action item format: task | assignee | deadline
                    parts = [p.strip() for p in line.split("|")]
                    current_items.append(parts[0])
                elif line[0].isdigit() and ". " in line:
                    current_items.append(line.split(". ", 1)[1])
                else:
                    current_items.append(line)

        if current_section and current_items:
            key = sections.get(current_section, "summary")
            if key == "summary":
                result[key] = " ".join(current_items)
            else:
                result[key] = current_items

        # Fallback: if parsing produced nothing, use raw text
        if not result["summary"] and raw:
            result["summary"] = raw[:500]

        # Extract topics from transcript
        topics = set()
        for entry in transcript:
            topic = entry.get("topic", "")
            if topic and topic != "General Discussion":
                topics.add(topic)
        if topics:
            result["topics_discussed"] = list(topics)

        return result

    def _parse_late_join(self, raw: str, recent: list[dict]) -> dict:
        result = {"current_topic": "General Discussion", "catch_up": "",
                  "key_points": [], "pending_questions": []}
        if not raw:
            if recent:
                result["catch_up"] = f"{len(recent)} messages in the discussion so far."
                result["key_points"] = [e["text"][:100] for e in recent[-5:]]
            return result

        for line in raw.strip().split("\n"):
            line = line.strip()
            if line.upper().startswith("CURRENT_TOPIC:") or line.upper().startswith("CURRENT TOPIC:"):
                result["current_topic"] = line.split(":", 1)[1].strip()
            elif line.startswith("- "):
                item = line[2:].strip()
                if "question" in line.lower() or "?" in line:
                    result["pending_questions"].append(item)
                else:
                    result["key_points"].append(item)

        if not result["catch_up"]:
            result["catch_up"] = raw[:300]

        return result

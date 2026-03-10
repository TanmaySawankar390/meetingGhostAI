"""
Meeting Ghost AI — Reasoning Engine
=====================================
LLM-powered decision making: determines when the AI should respond
on behalf of the user, generates contextual responses, and provides
reasoning transparency.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from config import settings
from models import ReasoningResult

logger = logging.getLogger(__name__)


class ReasoningEngine:
    """
    The 'brain' of Meeting Ghost AI.

    Uses Amazon Nova Lite (or compatible LLM) to:
    1. Detect if a message is directed at the user
    2. Decide whether the AI should respond
    3. Generate a professional, context-aware response
    4. Provide a confidence score and reasoning
    """

    def __init__(self, user_name: Optional[str] = None):
        self.user_name = user_name or settings.user_name
        self.model_id = settings.llm_model_id
        self.max_tokens = settings.max_response_tokens
        self.temperature = settings.llm_temperature
        self.confidence_threshold = settings.confidence_threshold

        # Load prompt templates
        self.reasoning_prompt_template = self._load_prompt("meeting_reasoning_prompt.txt")
        self.summary_prompt_template = self._load_prompt("summary_prompt.txt")
        self.late_join_prompt_template = self._load_prompt("late_join_prompt.txt")

        # Initialize AWS Bedrock client
        try:
            self.client = boto3.client(
                "bedrock-runtime",
                region_name=settings.aws_default_region,
                aws_access_key_id=settings.aws_access_key_id or None,
                aws_secret_access_key=settings.aws_secret_access_key or None,
            )
            self.use_aws = bool(settings.aws_access_key_id)
        except Exception as e:
            logger.warning(f"AWS Bedrock client init failed: {e}. Using local mode.")
            self.use_aws = False
            self.client = None

    def _load_prompt(self, filename: str) -> str:
        """Load a prompt template from the ai_prompts directory."""
        prompt_path = Path(settings.prompts_dir) / filename
        try:
            return prompt_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            logger.warning(f"Prompt template not found: {prompt_path}")
            return ""

    async def should_respond(
        self,
        context: list[dict],
        current_message: str,
        speaker: str,
    ) -> ReasoningResult:
        """
        Core reasoning method.

        Analyzes the current message in context to determine:
        1. Is the message directed at the user?
        2. Is it a question requiring a response?
        3. Does the AI have enough context to respond?
        4. What should the response be?

        Args:
            context: List of relevant previous utterances
            current_message: The latest message to analyze
            speaker: Who said the current message

        Returns:
            ReasoningResult with decision and optional response
        """
        # Quick filter: if the speaker IS the user, don't respond to yourself
        if speaker.lower() == self.user_name.lower():
            return ReasoningResult(
                should_respond=False,
                reasoning="Message is from the user themselves.",
            )

        # Build the reasoning prompt
        context_str = self._format_context(context)
        prompt = self._build_reasoning_prompt(context_str, current_message, speaker)

        # Get LLM response
        if self.use_aws:
            raw_output = await self._invoke_llm(prompt)
        else:
            raw_output = self._invoke_local_reasoning(context_str, current_message, speaker)

        # Parse the structured output
        result = self._parse_reasoning_output(raw_output)

        # Apply confidence threshold
        if result.should_respond and result.confidence < self.confidence_threshold:
            logger.info(
                f"Response suppressed: confidence {result.confidence:.2f} "
                f"below threshold {self.confidence_threshold}"
            )
            result.should_respond = False
            result.reasoning += f" (Confidence {result.confidence:.2f} below threshold)"

        return result

    def _build_reasoning_prompt(
        self, context_str: str, message: str, speaker: str
    ) -> str:
        """Build the complete reasoning prompt from template."""
        if self.reasoning_prompt_template:
            return self.reasoning_prompt_template.format(
                user_name=self.user_name,
                conversation_history=context_str or "No previous context available.",
                speaker_name=speaker,
                speaker_message=message,
            )

        # Fallback inline prompt if template file is missing
        return f"""You are an AI assistant representing {self.user_name} in a professional meeting.

Conversation History:
{context_str or "No previous context."}

Current Message:
{speaker}: {message}

Rules:
1. If the message is directed to {self.user_name}, respond professionally.
2. Keep responses concise (1-3 sentences).
3. Use realistic workplace tone.
4. If unsure, DO NOT respond.
5. Never reveal you are an AI.

Output Format:
RESPOND: yes/no
CONFIDENCE: 0.0-1.0
REASONING: <explanation>
RESPONSE: <your response if RESPOND is yes>"""

    async def _invoke_llm(self, prompt: str) -> str:
        """Invoke Amazon Bedrock with the reasoning prompt."""
        try:
            body = json.dumps({
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}],
                    }
                ],
                "inferenceConfig": {
                    "maxTokens": self.max_tokens,
                    "temperature": self.temperature,
                    "topP": 0.9,
                },
            })

            response = self.client.invoke_model(
                modelId=self.model_id,
                body=body,
                contentType="application/json",
                accept="application/json",
            )

            result = json.loads(response["body"].read())

            # Parse Nova Lite response format
            if "output" in result and "message" in result["output"]:
                content = result["output"]["message"]["content"]
                if isinstance(content, list) and len(content) > 0:
                    return content[0].get("text", "")
            # Fallback for other response formats
            if "results" in result:
                return result["results"][0].get("outputText", "")
            if "completion" in result:
                return result["completion"]
            if "content" in result:
                if isinstance(result["content"], list):
                    return result["content"][0].get("text", "")
                return result["content"]
            return json.dumps(result)

        except ClientError as e:
            logger.error(f"Bedrock invocation error: {e}")
            # Fall back to local reasoning
            return self._invoke_local_reasoning("", prompt, "")
        except Exception as e:
            logger.error(f"Unexpected LLM error: {e}")
            return self._invoke_local_reasoning("", prompt, "")

    def _invoke_local_reasoning(
        self, context_str: str, message: str, speaker: str
    ) -> str:
        """
        Local rule-based reasoning when AWS is not available.
        Uses keyword matching and heuristics.
        """
        message_lower = message.lower()
        user_name_lower = self.user_name.lower()

        # Check if the user is directly mentioned
        is_directed = user_name_lower in message_lower

        # Check if it's a question
        is_question = any(
            message_lower.strip().endswith(q)
            for q in ["?", "right?", "correct?", "thoughts?"]
        ) or any(
            message_lower.startswith(w)
            for w in ["when", "what", "how", "can", "will", "could", "would", "should", "do", "does", "is", "are"]
        )

        if is_directed and is_question:
            # Generate a contextual response based on keywords
            response = self._generate_local_response(message, context_str)
            return (
                f"RESPOND: yes\n"
                f"CONFIDENCE: 0.85\n"
                f"REASONING: Message is directed at {self.user_name} and is a question.\n"
                f"RESPONSE: {response}"
            )
        elif is_directed:
            response = self._generate_local_response(message, context_str)
            return (
                f"RESPOND: yes\n"
                f"CONFIDENCE: 0.75\n"
                f"REASONING: Message mentions {self.user_name} directly.\n"
                f"RESPONSE: {response}"
            )
        else:
            return (
                f"RESPOND: no\n"
                f"CONFIDENCE: 0.9\n"
                f"REASONING: Message is not directed at {self.user_name}."
            )

    def _generate_local_response(self, message: str, context: str) -> str:
        """Generate a rule-based response for local mode."""
        message_lower = message.lower()

        if "when" in message_lower and ("ready" in message_lower or "done" in message_lower or "complete" in message_lower):
            return "I'm targeting to have it completed by end of this week. I'll keep you updated on progress."
        elif "update" in message_lower or "status" in message_lower:
            return "Things are progressing well. I'm on track with the current timeline and will share a detailed update after this meeting."
        elif "can you" in message_lower or "could you" in message_lower:
            return "Yes, I can take that on. I'll review the details and get started."
        elif "think" in message_lower or "opinion" in message_lower or "thoughts" in message_lower:
            return "I think the proposed approach makes sense. Let me review the specifics and share my detailed thoughts via email."
        elif "deadline" in message_lower or "timeline" in message_lower:
            return "I'll have a realistic timeline ready by tomorrow. I want to ensure we account for testing and review."
        else:
            return "Understood. I'll follow up on that right after this meeting."

    def _format_context(self, context: list[dict]) -> str:
        """Format retrieved context entries into a readable string."""
        if not context:
            return ""

        lines = []
        for entry in context:
            timestamp = entry.get("timestamp", "")
            speaker = entry.get("speaker", "Unknown")
            text = entry.get("text", "")
            lines.append(f"[{timestamp}] {speaker}: {text}")

        return "\n".join(lines)

    def _parse_reasoning_output(self, raw_output: str) -> ReasoningResult:
        """
        Parse LLM output into a structured ReasoningResult.

        Expected format:
        RESPOND: yes/no
        CONFIDENCE: 0.0-1.0
        REASONING: <explanation>
        RESPONSE: <response text>
        """
        result = {
            "RESPOND": "no",
            "CONFIDENCE": "0.0",
            "REASONING": "",
            "RESPONSE": "",
        }

        if not raw_output:
            return ReasoningResult(
                should_respond=False,
                confidence=0.0,
                reasoning="Empty LLM output",
            )

        # Parse key-value pairs from the output
        for line in raw_output.strip().split("\n"):
            line = line.strip()
            if ":" in line:
                key, _, value = line.partition(":")
                key = key.strip().upper()
                value = value.strip()
                if key in result:
                    result[key] = value

        # Build the result
        try:
            confidence = float(result["CONFIDENCE"])
        except (ValueError, TypeError):
            confidence = 0.0

        return ReasoningResult(
            should_respond=result["RESPOND"].lower().strip() in ("yes", "true", "1"),
            response_text=result["RESPONSE"] if result["RESPONSE"] else None,
            confidence=min(max(confidence, 0.0), 1.0),  # Clamp to [0, 1]
            reasoning=result["REASONING"],
        )

    async def generate_summary_text(self, transcript_text: str) -> str:
        """Generate a meeting summary using the LLM."""
        if self.summary_prompt_template:
            prompt = self.summary_prompt_template.format(
                meeting_transcript=transcript_text
            )
        else:
            prompt = f"Summarize the following meeting transcript:\n\n{transcript_text}"

        if self.use_aws:
            return await self._invoke_llm(prompt)
        else:
            return self._generate_local_summary(transcript_text)

    async def generate_late_join_text(
        self, recent_transcript: str, minutes: int
    ) -> str:
        """Generate a late-join catch-up summary."""
        if self.late_join_prompt_template:
            prompt = self.late_join_prompt_template.format(
                recent_transcript=recent_transcript,
                minutes=minutes,
            )
        else:
            prompt = (
                f"Summarize the last {minutes} minutes of this meeting:\n\n"
                f"{recent_transcript}"
            )

        if self.use_aws:
            return await self._invoke_llm(prompt)
        else:
            return self._generate_local_late_join(recent_transcript, minutes)

    def _generate_local_summary(self, transcript: str) -> str:
        """Generate a local summary without LLM."""
        lines = transcript.strip().split("\n")
        num_lines = len(lines)
        speakers = set()
        for line in lines:
            if ":" in line:
                parts = line.split(":", 1)
                if "]" in parts[0]:
                    speaker = parts[0].split("]")[-1].strip()
                else:
                    speaker = parts[0].strip()
                if speaker:
                    speakers.add(speaker)

        return (
            f"SUMMARY: Meeting with {len(speakers)} participants covering "
            f"{num_lines} discussion points.\n"
            f"KEY_POINTS:\n- Multiple topics were discussed\n"
            f"- Action items were identified\n"
            f"DECISIONS:\n- Follow-up meeting to be scheduled\n"
            f"ACTION_ITEMS:\n"
            f"- Review meeting notes | Assignee: {settings.user_name} | "
            f"Deadline: This week | Priority: medium"
        )

    def _generate_local_late_join(self, transcript: str, minutes: int) -> str:
        """Generate a local late-join summary."""
        lines = transcript.strip().split("\n")
        return (
            f"CURRENT_TOPIC: General Discussion\n"
            f"WHAT_YOU_MISSED:\n"
            f"- {len(lines)} messages in the last {minutes} minutes\n"
            f"- Multiple topics were discussed\n"
            f"KEY_DECISIONS:\n- To be confirmed\n"
            f"PENDING_QUESTIONS:\n- None identified"
        )

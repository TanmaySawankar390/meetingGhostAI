# Meeting Ghost AI

> **Your AI digital twin for meetings. It listens, understands, responds, and summarizes — so you don't have to.**

## 🚀 Quick Start

### Backend

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Start backend
cd backend
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Testing

```bash
# Run the meeting simulator
python scripts/meeting_simulator.py

# Run tests
pytest tests/ -v
```

## 📂 Project Structure

```
meetingghostai/
├── backend/               # Python FastAPI backend
│   ├── main.py           # App entry point & routes
│   ├── meeting_listener.py  # WebSocket audio handler
│   ├── speech_to_text.py    # Amazon Nova Sonic STT
│   ├── reasoning_engine.py  # LLM response decisions
│   ├── voice_response.py    # Amazon Polly TTS
│   ├── meeting_memory.py    # Vector DB operations
│   ├── summary_generator.py # Post-meeting summaries
│   ├── config.py            # Environment configuration
│   ├── models.py            # Data models
│   └── utils/               # Utility modules
├── frontend/              # Next.js dashboard
├── ai_prompts/            # LLM prompt templates
├── scripts/               # Development utilities
├── tests/                 # Test suite
├── docker-compose.yml     # Container orchestration
└── requirements.txt       # Python dependencies
```

## 🧩 Features

- **Real-time transcription** — Audio → Text via Amazon Nova Sonic
- **AI reasoning** — Detects questions directed at you and responds
- **Conversation memory** — Vector database for semantic context retrieval
- **Voice responses** — Natural TTS via Amazon Polly
- **Meeting summaries** — Automatic post-meeting reports with action items
- **Late-join catch-up** — Instant summary of what you missed
- **Dashboard** — Live transcript, summaries, and meeting simulator

## 🔧 Configuration

See `.env.example` for all configuration options. The system works
in offline/simulation mode without any API keys configured.

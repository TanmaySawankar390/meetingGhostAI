FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python tooling
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip wheel "setuptools<70.0.0"

# Stage 1: Install PyTorch first (sentence-transformers needs torch at install time)
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu torch

# Stage 2: Install remaining dependencies
RUN pip install --no-cache-dir --no-build-isolation -r requirements.txt

# Copy backend code
COPY backend/ ./backend/
COPY ai_prompts/ ./ai_prompts/

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.11-slim

# Install system dependencies including ffmpeg and OpenCV runtime requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Ensure snapshots directory exists
RUN mkdir -p static/snapshots

EXPOSE 5000

ENV PORT=5000
ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "gunicorn --workers 1 --threads 8 --bind 0.0.0.0:${PORT:-5000} app:app"]

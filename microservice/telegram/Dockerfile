FROM python:3.12-slim

WORKDIR /app

# Install minimal system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user and set up storage directories
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/storage/sessions /app/storage/temp \
    && chown -R appuser:appuser /app/storage

USER appuser

EXPOSE 8000

CMD ["python", "main.py"]

FROM python:3.12-slim

WORKDIR /app

# Install minimal system deps + gosu for user switching
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gosu \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/storage/sessions /app/storage/temp \
    && chown -R appuser:appuser /app/storage \
    && chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["python", "main.py"]

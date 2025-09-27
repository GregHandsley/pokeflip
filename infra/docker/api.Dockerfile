# infra/docker/api.Dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# system deps (psycopg + pillow/opencv deps minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# copy and install requirements
COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# copy source
COPY apps/api/ ./apps/api/

EXPOSE 8000
CMD ["uvicorn","apps.api.apps.api.main:app","--host","0.0.0.0","--port","8000","--reload"]

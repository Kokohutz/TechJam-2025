FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy everything (use .dockerignore to keep it lean)
COPY . .

# Install deps if we find a requirements file in common places
RUN if [ -f requirements.txt ]; then pip install -r requirements.txt; \
    elif [ -f backend/requirements.txt ]; then pip install -r backend/requirements.txt; \
    elif [ -f app/requirements.txt ]; then pip install -r app/requirements.txt; \
    else echo "No requirements.txt found, skipping pip install"; fi

# App port (change if your app listens somewhere else)
EXPOSE 8002

# Start command (change to your real entrypoint)
# Examples:
#   FastAPI: CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8002"]
#   Django:  CMD ["gunicorn","myproj.wsgi:application","--bind","0.0.0.0:8002"]
CMD ["python", "main.py"]

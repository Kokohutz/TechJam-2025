FROM python:3.11-slim
WORKDIR /app

# Optional: faster/cleaner Python
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# If you need build tools for some wheels, keep build-essential; otherwise remove it
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8002               # change if your app listens on another port
CMD ["python", "main.py"] # change to your real entry point

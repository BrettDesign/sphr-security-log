FROM python:3.11-slim

WORKDIR /app

# System libs needed by Pillow / reportlab (used by xhtml2pdf for the PDF report)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001
# Bind to $PORT when the platform provides one (e.g. Render); default to 8001
# so the docker-compose / Nginx setup (which proxies to backend:8001) still works.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]

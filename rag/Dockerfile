FROM python:3.11-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads && \
    chmod 777 /app/uploads

# Make start script executable
RUN chmod +x /app/start.sh

EXPOSE 8000 8001

CMD ["/app/start.sh"]

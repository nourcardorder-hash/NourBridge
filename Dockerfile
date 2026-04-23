# Dockerfile

# Stage 1: Build
FROM python:3.9-slim AS builder

# Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set the working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Production
FROM python:3.9-slim

# Copy only necessary files from builder
COPY --from=builder /app /app

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start the application
CMD ["/entrypoint.sh"]

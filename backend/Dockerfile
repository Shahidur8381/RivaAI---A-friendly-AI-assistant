FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source files
COPY . .

# Expose FastAPI application port
EXPOSE 8000

# Start Uvicorn ASGI server in production mode
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

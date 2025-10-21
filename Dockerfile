# 1. Start with a Python base image
FROM python:3.11-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Install system dependencies needed by Coqui TTS (like espeak)
# Use --no-install-recommends to keep the image smaller
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy only the requirements file first (for Docker caching)
COPY requirements.txt .

# 5. Install Python libraries
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of your application code into the container
#    This includes app.py, .env, and the frontend folder
COPY . .

# 7. Tell Docker which port your app will listen on
EXPOSE 5000

# 8. Define the command to run your app using Gunicorn
#    Binds to all network interfaces (0.0.0.0) on port 5000
CMD ["gunicorn", "--workers", "1", "--threads", "4", "--bind", "0.0.0.0:5000", "app:app"]
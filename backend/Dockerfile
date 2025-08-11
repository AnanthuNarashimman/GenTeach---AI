# Dockerfile for GenTeach AI Video Generator

# === Stage 1: Base Image ===
# We start with an official, slim version of Python. This provides a good balance
# between size and having the necessary tools.
FROM python:3.10-slim

# === Stage 2: Set Up the Environment ===
# Set the working directory inside the container to /app. All subsequent commands
# will run from this directory.
WORKDIR /app

# Set an environment variable to prevent Python from buffering output.
# This is crucial for seeing logs in real-time in Google Cloud Run.
ENV PYTHONUNBUFFERED True

# === Stage 3: Install System-Level Dependencies ===
# Your app.py uses MoviePy for video creation, which requires FFmpeg for video
# encoding/decoding and ImageMagick for creating text clips and other effects.
# This command updates the package list and installs them.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# === Stage 3.5: Configure ImageMagick Security Policy ===
# MoviePy requires ImageMagick to process text and images, but ImageMagick's
# default security policy blocks many operations. We need to modify it.
RUN sed -i 's/<policy domain="path" rights="none" pattern="@\*"/<policy domain="path" rights="read|write" pattern="@*"/' /etc/ImageMagick-6/policy.xml

# === Stage 3.6: Install System Fonts ===
# MoviePy needs fonts for text generation. Install common fonts.
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* && \
    fc-cache -fv


# === Stage 4: Install Python Dependencies ===
# First, copy only the requirements.txt file. This is a key Docker optimization.
# If this file doesn't change, Docker can reuse the cached layer from a previous
# build, making future builds much faster.
COPY requirements.txt .

# Now, install all the Python libraries specified in your requirements file.
RUN pip install --no-cache-dir -r requirements.txt

# === Stage 5: Copy Your Application Code ===
# Copy the rest of your application's files into the /app directory in the container.
# This includes your app.py, the 'fonts' folder, and the 'static' folder.
# The first '.' refers to the source directory (your backend/ folder on your machine).
# The second '.' refers to the destination directory inside the container (/app).
COPY . .

# === Stage 6: Define the Command to Run Your App ===
# This is the command that will be executed when your container starts on Cloud Run.
# We use Gunicorn, a production-grade web server, instead of Flask's built-in dev server.
#
# --bind :$PORT       : Binds to the port provided by Cloud Run.
# --workers 1         : Use a single worker process.
# --threads 8         : Handle up to 8 requests concurrently per worker.
# --timeout 3600      : CRITICAL! Sets the request timeout to 1 hour (3600 seconds).
#                       This is necessary for your long-running video generation tasks.
# app:app             : Tells Gunicorn to look for a file named app.py and find the
#                       Flask application object named 'app' inside it.
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 3600 app:app

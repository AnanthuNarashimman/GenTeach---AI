# Dockerfile for GenTeach AI Video Generator (Multi-Stage Build)

# ====================================================================
# Stage 1: Builder - Installs all dependencies and prepares assets
# ====================================================================
FROM python:3.10-slim as builder

# --- Set Up the Environment ---
WORKDIR /app
ENV PYTHONUNBUFFERED True

# --- Install System-Level Dependencies ---
# Install ffmpeg, imagemagick, and fonts needed for MoviePy.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# --- Configure ImageMagick Security Policy ---
# Safely find and modify the policy file to allow MoviePy operations.
RUN policy_file=$(find /etc -name policy.xml | head -n 1) && \
    if [ -n "$policy_file" ]; then \
        sed -i 's/<policy domain="path" rights="none" pattern="@\*"/<policy domain="path" rights="read|write" pattern="@\*"/' "$policy_file"; \
    else \
        echo "Warning: policy.xml not found, skipping ImageMagick policy update"; \
    fi

# --- Pre-build Python Dependencies ---
# Copy requirements.txt and build Python packages into "wheels" for faster
# installation in the final stage. This is a key optimization.
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ==================================================================
# Stage 2: Final Production Image - Lean and Optimized
# ==================================================================
FROM python:3.10-slim

# --- Set Up the Environment ---
WORKDIR /app
ENV PYTHONUNBUFFERED True

# --- Copy Necessary Assets from Builder Stage ---
# Copy only the essential runtime files from the builder stage, leaving
# behind all the build tools and intermediate files.
COPY --from=builder /usr/bin/ffmpeg /usr/bin/
COPY --from=builder /usr/bin/convert /usr/bin/
COPY --from=builder /usr/lib/x86_64-linux-gnu /usr/lib/x86_64-linux-gnu
COPY --from=builder /etc/ImageMagick-* /etc/ImageMagick-6/
COPY --from=builder /usr/share/fonts /usr/share/fonts
COPY --from=builder /wheels /wheels

# --- Install Python Dependencies from Wheels ---
# Install the pre-built Python packages. This is much faster and cleaner.
RUN pip install --no-cache /wheels/*

# --- Copy Your Application Code ---
COPY . .

# --- Define the Command to Run Your App ---
# Use Gunicorn for a production-ready server with a long timeout for video tasks.
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 3600 app:app

# Build stage
FROM --platform=$BUILDPLATFORM node:18-bullseye-slim as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM --platform=$TARGETPLATFORM ubuntu:22.04 as production

WORKDIR /app

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and other dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y \
    nodejs \
    ffmpeg \
    sox \
    python3 \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        torch \
        torchaudio \
        numpy \
        soundfile \
        librosa

# Create app directory and use non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m staycrest && \
    chown -R staycrest:nodejs /app

# Create necessary directories with proper permissions
RUN mkdir -p \
    /app/logs \
    /app/uploads \
    /app/cache \
    && chown -R staycrest:nodejs \
        /app/logs \
        /app/uploads \
        /app/cache

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source files
COPY . .

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    ENABLE_WEBSOCKET=true \
    CACHE_TTL=3600 \
    MAX_UPLOAD_SIZE=50mb

# Add volume mount points
VOLUME ["/app/logs", "/app/uploads", "/app/cache"]

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER staycrest

# Expose API port
EXPOSE 3000

# Start in production mode
CMD ["npm", "start"] 
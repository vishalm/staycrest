# Build stage
FROM --platform=$BUILDPLATFORM node:18 as builder

WORKDIR /app

# Install build dependencies and download Node.js headers
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    make \
    g++ \
    wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /usr/local/share/node-gyp/18.20.8 \
    && wget -q -O - https://nodejs.org/download/release/v18.20.8/node-v18.20.8-headers.tar.gz \
    | tar xz --strip-components=1 -C /usr/local/share/node-gyp/18.20.8

# Set Python environment and node-gyp paths
ENV PYTHON=/usr/bin/python3 \
    NODE_GYP_FORCE_PYTHON=/usr/bin/python3 \
    npm_config_nodedir=/usr/local/share/node-gyp/18.20.8

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Production stage
FROM --platform=$TARGETPLATFORM node:18 as production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3-minimal \
    python3-pip \
    ffmpeg \
    sox \
    curl \
    && pip3 install --no-cache-dir \
    torch \
    torchaudio \
    numpy \
    soundfile \
    librosa \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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

# Copy from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

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
CMD ["node", "dist/index.js"] 
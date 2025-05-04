# Build stage
FROM --platform=$BUILDPLATFORM node:18 as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    make \
    g++ \
    wget \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create and activate Python virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Download and extract Node.js headers with verification
RUN mkdir -p /usr/local/share/node-gyp/18.20.8 && \
    cd /tmp && \
    wget --no-check-certificate https://nodejs.org/download/release/v18.20.8/node-v18.20.8-headers.tar.gz && \
    tar xzf node-v18.20.8-headers.tar.gz && \
    cp -r node-v18.20.8/* /usr/local/share/node-gyp/18.20.8/ && \
    rm -rf /tmp/node-v18.20.8*

# Set Python environment and node-gyp paths
ENV PYTHON=/usr/bin/python3 \
    NODE_GYP_FORCE_PYTHON=/usr/bin/python3 \
    npm_config_nodedir=/usr/local/share/node-gyp/18.20.8 \
    NODE_TLS_REJECT_UNAUTHORIZED=0 \
    npm_config_strict_ssl=false

# Configure npm to skip SSL verification
RUN npm config set strict-ssl false && \
    npm config set registry http://registry.npmjs.org/

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps and no SSL verification
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npm install --legacy-peer-deps --no-strict-ssl

# Copy source code
COPY . .

# Production stage
FROM --platform=$TARGETPLATFORM node:18 as production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    sox \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create and activate Python virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python packages in virtual environment
RUN pip3 install --no-cache-dir \
    torch \
    torchaudio \
    numpy \
    soundfile \
    librosa

# Create app directory and use non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m staycrest && \
    chown -R staycrest:nodejs /app /opt/venv

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
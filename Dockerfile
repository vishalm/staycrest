# Build stage
FROM node:18-alpine as builder

# Create app directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application if needed
RUN npm run build

# Production stage
FROM node:18-alpine

# Create app directory and use non-root user
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S staycrest -u 1001 && \
    chown -R staycrest:nodejs /app

# Install production dependencies
RUN apk add --no-cache dumb-init curl tini tzdata

# Set node environment
ENV NODE_ENV=production
ENV TZ=UTC

# Set default values for worker threads and process count
ENV WORKER_THREADS=4
ENV WORKER_PROCESSES=2
ENV ENABLE_METRICS=true
ENV ENABLE_TRACING=true

# Create necessary directories
RUN mkdir -p /app/logs /app/data && \
    chown -R staycrest:nodejs /app/logs /app/data

# Copy from builder stage
COPY --from=builder --chown=staycrest:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=staycrest:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=staycrest:nodejs /app/server /app/server
COPY --from=builder --chown=staycrest:nodejs /app/cluster.js /app/cluster.js
COPY --from=builder --chown=staycrest:nodejs /app/server.js /app/server.js
COPY --from=builder --chown=staycrest:nodejs /app/kubernetes /app/kubernetes
COPY --from=builder --chown=staycrest:nodejs /app/monitoring /app/monitoring

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health/liveness || exit 1

# Switch to non-root user
USER staycrest

# Expose ports
EXPOSE 3000 9091

# Run application with tini for proper PID 1 handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default to running in cluster mode for production
CMD ["node", "cluster.js"] 
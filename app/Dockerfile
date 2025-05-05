# Build stage
FROM node:18 as builder

WORKDIR /app

# Copy package files first
COPY app/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY app/ .

# Copy HTML files and static assets from root directory
COPY index.html admin.html admin-login.html test.html full-test.html html-check.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY assets/ ./assets/

# Production stage
FROM node:18 as production

WORKDIR /app

# Copy package files and dependencies from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy application files and static assets
COPY --from=builder /app/server ./server
COPY --from=builder /app/index.html ./
COPY --from=builder /app/admin.html ./
COPY --from=builder /app/admin-login.html ./
COPY --from=builder /app/test.html ./
COPY --from=builder /app/full-test.html ./
COPY --from=builder /app/html-check.html ./
COPY --from=builder /app/css ./css
COPY --from=builder /app/js ./js
COPY --from=builder /app/assets ./assets

# Create necessary directories with proper permissions
RUN mkdir -p \
    /app/logs \
    /app/uploads \
    /app/cache \
    && chown -R node:node \
        /app/logs \
        /app/uploads \
        /app/cache \
        /app/node_modules \
        /app/server \
        /app/package.json \
        /app/index.html \
        /app/admin.html \
        /app/admin-login.html \
        /app/test.html \
        /app/full-test.html \
        /app/html-check.html \
        /app/css \
        /app/js \
        /app/assets

# Switch to non-root user
USER node

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Add volume mount points
VOLUME ["/app/logs", "/app/uploads", "/app/cache"]

# Expose API port
EXPOSE 3000

# Start in production mode
CMD ["node", "server/app.js"]
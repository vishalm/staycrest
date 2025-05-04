# StayCrest Deployment Guide

This document provides comprehensive instructions for deploying StayCrest in various environments, from local development to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Production Deployment](#production-deployment)
5. [Monitoring Setup](#monitoring-setup)
6. [Maintenance](#maintenance)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Software Requirements

- Node.js v18 or higher
- Docker and Docker Compose
- Git
- MongoDB Tools (optional, for database operations)
- Redis CLI (optional, for cache operations)

### Resource Requirements

- **Development**: Minimum 8GB RAM, 4 CPU cores
- **Production**: Minimum 16GB RAM, 8 CPU cores, 50GB storage

### Network Requirements

- Open ports:
  - 3000: Main application
  - 27017: MongoDB
  - 6379: Redis
  - 9090: Prometheus
  - 3001: Grafana
  - 5601: Kibana
  - 16686: Jaeger UI
  - 9200: Elasticsearch
  - 8080: Adminer

## Local Development Setup

### Simple Server (Quick Start)

For a lightweight development experience:

```bash
# Clone the repository
git clone https://github.com/staycrest/staycrest.git
cd staycrest

# Install dependencies
npm install

# Start the simple server
npm run simple-server
# Or use the convenience script
./start.sh
```

Access the application at http://localhost:3000

### Full Stack Development

For a complete development environment with all services:

```bash
# Start all services with Docker Compose
docker compose up -d

# Install Node.js dependencies 
npm install

# Run the application in development mode
npm run dev
```

## Docker Compose Deployment

### Basic Deployment

The simplest way to deploy the full stack:

```bash
# Clone the repository
git clone https://github.com/staycrest/staycrest.git
cd staycrest

# Start all services
docker compose up -d
```

### Selective Service Deployment

To run only specific components:

```bash
# Core application with essential databases
docker compose up -d app mongodb redis

# Monitoring stack only
docker compose up -d prometheus grafana jaeger otel-collector
```

### Environment Configuration

Create a `.env` file in the project root to customize the deployment:

```
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
WORKER_THREADS=8
WORKER_PROCESSES=4

# Databases
MONGODB_URI=mongodb://admin:custom_password@mongodb:27017/staycrest
REDIS_URI=redis://:custom_redis_password@redis:6379

# Security
JWT_SECRET=your_custom_jwt_secret
SESSION_SECRET=your_custom_session_secret

# LLM Configuration
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

Then deploy with the custom configuration:

```bash
docker compose --env-file .env up -d
```

## Production Deployment

### Preparing for Production

Before deploying to production:

1. **Secure credentials**: Update all default passwords and secrets
2. **Scale appropriately**: Adjust resource limits based on expected load
3. **Enable backups**: Configure database backups
4. **Set up monitoring**: Ensure alerts are configured

### Docker Compose (Small-Scale Production)

For small-scale production deployments:

```bash
# Create production .env file
cp .env.example .env.production
vim .env.production  # Edit with production values

# Deploy with production configuration
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

For large-scale production deployments:

```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmaps.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/databases/
kubectl apply -f kubernetes/monitoring/
kubectl apply -f kubernetes/app/

# Verify deployment
kubectl get pods -n staycrest
```

### SSL/TLS Configuration

To enable HTTPS:

1. Generate or obtain SSL certificates
2. Configure the Ingress or API Gateway with the certificates
3. Update the application to use HTTPS URLs

Example Nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name staycrest.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring Setup

### Accessing Monitoring Dashboards

After deployment, access the monitoring tools:

- **Grafana**: http://localhost:3001 (admin/staycrest)
- **Prometheus**: http://localhost:9090
- **Kibana**: http://localhost:5601
- **Jaeger UI**: http://localhost:16686

### Importing Dashboards

Import pre-configured dashboards in Grafana:

1. Go to http://localhost:3001 and log in
2. Navigate to Dashboards > Import
3. Import dashboards from `monitoring/grafana/dashboards/`

### Setting Up Alerts

Configure alerts in Grafana:

1. Go to Alerting > Alert Rules
2. Create alerts for:
   - High error rates
   - Elevated response times
   - Low disk space
   - High CPU/memory usage

## Maintenance

### Backup and Restore

#### Database Backup

```bash
# MongoDB backup
docker exec staycrest-mongodb mongodump --out /data/backups/$(date +%Y-%m-%d)

# Copy backup files to host
docker cp staycrest-mongodb:/data/backups ./backups

# PostgreSQL backup
docker exec staycrest-postgres pg_dump -U postgres staycrest > staycrest_$(date +%Y-%m-%d).sql
```

#### Database Restore

```bash
# MongoDB restore
docker cp ./backups/2023-05-01 staycrest-mongodb:/data/restore
docker exec staycrest-mongodb mongorestore /data/restore

# PostgreSQL restore
cat staycrest_2023-05-01.sql | docker exec -i staycrest-postgres psql -U postgres staycrest
```

### Scaling Services

```bash
# Scale app service
docker compose up -d --scale app=3

# In Kubernetes
kubectl scale deployment/staycrest-app -n staycrest --replicas=5
```

### Updating the Application

```bash
# Pull latest changes
git pull

# Rebuild and restart services
docker compose build app
docker compose up -d app
```

### Log Rotation

Configure log rotation to prevent disk space issues:

```bash
# Configure Docker log rotation
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Restart Docker
systemctl restart docker
```

## Troubleshooting

### Common Issues

#### Application Won't Start

**Symptoms**: The app container exits immediately or fails health checks.

**Solutions**:
1. Check container logs: `docker compose logs app`
2. Verify environment variables are set correctly
3. Ensure MongoDB and Redis are running: `docker compose ps`

#### MongoDB Connection Issues

**Symptoms**: Application logs show MongoDB connection errors.

**Solutions**:
1. Check if MongoDB is running: `docker compose ps mongodb`
2. Verify connection string is correct in environment variables
3. Check if MongoDB replica set is initialized properly
4. Try resetting the MongoDB replica set:
   ```bash
   docker compose down -v mongodb mongo-init
   docker compose up -d mongodb
   docker compose up mongo-init
   ```

#### High Memory Usage

**Symptoms**: Services crash or become unresponsive, host system shows high memory pressure.

**Solutions**:
1. Check which service is using memory: `docker stats`
2. Adjust memory limits in docker-compose.yml
3. Scale down services if needed
4. Consider upgrading host resources

#### Slow Performance

**Symptoms**: API responses are slow, UI feels sluggish.

**Solutions**:
1. Check CPU usage: `docker stats`
2. Check application logs for long-running operations
3. Analyze Jaeger traces to identify bottlenecks
4. Add Redis caching for frequent operations
5. Scale up the application service

### Diagnostic Commands

```bash
# Check all container statuses
docker compose ps

# View container logs
docker compose logs app
docker compose logs mongodb

# Follow logs in real-time
docker compose logs -f app

# Check container resource usage
docker stats

# Inspect container
docker inspect staycrest-app

# Check database connection
docker exec -it staycrest-mongodb mongosh -u admin -p admin123
```

### Getting Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/staycrest/staycrest/issues) for similar problems
2. Review the [Troubleshooting Guide](docs/troubleshooting.md) for detailed solutions
3. Reach out to the community on [Discord](https://discord.gg/staycrest)
4. Submit a detailed bug report with logs and environment information 
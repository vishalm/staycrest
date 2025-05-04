# StayCrest 🏨✨

## AI-Powered Hotel Discovery Platform

StayCrest is an enterprise-grade hotel discovery platform with AI-powered conversations, loyalty program integration, and a robust microservices architecture. It features comprehensive observability, distributed tracing, and high availability.

![StayCrest Banner](assets/images/staycrest-banner.svg)

## Features

- 🎨 **Beautiful UI with Dark/Light Mode**: Toggle between themes with smooth transitions
- 🤖 **AI Chat Interface**: Converse naturally using Ollama-based LLM integration
- 🔍 **Hotel Search**: Search and view hotel details with rich information
- 📊 **Complete Observability Stack**: Prometheus, Grafana, ELK, and OpenTelemetry integration
- 🗣️ **Voice Input Support**: Voice interface for natural hotel queries
- 💾 **Persistent Data Storage**: MongoDB, Redis, and PostgreSQL with pgvector for RAG
- 🌐 **Scalable Backend API**: Containerized microservices architecture
- 🧪 **Comprehensive Test Suite**: Full test coverage with Jest

## System Architecture

StayCrest follows a modern microservices architecture with the following components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Web Frontend   │────▶│   Node.js API   │────▶│  LLM Services   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                        │
         │                      │                        │
         ▼                      ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Redis Cache     │     │ MongoDB         │     │ PostgreSQL      │
│ Session Storage │     │ Primary Storage │     │ Vector Storage  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                        │
         │                      │                        │
         ▼                      ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Observability Stack                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Prometheus  │  │    Grafana   │  │    ELK Stack         │   │
│  │  Metrics     │  │  Dashboards  │  │  Logs & Visualization│   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │    Jaeger    │  │   OpenTel    │                              │
│  │    Tracing   │  │  Collector   │                              │
│  └──────────────┘  └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start (Docker Compose)

The easiest way to run the complete StayCrest platform is with Docker Compose.

### Prerequisites

- Docker and Docker Compose installed
- 8GB+ RAM recommended for the full stack

### Running the Full Stack

```bash
# Start all services
docker compose up -d

# Check service status
docker compose ps
```

### Access the Application and Services

- **Web Application**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs
- **Monitoring Dashboards**:
  - Grafana: http://localhost:3001 (user: admin, password: staycrest)
  - Kibana: http://localhost:5601
  - Prometheus: http://localhost:9090
  - Jaeger UI: http://localhost:16686
- **Database Admin Tools**:
  - Adminer: http://localhost:8080 (See connection details below)

### Running Individual Components

If you prefer to run only specific components, you can specify the services:

```bash
# Run only the core application with MongoDB
docker compose up -d app mongodb redis

# Run just the monitoring stack
docker compose up -d prometheus grafana jaeger otel-collector

# Run the ELK stack for logging
docker compose up -d elasticsearch logstash kibana
```

## Kubernetes Deployment

StayCrest is designed to run in Kubernetes environments with full support for cloud-native features. We use Kustomize for configuration management.

### Prerequisites

- Kubernetes cluster (1.22+)
- kubectl installed and configured
- kustomize installed (v4.0.0+)

### Deploying with Kustomize

The `kubernetes` directory contains all necessary configuration files that can be deployed using Kustomize:

```bash
# Deploy all resources using kustomize
kubectl apply -k kubernetes/

# View deployed resources
kubectl get all -n staycrest

# Check status of the deployment
kubectl -n staycrest get pods
```

### Understanding Kubernetes Configuration

The Kubernetes deployment is organized as follows:

1. **ConfigMaps**:
   - `search-sources-config.yaml`: Contains all hotel loyalty providers, web search engines, and aggregator configurations
   - `otel-collector-config`: OpenTelemetry Collector configuration
   - `grafana-dashboards`: Grafana dashboard definitions, including a search sources dashboard

2. **Deployments**:
   - `staycrest`: Main application deployment
   - Supporting services (databases, monitoring tools)

3. **Jobs**:
   - `search-sources-validator`: Validates the search sources configuration

The search sources configuration file (`search-sources-config.yaml`) is especially important as it contains all the hotel loyalty program and search provider information used by the application. It includes:

- Loyalty program details (Marriott, Hilton, IHG, etc.)
- Web search providers (Google, Bing)
- Hotel aggregators (Expedia, Booking.com, etc.)
- Direct booking platforms
- Theme and styling information for each provider

### Customizing the Deployment

You can customize the deployment by:

1. Modifying the `kubernetes/kustomization.yaml` file
2. Creating environment-specific overlays

```bash
# Create a production overlay
mkdir -p kubernetes/overlays/production

# Create a kustomization.yaml in the overlay directory
cat > kubernetes/overlays/production/kustomization.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../

namespace: staycrest-prod

patches:
- path: replica-count.yaml
EOF

# Create a patch for production replicas
cat > kubernetes/overlays/production/replica-count.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: staycrest
spec:
  replicas: 5
EOF

# Apply the production overlay
kubectl apply -k kubernetes/overlays/production/
```

### Managing Hotel Search Sources

The search sources configuration is stored as a ConfigMap and can be modified:

```bash
# View current search sources configuration
kubectl -n staycrest describe configmap search-sources-config

# Edit the search sources configuration
kubectl -n staycrest edit configmap search-sources-config

# Restart the application to pick up changes
kubectl -n staycrest rollout restart deployment staycrest
```

### Search Sources Validation

A validation job ensures the integrity of the search sources configuration:

```bash
# Check the status of the validation job
kubectl -n staycrest get jobs search-sources-validator

# View the validator logs
kubectl -n staycrest logs job/search-sources-validator

# If you need to rerun the validation job
kubectl -n staycrest delete job search-sources-validator
kubectl apply -k kubernetes/search-sources-validator.yaml

# To modify the validation criteria
kubectl -n staycrest edit job search-sources-validator
```

The validator checks:
1. Presence of loyalty programs
2. Proper configuration of web search providers
3. Configuration of hotel aggregators
4. Direct booking options

Any issues are reported in the job logs, allowing you to fix configuration problems before they affect users.

### Observability in Kubernetes

The Kubernetes deployment includes a full observability stack:

- Prometheus for metrics
- Grafana for dashboards (including search sources dashboard)
- Jaeger for distributed tracing
- OpenTelemetry for instrumentation

### Database Caching in Kubernetes

StayCrest uses a comprehensive database caching strategy to optimize performance. The Kubernetes deployment includes:

1. **Redis Cache Configuration**
   - Main cache for general application data
   - Search-specific cache with optimized TTL
   - Rate limiting cache
   - Memory usage and eviction policies

2. **MongoDB Cache Configuration**
   - Collection-specific caching with TTL settings
   - Query pattern optimization
   - Cache invalidation triggers
   - Read preference configuration for replica sets

3. **PostgreSQL Optimization**
   - PgBouncer connection pooling
   - PgVector cache configuration for semantic searches
   - Query result caching with table-specific TTLs

4. **Deployment Features**
   - Database cache ConfigMap for centralized configuration
   - Cache validator job to ensure configuration integrity
   - Environment variables for enabling/disabling cache features
   - Grafana dashboard for monitoring cache performance

5. **Environment-Specific Settings**
   - Development: Reduced cache sizes, higher debug visibility
   - Production: Optimized memory usage, circuit breaker protection

To update the database cache configuration:

```bash
# Edit the database cache configuration
kubectl edit configmap db-cache-config -n staycrest

# Validate the configuration
kubectl apply -f kubernetes/db-cache-validator.yaml

# Restart services to apply new configuration
kubectl rollout restart deployment staycrest -n staycrest
```

### State Management and Persistence in Kubernetes

StayCrest uses Persistent Volume Claims (PVCs) for all stateful components to ensure data persistence across pod restarts and cluster migrations. The platform includes:

1. **Database Persistence**
   - MongoDB: 20GB storage for document database (`mongodb-data-pvc`)
   - PostgreSQL: 15GB storage for vector and relational data (`postgres-data-pvc`)
   - Redis: 10GB storage for caching and session management (`redis-data-pvc`)

2. **LLM and AI Components**
   - Ollama: 50GB storage for hosting all language models locally (`ollama-models-pvc`)
   - Models are downloaded and managed within the cluster, no local storage needed

3. **Observability Persistence**
   - Elasticsearch: 30GB storage for logs and search indices (`elasticsearch-data-pvc`)
   - Prometheus: 15GB storage for metrics with 30-day retention (`prometheus-data-pvc`)
   - Grafana: 5GB storage for dashboards and configurations (`grafana-data-pvc`)
   - Application Logs: 8GB storage for centralized logging (`app-logs-pvc`)

To manage persistent volumes:

```bash
# Check status of PVCs
kubectl get pvc -n staycrest

# For backup of critical data, create snapshots (if your storage provider supports it)
kubectl apply -f kubernetes/snapshots/create-mongodb-snapshot.yaml

# Increase storage capacity (if your storage class supports volume expansion)
kubectl patch pvc ollama-models-pvc -n staycrest -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
```

The Ollama service is deployed with:
- Automatic model downloading for Llama2, Mistral, and CodeLlama
- GPU support when available (using NVIDIA runtime)
- Full persistence of models across restarts
- Dedicated service endpoint for AI inference

To access Grafana dashboards:

```bash
# Port-forward to access Grafana
kubectl -n staycrest port-forward svc/grafana 3001:3000

# Access the dashboards at:
# http://localhost:3001/d/search-sources/search-sources-service
# http://localhost:3001/d/db-cache/database-cache-performance
```

## Development Setup

### Running the Simple Server (Development Mode)

For local development without the full stack:

```bash
# Install dependencies
npm install

# Start the simple server
npm run simple-server

# Or use the convenience script
./start.sh
```

### Running with Hot Reload

```bash
# Run with nodemon for auto-restart
npm run dev
```

### Database Connection Details

When using Adminer (http://localhost:8080):

**MongoDB**:
- System: MongoDB
- Server: mongodb
- Username: admin
- Password: admin123
- Database: staycrest

**PostgreSQL**:
- System: PostgreSQL
- Server: postgres
- Username: postgres
- Password: postgres
- Database: staycrest

## API Endpoints

### Core API

- **GET /api/search**: Search for hotels
  - Query params: `q` (search term), `location` (optional filter)
  - Returns hotel listings matching the search criteria

- **POST /api/chat**: Send chat messages to AI
  - Body: `{ "message": "your message", "sessionId": "unique-session-id" }`
  - Returns AI-generated responses based on the input

- **GET /api/loyalty/programs**: Get loyalty program information
  - Returns data about hotel loyalty programs, point values, and affiliated hotel chains

- **GET /api/features**: Get feature flags
  - Returns configuration for enabled features like voice commands and dark mode

### Admin & Health APIs

- **GET /api/v1/health**: Health check endpoint
  - Returns system health status

- **GET /api/v1/metrics**: Prometheus metrics (port 9091)
  - Returns application metrics in Prometheus format

- **GET /api/docs**: API documentation
  - Swagger UI with interactive API documentation

## Component Details

### Core Components

| Service | Description | Tech Stack | Port |
|---------|-------------|------------|------|
| app | Main application service | Node.js, Express | 3000, 9091 |
| mongodb | Primary database | MongoDB 6 | 27017 |
| redis | Caching and session storage | Redis 7 | 6379 |
| postgres | Vector database for RAG | PostgreSQL with pgvector | 5432 |

### Observability Stack

| Service | Description | Tech Stack | Port |
|---------|-------------|------------|------|
| prometheus | Metrics collection and storage | Prometheus | 9090 |
| grafana | Metrics visualization and dashboards | Grafana | 3001 |
| elasticsearch | Log storage and search | Elasticsearch 7 | 9200 |
| logstash | Log collection and processing | Logstash 7 | - |
| kibana | Log visualization | Kibana 7 | 5601 |
| jaeger | Distributed tracing | Jaeger | 16686 |
| otel-collector | OpenTelemetry collection | OpenTelemetry | 4317, 4318 |
| node-exporter | Host metrics collection | Prometheus Node Exporter | 9100 |

### Support Services

| Service | Description | Tech Stack | Port |
|---------|-------------|------------|------|
| adminer | Database management UI | Adminer | 8080 |
| connection-pool | MongoDB connection pooling | TCP Proxy | 27117 |
| mongo-init | MongoDB replica set initialization | MongoDB | - |

## Environment Configuration

The application can be configured using environment variables in the docker-compose.yml file:

```yaml
environment:
  - NODE_ENV=development
  - PORT=3000
  - MONGODB_URI=mongodb://mongodb:27017/staycrest
  - REDIS_URI=redis://redis:6379
  - JWT_SECRET=development_jwt_secret
  - LOG_LEVEL=debug
  - WORKER_THREADS=4
  - WORKER_PROCESSES=2
  - ENABLE_METRICS=true
  - ENABLE_TRACING=true
```

## Project Structure

```
staycrest/
├── server/                # Server-side code
│   ├── app.js            # Express application
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   ├── models/           # Data models
│   ├── mcp/              # Model-Controller-Presenter
│   └── agents/           # AI agents
├── js/                   # Client-side JavaScript
├── monitoring/           # Monitoring and observability configs
│   ├── grafana/          # Grafana dashboards
│   ├── prometheus/       # Prometheus configuration
│   ├── otel/             # OpenTelemetry configuration
│   ├── logstash/         # Logstash pipelines
│   ├── mongo-init/       # MongoDB initialization scripts
│   └── redis/            # Redis configuration
├── kubernetes/           # Kubernetes deployment configs
├── Dockerfile            # Application container definition
├── docker-compose.yml    # Local development stack
├── cluster.js            # Node.js clustering for production
├── server.js             # Simple server for development
├── index.html            # Main HTML file
└── package.json          # Project dependencies
```

## Testing

```bash
# Run all tests with coverage report
npm test

# Run tests in watch mode during development
npm run test:watch

# Run only client-side tests
npm run test:client

# Run only server-side tests
npm run test:server
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: If services fail to start due to port conflicts, ensure ports 3000, 27017, 6379, etc. are available.
   ```bash
   # Check for processes using port 3000
   lsof -i :3000
   
   # Stop the StayCrest server if running
   ./stop.sh
   ```

2. **MongoDB replica set issues**: If MongoDB fails to initialize, you may need to reset the replica set:
   ```bash
   docker compose down -v  # Warning: This will delete volumes
   docker compose up -d mongodb
   ```

3. **Memory issues**: If containers crash or are killed, check Docker memory allocation:
   ```bash
   docker stats
   ```

### Kubernetes Troubleshooting

1. **Debugging the Search Sources Configuration**:
   ```bash
   # Check if search-sources-config ConfigMap exists
   kubectl -n staycrest get configmap search-sources-config
   
   # Check validation job logs
   kubectl -n staycrest logs job/search-sources-validator
   
   # View the mounted configuration in a running pod
   kubectl -n staycrest exec -it deploy/staycrest -- cat /app/config/search-sources.js
   ```

2. **Pod Startup Issues**:
   ```bash
   # Check pod status
   kubectl -n staycrest get pods
   
   # View pod logs
   kubectl -n staycrest logs deploy/staycrest
   
   # Check events for issues
   kubectl -n staycrest get events --sort-by='.lastTimestamp'
   ```

3. **Health Check Failures**:
   ```bash
   # Check readiness probe logs
   kubectl -n staycrest describe pod -l app=staycrest
   
   # Test the health endpoint manually
   kubectl -n staycrest port-forward deploy/staycrest 8080:3000
   curl http://localhost:8080/api/health/search-sources
   ```

4. **ConfigMap Updates Not Taking Effect**:
   ```bash
   # Restart the deployment to pick up ConfigMap changes
   kubectl -n staycrest rollout restart deployment staycrest
   
   # Force update by recreating pods
   kubectl -n staycrest scale deploy staycrest --replicas=0
   kubectl -n staycrest scale deploy staycrest --replicas=3
   ```

### Viewing Logs

```bash
# View logs from all services
docker compose logs

# View logs from a specific service
docker compose logs app

# Follow logs in real-time
docker compose logs -f app
```

## License

MIT License

## Acknowledgments

StayCrest is a demonstration project showcasing modern architecture practices including containerization, observability, and AI integration.

---

Made with ❤️ for travelers by travelers

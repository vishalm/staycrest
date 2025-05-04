# StayCrest Architecture Documentation

This document provides a detailed overview of the StayCrest system architecture, design principles, and component interactions.

## System Overview

StayCrest is built on a modern microservices architecture that emphasizes:

- **Scalability**: Horizontally scalable components
- **Resilience**: Fault tolerance through redundancy and circuit breakers
- **Observability**: Comprehensive monitoring and tracing
- **Security**: Authentication, authorization, and data protection
- **Performance**: Caching and optimized data access patterns

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             Client Layer                                 │
│                                                                          │
│   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐       │
│   │  Web Browser  │      │ Mobile App    │      │ Voice Devices │       │
│   └───────────────┘      └───────────────┘      └───────────────┘       │
└────────────────┬──────────────────┬───────────────────┬─────────────────┘
                 │                  │                   │
                 ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             API Gateway                                  │
│                                                                          │
│   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐       │
│   │ Routing       │      │ Rate Limiting │      │ Authentication │       │
│   └───────────────┘      └───────────────┘      └───────────────┘       │
└────────────────┬──────────────────┬───────────────────┬─────────────────┘
                 │                  │                   │
                 ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Application Services                             │
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────┐│
│  │ User Service   │ │ Search Service │ │ LLM Service    │ │ Hotel      ││
│  │                │ │                │ │                │ │ Service    ││
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────┘│
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────┐│
│  │ Loyalty Service│ │ Analytics      │ │ Notification   │ │ Payment    ││
│  │                │ │ Service        │ │ Service        │ │ Service    ││
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────┘│
└───────────┬──────────────────┬───────────────────────────┬──────────────┘
            │                  │                           │
            ▼                  ▼                           ▼
┌───────────────────┐  ┌──────────────────┐      ┌─────────────────────────┐
│  Data Layer       │  │  External APIs    │      │  Support Services       │
│                   │  │                   │      │                         │
│ ┌───────────────┐ │  │ ┌───────────────┐ │      │ ┌───────────────────┐  │
│ │ MongoDB       │ │  │ │ Hotel APIs    │ │      │ │ Redis Cache       │  │
│ └───────────────┘ │  │ └───────────────┘ │      │ └───────────────────┘  │
│                   │  │                   │      │                         │
│ ┌───────────────┐ │  │ ┌───────────────┐ │      │ ┌───────────────────┐  │
│ │ PostgreSQL    │ │  │ │ Payment       │ │      │ │ Message Queue     │  │
│ │ (Vector DB)   │ │  │ │ Gateway       │ │      │ └───────────────────┘  │
│ └───────────────┘ │  │ └───────────────┘ │      │                         │
│                   │  │                   │      │ ┌───────────────────┐  │
│ ┌───────────────┐ │  │ ┌───────────────┐ │      │ │ Ollama LLM       │  │
│ │ Elasticsearch │ │  │ │ Loyalty       │ │      │ └───────────────────┘  │
│ └───────────────┘ │  │ │ Program APIs  │ │      │                         │
└───────────────────┘  │ └───────────────┘ │      └─────────────────────────┘
                       └───────────────────┘
```

## Component Details

### API Gateway

Acts as the single entry point for all client requests, providing:

- Request routing to appropriate services
- Authentication and authorization
- Rate limiting and throttling
- Request/response transformation
- Circuit breaking for failing services

### Application Services

#### User Service

Manages user profiles, authentication, and authorization.

- User registration and login
- Profile management
- Authorization checks
- Preference storage

#### Search Service

Handles hotel search queries and results processing.

- Text-based search
- Location-based search
- Filter application
- Result ranking
- Caching of common search results

#### LLM Service

Integrates with AI language models for natural language processing.

- Conversation handling
- Intent recognition
- Named entity extraction
- Recommendation generation
- Integration with Ollama for local LLM inference

#### Hotel Service

Manages hotel data and reservation capabilities.

- Hotel information storage
- Room availability checking
- Pricing information
- Hotel details and images

#### Loyalty Service

Handles loyalty program integration and points calculations.

- Loyalty program enrollment
- Points calculation
- Redemption options
- Program comparison

#### Analytics Service

Processes user behavior and application metrics.

- Event collection
- Usage patterns analysis
- Performance monitoring
- Business intelligence

#### Notification Service

Manages sending notifications across different channels.

- Email notifications
- Push notifications
- In-app messaging
- Notification preferences

#### Payment Service

Handles payment processing and billing.

- Payment method management
- Transaction processing
- Refund handling
- Invoice generation

### Data Layer

#### MongoDB

Primary NoSQL database for most application data.

- User profiles
- Hotel information
- Reservation data
- Application settings

#### PostgreSQL with pgvector

Vector database for RAG (Retrieval Augmented Generation) capabilities.

- Vector embeddings for semantic search
- Hotel description embeddings
- Review embeddings
- Similarity search

#### Elasticsearch

Search engine for text-based search and analytics.

- Full-text search capabilities
- Log aggregation
- Analytics data storage

### Support Services

#### Redis Cache

In-memory data store for caching and session management.

- Session storage
- Rate limiting counters
- Frequently accessed data caching
- Pub/sub for real-time features

#### Message Queue

Asynchronous message processing.

- Service-to-service communication
- Event-driven architecture support
- Task scheduling
- Workload distribution

#### Ollama LLM

Local Large Language Model server.

- Natural language understanding
- Text generation
- RAG integration
- Conversational AI

## Observability Stack

### Prometheus & Grafana

- Metrics collection and visualization
- Alerting based on thresholds
- Dashboard for system monitoring

### ELK Stack (Elasticsearch, Logstash, Kibana)

- Centralized logging
- Log analysis and visualization
- Error tracking and alerting

### Jaeger & OpenTelemetry

- Distributed tracing
- Request flow visualization
- Performance bottleneck identification

## Data Flow

### Search Flow

1. User sends search query via web/mobile interface
2. API Gateway authenticates and routes to Search Service
3. Search Service parses query and extracts parameters
4. Search Service queries Hotel Service for matching hotels
5. Results are filtered, ranked, and cached
6. Response is returned to the user via API Gateway

### Chat Flow

1. User sends message via chat interface
2. API Gateway routes to LLM Service
3. LLM Service processes the message with Ollama
4. If hotel-related intent is detected, Search Service is queried
5. If loyalty-related intent is detected, Loyalty Service is queried
6. Response is generated combining LLM output and service data
7. Response is returned to the user

### Reservation Flow

1. User selects hotel and dates
2. Hotel Service checks availability
3. User enters payment information
4. Payment Service processes the payment
5. Reservation is created and stored
6. Loyalty Service credits points if applicable
7. Notification Service sends confirmation
8. Analytics Service records the transaction

## Scalability Considerations

### Horizontal Scaling

- Each service can be independently scaled based on load
- Containerization with Docker and orchestration with Kubernetes
- Stateless design for most services

### Database Scaling

- MongoDB replica sets for high availability
- Read replicas for scaling read operations
- Sharding for large datasets

### Caching Strategy

- Multi-level caching (application, Redis, CDN)
- Cache invalidation strategies
- TTL-based expiration

## Security Architecture

### Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- OAuth2 integration for third-party authentication

### Data Protection

- Encryption at rest and in transit
- PII data handling compliance
- Secure credential storage

### API Security

- Input validation and sanitization
- Rate limiting and throttling
- DDoS protection

## Deployment Architecture

### Development Environment

- Docker Compose for local development
- Hot reloading for faster development
- Mock services for external dependencies

### Production Environment

- Kubernetes deployment
- Multiple availability zones
- Blue-green deployment for zero downtime updates

### CI/CD Pipeline

- Automated testing
- Continuous integration
- Deployment automation
- Rollback capabilities

## Future Architecture Enhancements

- Serverless functions for specific workloads
- GraphQL API for more efficient data fetching
- Geographically distributed deployment
- Advanced fraud detection system
- Enhanced personalization engine 
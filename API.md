# StayCrest API Documentation

This document provides detailed information about all API endpoints available in the StayCrest platform.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints for the full application (not the simple server) require authentication using JWT tokens:

```
Authorization: Bearer <your_jwt_token>
```

To obtain a token, use the authentication endpoints described below.

## API Versioning

- `/api/*` - Simple server endpoints (no authentication required, mock data)
- `/api/v1/*` - Full application endpoints (authentication required for protected routes)

## Core Endpoints

### Hotel Search

**Endpoint:** `GET /api/search`

Search for hotels based on various criteria.

**Query Parameters:**
- `q` (string): General search query
- `location` (string, optional): Filter by location
- `checkIn` (string, optional): Check-in date (YYYY-MM-DD)
- `checkOut` (string, optional): Check-out date (YYYY-MM-DD)
- `guests` (number, optional): Number of guests
- `rooms` (number, optional): Number of rooms
- `stars` (number, optional): Minimum star rating
- `priceMin` (number, optional): Minimum price
- `priceMax` (number, optional): Maximum price

**Example Request:**
```
GET /api/search?q=hotel&location=New%20York&priceMax=400
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "query": "hotel",
    "hotels": [
      {
        "id": "hotel-1",
        "name": "Grand Hyatt Hotel",
        "chain": "Hyatt",
        "location": "New York, NY",
        "stars": 5,
        "price": 350,
        "currency": "USD",
        "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945"
      },
      {
        "id": "hotel-2",
        "name": "Marriott Downtown",
        "chain": "Marriott",
        "location": "New York, NY",
        "stars": 4,
        "price": 280,
        "currency": "USD",
        "image": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb"
      }
    ]
  }
}
```

### Chat API

**Endpoint:** `POST /api/chat`

Send a message to the AI assistant and receive a response.

**Request Body:**
```json
{
  "message": "Tell me about loyalty programs",
  "sessionId": "unique-session-id"
}
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "response": "We support various loyalty programs including Marriott Bonvoy, Hilton Honors, and World of Hyatt. Would you like to compare their point values?",
    "sessionId": "unique-session-id"
  }
}
```

### Loyalty Programs

**Endpoint:** `GET /api/loyalty/programs`

Retrieve information about hotel loyalty programs.

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "programs": [
      {
        "id": "loyalty-1",
        "name": "Marriott Bonvoy",
        "pointsValue": 0.8,
        "hotels": ["Marriott", "Westin", "Sheraton"]
      },
      {
        "id": "loyalty-2",
        "name": "Hilton Honors",
        "pointsValue": 0.5,
        "hotels": ["Hilton", "DoubleTree", "Embassy Suites"]
      },
      {
        "id": "loyalty-3",
        "name": "World of Hyatt",
        "pointsValue": 1.2,
        "hotels": ["Hyatt", "Grand Hyatt", "Park Hyatt"]
      }
    ]
  }
}
```

### Feature Flags

**Endpoint:** `GET /api/features`

Get configuration for enabled features.

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "features": {
      "voiceCommands": true,
      "darkMode": true,
      "locationServices": true,
      "pointsCalculator": true
    }
  }
}
```

## Authentication API (Full Application)

### User Registration

**Endpoint:** `POST /api/v1/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2023-04-20T12:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### User Login

**Endpoint:** `POST /api/v1/auth/login`

Authenticate a user and get a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Token Refresh

**Endpoint:** `POST /api/v1/auth/refresh`

Refresh an expired JWT token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## User API (Full Application)

### Get Current User

**Endpoint:** `GET /api/v1/user/me`

Get the current authenticated user's profile.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "preferences": {
        "theme": "dark",
        "currency": "USD",
        "notifications": true
      },
      "loyalty": {
        "programs": ["marriott", "hilton"],
        "favoriteHotels": ["hotel-1", "hotel-2"]
      }
    }
  }
}
```

### Update User Profile

**Endpoint:** `PATCH /api/v1/user/profile`

Update the user's profile information.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Request Body:**
```json
{
  "firstName": "Jonathan",
  "preferences": {
    "theme": "light"
  }
}
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "firstName": "Jonathan",
      "lastName": "Doe",
      "preferences": {
        "theme": "light",
        "currency": "USD",
        "notifications": true
      }
    }
  }
}
```

## Health and Monitoring API

### Health Check

**Endpoint:** `GET /api/v1/health`

Check the health status of the application and its dependencies.

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "uptime": 3600,
    "timestamp": "2023-04-20T12:00:00Z",
    "services": {
      "api": "healthy",
      "database": "healthy",
      "redis": "healthy",
      "ollama": "healthy"
    }
  }
}
```

### Health Check (Liveness)

**Endpoint:** `GET /api/v1/health/liveness`

Simple liveness probe for Kubernetes.

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "alive": true
  }
}
```

### Health Check (Readiness)

**Endpoint:** `GET /api/v1/health/readiness`

Readiness probe for Kubernetes.

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "ready": true,
    "dependencies": {
      "database": true,
      "cache": true,
      "llm": true
    }
  }
}
```

### Metrics

**Endpoint:** `GET /api/v1/metrics`

Get application metrics in Prometheus format.

**Example Response:**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/search",status="200"} 45
http_requests_total{method="POST",path="/api/chat",status="200"} 78

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="GET",path="/api/search"} 32
http_request_duration_seconds_bucket{le="0.3",method="GET",path="/api/search"} 40
http_request_duration_seconds_bucket{le="0.5",method="GET",path="/api/search"} 44
http_request_duration_seconds_bucket{le="1",method="GET",path="/api/search"} 45
http_request_duration_seconds_bucket{le="+Inf",method="GET",path="/api/search"} 45
```

## Error Responses

All API endpoints return errors in a consistent format:

```json
{
  "status": "error",
  "message": "Description of the error",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional details about the error"
  }
}
```

### Common Error Codes

- `INVALID_REQUEST`: Request body or parameters are invalid
- `AUTHENTICATION_FAILED`: Invalid credentials
- `AUTHORIZATION_FAILED`: User doesn't have permission
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `SERVICE_UNAVAILABLE`: External service is unavailable
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

## Rate Limiting

API requests are subject to rate limiting:

- Anonymous requests: 60 requests per minute
- Authenticated requests: 300 requests per minute

When rate-limited, the API will return status code 429 with headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1682000000
``` 
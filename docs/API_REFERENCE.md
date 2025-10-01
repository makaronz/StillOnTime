# StillOnTime API Reference

Complete API documentation for the StillOnTime film schedule automation platform.

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Schedule Management](#schedule-management)
4. [Email Processing](#email-processing)
5. [Route Planning](#route-planning)
6. [Weather Integration](#weather-integration)
7. [Calendar Integration](#calendar-integration)
8. [Notifications](#notifications)
9. [Analytics](#analytics)
10. [Admin Operations](#admin-operations)

## Base URL

```
Production: https://api.stillontime.com
Staging: https://staging-api.stillontime.com
Development: http://localhost:3001
```

## Authentication

### OAuth 2.0 Flow

#### Start OAuth Flow
```http
GET /auth/google
```

Redirects to Google OAuth consent page.

**Response:**
Redirects to Google OAuth consent screen.

#### OAuth Callback
```http
GET /auth/google/callback?code={authorization_code}
```

**Parameters:**
- `code` (string): Authorization code from Google

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "picture": "https://example.com/avatar.jpg"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "rt_abcd1234...",
      "expiresIn": 86400
    }
  }
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "rt_abcd1234..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

### JWT Token Usage

Include the access token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## User Management

### Get Current User
```http
GET /api/users/me
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://example.com/avatar.jpg",
    "role": "producer",
    "company": "Film Production Co",
    "preferences": {
      "timezone": "America/Los_Angeles",
      "notifications": {
        "email": true,
        "sms": false,
        "push": true
      }
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "lastLoginAt": "2024-03-15T08:45:00Z"
  }
}
```

### Update User Profile
```http
PUT /api/users/me
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Smith",
  "company": "New Production Co",
  "preferences": {
    "timezone": "America/New_York",
    "notifications": {
      "email": true,
      "sms": true,
      "push": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Smith",
    "company": "New Production Co",
    "preferences": {
      "timezone": "America/New_York",
      "notifications": {
        "email": true,
        "sms": true,
        "push": true
      }
    },
    "updatedAt": "2024-03-15T09:15:00Z"
  }
}
```

## Schedule Management

### Get Schedules
```http
GET /api/schedules?page=1&limit=20&status=active&startDate=2024-03-01&endDate=2024-03-31
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `status` (string, optional): Filter by status (`active`, `completed`, `cancelled`)
- `startDate` (string, optional): Filter by start date (ISO 8601)
- `endDate` (string, optional): Filter by end date (ISO 8601)
- `search` (string, optional): Search in schedule titles and descriptions

**Response:**
```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "id": "schedule_456",
        "title": "Downtown Shoot - Day 1",
        "description": "Interior office scenes",
        "shootDate": "2024-03-20T00:00:00Z",
        "callTime": "2024-03-20T06:00:00Z",
        "wrapTime": "2024-03-20T18:00:00Z",
        "location": {
          "name": "Downtown Office Building",
          "address": "123 Main St, Los Angeles, CA 90210",
          "coordinates": {
            "lat": 34.0522,
            "lng": -118.2437
          }
        },
        "crew": [
          {
            "id": "crew_789",
            "name": "Jane Director",
            "role": "Director",
            "callTime": "2024-03-20T05:30:00Z",
            "department": "Direction"
          }
        ],
        "weather": {
          "temperature": 72,
          "condition": "sunny",
          "precipitation": 0,
          "windSpeed": 5
        },
        "routePlan": {
          "id": "route_321",
          "estimatedTravelTime": 45,
          "distance": 25.5,
          "trafficConditions": "moderate"
        },
        "status": "active",
        "createdAt": "2024-03-01T10:00:00Z",
        "updatedAt": "2024-03-15T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### Get Schedule Details
```http
GET /api/schedules/{scheduleId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "schedule_456",
    "title": "Downtown Shoot - Day 1",
    "description": "Interior office scenes with full cast",
    "shootDate": "2024-03-20T00:00:00Z",
    "callTime": "2024-03-20T06:00:00Z",
    "wrapTime": "2024-03-20T18:00:00Z",
    "location": {
      "name": "Downtown Office Building",
      "address": "123 Main St, Los Angeles, CA 90210",
      "coordinates": {
        "lat": 34.0522,
        "lng": -118.2437
      },
      "parkingInfo": "Street parking available",
      "contactInfo": {
        "name": "Building Manager",
        "phone": "+1-555-0123"
      }
    },
    "scenes": [
      {
        "id": "scene_101",
        "number": "12A",
        "description": "Conference room meeting",
        "estimatedDuration": 120,
        "complexity": "medium",
        "equipment": ["Camera A", "Lighting Kit 1"]
      }
    ],
    "crew": [
      {
        "id": "crew_789",
        "name": "Jane Director",
        "role": "Director",
        "department": "Direction",
        "callTime": "2024-03-20T05:30:00Z",
        "contact": {
          "phone": "+1-555-0456",
          "email": "jane@example.com"
        }
      }
    ],
    "equipment": [
      {
        "id": "eq_101",
        "name": "Camera A",
        "type": "camera",
        "status": "available",
        "location": "Equipment Truck 1"
      }
    ],
    "weather": {
      "temperature": 72,
      "condition": "sunny",
      "humidity": 45,
      "precipitation": 0,
      "windSpeed": 5,
      "uvIndex": 6,
      "forecast": [
        {
          "time": "06:00",
          "temperature": 68,
          "condition": "partly_cloudy"
        }
      ]
    },
    "routePlan": {
      "id": "route_321",
      "origin": "Production Office",
      "destination": "Downtown Office Building",
      "estimatedTravelTime": 45,
      "distance": 25.5,
      "route": [
        {
          "instruction": "Head north on Sunset Blvd",
          "distance": 5.2,
          "duration": 8
        }
      ],
      "trafficConditions": "moderate",
      "alternativeRoutes": 2
    },
    "budget": {
      "estimated": 15000,
      "actual": 14250,
      "breakdown": {
        "crew": 8000,
        "equipment": 3000,
        "location": 2000,
        "catering": 1250
      }
    },
    "status": "active",
    "createdAt": "2024-03-01T10:00:00Z",
    "updatedAt": "2024-03-15T14:30:00Z"
  }
}
```

### Create Schedule
```http
POST /api/schedules
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Beach Shoot - Day 2",
  "description": "Exterior beach scenes",
  "shootDate": "2024-03-21",
  "callTime": "05:30",
  "wrapTime": "16:00",
  "location": {
    "name": "Malibu Beach",
    "address": "Malibu Beach, CA 90265"
  },
  "crew": [
    {
      "name": "John Cinematographer",
      "role": "Director of Photography",
      "department": "Camera",
      "callTime": "05:00",
      "contact": {
        "phone": "+1-555-0789",
        "email": "john@example.com"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "schedule_457",
    "title": "Beach Shoot - Day 2",
    "description": "Exterior beach scenes",
    "shootDate": "2024-03-21T00:00:00Z",
    "callTime": "2024-03-21T05:30:00Z",
    "wrapTime": "2024-03-21T16:00:00Z",
    "status": "pending",
    "createdAt": "2024-03-15T15:00:00Z"
  }
}
```

## Email Processing

### Get Processed Emails
```http
GET /api/emails?page=1&limit=20&status=processed&hasSchedule=true
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number
- `limit` (integer, optional): Items per page
- `status` (string, optional): Filter by processing status
- `hasSchedule` (boolean, optional): Filter by schedule extraction success
- `fromDate` (string, optional): Filter by received date

**Response:**
```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": "email_789",
        "messageId": "msg_abc123",
        "subject": "Updated Call Sheet - Downtown Shoot",
        "sender": "production@example.com",
        "receivedAt": "2024-03-15T08:30:00Z",
        "processedAt": "2024-03-15T08:31:15Z",
        "status": "processed",
        "hasAttachments": true,
        "attachments": [
          {
            "filename": "call_sheet_032024.pdf",
            "size": 245760,
            "mimeType": "application/pdf",
            "processed": true
          }
        ],
        "extractedData": {
          "scheduleId": "schedule_456",
          "confidence": 0.95,
          "dataPoints": {
            "shootDate": "2024-03-20",
            "callTime": "06:00",
            "location": "Downtown Office Building"
          }
        },
        "processingTime": 75,
        "errors": []
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 123,
      "pages": 7
    }
  }
}
```

### Reprocess Email
```http
POST /api/emails/{emailId}/reprocess
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_reprocess_456",
    "status": "queued",
    "estimatedCompletion": "2024-03-15T15:35:00Z"
  }
}
```

## Route Planning

### Calculate Route
```http
POST /api/routes/calculate
Authorization: Bearer {token}
Content-Type: application/json

{
  "origin": {
    "address": "Production Office, 456 Sunset Blvd, LA, CA"
  },
  "destination": {
    "address": "123 Main St, Los Angeles, CA 90210"
  },
  "departureTime": "2024-03-20T05:30:00Z",
  "options": {
    "avoidTolls": false,
    "avoidHighways": false,
    "trafficModel": "best_guess"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "routeId": "route_321",
    "distance": 25.5,
    "duration": 45,
    "durationInTraffic": 52,
    "route": [
      {
        "instruction": "Head north on Sunset Blvd",
        "distance": 5.2,
        "duration": 8,
        "coordinates": {
          "lat": 34.0522,
          "lng": -118.2437
        }
      },
      {
        "instruction": "Turn right on Main St",
        "distance": 2.1,
        "duration": 4,
        "coordinates": {
          "lat": 34.0525,
          "lng": -118.2401
        }
      }
    ],
    "trafficConditions": {
      "current": "moderate",
      "predicted": "heavy",
      "incidents": [
        {
          "type": "construction",
          "description": "Lane closure on Highway 101",
          "impact": "minor",
          "startTime": "2024-03-20T06:00:00Z",
          "endTime": "2024-03-20T10:00:00Z"
        }
      ]
    },
    "alternativeRoutes": [
      {
        "routeId": "route_322",
        "distance": 28.1,
        "duration": 43,
        "description": "Via Highway 101"
      }
    ],
    "costEstimate": {
      "fuel": 4.50,
      "tolls": 0,
      "parking": 15.00
    },
    "createdAt": "2024-03-15T15:20:00Z"
  }
}
```

### Get Route Details
```http
GET /api/routes/{routeId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "route_321",
    "origin": {
      "address": "Production Office, 456 Sunset Blvd, LA, CA",
      "coordinates": {
        "lat": 34.0522,
        "lng": -118.2437
      }
    },
    "destination": {
      "address": "123 Main St, Los Angeles, CA 90210",
      "coordinates": {
        "lat": 34.0525,
        "lng": -118.2401
      }
    },
    "distance": 25.5,
    "estimatedDuration": 45,
    "actualDuration": 52,
    "polyline": "encoded_polyline_string",
    "waypoints": [
      {
        "lat": 34.0523,
        "lng": -118.2420,
        "instruction": "Continue straight"
      }
    ],
    "createdAt": "2024-03-15T15:20:00Z"
  }
}
```

## Weather Integration

### Get Current Weather
```http
GET /api/weather/current?lat=34.0522&lng=-118.2437
Authorization: Bearer {token}
```

**Query Parameters:**
- `lat` (number): Latitude coordinate
- `lng` (number): Longitude coordinate
- `address` (string, alternative): Address to geocode

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "lat": 34.0522,
      "lng": -118.2437,
      "address": "Los Angeles, CA"
    },
    "current": {
      "temperature": 72,
      "feelsLike": 75,
      "condition": "sunny",
      "description": "Clear sky",
      "humidity": 45,
      "pressure": 1013,
      "visibility": 10,
      "uvIndex": 6,
      "windSpeed": 5,
      "windDirection": 225,
      "cloudCover": 10
    },
    "alerts": [],
    "lastUpdated": "2024-03-15T15:30:00Z"
  }
}
```

### Get Weather Forecast
```http
GET /api/weather/forecast?lat=34.0522&lng=-118.2437&days=5
Authorization: Bearer {token}
```

**Query Parameters:**
- `lat` (number): Latitude coordinate
- `lng` (number): Longitude coordinate
- `days` (integer, optional): Number of forecast days (max: 7)
- `hourly` (boolean, optional): Include hourly forecast

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "lat": 34.0522,
      "lng": -118.2437,
      "address": "Los Angeles, CA"
    },
    "forecast": [
      {
        "date": "2024-03-20",
        "sunrise": "2024-03-20T06:45:00Z",
        "sunset": "2024-03-20T18:30:00Z",
        "temperature": {
          "min": 62,
          "max": 78,
          "morning": 65,
          "afternoon": 76,
          "evening": 70,
          "night": 64
        },
        "condition": "partly_cloudy",
        "description": "Partly cloudy with light winds",
        "precipitation": 0,
        "humidity": 55,
        "windSpeed": 8,
        "uvIndex": 7,
        "hourly": [
          {
            "time": "2024-03-20T06:00:00Z",
            "temperature": 63,
            "condition": "clear",
            "precipitation": 0,
            "windSpeed": 4
          }
        ]
      }
    ],
    "alerts": [
      {
        "id": "alert_123",
        "type": "wind",
        "severity": "minor",
        "title": "Wind Advisory",
        "description": "Gusty winds expected between 10 AM and 4 PM",
        "startTime": "2024-03-20T10:00:00Z",
        "endTime": "2024-03-20T16:00:00Z",
        "areas": ["Los Angeles County"]
      }
    ],
    "generatedAt": "2024-03-15T15:30:00Z"
  }
}
```

## Calendar Integration

### Get Calendar Events
```http
GET /api/calendar/events?startDate=2024-03-01&endDate=2024-03-31
Authorization: Bearer {token}
```

**Query Parameters:**
- `startDate` (string): Start date filter (ISO 8601)
- `endDate` (string): End date filter (ISO 8601)
- `calendarId` (string, optional): Specific calendar ID

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event_456",
        "calendarId": "primary",
        "title": "Downtown Shoot - Day 1",
        "description": "Call sheet details and crew information",
        "startTime": "2024-03-20T06:00:00Z",
        "endTime": "2024-03-20T18:00:00Z",
        "location": "123 Main St, Los Angeles, CA 90210",
        "attendees": [
          {
            "email": "jane@example.com",
            "name": "Jane Director",
            "status": "accepted"
          }
        ],
        "reminders": [
          {
            "method": "popup",
            "minutes": 60
          },
          {
            "method": "email", 
            "minutes": 120
          }
        ],
        "scheduleId": "schedule_456",
        "createdAt": "2024-03-15T10:00:00Z",
        "syncStatus": "synced"
      }
    ]
  }
}
```

### Create Calendar Event
```http
POST /api/calendar/events
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Beach Shoot - Day 2",
  "description": "Exterior beach scenes",
  "startTime": "2024-03-21T05:30:00Z",
  "endTime": "2024-03-21T16:00:00Z",
  "location": "Malibu Beach, CA 90265",
  "attendees": [
    {
      "email": "john@example.com",
      "name": "John Cinematographer"
    }
  ],
  "reminders": [
    {
      "method": "popup",
      "minutes": 60
    }
  ],
  "scheduleId": "schedule_457"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "event_457",
    "calendarId": "primary",
    "title": "Beach Shoot - Day 2",
    "googleEventId": "google_event_789",
    "startTime": "2024-03-21T05:30:00Z",
    "endTime": "2024-03-21T16:00:00Z",
    "createdAt": "2024-03-15T16:00:00Z",
    "syncStatus": "synced"
  }
}
```

## Notifications

### Get Notifications
```http
GET /api/notifications?page=1&limit=20&read=false&type=schedule_update
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number
- `limit` (integer, optional): Items per page
- `read` (boolean, optional): Filter by read status
- `type` (string, optional): Filter by notification type

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notification_123",
        "type": "schedule_update",
        "title": "Schedule Updated",
        "message": "Downtown Shoot call time changed to 5:30 AM",
        "data": {
          "scheduleId": "schedule_456",
          "changes": {
            "callTime": {
              "old": "2024-03-20T06:00:00Z",
              "new": "2024-03-20T05:30:00Z"
            }
          }
        },
        "channels": ["email", "push"],
        "priority": "high",
        "read": false,
        "createdAt": "2024-03-15T14:30:00Z",
        "readAt": null
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### Mark Notification as Read
```http
PUT /api/notifications/{notificationId}/read
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "notification_123",
    "read": true,
    "readAt": "2024-03-15T16:30:00Z"
  }
}
```

### Send Custom Notification
```http
POST /api/notifications
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "custom",
  "title": "Important Update",
  "message": "Please review the updated safety protocols",
  "recipients": ["user_123", "user_456"],
  "channels": ["email", "sms"],
  "priority": "high",
  "data": {
    "documentUrl": "https://example.com/safety-protocols.pdf"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "notification_124",
    "recipientCount": 2,
    "channels": ["email", "sms"],
    "scheduledAt": "2024-03-15T16:35:00Z",
    "status": "queued"
  }
}
```

## Analytics

### Get Dashboard Data
```http
GET /api/analytics/dashboard?period=30d
Authorization: Bearer {token}
```

**Query Parameters:**
- `period` (string): Time period (`7d`, `30d`, `90d`, `1y`)
- `projects` (string, optional): Comma-separated project IDs

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSchedules": 45,
      "activeProjects": 8,
      "avgProcessingTime": 85,
      "onTimePerformance": 0.94
    },
    "charts": {
      "schedulesTrend": [
        {
          "date": "2024-03-01",
          "count": 3
        },
        {
          "date": "2024-03-02", 
          "count": 5
        }
      ],
      "processingEfficiency": [
        {
          "date": "2024-03-01",
          "avgTime": 92,
          "successRate": 0.96
        }
      ],
      "userActivity": [
        {
          "date": "2024-03-01",
          "activeUsers": 12,
          "newUsers": 2
        }
      ]
    },
    "insights": [
      {
        "type": "efficiency_improvement",
        "title": "Processing Speed Improved",
        "description": "Email processing is 15% faster this week",
        "impact": "positive",
        "data": {
          "improvement": 0.15,
          "baseline": 100,
          "current": 85
        }
      }
    ]
  }
}
```

### Get Efficiency Report
```http
GET /api/analytics/efficiency?projectId=project_123&startDate=2024-03-01&endDate=2024-03-31
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "score": 87,
      "trend": "improving",
      "benchmarkComparison": 0.12
    },
    "categories": {
      "scheduling": {
        "score": 92,
        "issues": []
      },
      "communication": {
        "score": 83,
        "issues": ["Delayed email responses during peak hours"]
      },
      "resourceUtilization": {
        "score": 89,
        "issues": []
      },
      "timeManagement": {
        "score": 85,
        "issues": ["Occasional overtime on complex shoots"]
      }
    },
    "recommendations": [
      {
        "category": "communication",
        "recommendation": "Implement automated response system for common queries",
        "impact": "medium",
        "effort": "low"
      }
    ],
    "keyMetrics": {
      "emailResponseTime": 24,
      "scheduleChangeFrequency": 0.08,
      "onTimePerformance": 0.94,
      "resourceUtilizationRate": 0.87
    }
  }
}
```

## Admin Operations

### Get System Health
```http
GET /api/admin/health
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-03-15T16:45:00Z",
    "services": {
      "database": {
        "status": "healthy",
        "responseTime": 12,
        "connections": 15,
        "maxConnections": 100
      },
      "redis": {
        "status": "healthy",
        "responseTime": 3,
        "memoryUsage": 0.65,
        "connectedClients": 8
      },
      "email": {
        "status": "healthy",
        "queueSize": 2,
        "processingRate": 4.5
      },
      "storage": {
        "status": "healthy",
        "usage": 0.45,
        "available": "250GB"
      }
    },
    "version": "1.0.0",
    "uptime": 259200
  }
}
```

### Get System Metrics
```http
GET /api/admin/metrics?metric=requests_per_minute&period=1h
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "metric": "requests_per_minute",
    "period": "1h",
    "data": [
      {
        "timestamp": "2024-03-15T15:00:00Z",
        "value": 45.2
      },
      {
        "timestamp": "2024-03-15T15:01:00Z",
        "value": 42.8
      }
    ],
    "summary": {
      "min": 38.1,
      "max": 67.3,
      "avg": 45.7,
      "current": 42.8
    }
  }
}
```

## Error Handling

### Error Response Format

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email format is invalid"
      }
    ],
    "requestId": "req_123456789"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Invalid or missing authentication
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Request validation failed
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable

## Rate Limiting

API requests are rate limited per user:

- **Standard Users**: 100 requests per minute
- **Premium Users**: 500 requests per minute
- **Admin Users**: 1000 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1647356400
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.stillontime.com/ws?token=your_jwt_token');
```

### Real-time Events

```json
// Schedule update event
{
  "type": "schedule_update",
  "data": {
    "scheduleId": "schedule_456",
    "changes": {
      "callTime": "2024-03-20T05:30:00Z"
    },
    "updatedBy": "user_123"
  },
  "timestamp": "2024-03-15T16:30:00Z"
}

// Processing status event
{
  "type": "email_processed",
  "data": {
    "emailId": "email_789",
    "status": "completed",
    "extractedSchedules": 1
  },
  "timestamp": "2024-03-15T16:31:00Z"
}
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @stillontime/api-client
```

```javascript
import { StillOnTimeClient } from '@stillontime/api-client';

const client = new StillOnTimeClient({
  apiUrl: 'https://api.stillontime.com',
  accessToken: 'your_access_token'
});

const schedules = await client.schedules.list();
const schedule = await client.schedules.get('schedule_456');
```

### Python

```bash
pip install stillontime-api
```

```python
from stillontime import StillOnTimeClient

client = StillOnTimeClient(
    api_url='https://api.stillontime.com',
    access_token='your_access_token'
)

schedules = client.schedules.list()
schedule = client.schedules.get('schedule_456')
```

---

*For additional support and examples, visit our [Developer Portal](https://developers.stillontime.com)*
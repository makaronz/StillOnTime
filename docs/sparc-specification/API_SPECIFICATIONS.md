# StillOnTime Film Schedule Automation System
# API Specifications

## Executive Summary

This document provides comprehensive API specifications for the StillOnTime Film Schedule Automation System, defining all endpoints, request/response formats, authentication requirements, and integration patterns for external services.

## 1. API Architecture Overview

### 1.1 RESTful API Design

#### 1.1.1 API Principles
**Design Philosophy**: RESTful API design with resource-oriented architecture

**Core Principles**:
- **Resource-Based**: Everything is a resource with unique identifiers
- **Stateless**: Each request contains all information needed to process it
- **Cacheable**: Responses explicitly indicate cacheability
- **Uniform Interface**: Consistent interface design across all endpoints
- **Layered System**: Architecture supports multiple layers of intermediaries

**API Standards**:
- **Protocol**: HTTPS only for all API communications
- **Data Format**: JSON for request and response bodies
- **Versioning**: URL-based versioning (/api/v1/)
- **Status Codes**: Proper HTTP status codes for all responses
- **Error Handling**: Consistent error response format

#### 1.1.2 URL Structure
**Base URL**: `https://api.stillontime.com/api/v1`

**URL Patterns**:
```
{base-url}/{resource}[/{resource-id}][/{sub-resource}[/{sub-resource-id}]]
```

**Resource Examples**:
- `/api/v1/users` - User resource collection
- `/api/v1/users/{user-id}` - Specific user resource
- `/api/v1/users/{user-id}/schedules` - User's schedules
- `/api/v1/schedules/{schedule-id}/route-plan` - Schedule's route plan

### 1.2 Authentication and Authorization

#### 1.2.1 Authentication Methods
**Primary Authentication**: JWT Bearer Token Authentication

**Authentication Header**:
```
Authorization: Bearer <jwt-token>
```

**Token Requirements**:
- **Format**: JWT token signed with HS256 algorithm
- **Claims**: User ID, email, expiration time, issued at time
- **Expiration**: 24 hours maximum token lifetime
- **Refresh**: Token refresh capability for extended sessions

**Authentication Flow**:
1. Client authenticates via Google OAuth 2.0
2. Server returns JWT token and refresh token
3. Client includes JWT token in API requests
4. Server validates token and processes request
5. Client refreshes token when near expiration

#### 1.2.2 Authorization Model
**Authorization**: Role-Based Access Control (RBAC)

**Role Hierarchy**:
- **Administrator**: Full system access
- **Coordinator**: Schedule management and team coordination
- **User**: Personal schedule access and basic features
- **Viewer**: Read-only access to shared information

**Permission Examples**:
- `users:read` - Access user information
- `schedules:create` - Create new schedules
- `schedules:update:own` - Update own schedules
- `schedules:update:any` - Update any schedule (admin/coordinator)

### 1.3 Response Format Standards

#### 1.3.1 Success Response Format
**Standard Success Response**:
```json
{
  "success": true,
  "data": {
    // Resource data or collection
  },
  "metadata": {
    "timestamp": "2025-10-18T10:30:00Z",
    "requestId": "req_123456789",
    "version": "1.0"
  }
}
```

**Collection Response Format**:
```json
{
  "success": true,
  "data": [
    // Array of resource objects
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "metadata": {
    "timestamp": "2025-10-18T10:30:00Z",
    "requestId": "req_123456789",
    "version": "1.0"
  }
}
```

#### 1.3.2 Error Response Format
**Standard Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "timestamp": "2025-10-18T10:30:00Z",
    "requestId": "req_123456789",
    "path": "/api/v1/users"
  }
}
```

**Error Codes**:
- **AUTH_001**: Authentication required
- **AUTH_002**: Invalid or expired token
- **PERM_001**: Insufficient permissions
- **VALIDATION_001**: Request validation failed
- **RESOURCE_001**: Resource not found
- **RESOURCE_002**: Resource already exists
- **RATE_001**: Rate limit exceeded
- **SYSTEM_001**: Internal server error
- **EXTERNAL_001**: External service error

## 2. Authentication API

### 2.1 Authentication Endpoints

#### 2.1.1 Initiate OAuth Flow
**Endpoint**: `POST /api/v1/auth/login`

**Description**: Initiate Google OAuth 2.0 authentication flow

**Request Body**:
```json
{
  "state": "optional-csrf-state-string",
  "redirectUri": "https://app.stillontime.com/auth/callback"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/oauth/authorize?...",
    "state": "generated-state-string",
    "expiresIn": 600
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: OAuth configuration error

#### 2.1.2 OAuth Callback
**Endpoint**: `POST /api/v1/auth/callback`

**Description**: Handle OAuth callback from Google

**Request Body**:
```json
{
  "code": "authorization-code-from-google",
  "state": "state-parameter-from-auth-request"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123456789",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2025-10-01T10:00:00Z"
    },
    "token": "jwt-token-string",
    "refreshToken": "refresh-token-string",
    "expiresIn": 86400
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid authorization code or state
- `401 Unauthorized`: OAuth authentication failed
- `500 Internal Server Error`: Token exchange failed

#### 2.1.3 Refresh Token
**Endpoint**: `POST /api/v1/auth/refresh`

**Description**: Refresh JWT token using refresh token

**Request Body**:
```json
{
  "refreshToken": "refresh-token-string"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token-string",
    "expiresIn": 86400
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid refresh token
- `401 Unauthorized`: Refresh token expired or revoked
- `500 Internal Server Error`: Token refresh failed

#### 2.1.4 Logout
**Endpoint**: `POST /api/v1/auth/logout`

**Description**: Logout user and revoke tokens

**Authentication**: Required (JWT token)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid authentication token
- `500 Internal Server Error`: Token revocation failed

#### 2.1.5 Get Authentication Status
**Endpoint**: `GET /api/v1/auth/status`

**Description**: Get current authentication status

**Authentication**: Optional

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "isAuthenticated": true,
    "user": {
      "id": "user_123456789",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "oauth": {
      "isAuthenticated": true,
      "scopes": ["gmail.readonly", "calendar"],
      "expiresAt": "2025-10-19T10:00:00Z",
      "needsReauth": false
    }
  }
}
```

## 3. User Management API

### 3.1 User Profile Endpoints

#### 3.1.1 Get User Profile
**Endpoint**: `GET /api/v1/users/me`

**Description**: Get current user's profile information

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "user_123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-10-01T10:00:00Z",
    "updatedAt": "2025-10-18T09:30:00Z",
    "configuration": {
      "homeAddress": "123 Main St, Los Angeles, CA 90001",
      "bufferTimes": {
        "morningRoutine": 45,
        "carChange": 15,
        "parking": 10,
        "entry": 10,
        "traffic": 20
      },
      "notifications": {
        "email": true,
        "sms": false,
        "push": true
      }
    },
    "statistics": {
      "totalSchedules": 25,
      "processedEmails": 150,
      "averageProcessingTime": 28.5
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Authentication required
- `404 Not Found`: User not found

#### 3.1.2 Update User Profile
**Endpoint**: `PUT /api/v1/users/me`

**Description**: Update current user's profile information

**Authentication**: Required

**Request Body**:
```json
{
  "name": "John Smith",
  "configuration": {
    "homeAddress": "456 Oak Ave, Los Angeles, CA 90002",
    "panavisionAddress": "789 Studio Blvd, Hollywood, CA 90028",
    "bufferTimes": {
      "morningRoutine": 50,
      "carChange": 20,
      "parking": 15,
      "entry": 10,
      "traffic": 25
    },
    "notifications": {
      "email": true,
      "sms": true,
      "smsNumber": "+1234567890",
      "push": true
    }
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "user_123456789",
    "email": "user@example.com",
    "name": "John Smith",
    "updatedAt": "2025-10-18T10:30:00Z",
    "configuration": {
      // Updated configuration
    }
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Authentication required
- `422 Unprocessable Entity`: Validation errors

#### 3.1.3 Test OAuth Connection
**Endpoint**: `GET /api/v1/users/me/oauth/test`

**Description**: Test OAuth connection with Google APIs

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "connection": "active",
    "gmail": {
      "emailAddress": "user@example.com",
      "messagesTotal": 1234,
      "threadsTotal": 567
    },
    "oauth": {
      "isAuthenticated": true,
      "scopes": ["gmail.readonly", "calendar"],
      "tokenExpiry": "2025-10-19T10:00:00Z",
      "needsReauth": false
    },
    "timestamp": "2025-10-18T10:30:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: OAuth authentication expired or invalid
- `500 Internal Server Error`: Connection test failed

## 4. Email Processing API

### 4.1 Email Management Endpoints

#### 4.1.1 Get Processed Emails
**Endpoint**: `GET /api/v1/emails`

**Description**: Get list of processed emails for current user

**Authentication**: Required

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20): Items per page
- `status` (string, optional): Filter by processing status
- `dateFrom` (string, optional): Filter by date (ISO 8601)
- `dateTo` (string, optional): Filter by date (ISO 8601)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "email_123456789",
      "messageId": "msg_123456789",
      "subject": "Shooting Schedule - Oct 20",
      "sender": "production@studio.com",
      "receivedAt": "2025-10-18T09:00:00Z",
      "processingStatus": "completed",
      "hasSchedule": true,
      "scheduleId": "schedule_123456789",
      "createdAt": "2025-10-18T09:05:00Z",
      "updatedAt": "2025-10-18T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### 4.1.2 Get Email Details
**Endpoint**: `GET /api/v1/emails/{email-id}`

**Description**: Get detailed information about a processed email

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "email_123456789",
    "messageId": "msg_123456789",
      "subject": "Shooting Schedule - Oct 20",
    "sender": "production@studio.com",
    "receivedAt": "2025-10-18T09:00:00Z",
    "processingStatus": "completed",
    "pdfHash": "hash_123456789",
    "extractedData": {
      "confidence": 0.95,
      "scheduleData": {
        "shootingDate": "2025-10-20T00:00:00Z",
        "callTime": "07:00",
        "location": "123 Studio Lot, Hollywood, CA",
        "sceneType": "Interior",
        "equipment": ["Camera A", "Lighting Kit"],
        "contacts": [
          {
            "name": "John Director",
            "role": "Director",
            "phone": "+1234567890"
          }
        ]
      }
    },
    "schedule": {
      "id": "schedule_123456789",
      "status": "confirmed"
    },
    "createdAt": "2025-10-18T09:05:00Z",
    "updatedAt": "2025-10-18T09:15:00Z"
  }
}
```

#### 4.1.3 Trigger Email Processing
**Endpoint**: `POST /api/v1/emails/process`

**Description**: Manually trigger email processing for debugging

**Authentication**: Required

**Request Body**:
```json
{
  "messageId": "msg_123456789",
  "force": false
}
```

**Response**: `202 Accepted`
```json
{
  "success": true,
  "data": {
    "jobId": "job_123456789",
    "status": "queued",
    "estimatedProcessingTime": 30
  }
}
```

#### 4.1.4 Get Processing Status
**Endpoint**: `GET /api/v1/emails/process/{job-id}`

**Description**: Get status of email processing job

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "jobId": "job_123456789",
    "status": "completed",
    "progress": 100,
    "startedAt": "2025-10-18T10:00:00Z",
    "completedAt": "2025-10-18T10:00:30Z",
    "result": {
      "emailId": "email_123456789",
      "scheduleId": "schedule_123456789",
      "success": true
    }
  }
}
```

## 5. Schedule Management API

### 5.1 Schedule Endpoints

#### 5.1.1 Get Schedules
**Endpoint**: `GET /api/v1/schedules`

**Description**: Get list of schedules for current user

**Authentication**: Required

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20): Items per page
- `status` (string, optional): Filter by status
- `dateFrom` (string, optional): Filter by date
- `dateTo` (string, optional): Filter by date
- `location` (string, optional): Filter by location

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "schedule_123456789",
      "shootingDate": "2025-10-20T00:00:00Z",
      "callTime": "07:00",
      "location": "123 Studio Lot, Hollywood, CA",
      "baseLocation": "456 Equipment House, Burbank, CA",
      "sceneType": "Interior",
      "status": "confirmed",
      "hasRoutePlan": true,
      "hasWeatherData": true,
      "hasCalendarEvent": true,
      "createdAt": "2025-10-18T09:15:00Z",
      "updatedAt": "2025-10-18T09:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### 5.1.2 Get Schedule Details
**Endpoint**: `GET /api/v1/schedules/{schedule-id}`

**Description**: Get detailed information about a schedule

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "schedule_123456789",
    "shootingDate": "2025-10-20T00:00:00Z",
    "callTime": "07:00",
    "location": "123 Studio Lot, Hollywood, CA",
    "baseLocation": "456 Equipment House, Burbank, CA",
    "sceneType": "Interior",
    "scenes": [
      {
        "number": "Scene 1",
        "description": "Opening dialogue",
        "duration": "2 hours"
      }
    ],
    "equipment": [
      {
        "type": "Camera",
        "model": "Arri Alexa",
        "quantity": 2
      }
    ],
    "contacts": [
      {
        "name": "John Director",
        "role": "Director",
        "phone": "+1234567890",
        "email": "director@studio.com"
      }
    ],
    "safetyNotes": "Wet floor on stage 2",
    "notes": "Early call for lighting setup",
    "status": "confirmed",
    "routePlan": {
      "id": "route_123456789",
      "wakeUpTime": "2025-10-20T05:15:00Z",
      "departureTime": "2025-10-20T05:45:00Z",
      "arrivalTime": "2025-10-20T06:45:00Z",
      "totalTravelMinutes": 60
    },
    "weatherData": {
      "id": "weather_123456789",
      "temperature": 72.5,
      "description": "Partly cloudy",
      "precipitation": 0,
      "windSpeed": 5.2,
      "humidity": 65
    },
    "calendarEvent": {
      "id": "calendar_123456789",
      "calendarEventId": "google_event_123456789",
      "title": "Shooting - Scene 1",
      "startTime": "2025-10-20T07:00:00Z",
      "endTime": "2025-10-20T12:00:00Z"
    },
    "createdAt": "2025-10-18T09:15:00Z",
    "updatedAt": "2025-10-18T09:30:00Z"
  }
}
```

#### 5.1.3 Update Schedule
**Endpoint**: `PUT /api/v1/schedules/{schedule-id}`

**Description**: Update schedule information

**Authentication**: Required

**Request Body**:
```json
{
  "callTime": "07:30",
  "location": "789 New Studio, Los Angeles, CA",
  "baseLocation": "456 Equipment House, Burbank, CA",
  "sceneType": "Exterior",
  "scenes": [
    {
      "number": "Scene 1",
      "description": "Exterior opening shot",
      "duration": "3 hours"
    }
  ],
  "equipment": [
    {
      "type": "Camera",
      "model": "Red Komodo",
      "quantity": 3
    }
  ],
  "contacts": [
    {
      "name": "Jane Director",
      "role": "Director",
      "phone": "+1234567890",
      "email": "director@studio.com"
    }
  ],
  "safetyNotes": "Traffic control needed on main street",
  "notes": "Additional lighting equipment required"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "schedule_123456789",
    "updatedAt": "2025-10-18T11:00:00Z",
    "changes": [
      {
        "field": "callTime",
        "oldValue": "07:00",
        "newValue": "07:30"
      },
      {
        "field": "location",
        "oldValue": "123 Studio Lot, Hollywood, CA",
        "newValue": "789 New Studio, Los Angeles, CA"
      }
    ]
  }
}
```

#### 5.1.4 Confirm Schedule
**Endpoint**: `POST /api/v1/schedules/{schedule-id}/confirm`

**Description**: Confirm schedule and trigger downstream processing

**Authentication**: Required

**Request Body**:
```json
{
  "confirmed": true,
  "notes": "Reviewed and approved all details"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "scheduleId": "schedule_123456789",
    "status": "confirmed",
    "confirmedAt": "2025-10-18T11:15:00Z",
    "processedTasks": [
      {
        "task": "route_planning",
        "status": "completed",
        "result": "route_123456789"
      },
      {
        "task": "calendar_creation",
        "status": "completed",
        "result": "calendar_123456789"
      },
      {
        "task": "weather_check",
        "status": "completed",
        "result": "weather_123456789"
      }
    ]
  }
}
```

#### 5.1.5 Get Schedule Conflicts
**Endpoint**: `GET /api/v1/schedules/{schedule-id}/conflicts`

**Description**: Get conflicts for a schedule

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "conflicts": [
      {
        "type": "time_overlap",
        "severity": "high",
        "description": "Overlaps with existing schedule",
        "conflictingSchedule": {
          "id": "schedule_987654321",
          "date": "2025-10-20T00:00:00Z",
          "time": "08:00-12:00"
        },
        "resolution": {
          "suggested": "Adjust call time to 13:00",
          "impact": "4 hour delay"
        }
      }
    ],
    "hasConflicts": true,
    "totalConflicts": 1
  }
}
```

## 6. Route Planning API

### 6.1 Route Planning Endpoints

#### 6.1.1 Get Route Plan
**Endpoint**: `GET /api/v1/schedules/{schedule-id}/route`

**Description**: Get route plan for a schedule

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "route_123456789",
    "wakeUpTime": "2025-10-20T05:15:00Z",
    "departureTime": "2025-10-20T05:45:00Z",
    "arrivalTime": "2025-10-20T06:45:00Z",
    "totalTravelMinutes": 60,
    "routeSegments": [
      {
        "origin": "123 Home Street, Los Angeles, CA",
        "destination": "456 Equipment House, Burbank, CA",
        "distance": 15.2,
        "duration": 25,
        "instructions": "Head north on Home St toward Main St"
      },
      {
        "origin": "456 Equipment House, Burbank, CA",
        "destination": "789 Studio Lot, Hollywood, CA",
        "distance": 8.5,
        "duration": 20,
        "instructions": "Take Hollywood Blvd west to studio lot"
      }
    ],
    "buffers": {
      "morningRoutine": 45,
      "carChange": 15,
      "parking": 10,
      "entry": 10,
      "traffic": 20
    },
    "trafficInfo": {
      "currentConditions": "Moderate",
      "typicalConditions": "Light",
      "confidence": 0.85
    },
    "calculatedAt": "2025-10-18T10:00:00Z"
  }
}
```

#### 6.1.2 Calculate Route
**Endpoint**: `POST /api/v1/routes/calculate`

**Description**: Calculate route for custom parameters

**Authentication**: Required

**Request Body**:
```json
{
  "origin": "123 Home Street, Los Angeles, CA",
  "destination": "789 Studio Lot, Hollywood, CA",
  "waypoints": [
    "456 Equipment House, Burbank, CA"
  ],
  "departureTime": "2025-10-20T05:45:00Z",
  "transportMode": "driving",
  "bufferPreferences": {
    "morningRoutine": 45,
    "carChange": 15,
    "parking": 10,
    "entry": 10,
    "traffic": 20
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "routeSegments": [
      {
        "origin": "123 Home Street, Los Angeles, CA",
        "destination": "456 Equipment House, Burbank, CA",
        "distance": 15.2,
        "duration": 25,
        "instructions": "Head north on Home St toward Main St"
      }
    ],
    "timing": {
      "wakeUpTime": "2025-10-20T05:15:00Z",
      "departureTime": "2025-10-20T05:45:00Z",
      "arrivalTime": "2025-10-20T06:45:00Z",
      "totalTravelMinutes": 60
    },
    "alternatives": [
      {
        "routeIndex": 1,
        "totalDistance": 24.8,
        "totalDuration": 55,
        "advantage": "5 minutes faster",
        "disadvantage": "3.2 miles longer"
      }
    ]
  }
}
```

#### 6.1.3 Optimize Route
**Endpoint**: `POST /api/v1/routes/optimize`

**Description**: Optimize existing route based on current conditions

**Authentication**: Required

**Request Body**:
```json
{
  "routeId": "route_123456789",
  "currentLocation": "123 Home Street, Los Angeles, CA",
  "currentTime": "2025-10-20T05:30:00Z",
  "considerTraffic": true,
  "considerWeather": true
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "optimizedRoute": {
      "updatedDepartureTime": "2025-10-20T05:50:00Z",
      "updatedArrivalTime": "2025-10-20T06:50:00Z",
      "routeChanges": [
        {
          "segment": 1,
          "originalDuration": 25,
          "optimizedDuration": 22,
          "reason": "Lighter than expected traffic"
        }
      ]
    },
    "optimizationReason": "Current traffic conditions better than expected",
    "confidence": 0.92
  }
}
```

## 7. Calendar Integration API

### 7.1 Calendar Endpoints

#### 7.1.1 Get Calendar Events
**Endpoint**: `GET /api/v1/calendar/events`

**Description**: Get calendar events for a date range

**Authentication**: Required

**Query Parameters**:
- `dateFrom` (string, required): Start date (ISO 8601)
- `dateTo` (string, required): End date (ISO 8601)
- `calendar` (string, optional): Specific calendar ID

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "calendar_123456789",
      "calendarEventId": "google_event_123456789",
      "title": "Shooting - Scene 1",
      "startTime": "2025-10-20T07:00:00Z",
      "endTime": "2025-10-20T12:00:00Z",
      "location": "789 Studio Lot, Hollywood, CA",
      "description": "Interior shooting, Scene 1",
      "status": "confirmed",
      "scheduleId": "schedule_123456789",
      "createdAt": "2025-10-18T09:30:00Z"
    }
  ]
}
```

#### 7.1.2 Create Calendar Event
**Endpoint**: `POST /api/v1/calendar/events`

**Description**: Create calendar event

**Authentication**: Required

**Request Body**:
```json
{
  "title": "Shooting - Scene 1",
  "startTime": "2025-10-20T07:00:00Z",
  "endTime": "2025-10-20T12:00:00Z",
  "location": "789 Studio Lot, Hollywood, CA",
  "description": "Interior shooting, Scene 1\nEquipment: Camera A, Lighting Kit",
  "attendees": [
    {
      "email": "director@studio.com",
      "name": "John Director"
    }
  ],
  "reminders": [
    {
      "method": "email",
      "minutes": 60
    },
    {
      "method": "popup",
      "minutes": 15
    }
  ],
  "calendar": "primary"
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "calendar_123456789",
    "calendarEventId": "google_event_123456789",
    "title": "Shooting - Scene 1",
    "startTime": "2025-10-20T07:00:00Z",
    "endTime": "2025-10-20T12:00:00Z",
    "location": "789 Studio Lot, Hollywood, CA",
    "status": "created",
    "createdAt": "2025-10-18T11:30:00Z"
  }
}
```

#### 7.1.3 Update Calendar Event
**Endpoint**: `PUT /api/v1/calendar/events/{event-id}`

**Description**: Update calendar event

**Authentication**: Required

**Request Body**:
```json
{
  "title": "Shooting - Scene 1 (Updated)",
  "startTime": "2025-10-20T07:30:00Z",
  "endTime": "2025-10-20T12:30:00Z",
  "location": "789 Studio Lot, Hollywood, CA",
  "description": "Updated shooting details"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "calendar_123456789",
    "calendarEventId": "google_event_123456789",
    "updatedAt": "2025-10-18T12:00:00Z",
    "changes": [
      {
        "field": "startTime",
        "oldValue": "2025-10-20T07:00:00Z",
        "newValue": "2025-10-20T07:30:00Z"
      }
    ]
  }
}
```

#### 7.1.4 Delete Calendar Event
**Endpoint**: `DELETE /api/v1/calendar/events/{event-id}`

**Description**: Delete calendar event

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "calendar_123456789",
    "deletedAt": "2025-10-18T12:15:00Z"
  }
}
```

## 8. Weather Integration API

### 8.1 Weather Endpoints

#### 8.1.1 Get Weather Data
**Endpoint**: `GET /api/v1/weather`

**Description**: Get weather data for location and date

**Authentication**: Required

**Query Parameters**:
- `location` (string, required): Location address or coordinates
- `date` (string, required): Date for weather forecast (ISO 8601)
- `includeHistorical` (boolean, default: false): Include historical data

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "location": "789 Studio Lot, Hollywood, CA",
    "coordinates": {
      "latitude": 34.0522,
      "longitude": -118.2437
    },
    "forecastDate": "2025-10-20T00:00:00Z",
    "current": {
      "temperature": 72.5,
      "description": "Partly cloudy",
      "windSpeed": 5.2,
      "windDirection": 180,
      "precipitation": 0,
      "humidity": 65,
      "visibility": 10,
      "uvIndex": 6,
      "updatedAt": "2025-10-18T12:00:00Z"
    },
    "forecast": [
      {
        "time": "2025-10-20T07:00:00Z",
        "temperature": 68.0,
        "description": "Clear",
        "precipitation": 0,
        "windSpeed": 4.5,
        "humidity": 70
      },
      {
        "time": "2025-10-20T12:00:00Z",
        "temperature": 75.0,
        "description": "Sunny",
        "precipitation": 0,
        "windSpeed": 6.0,
        "humidity": 55
      }
    ],
    "alerts": [],
    "shootingAssessment": {
      "suitability": "excellent",
      "recommendations": [
        "Ideal conditions for outdoor shooting",
        "Good lighting expected throughout day"
      ],
      "equipmentConsiderations": [],
      "safetyConsiderations": []
    }
  }
}
```

#### 8.1.2 Get Weather Alerts
**Endpoint**: `GET /api/v1/weather/alerts`

**Description**: Get weather alerts for user's schedules

**Authentication**: Required

**Query Parameters**:
- `dateFrom` (string, optional): Start date filter
- `dateTo` (string, optional): End date filter
- `severity` (string, optional): Filter by alert severity

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "alert_123456789",
      "scheduleId": "schedule_123456789",
      "location": "789 Studio Lot, Hollywood, CA",
      "alertDate": "2025-10-20T00:00:00Z",
      "severity": "moderate",
      "type": "wind",
      "title": "Moderate Wind Advisory",
      "description": "Wind speeds expected to reach 20-25 mph",
      "recommendations": [
        "Secure lighting equipment",
        "Consider wind breaks for audio recording",
        "Monitor weather conditions"
      ],
      "startTime": "2025-10-20T10:00:00Z",
      "endTime": "2025-10-20T18:00:00Z",
      "createdAt": "2025-10-18T12:30:00Z",
      "updatedAt": "2025-10-18T13:00:00Z"
    }
  ],
  "totalAlerts": 1,
  "hasCriticalAlerts": false
}
```

## 9. Notification API

### 9.1 Notification Endpoints

#### 9.1.1 Get Notifications
**Endpoint**: `GET /api/v1/notifications`

**Description**: Get user notifications

**Authentication**: Required

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20): Items per page
- `type` (string, optional): Filter by notification type
- `status` (string, optional): Filter by status
- `unreadOnly` (boolean, default: false): Only unread notifications

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "notification_123456789",
      "type": "schedule_processed",
      "channel": "email",
      "subject": "New Schedule Processed - Oct 20",
      "message": "A new shooting schedule has been processed and is ready for review.",
      "data": {
        "scheduleId": "schedule_123456789",
        "emailId": "email_123456789"
      },
      "status": "sent",
      "sentAt": "2025-10-18T09:30:00Z",
      "readAt": null,
      "createdAt": "2025-10-18T09:25:00Z",
      "updatedAt": "2025-10-18T09:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "unreadCount": 5
}
```

#### 9.1.2 Mark Notification as Read
**Endpoint**: `PUT /api/v1/notifications/{notification-id}/read`

**Description**: Mark notification as read

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "notification_123456789",
    "readAt": "2025-10-18T14:00:00Z",
    "status": "read"
  }
}
```

#### 9.1.3 Update Notification Preferences
**Endpoint**: `PUT /api/v1/notifications/preferences`

**Description**: Update notification preferences

**Authentication**: Required

**Request Body**:
```json
{
  "email": {
    "enabled": true,
    "scheduleProcessed": true,
    "scheduleConfirmed": true,
    "routeCalculated": true,
    "weatherAlerts": true,
    "systemUpdates": false
  },
  "sms": {
    "enabled": true,
    "phoneNumber": "+1234567890",
    "criticalAlerts": true,
    "scheduleChanges": false,
    "routeUpdates": false
  },
  "push": {
    "enabled": true,
    "allNotifications": true,
    "quietHours": {
      "enabled": true,
      "start": "22:00",
      "end": "07:00"
    }
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "preferences": {
      // Updated preferences
    },
    "updatedAt": "2025-10-18T14:15:00Z"
  }
}
```

## 10. System Administration API

### 10.1 Admin Endpoints

#### 10.1.1 Get System Health
**Endpoint**: `GET /api/v1/health`

**Description**: Get system health status

**Authentication**: Required (Admin only)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-10-18T14:30:00Z",
    "version": "1.0.0",
    "uptime": 86400,
    "components": {
      "database": {
        "status": "healthy",
        "responseTime": 15,
        "connections": {
          "active": 5,
          "idle": 15,
          "total": 20
        }
      },
      "cache": {
        "status": "healthy",
        "responseTime": 2,
        "hitRate": 0.85
      },
      "externalApis": {
        "google": {
          "status": "healthy",
          "responseTime": 150
        },
        "openweathermap": {
          "status": "healthy",
          "responseTime": 200
        },
        "twilio": {
          "status": "healthy",
          "responseTime": 100
        }
      },
      "backgroundJobs": {
        "status": "healthy",
        "activeJobs": 3,
        "failedJobs": 0,
        "queueDepth": 5
      }
    },
    "metrics": {
      "requestsPerMinute": 45,
      "averageResponseTime": 125,
      "errorRate": 0.01
    }
  }
}
```

#### 10.1.2 Get User Analytics
**Endpoint**: `GET /api/v1/admin/analytics/users`

**Description**: Get user analytics and statistics

**Authentication**: Required (Admin only)

**Query Parameters**:
- `dateFrom` (string, optional): Start date for analytics
- `dateTo` (string, optional): End date for analytics
- `groupBy` (string, default: "day"): Grouping period

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalUsers": 1250,
      "activeUsers": 890,
      "newUsers": 45,
      "churnedUsers": 12
    },
    "trends": [
      {
        "date": "2025-10-18",
        "activeUsers": 890,
        "newUsers": 15,
        "totalSchedules": 125,
        "processingTime": 28.5
      }
    ],
    "engagement": {
      "averageSchedulesPerUser": 12.5,
      "averageProcessingTime": 28.5,
      "retentionRate": 0.85,
      "satisfactionScore": 4.6
    }
  }
}
```

#### 10.1.3 Get System Metrics
**Endpoint**: `GET /api/v1/admin/metrics`

**Description**: Get detailed system performance metrics

**Authentication**: Required (Admin only)

**Query Parameters**:
- `metric` (string, optional): Specific metric to retrieve
- `timeRange` (string, default: "1h"): Time range for metrics

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "performance": {
      "responseTime": {
        "p50": 120,
        "p95": 200,
        "p99": 350
      },
      "throughput": {
        "requestsPerSecond": 15.5,
        "schedulesProcessedPerHour": 45
      },
      "errorRate": 0.005
    },
    "resources": {
      "cpu": {
        "usage": 0.65,
        "cores": 8
      },
      "memory": {
        "used": 6.2,
        "total": 16,
        "usage": 0.39
      },
      "disk": {
        "used": 125,
        "total": 500,
        "usage": 0.25
      }
    },
    "externalApis": {
      "google": {
        "requests": 1250,
        "errors": 5,
        "averageResponseTime": 150,
        "quotaUsage": 0.65
      },
      "openweathermap": {
        "requests": 450,
        "errors": 0,
        "averageResponseTime": 200
      },
      "twilio": {
        "requests": 125,
        "errors": 2,
        "averageResponseTime": 100
      }
    }
  }
}
```

## 11. Webhook API

### 11.1 Webhook Endpoints

#### 11.1.1 Handle External Events
**Endpoint**: `POST /api/v1/webhooks/{source}`

**Description**: Handle webhook events from external services

**Authentication**: Webhook signature verification

**Request Headers**:
```
X-Webhook-Signature: sha256=<signature>
X-Webhook-Timestamp: <timestamp>
```

**Request Body** (Google Calendar webhook example):
```json
{
  "kind": "api#channel",
  "id": "channel_id_123456789",
  "resourceId": "resource_id_123456789",
  "resourceUri": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  "expiration": 1910952000000
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "processed": true,
    "message": "Webhook event processed successfully"
  }
}
```

#### 11.1.2 Register Webhook
**Endpoint**: `POST /api/v1/webhooks/register`

**Description**: Register webhook for external service notifications

**Authentication**: Required (Admin only)

**Request Body**:
```json
{
  "source": "google_calendar",
  "callbackUrl": "https://api.stillontime.com/webhooks/google_calendar",
  "events": ["event.created", "event.updated", "event.deleted"],
  "filters": {
    "calendar": "primary"
  }
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "webhookId": "webhook_123456789",
    "source": "google_calendar",
    "status": "active",
    "secret": "webhook_secret_123456789",
    "createdAt": "2025-10-18T15:00:00Z"
  }
}
```

## 12. Rate Limiting and Quotas

### 12.1 Rate Limiting Rules

#### 12.1.1 API Rate Limits
**Standard Rate Limits**:
- **Authentication endpoints**: 5 requests per minute
- **User profile endpoints**: 100 requests per minute
- **Schedule endpoints**: 200 requests per minute
- **Calendar endpoints**: 100 requests per minute
- **Weather endpoints**: 60 requests per minute
- **Notification endpoints**: 50 requests per minute

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1697647200
```

#### 12.1.2 Rate Limit Exceeded Response
**Response**: `429 Too Many Requests`
```json
{
  "success": false,
  "error": {
    "code": "RATE_001",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "window": "1 minute",
      "retryAfter": 30
    },
    "timestamp": "2025-10-18T15:30:00Z",
    "requestId": "req_123456789"
  }
}
```

## 13. Error Handling and Troubleshooting

### 13.1 Error Response Standards

#### 13.1.1 Validation Errors
**Response**: `400 Bad Request`
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_001",
    "message": "Request validation failed",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Invalid email format",
          "value": "invalid-email"
        },
        {
          "field": "callTime",
          "message": "Time must be in HH:MM format",
          "value": "25:00"
        }
      ]
    },
    "timestamp": "2025-10-18T15:30:00Z",
    "requestId": "req_123456789"
  }
}
```

#### 13.1.2 Authentication Errors
**Response**: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "code": "AUTH_002",
    "message": "Invalid or expired token",
    "details": {
      "reason": "Token expired",
      "expiredAt": "2025-10-18T14:00:00Z"
    },
    "timestamp": "2025-10-18T15:30:00Z",
    "requestId": "req_123456789"
  }
}
```

#### 13.1.3 Authorization Errors
**Response**: `403 Forbidden`
```json
{
  "success": false,
  "error": {
    "code": "PERM_001",
    "message": "Insufficient permissions",
    "details": {
      "required": "schedules:update:any",
      "current": "schedules:update:own"
    },
    "timestamp": "2025-10-18T15:30:00Z",
    "requestId": "req_123456789"
  }
}
```

### 13.2 Troubleshooting Endpoints

#### 13.2.1 API Debug Information
**Endpoint**: `GET /api/v1/debug`

**Description**: Get debug information for troubleshooting

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "requestId": "req_123456789",
    "timestamp": "2025-10-18T15:30:00Z",
    "user": {
      "id": "user_123456789",
      "email": "user@example.com",
      "role": "user"
    },
    "permissions": [
      "users:read:own",
      "schedules:create",
      "schedules:read:own",
      "schedules:update:own"
    ],
    "rateLimit": {
      "limit": 100,
      "remaining": 95,
      "reset": 1697647200
    },
    "features": {
      "betaFeatures": false,
      "advancedAnalytics": false
    }
  }
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-18  
**Next Review**: 2025-11-18  
**Approved By**: SPARC Specification Team
# MP2 Film Schedule Automation - API Specifications

## API Overview

This document provides comprehensive API specifications for the MP2 Film Schedule Automation System microservices architecture. The APIs follow RESTful principles and are designed for scalability, security, and ease of integration.

## 1. Authentication Service API

### Base URL: `https://api.mp2-automation.com/v1/auth`

#### 1.1 Google OAuth Integration

**POST /auth/google**
```http
Content-Type: application/json

{
  "code": "authorization_code_from_google",
  "redirect_uri": "https://app.mp2-automation.com/auth/callback"
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "c2VjcmV0X3JlZnJlc2hfdG9rZW4=",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "crew_member",
    "permissions": [
      "schedule:read",
      "schedule:create",
      "calendar:read",
      "calendar:write"
    ]
  }
}
```

**POST /auth/refresh**
```http
Content-Type: application/json
Authorization: Bearer {refresh_token}

{
  "refresh_token": "c2VjcmV0X3JlZnJlc2hfdG9rZW4="
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "access_token": "new_access_token",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**POST /auth/logout**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "refresh_token": "c2VjcmV0X3JlZnJlc2hfdG9rZW4="
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "message": "Successfully logged out"
}
```

## 2. Email Service API

### Base URL: `https://api.mp2-automation.com/v1/email`

#### 2.1 Email Processing

**GET /email/processed**
```http
Authorization: Bearer {access_token}
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20, max: 100)
- status: string (pending|processing|completed|failed)
- date_from: string (ISO 8601 date)
- date_to: string (ISO 8601 date)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "emails": [
    {
      "id": "uuid-string",
      "message_id": "gmail_message_id",
      "subject": "MP2 Plan Zdjęciowy - 15.03.2024",
      "sender": "production@mp2-studio.com",
      "received_at": "2024-03-14T18:30:00Z",
      "processed": true,
      "processing_status": "completed",
      "pdf_hash": "sha256_hash",
      "schedule_id": "uuid-string",
      "created_at": "2024-03-14T18:35:00Z",
      "updated_at": "2024-03-14T18:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

**POST /email/process**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "message_id": "gmail_message_id",
  "force_reprocess": false,
  "dry_run": false
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "success": true,
  "processed_count": 1,
  "errors": [],
  "summary": {
    "date": "2024-03-15",
    "call_time": "07:00",
    "location": "Plac Zamkowy, Warszawa",
    "wake_up_time": "05:15",
    "calendar_event_id": "google_calendar_event_id"
  },
  "processing_time_ms": 1250
}
```

**GET /email/{message_id}**
```http
Authorization: Bearer {access_token}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "id": "uuid-string",
  "message_id": "gmail_message_id",
  "subject": "MP2 Plan Zdjęciowy - 15.03.2024",
  "sender": "production@mp2-studio.com",
  "received_at": "2024-03-14T18:30:00Z",
  "processed": true,
  "processing_status": "completed",
  "pdf_url": "https://storage.googleapis.com/mp2-docs/uuid.pdf",
  "schedule": {
    "id": "uuid-string",
    "shooting_date": "2024-03-15",
    "call_time": "07:00",
    "location": "Plac Zamkowy, Warszawa",
    "scene_type": "EXT",
    "scenes": ["1A", "2B", "3C"],
    "safety_notes": "Working at height - safety harness required",
    "equipment": ["Camera", "Lighting", "Sound"],
    "contacts": [
      {
        "role": "Director",
        "name": "Jan Kowalski",
        "phone": "+48 123 456 789",
        "email": "director@mp2-studio.com"
      }
    ]
  },
  "processing_log": [
    {
      "timestamp": "2024-03-14T18:35:00Z",
      "step": "email_received",
      "status": "completed"
    },
    {
      "timestamp": "2024-03-14T18:36:00Z",
      "step": "pdf_extracted",
      "status": "completed"
    },
    {
      "timestamp": "2024-03-14T18:37:00Z",
      "step": "pdf_parsed",
      "status": "completed"
    },
    {
      "timestamp": "2024-03-14T18:38:00Z",
      "step": "schedule_created",
      "status": "completed"
    },
    {
      "timestamp": "2024-03-14T18:45:00Z",
      "step": "calendar_event_created",
      "status": "completed"
    }
  ]
}
```

## 3. PDF Processing Service API

### Base URL: `https://api.mp2-automation.com/v1/pdf`

#### 3.1 PDF Processing

**POST /pdf/parse**
```http
Content-Type: multipart/form-data
Authorization: Bearer {access_token}

pdf_file: [binary file]
options: {
  "ocr_enabled": true,
  "language": "pl",
  "extract_tables": true,
  "preserve_formatting": false
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "parsing_confidence": 0.95,
    "extraction_method": "hybrid",
    "schedule_data": {
      "shooting_date": "2024-03-15",
      "call_time": "07:00",
      "location": "Plac Zamkowy, Warszawa",
      "base_location": "Panavision, Warszawa",
      "scene_type": "EXT",
      "scenes": [
        {
          "number": "1A",
          "description": "Morning scene at castle",
          "location": "Castle courtyard",
          "time": "07:00-09:00"
        }
      ],
      "safety_notes": "Working at height - safety harness required",
      "equipment": ["Camera", "Lighting", "Sound", "Cranes"],
      "contacts": [
        {
          "role": "Director",
          "name": "Jan Kowalski",
          "phone": "+48 123 456 789",
          "email": "director@mp2-studio.com"
        }
      ],
      "notes": "Weather backup: Studio B available"
    },
    "raw_text": "Extracted text content from PDF...",
    "metadata": {
      "page_count": 3,
      "processing_time_ms": 2500,
      "ocr_used": true,
      "confidence_score": 0.95
    }
  }
}
```

**POST /pdf/validate**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "schedule_data": {
    "shooting_date": "2024-03-15",
    "call_time": "07:00",
    "location": "Plac Zamkowy, Warszawa"
  }
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "field": "call_time",
      "message": "Early morning call time - ensure adequate travel time"
    }
  ],
  "suggestions": [
    {
      "field": "location",
      "suggestion": "Consider traffic conditions for downtown location"
    }
  ]
}
```

## 4. Schedule Service API

### Base URL: `https://api.mp2-automation.com/v1/schedule`

#### 4.1 Schedule Management

**GET /schedule**
```http
Authorization: Bearer {access_token}
Query Parameters:
- date_from: string (ISO 8601 date)
- date_to: string (ISO 8601 date)
- location: string (filter by location)
- status: string (pending|confirmed|completed|cancelled)
- page: number (default: 1)
- limit: number (default: 20)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "schedules": [
    {
      "id": "uuid-string",
      "shooting_date": "2024-03-15",
      "call_time": "07:00",
      "location": "Plac Zamkowy, Warszawa",
      "base_location": "Panavision, Warszawa",
      "scene_type": "EXT",
      "status": "confirmed",
      "created_at": "2024-03-14T18:35:00Z",
      "updated_at": "2024-03-14T18:45:00Z",
      "route_plan": {
        "id": "uuid-string",
        "wake_up_time": "05:15",
        "departure_time": "05:45",
        "arrival_time": "06:45",
        "total_travel_minutes": 60
      },
      "weather_info": {
        "temperature": 12.5,
        "description": "Partly cloudy",
        "wind_speed": 5.2,
        "precipitation": 0,
        "warnings": []
      },
      "calendar_event": {
        "id": "uuid-string",
        "google_calendar_id": "google_event_id",
        "title": "MP2 — Dzień zdjęciowy (Plac Zamkowy)",
        "start_time": "2024-03-15T05:45:00Z",
        "end_time": "2024-03-15T17:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

**GET /schedule/{id}**
```http
Authorization: Bearer {access_token}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "id": "uuid-string",
  "shooting_date": "2024-03-15",
  "call_time": "07:00",
  "location": "Plac Zamkowy, Warszawa",
  "base_location": "Panavision, Warszawa",
  "scene_type": "EXT",
  "scenes": [
    {
      "number": "1A",
      "description": "Morning scene at castle",
      "location": "Castle courtyard",
      "time": "07:00-09:00",
      "cast": ["Actor A", "Actor B"],
      "equipment": ["Camera", "Lighting"]
    }
  ],
  "safety_notes": "Working at height - safety harness required",
  "equipment": ["Camera", "Lighting", "Sound", "Cranes"],
  "contacts": [
    {
      "role": "Director",
      "name": "Jan Kowalski",
      "phone": "+48 123 456 789",
      "email": "director@mp2-studio.com"
    }
  ],
  "notes": "Weather backup: Studio B available",
  "status": "confirmed",
  "route_plan": {
    "id": "uuid-string",
    "wake_up_time": "05:15",
    "departure_time": "05:45",
    "arrival_time": "06:45",
    "total_travel_minutes": 60,
    "route_segments": [
      {
        "from": "Home (ul. Stylowa 7)",
        "to": "Panavision (ul. Wyczółki)",
        "distance_km": 8.5,
        "duration_minutes": 20,
        "traffic_factor": 1.2
      },
      {
        "from": "Panavision (ul. Wyczółki)",
        "to": "Plac Zamkowy, Warszawa",
        "distance_km": 12.3,
        "duration_minutes": 35,
        "traffic_factor": 1.1
      }
    ],
    "buffers": {
      "car_change": 15,
      "parking": 10,
      "entry": 10,
      "traffic": 20,
      "morning_routine": 45
    },
    "alternatives": [
      {
        "route_name": "Alternative via Ursynów",
        "total_duration_minutes": 65,
        "traffic_level": "moderate"
      }
    ]
  },
  "weather_info": {
    "forecast_date": "2024-03-15",
    "temperature": 12.5,
    "description": "Partly cloudy",
    "wind_speed": 5.2,
    "precipitation": 0,
    "humidity": 65,
    "warnings": [],
    "equipment_recommendations": [
      "Light jacket recommended",
      "Camera protection from light rain"
    ]
  },
  "calendar_event": {
    "id": "uuid-string",
    "google_calendar_id": "google_event_id",
    "title": "MP2 — Dzień zdjęciowy (Plac Zamkowy)",
    "start_time": "2024-03-15T05:45:00Z",
    "end_time": "2024-03-15T17:00:00Z",
    "description": "Complete day schedule with route information and weather forecast...",
    "location": "Plac Zamkowy, Warszawa",
    "reminders": [
      {"method": "popup", "minutes_before": 720},
      {"method": "popup", "minutes_before": 180},
      {"method": "popup", "minutes_before": 60},
      {"method": "popup", "minutes_before": 15}
    ],
    "alarms": [
      {"time": "05:05", "type": "primary"},
      {"time": "05:15", "type": "secondary"},
      {"time": "05:20", "type": "backup"}
    ]
  },
  "notifications": [
    {
      "id": "uuid-string",
      "type": "email",
      "recipient": "user@example.com",
      "sent_at": "2024-03-14T18:50:00Z",
      "status": "delivered"
    }
  ],
  "created_at": "2024-03-14T18:35:00Z",
  "updated_at": "2024-03-14T18:45:00Z"
}
```

**PUT /schedule/{id}**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "call_time": "07:30",
  "location": "Plac Zamkowy, Warszawa",
  "scenes": [
    {
      "number": "1A",
      "description": "Updated morning scene",
      "location": "Castle courtyard"
    }
  ],
  "safety_notes": "Updated safety requirements"
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "id": "uuid-string",
  "updated_fields": ["call_time", "location", "scenes", "safety_notes"],
  "recalculated": {
    "route_plan": true,
    "wake_up_time": "05:45",
    "calendar_event": true
  },
  "updated_at": "2024-03-14T19:00:00Z"
}
```

## 5. Route Planning Service API

### Base URL: `https://api.mp2-automation.com/v1/routes`

#### 5.1 Route Calculation

**POST /routes/calculate**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "origin": "ul. Stylowa 7, Warszawa",
  "destination": "Plac Zamkowy, Warszawa",
  "via": "Panavision, ul. Wyczółki, Warszawa",
  "departure_time": "2024-03-15T05:45:00Z",
  "buffers": {
    "car_change": 15,
    "parking": 10,
    "entry": 10,
    "traffic": 20,
    "morning_routine": 45
  },
  "options": {
    "avoid_tolls": false,
    "avoid_highways": false,
    "alternatives": true
  }
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "route_plan": {
    "id": "uuid-string",
    "origin": "ul. Stylowa 7, Warszawa",
    "destination": "Plac Zamkowy, Warszawa",
    "departure_time": "2024-03-15T05:45:00Z",
    "arrival_time": "2024-03-15T06:45:00Z",
    "wake_up_time": "2024-03-15T05:15:00Z",
    "total_travel_minutes": 60,
    "total_distance_km": 20.8,
    "route_segments": [
      {
        "sequence": 1,
        "from": "ul. Stylowa 7, Warszawa",
        "to": "Panavision, ul. Wyczółki, Warszawa",
        "distance_km": 8.5,
        "duration_minutes": 20,
        "departure_time": "05:45",
        "arrival_time": "06:05",
        "traffic_factor": 1.2,
        "instructions": [
          "Head north on ul. Stylowa",
          "Turn right on ul. Puławska",
          "Continue for 5.2 km"
        ]
      },
      {
        "sequence": 2,
        "from": "Panavision, ul. Wyczółki, Warszawa",
        "to": "Plac Zamkowy, Warszawa",
        "distance_km": 12.3,
        "duration_minutes": 35,
        "departure_time": "06:20",
        "arrival_time": "06:55",
        "traffic_factor": 1.1,
        "instructions": [
          "Head north on ul. Wyczółki",
          "Merge onto route S2",
          "Take exit toward Centrum"
        ]
      }
    ],
    "buffers": {
      "car_change": 15,
      "parking": 10,
      "entry": 10,
      "traffic": 20,
      "morning_routine": 45,
      "total_buffer": 100
    },
    "alternatives": [
      {
        "name": "Alternative via Ursynów",
        "total_duration_minutes": 65,
        "total_distance_km": 22.1,
        "traffic_level": "moderate",
        "route_segments": [...]
      }
    ],
    "traffic_conditions": {
      "overall": "moderate",
      "segments": [
        {
          "segment": 1,
          "condition": "light",
          "delay_minutes": 2
        },
        {
          "segment": 2,
          "condition": "moderate",
          "delay_minutes": 5
        }
      ]
    },
    "calculated_at": "2024-03-14T18:40:00Z"
  }
}
```

**GET /routes/{id}**
```http
Authorization: Bearer {access_token}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "id": "uuid-string",
  "schedule_id": "uuid-string",
  "origin": "ul. Stylowa 7, Warszawa",
  "destination": "Plac Zamkowy, Warszawa",
  "departure_time": "2024-03-15T05:45:00Z",
  "arrival_time": "2024-03-15T06:45:00Z",
  "wake_up_time": "2024-03-15T05:15:00Z",
  "total_travel_minutes": 60,
  "calculated_at": "2024-03-14T18:40:00Z",
  "is_current": true
}
```

## 6. Calendar Service API

### Base URL: `https://api.mp2-automation.com/v1/calendar`

#### 6.1 Calendar Event Management

**POST /calendar/events**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "schedule_id": "uuid-string",
  "title": "MP2 — Dzień zdjęciowy (Plac Zamkowy)",
  "start_time": "2024-03-15T05:45:00Z",
  "end_time": "2024-03-15T17:00:00Z",
  "description": "Complete day schedule...",
  "location": "Plac Zamkowy, Warszawa",
  "reminders": [
    {"method": "popup", "minutes_before": 720},
    {"method": "popup", "minutes_before": 180},
    {"method": "popup", "minutes_before": 60},
    {"method": "popup", "minutes_before": 15}
  ],
  "alarms": [
    {"time": "05:05", "type": "primary"},
    {"time": "05:15", "type": "secondary"},
    {"time": "05:20", "type": "backup"}
  ],
  "attendees": [
    {
      "email": "user@example.com",
      "response_status": "accepted"
    }
  ]
}
```

**Response:**
```http
Status: 201 Created
Content-Type: application/json

{
  "id": "uuid-string",
  "google_calendar_id": "google_event_id",
  "schedule_id": "uuid-string",
  "title": "MP2 — Dzień zdjęciowy (Plac Zamkowy)",
  "start_time": "2024-03-15T05:45:00Z",
  "end_time": "2024-03-15T17:00:00Z",
  "location": "Plac Zamkowy, Warszawa",
  "status": "confirmed",
  "created_at": "2024-03-14T18:45:00Z",
  "calendar_url": "https://calendar.google.com/calendar/event?eid=..."
}
```

**GET /calendar/events**
```http
Authorization: Bearer {access_token}
Query Parameters:
- date_from: string (ISO 8601 date)
- date_to: string (ISO 8601 date)
- status: string (confirmed|tentative|cancelled)
- page: number (default: 1)
- limit: number (default: 20)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "events": [
    {
      "id": "uuid-string",
      "google_calendar_id": "google_event_id",
      "schedule_id": "uuid-string",
      "title": "MP2 — Dzień zdjęciowy (Plac Zamkowy)",
      "start_time": "2024-03-15T05:45:00Z",
      "end_time": "2024-03-15T17:00:00Z",
      "location": "Plac Zamkowy, Warszawa",
      "status": "confirmed",
      "attendees": [
        {
          "email": "user@example.com",
          "name": "John Doe",
          "response_status": "accepted"
        }
      ],
      "reminders": [
        {"method": "popup", "minutes_before": 720, "sent": true},
        {"method": "popup", "minutes_before": 180, "sent": false}
      ],
      "alarms": [
        {"time": "05:05", "type": "primary", "triggered": false},
        {"time": "05:15", "type": "secondary", "triggered": false},
        {"time": "05:20", "type": "backup", "triggered": false}
      ],
      "created_at": "2024-03-14T18:45:00Z",
      "updated_at": "2024-03-14T18:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "total_pages": 2
  }
}
```

**PUT /calendar/events/{id}**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "title": "Updated MP2 — Dzień zdjęciowy",
  "start_time": "2024-03-15T06:00:00Z",
  "location": "New Location, Warszawa"
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "id": "uuid-string",
  "updated_fields": ["title", "start_time", "location"],
  "google_calendar_updated": true,
  "updated_at": "2024-03-14T19:15:00Z"
}
```

**DELETE /calendar/events/{id}**
```http
Authorization: Bearer {access_token}
```

**Response:**
```http
Status: 204 No Content
```

## 7. Weather Service API

### Base URL: `https://api.mp2-automation.com/v1/weather`

#### 7.1 Weather Information

**GET /weather/forecast**
```http
Authorization: Bearer {access_token}
Query Parameters:
- location: string (required)
- date: string (ISO 8601 date, required)
- days: number (default: 1, max: 7)
- units: string (metric|imperial, default: metric)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "location": {
    "name": "Plac Zamkowy, Warszawa",
    "latitude": 52.2297,
    "longitude": 21.0122
  },
  "forecast": [
    {
      "date": "2024-03-15",
      "temperature": {
        "min": 8.5,
        "max": 14.2,
        "morning": 9.0,
        "afternoon": 14.2,
        "evening": 11.0,
        "night": 8.5
      },
      "description": "Partly cloudy",
      "humidity": 65,
      "pressure": 1013,
      "wind_speed": 5.2,
      "wind_direction": "NW",
      "precipitation": {
        "probability": 10,
        "amount": 0,
        "type": "none"
      },
      "visibility": 10,
      "uv_index": 3,
      "sunrise": "06:15",
      "sunset": "17:45",
      "warnings": [],
      "equipment_recommendations": [
        "Light jacket recommended",
        "Sun protection (UV index 3)",
        "Camera lens cleaning cloth"
      ]
    }
  ],
  "cached_at": "2024-03-14T12:00:00Z",
  "cache_expires_at": "2024-03-14T18:00:00Z"
}
```

**GET /weather/alerts**
```http
Authorization: Bearer {access_token}
Query Parameters:
- location: string (required)
- date_from: string (ISO 8601 date)
- date_to: string (ISO 8601 date)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "location": "Plac Zamkowy, Warszawa",
  "alerts": [
    {
      "id": "alert_123",
      "event": "High Wind Warning",
      "start": "2024-03-15T08:00:00Z",
      "end": "2024-03-15T14:00:00Z",
      "description": "Wind speeds expected to reach 25-30 mph",
      "severity": "moderate",
      "areas": ["Central Warsaw"],
      "recommendations": [
        "Secure lighting equipment",
        "Consider windbreaks for sound recording",
        "Monitor camera stability"
      ]
    }
  ]
}
```

## 8. Notification Service API

### Base URL: `https://api.mp2-automation.com/v1/notifications`

#### 8.1 Notification Management

**POST /notifications/send**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "recipient_id": "uuid-string",
  "type": "email",
  "subject": "MP2 Schedule Update - 15.03.2024",
  "content": {
    "summary": "Your shooting schedule for tomorrow...",
    "schedule_details": {
      "date": "2024-03-15",
      "call_time": "07:00",
      "location": "Plac Zamkowy, Warszawa",
      "wake_up_time": "05:15"
    },
    "route_plan": {
      "departure_time": "05:45",
      "arrival_time": "06:45"
    },
    "weather": {
      "temperature": 12.5,
      "description": "Partly cloudy"
    }
  },
  "priority": "normal",
  "send_at": "2024-03-14T20:00:00Z"
}
```

**Response:**
```http
Status: 202 Accepted
Content-Type: application/json

{
  "id": "uuid-string",
  "status": "scheduled",
  "scheduled_for": "2024-03-14T20:00:00Z",
  "estimated_delivery": "2024-03-14T20:01:00Z"
}
```

**GET /notifications**
```http
Authorization: Bearer {access_token}
Query Parameters:
- recipient_id: string
- type: string (email|sms|push)
- status: string (pending|sent|delivered|failed)
- date_from: string (ISO 8601 date)
- date_to: string (ISO 8601 date)
- page: number (default: 1)
- limit: number (default: 20)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "notifications": [
    {
      "id": "uuid-string",
      "recipient_id": "uuid-string",
      "type": "email",
      "subject": "MP2 Schedule Update - 15.03.2024",
      "status": "delivered",
      "priority": "normal",
      "sent_at": "2024-03-14T20:00:15Z",
      "delivered_at": "2024-03-14T20:01:32Z",
      "delivery_attempts": 1,
      "created_at": "2024-03-14T19:55:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "total_pages": 7
  }
}
```

**GET /notifications/{id}**
```http
Authorization: Bearer {access_token}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "id": "uuid-string",
  "recipient_id": "uuid-string",
  "type": "email",
  "subject": "MP2 Schedule Update - 15.03.2024",
  "content": {
    "summary": "Your shooting schedule for tomorrow...",
    "schedule_details": {...}
  },
  "status": "delivered",
  "priority": "normal",
  "provider": "sendgrid",
  "provider_message_id": "sendgrid_msg_id",
  "sent_at": "2024-03-14T20:00:15Z",
  "delivered_at": "2024-03-14T20:01:32Z",
  "delivery_attempts": 1,
  "delivery_logs": [
    {
      "timestamp": "2024-03-14T20:00:15Z",
      "status": "sent",
      "message": "Email sent to provider"
    },
    {
      "timestamp": "2024-03-14T20:01:32Z",
      "status": "delivered",
      "message": "Email delivered to recipient"
    }
  ],
  "created_at": "2024-03-14T19:55:00Z"
}
```

## 9. Configuration Service API

### Base URL: `https://api.mp2-automation.com/v1/config`

#### 9.1 Configuration Management

**GET /config/user**
```http
Authorization: Bearer {access_token}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "user_id": "uuid-string",
  "addresses": {
    "home": "ul. Stylowa 7, Warszawa",
    "panavision": "ul. Wyczółki, Warszawa"
  },
  "buffers": {
    "car_change": 15,
    "parking": 10,
    "entry": 10,
    "traffic": 20,
    "morning_routine": 45
  },
  "notifications": {
    "email": true,
    "sms": false,
    "push": true,
    "delivery_time": "20:00"
  },
  "preferences": {
    "language": "pl",
    "timezone": "Europe/Warsaw",
    "date_format": "YYYY-MM-DD",
    "time_format": "24h"
  },
  "api_keys": {
    "maps": {
      "configured": true,
      "provider": "google",
      "last_tested": "2024-03-14T10:00:00Z"
    },
    "weather": {
      "configured": true,
      "provider": "openweathermap",
      "last_tested": "2024-03-14T10:05:00Z"
    }
  },
  "updated_at": "2024-03-14T15:30:00Z"
}
```

**PUT /config/user**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "addresses": {
    "home": "ul. Nowa 5, Warszawa",
    "panavision": "ul. Wyczółki, Warszawa"
  },
  "buffers": {
    "car_change": 20,
    "parking": 15,
    "entry": 10,
    "traffic": 25,
    "morning_routine": 45
  },
  "notifications": {
    "email": true,
    "sms": true,
    "push": true,
    "delivery_time": "21:00"
  }
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "updated_fields": ["addresses", "buffers", "notifications"],
  "updated_at": "2024-03-14T16:45:00Z"
}
```

**POST /config/test-api-key**
```http
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "service": "maps",
  "api_key": "new_api_key_value"
}
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "valid": true,
  "service": "maps",
  "test_result": {
    "success": true,
    "response_time_ms": 250,
    "quota_info": {
      "daily_limit": 100000,
      "daily_usage": 1234,
      "reset_time": "2024-03-15T00:00:00Z"
    }
  },
  "tested_at": "2024-03-14T17:00:00Z"
}
```

## 10. Analytics Service API

### Base URL: `https://api.mp2-automation.com/v1/analytics`

#### 10.1 Analytics and Reporting

**GET /analytics/summary**
```http
Authorization: Bearer {access_token}
Query Parameters:
- date_from: string (ISO 8601 date)
- date_to: string (ISO 8601 date)
- granularity: string (day|week|month)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "period": {
    "from": "2024-03-01",
    "to": "2024-03-31",
    "granularity": "day"
  },
  "summary": {
    "total_emails_processed": 45,
    "successful_processing": 42,
    "failed_processing": 3,
    "success_rate": 0.933,
    "total_schedules_created": 42,
    "total_route_calculations": 42,
    "total_calendar_events": 42,
    "total_notifications_sent": 168
  },
  "daily_breakdown": [
    {
      "date": "2024-03-14",
      "emails_processed": 3,
      "success_rate": 1.0,
      "avg_processing_time_ms": 1250,
      "schedules_created": 3,
      "notifications_sent": 12
    }
  ],
  "performance_metrics": {
    "avg_email_processing_time_ms": 1350,
    "avg_pdf_parsing_time_ms": 2100,
    "avg_route_calculation_time_ms": 450,
    "system_uptime_percentage": 99.8,
    "api_response_times": {
      "p50": 250,
      "p95": 800,
      "p99": 1500
    }
  },
  "error_analysis": {
    "total_errors": 3,
    "error_types": [
      {
        "type": "pdf_parsing_error",
        "count": 2,
        "percentage": 66.7
      },
      {
        "type": "api_timeout",
        "count": 1,
        "percentage": 33.3
      }
    ]
  }
}
```

**GET /analytics/performance**
```http
Authorization: Bearer {access_token}
Query Parameters:
- metric: string (processing_time|error_rate|api_response)
- date_from: string (ISO 8601 date)
- date_to: string (ISO 8601 date)
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "metric": "processing_time",
  "period": {
    "from": "2024-03-01",
    "to": "2024-03-31"
  },
  "data_points": [
    {
      "timestamp": "2024-03-14T10:00:00Z",
      "value": 1250,
      "unit": "milliseconds"
    }
  ],
  "statistics": {
    "min": 800,
    "max": 2100,
    "mean": 1350,
    "median": 1300,
    "p95": 1800,
    "p99": 2000
  },
  "trends": {
    "direction": "stable",
    "change_percentage": 2.5
  }
}
```

## 11. Health Check Service API

### Base URL: `https://api.mp2-automation.com/v1/health`

#### 11.1 System Health

**GET /health**
```http
No authentication required
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2024-03-14T18:00:00Z",
  "version": "1.0.0",
  "uptime_seconds": 86400,
  "services": {
    "email_service": {
      "status": "healthy",
      "response_time_ms": 150,
      "last_check": "2024-03-14T17:59:30Z"
    },
    "pdf_processing": {
      "status": "healthy",
      "response_time_ms": 200,
      "last_check": "2024-03-14T17:59:45Z"
    },
    "route_planning": {
      "status": "degraded",
      "response_time_ms": 1200,
      "last_check": "2024-03-14T17:59:50Z",
      "issues": ["Elevated response times"]
    },
    "calendar_service": {
      "status": "healthy",
      "response_time_ms": 100,
      "last_check": "2024-03-14T17:59:55Z"
    },
    "weather_service": {
      "status": "healthy",
      "response_time_ms": 80,
      "last_check": "2024-03-14T18:00:00Z"
    },
    "notification_service": {
      "status": "healthy",
      "response_time_ms": 120,
      "last_check": "2024-03-14T18:00:05Z"
    },
    "database": {
      "status": "healthy",
      "response_time_ms": 25,
      "last_check": "2024-03-14T18:00:10Z"
    },
    "redis_cache": {
      "status": "healthy",
      "response_time_ms": 5,
      "last_check": "2024-03-14T18:00:15Z"
    }
  },
  "external_dependencies": {
    "gmail_api": {
      "status": "healthy",
      "response_time_ms": 180,
      "last_check": "2024-03-14T17:58:00Z"
    },
    "google_maps_api": {
      "status": "healthy",
      "response_time_ms": 300,
      "quota_remaining": 98765,
      "last_check": "2024-03-14T17:58:30Z"
    },
    "openweathermap_api": {
      "status": "healthy",
      "response_time_ms": 120,
      "quota_remaining": 95000,
      "last_check": "2024-03-14T17:59:00Z"
    }
  }
}
```

**GET /health/ready**
```http
No authentication required
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "ready": true,
  "checks": {
    "database": "pass",
    "redis": "pass",
    "external_apis": "pass"
  },
  "timestamp": "2024-03-14T18:00:00Z"
}
```

**GET /health/live**
```http
No authentication required
```

**Response:**
```http
Status: 200 OK
Content-Type: application/json

{
  "alive": true,
  "timestamp": "2024-03-14T18:00:00Z"
}
```

## 12. Error Responses

All APIs follow consistent error response format:

### Standard Error Response
```http
Status: 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "call_time",
      "issue": "Invalid time format"
    },
    "request_id": "uuid-string",
    "timestamp": "2024-03-14T18:00:00Z"
  }
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `EXTERNAL_API_ERROR` | 502 | External API error |
| `TIMEOUT` | 504 | Request timeout |

## 13. Rate Limiting

API rate limits are applied per user and service:

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| Email processing | 10 requests/hour | 20 |
| Route calculation | 100 requests/hour | 150 |
| Weather data | 100 requests/hour | 120 |
| Configuration | 50 requests/hour | 75 |
| Analytics | 200 requests/hour | 250 |

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640998800
```

## 14. Authentication

All API endpoints (except health checks) require authentication via JWT tokens:

### Authorization Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Refresh
Access tokens expire after 1 hour. Use the refresh token to obtain new access tokens without re-authentication.

---

**API Specification Version**: 1.0.0
**Last Updated**: 2025-10-19
**Base URL**: `https://api.mp2-automation.com/v1`
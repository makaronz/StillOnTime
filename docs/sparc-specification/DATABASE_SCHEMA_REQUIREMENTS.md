# StillOnTime Film Schedule Automation System
# Database Schema Requirements

## Executive Summary

This document defines the comprehensive database schema requirements for the StillOnTime Film Schedule Automation System, including entity relationships, data types, constraints, indexes, and optimization strategies for PostgreSQL database with Prisma ORM.

## 1. Database Architecture Overview

### 1.1 Database Technology Stack

#### 1.1.1 Primary Database
**Database**: PostgreSQL 15+
**ORM**: Prisma 5.6+
**Connection Pooling**: PgBouncer
**Replication**: Streaming replication for read scalability

**Rationale for PostgreSQL Selection**:
- Strong ACID compliance for data integrity
- Advanced indexing capabilities for complex queries
- JSON support for flexible data storage
- Full-text search capabilities
- Proven scalability and reliability
- Extensive ecosystem and tooling

#### 1.1.2 Caching Layer
**Cache**: Redis 7+
**Use Cases**: Session storage, API response caching, background job queues
**Persistence**: RDB + AOF persistence
**Cluster**: Redis Cluster for horizontal scaling

### 1.2 Database Design Principles

#### 1.2.1 Design Principles
**Normalization**: Third Normal Form (3NF) with selective denormalization for performance
**Consistency**: Strong consistency for critical data, eventual consistency for background data
**Scalability**: Horizontal scaling through read replicas and sharding strategies
**Security**: Row-level security and encryption at rest
**Auditability**: Complete audit trail for all data modifications

#### 1.2.2 Naming Conventions
**Tables**: snake_case, plural form (e.g., `users`, `schedules`)
**Columns**: snake_case, descriptive names (e.g., `created_at`, `user_id`)
**Indexes**: `idx_table_name_column_name` pattern
**Foreign Keys**: `fk_table_name_column_name` pattern
**Constraints**: `ck_table_name_condition` pattern

## 2. Core Entity Models

### 2.1 User Management

#### 2.1.1 Users Table
**Purpose**: Store user authentication and profile information

**Table Definition**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT, -- Encrypted
    refresh_token TEXT, -- Encrypted
    token_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0
);
```

**Prisma Schema**:
```prisma
model User {
    id            String   @id @default(cuid())
    email         String   @unique
    name          String?
    googleId      String   @unique
    accessToken   String?  // Encrypted
    refreshToken  String?  // Encrypted
    tokenExpiry   DateTime?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    deletedAt     DateTime?
    emailVerified Boolean  @default(false)
    lastLoginAt   DateTime?
    loginCount    Int      @default(0)

    processedEmails ProcessedEmail[]
    schedules       ScheduleData[]
    routePlans      RoutePlan[]
    weatherData     WeatherData[]
    calendarEvents  CalendarEvent[]
    userConfig      UserConfig?
    notifications   Notification[]
    summaries       Summary[]

    @@map("users")
    @@index([email])
    @@index([googleId])
    @@index([deletedAt])
}
```

**Index Strategy**:
- Primary key: `id` (UUID)
- Unique indexes: `email`, `google_id`
- Search indexes: `email` for authentication lookups
- Soft delete index: `deleted_at` for filtering active users

**Data Validation Rules**:
- Email: Valid email format required
- Google ID: Non-null, validated Google user ID
- Tokens: Encrypted at rest, validated format
- Timestamps: UTC timezone, automatic updates

---

#### 2.1.2 User Configuration Table
**Purpose**: Store user preferences and configuration data

**Table Definition**:
```sql
CREATE TABLE user_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    home_address TEXT NOT NULL,
    panavision_address TEXT,
    buffer_car_change INTEGER DEFAULT 15,
    buffer_parking INTEGER DEFAULT 10,
    buffer_entry INTEGER DEFAULT 10,
    buffer_traffic INTEGER DEFAULT 20,
    buffer_morning_routine INTEGER DEFAULT 45,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_sms BOOLEAN DEFAULT FALSE,
    notification_push BOOLEAN DEFAULT TRUE,
    sms_number VARCHAR(20),
    sms_verified BOOLEAN DEFAULT FALSE,
    sms_verification_code VARCHAR(6),
    sms_verification_expiry TIMESTAMP WITH TIME ZONE,
    push_token TEXT,
    push_token_verified BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);
```

**Prisma Schema**:
```prisma
model UserConfig {
    id                    String   @id @default(cuid())
    userId                String   @unique
    homeAddress           String
    panavisionAddress     String?
    bufferCarChange       Int      @default(15)
    bufferParking         Int      @default(10)
    bufferEntry           Int      @default(10)
    bufferTraffic         Int      @default(20)
    bufferMorningRoutine  Int      @default(45)
    notificationEmail     Boolean  @default(true)
    notificationSms       Boolean  @default(false)
    notificationPush      Boolean  @default(true)
    smsNumber             String?
    smsVerified           Boolean  @default(false)
    smsVerificationCode   String?
    smsVerificationExpiry DateTime?
    pushToken             String?
    pushTokenVerified     Boolean  @default(false)
    timezone              String   @default("UTC")
    language              String   @default("en")
    createdAt             DateTime @default(now())
    updatedAt             DateTime @updatedAt

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@map("user_configs")
    @@index([userId])
}
```

**Validation Constraints**:
- Buffer times: 5-120 minutes range
- Phone number: E.164 format validation
- Timezone: Valid timezone from IANA database
- Language: ISO 639-1 language codes

---

### 2.2 Email Processing

#### 2.2.1 Processed Emails Table
**Purpose**: Track all processed emails and their status

**Table Definition**:
```sql
CREATE TABLE processed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    thread_id VARCHAR(255),
    subject TEXT NOT NULL,
    sender VARCHAR(255) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending',
    pdf_hash VARCHAR(64),
    error TEXT,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_processed_emails_user_id (user_id),
    INDEX idx_processed_emails_status (processing_status),
    INDEX idx_processed_emails_received_at (received_at),
    INDEX idx_processed_emails_sender (sender)
);
```

**Prisma Schema**:
```prisma
model ProcessedEmail {
    id                  String   @id @default(cuid())
    messageId           String   @unique
    threadId            String?
    subject             String
    sender              String
    receivedAt          DateTime
    processed           Boolean  @default(false)
    processingStatus    String   @default("pending")
    pdfHash             String?
    error               String?
    processingStartedAt DateTime?
    processingCompletedAt DateTime?
    retryCount          Int      @default(0)
    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt

    userId  String       @map("user_id")
    user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)
    schedule ScheduleData?

    @@map("processed_emails")
    @@index([userId])
    @@index([processingStatus])
    @@index([receivedAt])
    @@index([sender])
}
```

**Processing Status Values**:
- `pending`: Initial state, waiting to be processed
- `processing`: Currently being processed
- `completed`: Successfully processed
- `failed`: Processing failed with retryable error
- `error`: Processing failed with permanent error
- `skipped`: Email does not match processing criteria

---

#### 2.2.2 Schedule Data Table
**Purpose**: Store extracted and confirmed schedule information

**Table Definition**:
```sql
CREATE TABLE schedule_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shooting_date DATE NOT NULL,
    call_time TIME NOT NULL,
    location TEXT NOT NULL,
    base_location TEXT,
    scene_type VARCHAR(100),
    scenes JSONB,
    equipment JSONB,
    contacts JSONB,
    safety_notes TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'extracted',
    confidence_score DECIMAL(3,2),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID UNIQUE NOT NULL REFERENCES processed_emails(id) ON DELETE CASCADE,
    
    INDEX idx_schedule_data_user_id (user_id),
    INDEX idx_schedule_data_date (shooting_date),
    INDEX idx_schedule_data_status (status),
    INDEX idx_schedule_data_location (location)
);
```

**Prisma Schema**:
```prisma
model ScheduleData {
    id            String   @id @default(cuid())
    shootingDate  DateTime @map("shooting_date")
    callTime      String   @map("call_time")
    location      String
    baseLocation  String?  @map("base_location")
    sceneType     String?  @map("scene_type")
    scenes        Json?
    equipment     Json?
    contacts      Json?
    safetyNotes   String?  @map("safety_notes")
    notes         String?
    status        String   @default("extracted")
    confidenceScore Decimal? @map("confidence_score") @db.Decimal(3, 2)
    version       Int      @default(1)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    userId  String         @map("user_id")
    user    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
    emailId String         @unique @map("email_id")
    email   ProcessedEmail @relation(fields: [emailId], references: [id], onDelete: Cascade)

    routePlan     RoutePlan?
    weatherData   WeatherData?
    calendarEvent CalendarEvent?
    summary       Summary?

    @@map("schedule_data")
    @@index([userId])
    @@index([shootingDate])
    @@index([status])
    @@index([location])
}
```

**Status Values**:
- `extracted`: Data extracted from email, pending review
- `reviewing`: Currently being reviewed by user
- `confirmed`: User has confirmed schedule data
- `modified`: Schedule has been modified after confirmation
- `cancelled`: Schedule has been cancelled

**JSON Schema for Scenes**:
```json
{
  "scenes": [
    {
      "number": "Scene 1",
      "description": "Opening dialogue",
      "duration": "2 hours",
      "location": "Interior - Living Room",
      "cast": ["Actor A", "Actor B"],
      "specialRequirements": ["Special lighting", "Sound effects"]
    }
  ]
}
```

**JSON Schema for Equipment**:
```json
{
  "equipment": [
    {
      "type": "Camera",
      "model": "Arri Alexa",
      "quantity": 2,
      "accessories": ["Lenses", "Batteries", "Memory cards"]
    },
    {
      "type": "Lighting",
      "model": "LED Panel",
      "quantity": 4,
      "accessories": ["Stands", "Gels", "Diffusion"]
    }
  ]
}
```

---

### 2.3 Route Planning

#### 2.3.1 Route Plans Table
**Purpose**: Store calculated route plans and timing information

**Table Definition**:
```sql
CREATE TABLE route_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wake_up_time TIMESTAMP WITH TIME ZONE NOT NULL,
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_travel_minutes INTEGER NOT NULL,
    route_segments JSONB NOT NULL,
    buffers JSONB NOT NULL,
    traffic_info JSONB,
    confidence_score DECIMAL(3,2),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID UNIQUE NOT NULL REFERENCES schedule_data(id) ON DELETE CASCADE,
    
    INDEX idx_route_plans_user_id (user_id),
    INDEX idx_route_plans_schedule_id (schedule_id),
    INDEX idx_route_plans_departure_time (departure_time)
);
```

**Prisma Schema**:
```prisma
model RoutePlan {
    id                  String   @id @default(cuid())
    wakeUpTime          DateTime @map("wake_up_time")
    departureTime       DateTime @map("departure_time")
    arrivalTime         DateTime @map("arrival_time")
    totalTravelMinutes  Int      @map("total_travel_minutes")
    routeSegments       Json     @map("route_segments")
    buffers             Json
    trafficInfo         Json?    @map("traffic_info")
    confidenceScore     Decimal? @map("confidence_score") @db.Decimal(3, 2)
    calculatedAt        DateTime @default(now()) @map("calculated_at")
    updatedAt           DateTime @updatedAt

    userId    String      @map("user_id")
    user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
    scheduleId String      @unique @map("schedule_id")
    schedule  ScheduleData @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

    @@map("route_plans")
    @@index([userId])
    @@index([scheduleId])
    @@index([departureTime])
}
```

**JSON Schema for Route Segments**:
```json
{
  "routeSegments": [
    {
      "origin": "123 Home Street, Los Angeles, CA",
      "originCoordinates": {
        "latitude": 34.0522,
        "longitude": -118.2437
      },
      "destination": "456 Equipment House, Burbank, CA",
      "destinationCoordinates": {
        "latitude": 34.1808,
        "longitude": -118.3089
      },
      "distance": 15.2,
      "distanceUnit": "miles",
      "duration": 25,
      "durationUnit": "minutes",
      "instructions": "Head north on Home St toward Main St",
      "waypoints": [],
      "trafficCondition": "moderate"
    }
  ]
}
```

**JSON Schema for Buffers**:
```json
{
  "buffers": {
    "morningRoutine": 45,
    "carChange": 15,
    "parking": 10,
    "entry": 10,
    "traffic": 20,
    "contingency": 0
  }
}
```

---

### 2.4 Calendar Integration

#### 2.4.1 Calendar Events Table
**Purpose**: Store calendar event information and synchronization data

**Table Definition**:
```sql
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_event_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    location TEXT,
    attendees JSONB,
    reminders JSONB,
    status VARCHAR(50) DEFAULT 'active',
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID UNIQUE REFERENCES schedule_data(id) ON DELETE CASCADE,
    
    INDEX idx_calendar_events_user_id (user_id),
    INDEX idx_calendar_events_schedule_id (schedule_id),
    INDEX idx_calendar_events_start_time (start_time),
    INDEX idx_calendar_events_sync_status (sync_status)
);
```

**Prisma Schema**:
```prisma
model CalendarEvent {
    id            String   @id @default(cuid())
    calendarEventId String   @map("calendar_event_id")
    title         String
    startTime     DateTime @map("start_time")
    endTime       DateTime @map("end_time")
    description   String?
    location      String?
    attendees     Json?
    reminders     Json?
    status        String   @default("active")
    syncStatus    String   @default("synced") @map("sync_status")
    lastSyncAt    DateTime? @map("last_sync_at")
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    userId    String       @map("user_id")
    user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
    scheduleId String?      @unique @map("schedule_id")
    schedule  ScheduleData? @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

    @@map("calendar_events")
    @@index([userId])
    @@index([scheduleId])
    @@index([startTime])
    @@index([syncStatus])
}
```

**Status Values**:
- `active`: Event is active and current
- `cancelled`: Event has been cancelled
- `completed`: Event has passed and is marked complete

**Sync Status Values**:
- `synced`: Event is synchronized with calendar
- `pending`: Changes pending synchronization
- `error`: Synchronization failed
- `conflict`: Conflict detected between systems

---

### 2.5 Weather Integration

#### 2.5.1 Weather Data Table
**Purpose**: Store weather forecast and current conditions data

**Table Definition**:
```sql
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_date DATE NOT NULL,
    location TEXT NOT NULL,
    coordinates POINT NOT NULL,
    temperature DECIMAL(5,2),
    description TEXT,
    wind_speed DECIMAL(5,2),
    wind_direction INTEGER,
    precipitation DECIMAL(5,2),
    humidity INTEGER,
    visibility DECIMAL(5,2),
    uv_index INTEGER,
    air_pressure DECIMAL(7,2),
    weather_code INTEGER,
    warnings JSONB,
    shooting_assessment JSONB,
    forecast_data JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID UNIQUE REFERENCES schedule_data(id) ON DELETE CASCADE,
    
    INDEX idx_weather_data_user_id (user_id),
    INDEX idx_weather_data_schedule_id (schedule_id),
    INDEX idx_weather_data_date (forecast_date),
    INDEX idx_weather_data_location (location),
    INDEX idx_weather_data_coordinates (coordinates) USING GIST
);
```

**Prisma Schema**:
```prisma
model WeatherData {
    id               String   @id @default(cuid())
    forecastDate     DateTime @map("forecast_date")
    location         String
    coordinates      Json?    // PostgreSQL Point type not directly supported in Prisma
    temperature      Decimal? @db.Decimal(5, 2)
    description      String?
    windSpeed        Decimal? @db.Decimal(5, 2) @map("wind_speed")
    windDirection    Int?     @map("wind_direction")
    precipitation     Decimal? @db.Decimal(5, 2)
    humidity         Int?
    visibility       Decimal? @db.Decimal(5, 2)
    uvIndex          Int?     @map("uv_index")
    airPressure      Decimal? @db.Decimal(7, 2) @map("air_pressure")
    weatherCode      Int?     @map("weather_code")
    warnings         Json?
    shootingAssessment Json?  @map("shooting_assessment")
    forecastData     Json?    @map("forecast_data")
    fetchedAt        DateTime @default(now()) @map("fetched_at")
    expiresAt        DateTime? @map("expires_at")
    createdAt        DateTime @default(now())
    updatedAt        DateTime @updatedAt

    userId    String       @map("user_id")
    user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
    scheduleId String?      @unique @map("schedule_id")
    schedule  ScheduleData? @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

    @@map("weather_data")
    @@index([userId])
    @@index([scheduleId])
    @@index([forecastDate])
    @@index([location])
}
```

**JSON Schema for Shooting Assessment**:
```json
{
  "shootingAssessment": {
    "suitability": "excellent",
    "recommendations": [
      "Ideal conditions for outdoor shooting",
      "Good lighting expected throughout day"
    ],
    "equipmentConsiderations": [
      "Lens hood recommended for bright conditions",
      "Extra batteries for cold morning temperatures"
    ],
    "safetyConsiderations": [],
    "riskLevel": "low"
  }
}
```

---

### 2.6 Notification System

#### 2.6.1 Notifications Table
**Purpose**: Store notification history and delivery status

**Table Definition**:
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL,
    template VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    delivery_attempts INTEGER DEFAULT 0,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    external_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_status (status),
    INDEX idx_notifications_channel (channel),
    INDEX idx_notifications_created_at (created_at),
    INDEX idx_notifications_scheduled_for (scheduled_for)
);
```

**Prisma Schema**:
```prisma
model Notification {
    id               String   @id @default(cuid())
    channel          String
    template         String
    subject          String
    message          String   @db.Text
    data             Json?
    scheduledFor     DateTime? @map("scheduled_for")
    sentAt           DateTime? @map("sent_at")
    status           String   @default("pending")
    error            String?
    retryCount       Int      @default(0) @map("retry_count")
    deliveryAttempts Int      @default(0) @map("delivery_attempts")
    deliveredAt      DateTime? @map("delivered_at")
    readAt           DateTime? @map("read_at")
    externalId       String?  @map("external_id")
    createdAt        DateTime @default(now())
    updatedAt        DateTime @updatedAt

    userId String @map("user_id")
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@map("notifications")
    @@index([userId])
    @@index([status])
    @@index([channel])
    @@index([createdAt])
    @@index([scheduledFor])
}
```

**Channel Values**:
- `email`: Email notifications
- `sms`: SMS notifications
- `push`: Push notifications
- `in_app`: In-app notifications

**Status Values**:
- `pending`: Waiting to be sent
- `processing`: Currently being sent
- `sent`: Successfully sent
- `delivered`: Confirmed delivery
- `failed`: Failed to send
- `cancelled`: Cancelled before sending

---

### 2.7 Summary and Analytics

#### 2.7.1 Summaries Table
**Purpose**: Store generated summaries and analysis data

**Table Definition**:
```sql
CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(10) DEFAULT 'en',
    content TEXT NOT NULL,
    html_content TEXT NOT NULL,
    timeline JSONB,
    weather_summary TEXT,
    warnings JSONB,
    confidence_score DECIMAL(3,2),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID UNIQUE NOT NULL REFERENCES schedule_data(id) ON DELETE CASCADE,
    
    INDEX idx_summaries_user_id (user_id),
    INDEX idx_summaries_schedule_id (schedule_id),
    INDEX idx_summaries_language (language),
    INDEX idx_summaries_generated_at (generated_at)
);
```

**Prisma Schema**:
```prisma
model Summary {
    id             String   @id @default(cuid())
    language       String   @default("en")
    content        String   @db.Text
    htmlContent    String   @db.Text @map("html_content")
    timeline       Json?
    weatherSummary String?  @map("weather_summary")
    warnings       Json?
    confidenceScore Decimal? @map("confidence_score") @db.Decimal(3, 2)
    generatedAt    DateTime @default(now()) @map("generated_at")
    updatedAt      DateTime @updatedAt

    userId    String       @map("user_id")
    user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
    scheduleId String       @unique @map("schedule_id")
    schedule  ScheduleData @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

    @@map("summaries")
    @@index([userId])
    @@index([scheduleId])
    @@index([language])
    @@index([generatedAt])
}
```

---

## 3. Database Optimization Strategies

### 3.1 Indexing Strategy

#### 3.1.1 Primary Indexes
**Primary Keys**: All tables use UUID primary keys with `gen_random_uuid()`
**Benefits**: Globally unique, no sequence bottlenecks, distributed-friendly

#### 3.1.2 Foreign Key Indexes
**Purpose**: Optimize JOIN operations and relationship queries
**Strategy**: Index all foreign key columns for fast relationship traversal

```sql
-- Example foreign key indexes
CREATE INDEX idx_schedule_data_user_id ON schedule_data(user_id);
CREATE INDEX idx_route_plans_schedule_id ON route_plans(schedule_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
```

#### 3.1.3 Query-Specific Indexes
**Time-Based Queries**: Index frequently queried timestamp columns
```sql
CREATE INDEX idx_schedule_data_shooting_date ON schedule_data(shooting_date);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

**Location-Based Queries**: Use PostgreSQL PostGIS for geospatial queries
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE INDEX idx_weather_data_location ON weather_data USING GIST(coordinates);
```

**Full-Text Search**: Use PostgreSQL full-text search for content search
```sql
CREATE INDEX idx_processed_emails_subject_fts ON processed_emails USING gin(to_tsvector('english', subject));
```

### 3.2 Partitioning Strategy

#### 3.2.1 Time-Based Partitioning
**Tables**: `notifications`, `processed_emails`, `schedule_data`
**Strategy**: Monthly partitioning based on creation date

```sql
-- Example partitioned table
CREATE TABLE notifications_partitioned (
    LIKE notifications INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE notifications_2025_10 PARTITION OF notifications_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

#### 3.2.2 User-Based Partitioning
**Tables**: Large tables with high user-specific query patterns
**Strategy**: Partition by user_id for multi-tenant isolation

### 3.3 Caching Strategy

#### 3.3.1 Application-Level Caching
**Redis Usage**:
- User session data
- Frequently accessed schedule data
- API response caching
- Background job queue storage

**Cache Keys**:
```
user:profile:{user_id} - User profile data
schedule:details:{schedule_id} - Schedule details
route:plan:{schedule_id} - Route plan data
weather:{location}:{date} - Weather data
```

#### 3.3.2 Database Query Caching
**Materialized Views**: For complex analytics queries
```sql
CREATE MATERIALIZED VIEW user_schedule_stats AS
SELECT 
    user_id,
    COUNT(*) as total_schedules,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) as avg_processing_time
FROM schedule_data 
GROUP BY user_id;

-- Refresh schedule
CREATE OR REPLACE FUNCTION refresh_user_schedule_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_schedule_stats;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Data Integrity and Validation

### 4.1 Constraints and Rules

#### 4.1.1 Check Constraints
**Example Constraints**:
```sql
-- Buffer time constraints
ALTER TABLE user_configs 
ADD CONSTRAINT ck_buffer_times 
CHECK (
    buffer_car_change BETWEEN 5 AND 120 AND
    buffer_parking BETWEEN 5 AND 120 AND
    buffer_entry BETWEEN 5 AND 120 AND
    buffer_traffic BETWEEN 5 AND 120 AND
    buffer_morning_routine BETWEEN 5 AND 120
);

-- Schedule date constraints
ALTER TABLE schedule_data
ADD CONSTRAINT ck_schedule_date_future
CHECK (shooting_date >= CURRENT_DATE);

-- Notification status constraints
ALTER TABLE notifications
ADD CONSTRAINT ck_notification_status
CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'cancelled'));
```

#### 4.1.2 Triggers for Data Validation
**Example Triggers**:
```sql
-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cascade status updates
CREATE OR REPLACE FUNCTION update_schedule_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        -- Trigger downstream processes
        PERFORM pg_notify('schedule_confirmed', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_status_change
    BEFORE UPDATE ON schedule_data
    FOR EACH ROW EXECUTE FUNCTION update_schedule_status();
```

### 4.2 Data Encryption

#### 4.2.1 Sensitive Data Encryption
**Fields to Encrypt**:
- User tokens (access_token, refresh_token)
- Phone numbers
- SMS verification codes
- External service credentials

**Encryption Implementation**:
```sql
-- Extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encryption function
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(encrypt(data::bytea, current_setting('app.encryption_key'), 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decryption function
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN convert_from(decrypt(decode(encrypted_data, 'base64'), current_setting('app.encryption_key'), 'aes'), 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Backup and Recovery Strategy

### 5.1 Backup Strategy

#### 5.1.1 Automated Backups
**Daily Full Backups**:
```bash
#!/bin/bash
# Daily backup script
BACKUP_DIR="/backups/postgresql"
DATE=$(date +%Y%m%d)
DB_NAME="stillontime_prod"

# Create backup
pg_dump -h localhost -U postgres -d $DB_NAME \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_DIR/stillontime_$DATE.backup"

# Retention: Keep 30 days
find $BACKUP_DIR -name "stillontime_*.backup" -mtime +30 -delete
```

**Continuous WAL Archiving**:
```sql
-- Enable WAL archiving
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f';
SELECT pg_reload_conf();
```

#### 5.1.2 Point-in-Time Recovery
**WAL Restore Strategy**:
```bash
# Restore to specific point in time
pg_basebackup -h localhost -D /var/lib/postgresql/restore -U postgres -v -P -W
# Then restore WAL files to desired time
```

### 5.2 High Availability

#### 5.2.1 Streaming Replication
**Primary Server Configuration**:
```sql
-- Create replication user
CREATE ROLE replicator WITH REPLICATION LOGIN ENCRYPTED PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE stillontime_prod TO replicator;

-- Configure postgresql.conf
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
synchronous_commit = on
synchronous_standby_names = 'standby1,standby2'
```

**Standby Server Configuration**:
```bash
# Recovery configuration
standby_mode = 'on'
primary_conninfo = 'host=primary-ip port=5432 user=replicator'
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
```

---

## 6. Monitoring and Maintenance

### 6.1 Performance Monitoring

#### 6.1.1 Query Performance
**Slow Query Monitoring**:
```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Query performance analysis
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM schedule_data 
WHERE user_id = $1 AND shooting_date >= $2;
```

#### 6.1.2 Database Statistics
**Performance Metrics Collection**:
```sql
-- Create statistics collection function
CREATE OR REPLACE FUNCTION collect_db_stats()
RETURNS TABLE(
    database_size BIGINT,
    active_connections INTEGER,
    cache_hit_ratio DECIMAL,
    index_usage_stats JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_database_size(current_database()) as database_size,
        count(*) as active_connections,
        round((blks_hit::decimal / (blks_hit + blks_read)) * 100, 2) as cache_hit_ratio,
        json_agg(
            json_build_object(
                'indexname', indexrelname,
                'idx_scan', idx_scan,
                'idx_tup_read', idx_tup_read,
                'idx_tup_fetch', idx_tup_fetch
            )
        ) as index_usage_stats
    FROM pg_stat_activity
    CROSS JOIN pg_stat_user_indexes
    WHERE state = 'active'
    GROUP BY pg_database_size(current_database());
END;
$$ LANGUAGE plpgsql;
```

### 6.2 Maintenance Tasks

#### 6.2.1 Regular Maintenance
**Automated Maintenance Script**:
```bash
#!/bin/bash
# Weekly maintenance script

# Update table statistics
psql -U postgres -d stillontime_prod -c "ANALYZE;"

# Reindex fragmented indexes
psql -U postgres -d stillontime_prod -c "REINDEX DATABASE stillontime_prod;"

# Vacuum analyze large tables
psql -U postgres -d stillontime_prod -c "VACUUM ANALYZE schedule_data;"
psql -U postgres -d stillontime_prod -c "VACUUM ANALYZE notifications;"
psql -U postgres -d stillontime_prod -c "VACUUM ANALYZE processed_emails;"

# Refresh materialized views
psql -U postgres -d stillontime_prod -c "REFRESH MATERIALIZED VIEW CONCURRENTLY user_schedule_stats;"
```

---

## 7. Security Considerations

### 7.1 Access Control

#### 7.1.1 Row-Level Security
**Example RLS Policies**:
```sql
-- Enable RLS on user tables
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Policy for users to only access their own data
CREATE POLICY user_schedules_policy ON schedules
    FOR ALL
    TO application_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- Policy for admins to access all data
CREATE POLICY admin_schedules_policy ON schedules
    FOR ALL
    TO admin_user
    USING (true);
```

#### 7.1.2 Database User Security
**User Roles and Permissions**:
```sql
-- Application user (least privilege)
CREATE ROLE application_user WITH LOGIN ENCRYPTED PASSWORD 'secure_app_password';
GRANT CONNECT ON DATABASE stillontime_prod TO application_user;
GRANT USAGE ON SCHEMA public TO application_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO application_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO application_user;

-- Read-only user for reporting
CREATE ROLE readonly_user WITH LOGIN ENCRYPTED PASSWORD 'secure_readonly_password';
GRANT CONNECT ON DATABASE stillontime_prod TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- Admin user for maintenance
CREATE ROLE admin_user WITH LOGIN ENCRYPTED PASSWORD 'secure_admin_password';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user;
```

---

## 8. Migration and Versioning

### 8.1 Database Migration Strategy

#### 8.1.1 Prisma Migration Workflow
**Migration Commands**:
```bash
# Create new migration
npx prisma migrate dev --name add_weather_alerts

# Deploy to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

**Custom Migration Example**:
```sql
-- Migration: Add weather alerts to schedules
-- File: migrations/003_add_weather_alerts.sql

-- Add new column to schedules table
ALTER TABLE schedule_data 
ADD COLUMN weather_alerts JSONB;

-- Create index for weather alerts
CREATE INDEX idx_schedule_data_weather_alerts ON schedule_data 
USING GIN(weather_alerts);

-- Populate existing data with default empty alerts
UPDATE schedule_data 
SET weather_alerts = '[]'::jsonb 
WHERE weather_alerts IS NULL;

-- Add check constraint
ALTER TABLE schedule_data 
ADD CONSTRAINT ck_weather_alerts_format 
CHECK (jsonb_typeof(weather_alerts) = 'array');
```

#### 8.1.2 Rollback Strategy
**Rollback Planning**:
- All migrations include rollback procedures
- Test rollback procedures in staging environment
- Document rollback steps for each migration
- Maintain database schema version history

**Rollback Example**:
```sql
-- Rollback migration: Remove weather alerts
-- File: migrations/rollback_003_remove_weather_alerts.sql

-- Remove index
DROP INDEX IF EXISTS idx_schedule_data_weather_alerts;

-- Remove check constraint
ALTER TABLE schedule_data 
DROP CONSTRAINT IF EXISTS ck_weather_alerts_format;

-- Remove column
ALTER TABLE schedule_data 
DROP COLUMN IF EXISTS weather_alerts;
```

---

## 9. Testing and Validation

### 9.1 Database Testing Strategy

#### 9.1.1 Unit Testing
**Test Database Setup**:
```javascript
// Jest database setup
const { PrismaClient } = require('@prisma/client');

const testClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
});

beforeAll(async () => {
  // Reset test database
  await testClient.$executeRaw`TRUNCATE TABLE users, schedules, notifications CASCADE`;
});

afterAll(async () => {
  await testClient.$disconnect();
});
```

#### 9.1.2 Integration Testing
**Test Scenarios**:
- User registration and authentication flow
- Email processing pipeline
- Schedule creation and confirmation
- Route planning and optimization
- Calendar synchronization
- Weather data integration
- Notification delivery

**Performance Testing**:
```sql
-- Performance test queries
EXPLAIN (ANALYZE, BUFFERS) 
SELECT s.*, u.name as user_name
FROM schedule_data s
JOIN users u ON s.user_id = u.id
WHERE s.shooting_date BETWEEN '2025-10-01' AND '2025-10-31'
  AND s.status = 'confirmed'
ORDER BY s.shooting_date, s.call_time
LIMIT 50;
```

---

## 10. Conclusion

### 10.1 Summary
This database schema provides a robust foundation for the StillOnTime Film Schedule Automation System with:

- **Scalable Architecture**: Designed for horizontal scaling and high availability
- **Data Integrity**: Comprehensive constraints and validation rules
- **Performance Optimization**: Strategic indexing and caching
- **Security**: Encryption, access control, and audit trails
- **Maintainability**: Clear structure and migration strategy

### 10.2 Next Steps
1. **Implementation**: Set up development database with initial schema
2. **Migration**: Execute migration strategy for existing data
3. **Testing**: Implement comprehensive testing suite
4. **Monitoring**: Set up performance monitoring and alerting
5. **Documentation**: Create operational runbooks and procedures

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-18  
**Next Review**: 2025-11-18  
**Approved By**: SPARC Specification Team
-- Create tables from Prisma schema

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    "googleId" TEXT UNIQUE NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processed_emails (
    id TEXT PRIMARY KEY,
    "messageId" TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    sender TEXT NOT NULL,
    "receivedAt" TIMESTAMP NOT NULL,
    "threadId" TEXT,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "pdfHash" TEXT,
    error TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_data (
    id TEXT PRIMARY KEY,
    "shootingDate" TIMESTAMP NOT NULL,
    "callTime" TEXT NOT NULL,
    location TEXT NOT NULL,
    "baseLocation" TEXT,
    "sceneType" TEXT NOT NULL,
    scenes JSONB,
    "safetyNotes" TEXT,
    equipment JSONB,
    contacts JSONB,
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "emailId" TEXT UNIQUE NOT NULL REFERENCES processed_emails(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS route_plans (
    id TEXT PRIMARY KEY,
    "wakeUpTime" TIMESTAMP NOT NULL,
    "departureTime" TIMESTAMP NOT NULL,
    "arrivalTime" TIMESTAMP NOT NULL,
    "totalTravelMinutes" INTEGER NOT NULL,
    "routeSegments" JSONB NOT NULL,
    buffers JSONB NOT NULL,
    "calculatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "scheduleId" TEXT UNIQUE NOT NULL REFERENCES schedule_data(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weather_data (
    id TEXT PRIMARY KEY,
    "forecastDate" TIMESTAMP NOT NULL,
    temperature DOUBLE PRECISION,
    description TEXT,
    "windSpeed" DOUBLE PRECISION,
    precipitation DOUBLE PRECISION,
    humidity INTEGER,
    warnings JSONB,
    "fetchedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "scheduleId" TEXT UNIQUE NOT NULL REFERENCES schedule_data(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    "calendarEventId" TEXT NOT NULL,
    title TEXT NOT NULL,
    "startTime" TIMESTAMP NOT NULL,
    "endTime" TIMESTAMP NOT NULL,
    description TEXT,
    location TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "scheduleId" TEXT UNIQUE NOT NULL REFERENCES schedule_data(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_configs (
    id TEXT PRIMARY KEY,
    "homeAddress" TEXT NOT NULL,
    "panavisionAddress" TEXT NOT NULL,
    "bufferCarChange" INTEGER NOT NULL DEFAULT 15,
    "bufferParking" INTEGER NOT NULL DEFAULT 10,
    "bufferEntry" INTEGER NOT NULL DEFAULT 10,
    "bufferTraffic" INTEGER NOT NULL DEFAULT 20,
    "bufferMorningRoutine" INTEGER NOT NULL DEFAULT 45,
    "notificationEmail" BOOLEAN NOT NULL DEFAULT TRUE,
    "notificationSMS" BOOLEAN NOT NULL DEFAULT FALSE,
    "notificationPush" BOOLEAN NOT NULL DEFAULT TRUE,
    "smsNumber" TEXT,
    "smsVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "smsVerificationCode" TEXT,
    "smsVerificationExpiry" TIMESTAMP,
    "pushToken" TEXT,
    "pushTokenVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    template TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    "scheduledFor" TIMESTAMP,
    "sentAt" TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    timeline JSONB NOT NULL,
    "weatherSummary" TEXT,
    warnings JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "scheduleId" TEXT UNIQUE NOT NULL REFERENCES schedule_data(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_emails_userId ON processed_emails("userId");
CREATE INDEX IF NOT EXISTS idx_processed_emails_processed ON processed_emails(processed);
CREATE INDEX IF NOT EXISTS idx_schedule_data_userId ON schedule_data("userId");
CREATE INDEX IF NOT EXISTS idx_schedule_data_shootingDate ON schedule_data("shootingDate");
CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

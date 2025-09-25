-- Initialize database for StillOnTime Film Schedule Automation System
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- Create user if it doesn't exist (handled by POSTGRES_USER env var)

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE stillontime_automation TO stillontime_user;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log initialization
SELECT 'StillOnTime database initialized successfully' AS status;
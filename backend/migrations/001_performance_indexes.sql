-- Performance Optimization Database Schema
-- Enhanced indexes for optimal query performance

-- 1. USER TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_google_id ON users("googleId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users("createdAt");

-- 2. PROCESSED_EMAILS TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_user_received ON processed_emails("userId", "receivedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_user_processed_status ON processed_emails("userId", processed, "processingStatus");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_message_id ON processed_emails("messageId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_thread_id ON processed_emails("threadId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_sender ON processed_emails(sender);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_received_at ON processed_emails("receivedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_pdf_hash ON processed_emails("pdfHash");

-- 3. SCHEDULE_DATA TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_user_date ON schedule_data("userId", "shootingDate" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_location_gin ON schedule_data USING gin(location gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_scene_type ON schedule_data("sceneType");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_created_at ON schedule_data("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_shooting_date ON schedule_data("shootingDate" DESC);

-- 4. ROUTE_PLANS TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_user_calculated ON route_plans("userId", "calculatedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_wake_time ON route_plans("wakeUpTime");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_departure_time ON route_plans("departureTime");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_travel_minutes ON route_plans("totalTravelMinutes");

-- 5. WEATHER_DATA TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_user_forecast ON weather_data("userId", "forecastDate" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_fetched_at ON weather_data("fetchedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_forecast_date ON weather_data("forecastDate" DESC);

-- 6. CALENDAR_EVENTS TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_user_time ON calendar_events("userId", "startTime" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_event_id ON calendar_events("calendarEventId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_start_time ON calendar_events("startTime" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_location_gin ON calendar_events USING gin(location gin_trgm_ops);

-- 7. NOTIFICATIONS TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status_scheduled ON notifications("userId", status, "scheduledFor");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_scheduled_for ON notifications("scheduledFor") WHERE status = 'pending';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_channel_status ON notifications(channel, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_retry_count ON notifications("retryCount") WHERE status = 'failed';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at ON notifications("createdAt" DESC);

-- 8. SUMMARIES TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_user_created ON summaries("userId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_language ON summaries(language);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_created_at ON summaries("createdAt" DESC);

-- 9. USER_CONFIGS TABLE OPTIMIZATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_configs_sms_verified ON user_configs("smsVerified") WHERE "smsVerified" = TRUE;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_configs_push_verified ON user_configs("pushTokenVerified") WHERE "pushTokenVerified" = TRUE;

-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS

-- Email processing queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_user_processing
ON processed_emails("userId", "processingStatus", "receivedAt" DESC)
WHERE processed = FALSE;

-- Schedule and route queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_route_user_date
ON schedule_data("userId", "shootingDate" DESC, "createdAt" DESC);

-- Dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_activity
ON processed_emails("userId", "createdAt" DESC, "processingStatus");

-- Notification queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_notifications
ON notifications("scheduledFor", "userId")
WHERE status = 'pending' AND "scheduledFor" > NOW();

-- PARTIAL INDEXES FOR PERFORMANCE

-- Unprocessed emails only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unprocessed_emails
ON processed_emails("userId", "receivedAt" DESC)
WHERE processed = FALSE;

-- Recent schedules only (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_schedules
ON schedule_data("userId", "shootingDate" DESC)
WHERE "shootingDate" >= NOW() - INTERVAL '30 days';

-- Active notifications only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_notifications
ON notifications("userId", "scheduledFor")
WHERE status IN ('pending', 'retrying');

-- JSONB indexes for structured data queries

-- Scenes array queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_scenes_gin ON schedule_data USING gin(scenes);

-- Equipment JSONB queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_equipment_gin ON schedule_data USING gin(equipment);

-- Contacts JSONB queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_contacts_gin ON schedule_data USING gin(contacts);

-- Route segments JSONB queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_segments_gin ON route_plans USING gin("routeSegments");

-- Weather warnings JSONB queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_warnings_gin ON weather_data USING gin(warnings);

-- Timeline JSONB queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summary_timeline_gin ON summaries USING gin(timeline);

-- Summary warnings JSONB queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summary_warnings_gin ON summaries USING gin(warnings);

-- PERFORMANCE MONITORING QUERIES

-- Create a materialized view for dashboard statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_dashboard_stats AS
SELECT
    u.id as "userId",
    u.email,
    COUNT(DISTINCT pe.id) as "totalEmails",
    COUNT(DISTINCT CASE WHEN pe.processed = TRUE THEN pe.id END) as "processedEmails",
    COUNT(DISTINCT sd.id) as "totalSchedules",
    COUNT(DISTINCT CASE WHEN sd."shootingDate" >= CURRENT_DATE THEN sd.id END) as "upcomingSchedules",
    MAX(pe."receivedAt") as "lastEmailReceived",
    MAX(sd."createdAt") as "lastScheduleCreated"
FROM users u
LEFT JOIN processed_emails pe ON u.id = pe."userId"
LEFT JOIN schedule_data sd ON u.id = sd."userId"
GROUP BY u.id, u.email;

-- Create index for materialized view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_stats_user_id ON user_dashboard_stats("userId");

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stats refresh (optional)
-- Note: This is commented out as automatic refresh might impact performance
-- Consider running this refresh periodically via cron instead
/*
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_stats()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
*/

-- PERFORMANCE ANALYSIS QUERIES

-- Query to identify slow indexes (run periodically)
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE(
    schemaname name,
    tablename name,
    indexname name,
    idx_scan bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint,
    usage_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pg_stat_user_indexes.schemaname,
        pg_stat_user_indexes.relname::name as tablename,
        pg_stat_user_indexes.indexrelname::name as indexname,
        pg_stat_user_indexes.idx_scan,
        pg_stat_user_indexes.idx_tup_read,
        pg_stat_user_indexes.idx_tup_fetch,
        CASE
            WHEN pg_stat_user_indexes.idx_scan = 0 THEN 0.0
            ELSE (pg_stat_user_indexes.idx_tup_read::float / pg_stat_user_indexes.idx_scan::float)
        END as usage_score
    FROM pg_stat_user_indexes
    ORDER BY pg_stat_user_indexes.idx_scan ASC;
END;
$$ LANGUAGE plpgsql;

-- Query to identify table sizes and growth
CREATE OR REPLACE FUNCTION analyze_table_sizes()
RETURNS TABLE(
    tablename name,
    total_size text,
    index_size text,
    table_size text,
    row_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname||'.'||tablename as tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        n_tup_ins - n_tup_del as row_count
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable pg_stat_statements for query performance monitoring if not already enabled
-- This should be added to postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query to find slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(min_exec_time float DEFAULT 1000.0)
RETURNS TABLE(
    query text,
    exec_time float,
    calls bigint,
    total_exec_time float
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pg_stat_statements.query,
        pg_stat_statements.mean_exec_time,
        pg_stat_statements.calls,
        pg_stat_statements.total_exec_time
    FROM pg_stat_statements
    WHERE pg_stat_statements.mean_exec_time > min_exec_time
    ORDER BY pg_stat_statements.mean_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;
-- Performance Indexes for StillOnTime Application
-- Created: 2024-01-15
-- Purpose: Optimize query performance for high-traffic tables

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Processed emails indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_user_id ON processed_emails(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_message_id ON processed_emails(message_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_user_status ON processed_emails(user_id, processing_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_received_at ON processed_emails(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_user_date ON processed_emails(user_id, received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_pdf_hash ON processed_emails(pdf_hash) WHERE pdf_hash IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_thread_id ON processed_emails(thread_id) WHERE thread_id IS NOT NULL;

-- Schedule data indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_data_user_id ON schedule_data(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_data_email_id ON schedule_data(email_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_data_shooting_date ON schedule_data(shooting_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_data_user_date ON schedule_data(user_id, shooting_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_data_location ON schedule_data USING gin(to_tsvector('english', location));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_data_scene_type ON schedule_data(scene_type);

-- Route plans indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_user_id ON route_plans(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_schedule_id ON route_plans(schedule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_departure_time ON route_plans(departure_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_plans_user_date ON route_plans(user_id, calculated_at DESC);

-- Weather data indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_data_user_id ON weather_data(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_data_schedule_id ON weather_data(schedule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_data_forecast_date ON weather_data(forecast_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_data_fetched_at ON weather_data(fetched_at DESC);

-- Calendar events indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_schedule_id ON calendar_events(schedule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_calendar_event_id ON calendar_events(calendar_event_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_user_time ON calendar_events(user_id, start_time DESC);

-- User config indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id) WHERE user_id IS NOT NULL;

-- Notifications indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Summaries indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_user_id ON summaries(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_schedule_id ON summaries(schedule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_language ON summaries(language);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_created_at ON summaries(created_at DESC);

-- Composite indexes for complex queries

-- For user dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_dashboard ON schedule_data(user_id, shooting_date DESC, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_dashboard ON processed_emails(user_id, received_at DESC, processing_status);

-- For API filtering and sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_filters ON schedule_data(user_id, scene_type, shooting_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_filters ON notifications(user_id, status, channel, scheduled_for DESC);

-- For analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_dates ON schedule_data(shooting_date, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_users ON processed_emails(user_id, received_at, processing_status);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_search ON schedule_data USING gin(
  to_tsvector('english',
    COALESCE(location, '') || ' ' ||
    COALESCE(notes, '') || ' ' ||
    COALESCE(safety_notes, '')
  )
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_subject_search ON processed_emails USING gin(
  to_tsvector('english', subject)
);

-- Partitioning for large tables (optional - uncomment if needed)
/*
-- Partition processed_emails by date
CREATE TABLE processed_emails_partitioned (
  LIKE processed_emails INCLUDING ALL
) PARTITION BY RANGE (received_at);

CREATE TABLE processed_emails_2024_01 PARTITION OF processed_emails_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE processed_emails_2024_02 PARTITION OF processed_emails_partitioned
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
*/

-- Create partial indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_emails ON processed_emails(user_id, created_at)
WHERE processing_status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failed_emails ON processed_emails(user_id, created_at)
WHERE processing_status = 'failed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_schedules ON schedule_data(user_id, shooting_date)
WHERE shooting_date >= CURRENT_DATE;

-- Create covering indexes for frequently accessed columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_covering ON schedule_data(user_id, shooting_date)
INCLUDE (id, call_time, location, scene_type, created_at);

-- Update table statistics
ANALYZE processed_emails;
ANALYZE schedule_data;
ANALYZE route_plans;
ANALYZE weather_data;
ANALYZE calendar_events;
ANALYZE notifications;
ANALYZE summaries;

-- Create index usage monitoring view
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Create missing indexes view (for monitoring)
CREATE OR REPLACE VIEW missing_indexes AS
SELECT
  schemaname,
  tablename,
  attnames,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename IN (
    'processed_emails',
    'schedule_data',
    'route_plans',
    'weather_data',
    'calendar_events',
    'notifications',
    'summaries'
  )
ORDER BY tablename, attnames;

-- Grant necessary permissions (adjust as needed)
-- GRANT SELECT ON index_usage_stats TO readonly_user;
-- GRANT SELECT ON missing_indexes TO readonly_user;

COMMIT;
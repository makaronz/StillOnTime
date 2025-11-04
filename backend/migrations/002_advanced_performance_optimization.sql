-- Additional Database Performance Optimizations
-- Advanced indexes and query optimizations for StillOnTime

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. PARTITIONING FOR LARGE TABLES
-- Partition processed_emails by date for better query performance
-- Note: This requires table recreation, implement during maintenance window

/*
-- Create partitioned table (uncomment during implementation)
CREATE TABLE processed_emails_partitioned (
    LIKE processed_emails INCLUDING ALL
) PARTITION BY RANGE ("receivedAt");

-- Create monthly partitions
CREATE TABLE processed_emails_2024_01 PARTITION OF processed_emails_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE processed_emails_2024_02 PARTITION OF processed_emails_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more partitions as needed
*/

-- 2. ADVANCED INDEXES FOR COMPLEX QUERIES

-- Full-text search indexes for email content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_subject_gin 
ON processed_emails USING gin(to_tsvector('english', subject));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_content_gin 
ON processed_emails USING gin(to_tsvector('english', content));

-- BRIN indexes for time-series data (very large tables)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_emails_received_at_brin 
ON processed_emails USING brin("receivedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_data_shooting_date_brin 
ON schedule_data USING brin("shootingDate");

-- Composite indexes for specific dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_user_emails_stats 
ON processed_emails("userId", processed, "processingStatus", "receivedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_schedule_location_date 
ON schedule_data("userId", location, "shootingDate" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_pending_time 
ON notifications("scheduledFor" DESC, "userId") WHERE status = 'pending';

-- 3. PARTIAL INDEXES FOR SPECIFIC USE CASES

-- Index for unprocessed emails from last 7 days
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_unprocessed_emails 
ON processed_emails("userId", "receivedAt" DESC) 
WHERE processed = FALSE AND "receivedAt" >= NOW() - INTERVAL '7 days';

-- Index for active schedules (upcoming)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_schedules 
ON schedule_data("userId", "shootingDate" ASC, "createdAt" DESC)
WHERE "shootingDate" >= CURRENT_DATE;

-- Index for failed notifications that need retry
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failed_notifications_retry 
ON notifications("userId", "retryCount", "scheduledFor") 
WHERE status = 'failed' AND "retryCount" < 3;

-- 4. JSONB OPTIMIZATIONS

-- Optimized JSONB indexes with expression indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_scenes_count 
ON schedule_data ((jsonb_array_length(scenes)));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_equipment_count 
ON schedule_data ((jsonb_array_length(equipment)));

-- GIN indexes for JSONB array containment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_equipment_gin_containment 
ON schedule_data USING gin(equipment);

-- Expression indexes for commonly accessed JSON fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_call_time 
ON schedule_data (((schedule->>'callTime')::time));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_wrap_time 
ON schedule_data (((schedule->>'wrapTime')::time));

-- 5. QUERY PERFORMANCE OPTIMIZATION

-- Create optimized views for common dashboard queries
CREATE OR REPLACE VIEW user_email_summary AS
SELECT 
    u.id as "userId",
    u.email,
    COUNT(pe.id) as "totalEmails",
    COUNT(CASE WHEN pe.processed = TRUE THEN 1 END) as "processedEmails",
    COUNT(CASE WHEN pe.processed = FALSE THEN 1 END) as "unprocessedEmails",
    MAX(pe."receivedAt") as "lastEmailReceived",
    COUNT(CASE WHEN pe."receivedAt" >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as "emailsLast7Days",
    COUNT(CASE WHEN pe."receivedAt" >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as "emailsLast30Days"
FROM users u
LEFT JOIN processed_emails pe ON u.id = pe."userId"
GROUP BY u.id, u.email;

CREATE OR REPLACE VIEW user_schedule_summary AS
SELECT 
    u.id as "userId",
    u.email,
    COUNT(sd.id) as "totalSchedules",
    COUNT(CASE WHEN sd."shootingDate" >= CURRENT_DATE THEN 1 END) as "upcomingSchedules",
    COUNT(CASE WHEN sd."shootingDate" >= CURRENT_DATE AND sd."shootingDate" <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as "schedulesNext7Days",
    MIN(sd."shootingDate") as "nextShootingDate",
    MAX(sd."createdAt") as "lastScheduleCreated"
FROM users u
LEFT JOIN schedule_data sd ON u.id = sd."userId"
GROUP BY u.id, u.email;

CREATE OR REPLACE VIEW notification_performance_summary AS
SELECT 
    u.id as "userId",
    u.email,
    COUNT(n.id) as "totalNotifications",
    COUNT(CASE WHEN n.status = 'sent' THEN 1 END) as "sentNotifications",
    COUNT(CASE WHEN n.status = 'failed' THEN 1 END) as "failedNotifications",
    COUNT(CASE WHEN n.status = 'pending' THEN 1 END) as "pendingNotifications",
    ROUND((COUNT(CASE WHEN n.status = 'sent' THEN 1 END) * 100.0 / NULLIF(COUNT(n.id), 0)), 2) as "successRate",
    MAX(n."scheduledFor") as "lastScheduledNotification"
FROM users u
LEFT JOIN notifications n ON u.id = n."userId"
GROUP BY u.id, u.email;

-- 6. PERFORMANCE MONITORING FUNCTIONS

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_slow_queries(
    min_duration_ms INTEGER DEFAULT 1000,
    limit_count INTEGER DEFAULT 20
) RETURNS TABLE(
    query text,
    calls bigint,
    total_time double precision,
    mean_time double precision,
    rows double precision,
    cache_hit_ratio double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_stat_statements.query,
        pg_stat_statements.calls,
        pg_stat_statements.total_exec_time,
        pg_stat_statements.mean_exec_time,
        pg_stat_statements.rows,
        CASE 
            WHEN pg_stat_statements.calls > 0 
            THEN (pg_stat_statements.shared_blks_hit::float / 
                  (pg_stat_statements.shared_blks_hit + pg_stat_statements.shared_blks_read))::float 
            ELSE 0 
        END as cache_hit_ratio
    FROM pg_stat_statements
    WHERE pg_stat_statements.mean_exec_time > min_duration_ms
    ORDER BY pg_stat_statements.mean_exec_time DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get table bloat analysis
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE(
    schemaname name,
    tablename name,
    bloat_size text,
    bloat_percent double precision,
    recommendation text
) AS $$
BEGIN
    RETURN QUERY
    WITH table_stats AS (
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
            pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
            (SELECT SUM(pg_stat_get_dead_tuple_count(c.oid)) 
             FROM pg_class c 
             WHERE c.relname = pg_stat_user_tables.tablename) as dead_tuples
        FROM pg_stat_user_tables
    ),
    bloat_analysis AS (
        SELECT 
            ts.schemaname,
            ts.tablename,
            ts.total_size,
            CASE 
                WHEN ts.dead_tuples > 1000 THEN pg_size_pretty(ts.dead_tuples * 8192)
                ELSE 'Minimal'
            END as bloat_size,
            CASE 
                WHEN ts.total_bytes > 0 THEN (ts.dead_tuples * 8192.0 / ts.total_bytes * 100)
                ELSE 0 
            END as bloat_percent
        FROM table_stats ts
    )
    SELECT 
        ba.schemaname,
        ba.tablename,
        ba.bloat_size,
        ba.bloat_percent,
        CASE 
            WHEN ba.bloat_percent > 20 THEN 'VACUUM ANALYZE recommended'
            WHEN ba.bloat_percent > 10 THEN 'Consider VACUUM'
            ELSE 'No action needed'
        END as recommendation
    FROM bloat_analysis ba
    WHERE ba.bloat_percent > 5
    ORDER BY ba.bloat_percent DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest missing indexes
CREATE OR REPLACE FUNCTION suggest_missing_indexes()
RETURNS TABLE(
    tablename text,
    column_names text,
    query_count bigint,
    potential_improvement text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as tablename,
        attname as column_names,
        seq_scan as query_count,
        CASE 
            WHEN seq_scan > 1000 THEN 'High priority index candidate'
            WHEN seq_scan > 100 THEN 'Medium priority index candidate'
            ELSE 'Low priority index candidate'
        END as potential_improvement
    FROM pg_stat_user_tables
    JOIN pg_attribute ON pg_stat_user_tables.relid = pg_attribute.attrelid
    WHERE seq_scan > 50 
    AND pg_attribute.attnum > 0
    AND NOT EXISTS (
        SELECT 1 FROM pg_index 
        WHERE pg_index.indrelid = pg_stat_user_tables.relid 
        AND pg_attribute.attnum = ANY(pg_index.indkey)
    )
    ORDER BY seq_scan DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- 7. AUTOMATIC MAINTENANCE FUNCTIONS

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data(
    days_to_keep INTEGER DEFAULT 365
) RETURNS TABLE(
    table_name text,
    rows_deleted bigint,
    space_reclaimed text
) AS $$
BEGIN
    RETURN QUERY
    WITH cleanup_results AS (
        -- Clean old processed emails
        INSERT INTO processed_emails_archive
        SELECT * FROM processed_emails 
        WHERE "receivedAt" < NOW() - INTERVAL '1 year'
        RETURNING 'processed_emails' as table_name, 1 as dummy
    )
    SELECT 
        cr.table_name,
        COUNT(*) as rows_deleted,
        pg_size_pretty(SUM(pg_total_relation_size('processed_emails'))) as space_reclaimed
    FROM cleanup_results cr
    GROUP BY cr.table_name;
    
    -- Note: This is a simplified example. Implement actual archiving tables
    -- and retention policies based on your business requirements.
END;
$$ LANGUAGE plpgsql;

-- Create a function to update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    -- Update statistics for all tables
    ANALYZE processed_emails;
    ANALYZE schedule_data;
    ANALYZE route_plans;
    ANALYZE weather_data;
    ANALYZE calendar_events;
    ANALYZE notifications;
    ANALYZE summaries;
    ANALYZE user_configs;
    
    -- Refresh materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats;
    
    RAISE NOTICE 'Table statistics updated successfully';
END;
$$ LANGUAGE plpgsql;

-- 8. PERFORMANCE CONFIGURATION RECOMMENDATIONS

-- Create a function to check performance settings
CREATE OR REPLACE FUNCTION check_performance_settings()
RETURNS TABLE(
    setting_name text,
    current_value text,
    recommended_value text,
    impact_level text
) AS $$
BEGIN
    RETURN QUERY
    -- Check important performance settings
    SELECT 
        'shared_buffers' as setting_name,
        current_setting('shared_buffers') as current_value,
        CASE 
            WHEN (current_setting('shared_buffers')::integer) < 256 THEN '256MB'
            WHEN (current_setting('shared_buffers')::integer) < 512 THEN '512MB' 
            ELSE '1GB or 25% of RAM'
        END as recommended_value,
        'High' as impact_level
    
    UNION ALL
    
    SELECT 
        'effective_cache_size' as setting_name,
        current_setting('effective_cache_size') as current_value,
        '75% of total RAM' as recommended_value,
        'High' as impact_level
        
    UNION ALL
    
    SELECT 
        'work_mem' as setting_name,
        current_setting('work_mem') as current_value,
        '4MB - 16MB' as recommended_value,
        'Medium' as impact_level
        
    UNION ALL
    
    SELECT 
        'maintenance_work_mem' as setting_name,
        current_setting('maintenance_work_mem') as current_value,
        '64MB - 256MB' as recommended_value,
        'Medium' as impact_level;
        
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions for performance monitoring
GRANT SELECT ON pg_stat_activity TO CURRENT_USER;
GRANT SELECT ON pg_stat_statements TO CURRENT_USER;

-- Create scheduled cleanup job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * 0', 'SELECT cleanup_old_data(365);');
-- SELECT cron.schedule('update-statistics', '0 3 * * *', 'SELECT update_table_statistics();');

-- Performance optimization complete
DO $$
BEGIN
    RAISE NOTICE 'Performance optimization queries executed successfully';
    RAISE NOTICE 'Consider running VACUUM ANALYZE on large tables';
    RAISE NOTICE 'Monitor query performance using analyze_slow_queries()';
    RAISE NOTICE 'Check for table bloat using analyze_table_bloat()';
END $$;

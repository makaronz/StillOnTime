#!/bin/bash

# StillOnTime Backup Health Check
# Validates backup system health and readiness

set -euo pipefail

# Configuration
HEALTH_LOG="/backups/logs/health-check.log"
MAX_LOG_SIZE=10485760  # 10MB

# Health check criteria
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-48}"
MIN_BACKUP_SIZE_MB="${MIN_BACKUP_SIZE_MB:-1}"
REQUIRED_FREE_SPACE_GB="${REQUIRED_FREE_SPACE_GB:-5}"

# Logging with size management
log() {
    # Rotate log if too large
    if [[ -f "$HEALTH_LOG" && $(stat -c%s "$HEALTH_LOG" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]]; then
        mv "$HEALTH_LOG" "$HEALTH_LOG.old" 2>/dev/null || true
    fi
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') [HEALTH] $1" >> "$HEALTH_LOG"
}

error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$HEALTH_LOG"
    echo "ERROR: $1" >&2
}

# Check if backup directories exist and are writable
check_directories() {
    local issues=0
    
    local required_dirs=(
        "/backups/postgres"
        "/backups/files" 
        "/backups/redis"
        "/backups/logs"
        "/backups/reports"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            error "Required directory missing: $dir"
            issues=$((issues + 1))
        elif [[ ! -w "$dir" ]]; then
            error "Directory not writable: $dir"
            issues=$((issues + 1))
        fi
    done
    
    return $issues
}

# Check free disk space
check_disk_space() {
    local backup_dir="/backups"
    local available_gb
    
    # Get available space in GB
    available_gb=$(df "$backup_dir" | awk 'NR==2 {printf "%.1f", $4/1024/1024}')
    
    if (( $(echo "$available_gb < $REQUIRED_FREE_SPACE_GB" | bc -l 2>/dev/null || echo 1) )); then
        error "Insufficient disk space: ${available_gb}GB available, ${REQUIRED_FREE_SPACE_GB}GB required"
        return 1
    fi
    
    log "Disk space check passed: ${available_gb}GB available"
    return 0
}

# Check recent backup existence and validity
check_recent_backups() {
    local issues=0
    local cutoff_time=$(($(date +%s) - MAX_BACKUP_AGE_HOURS * 3600))
    
    # Check PostgreSQL backups
    local latest_db_backup=$(find /backups/postgres -name "postgres-*.sql.gz" -o -name "postgres-*.custom" 2>/dev/null | \
                            sed 's/.*postgres-\([0-9_]*\)\..*/\1/' | \
                            sort -r | head -1)
    
    if [[ -n "$latest_db_backup" ]]; then
        local backup_timestamp=$(echo "$latest_db_backup" | sed 's/_/ /')
        local backup_time=$(date -d "$backup_timestamp" +%s 2>/dev/null || echo 0)
        
        if [[ $backup_time -lt $cutoff_time ]]; then
            error "Database backup too old: $latest_db_backup"
            issues=$((issues + 1))
        else
            # Check backup file size
            local backup_file="/backups/postgres/postgres-${latest_db_backup}.sql.gz"
            if [[ -f "$backup_file" ]]; then
                local backup_size_mb=$(stat -c%s "$backup_file" 2>/dev/null | awk '{printf "%.1f", $1/1024/1024}')
                
                if (( $(echo "$backup_size_mb < $MIN_BACKUP_SIZE_MB" | bc -l 2>/dev/null || echo 1) )); then
                    error "Database backup too small: ${backup_size_mb}MB"
                    issues=$((issues + 1))
                else
                    log "Database backup check passed: $latest_db_backup (${backup_size_mb}MB)"
                fi
            fi
        fi
    else
        error "No database backups found"
        issues=$((issues + 1))
    fi
    
    # Check file backups
    local latest_file_backup=$(find /backups/files -name "files-*.tar.gz" 2>/dev/null | \
                              sed 's/.*files-\([0-9_]*\)\.tar\.gz/\1/' | \
                              sort -r | head -1)
    
    if [[ -n "$latest_file_backup" ]]; then
        local backup_timestamp=$(echo "$latest_file_backup" | sed 's/_/ /')
        local backup_time=$(date -d "$backup_timestamp" +%s 2>/dev/null || echo 0)
        
        if [[ $backup_time -lt $cutoff_time ]]; then
            log "Warning: File backup older than ${MAX_BACKUP_AGE_HOURS}h: $latest_file_backup"
        else
            log "File backup check passed: $latest_file_backup"
        fi
    else
        log "Warning: No file backups found (non-critical)"
    fi
    
    return $issues
}

# Check database connectivity
check_database_connectivity() {
    local postgres_host="${POSTGRES_HOST:-postgres}"
    local postgres_port="${POSTGRES_PORT:-5432}"
    local postgres_user="${POSTGRES_USER:-postgres}"
    local postgres_db="${POSTGRES_DB:-stillontime}"
    
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h "$postgres_host" -p "$postgres_port" -U "$postgres_user" -d "$postgres_db" >/dev/null 2>&1; then
            log "Database connectivity check passed"
            return 0
        else
            error "Cannot connect to PostgreSQL database"
            return 1
        fi
    else
        log "Warning: pg_isready not available, skipping database connectivity check"
        return 0
    fi
}

# Check S3 connectivity (if configured)
check_s3_connectivity() {
    local s3_bucket="${S3_BUCKET:-}"
    
    if [[ -z "$s3_bucket" ]]; then
        log "S3 not configured, skipping S3 connectivity check"
        return 0
    fi
    
    if command -v aws >/dev/null 2>&1; then
        if aws s3 ls "s3://$s3_bucket/" >/dev/null 2>&1; then
            log "S3 connectivity check passed"
            return 0
        else
            error "Cannot access S3 bucket: $s3_bucket"
            return 1
        fi
    else
        error "AWS CLI not available but S3 backup is configured"
        return 1
    fi
}

# Check backup process status
check_backup_process() {
    local issues=0
    
    # Check if backup scheduler is running
    if [[ -f "/tmp/backup-scheduler.pid" ]]; then
        local scheduler_pid=$(cat "/tmp/backup-scheduler.pid")
        
        if kill -0 "$scheduler_pid" 2>/dev/null; then
            log "Backup scheduler running (PID: $scheduler_pid)"
        else
            error "Backup scheduler PID file exists but process not running"
            issues=$((issues + 1))
        fi
    else
        log "Warning: Backup scheduler PID file not found"
    fi
    
    # Check for stuck backup processes
    local backup_processes=$(pgrep -f "run-backup.sh" | wc -l)
    
    if [[ $backup_processes -gt 1 ]]; then
        error "Multiple backup processes detected (possible stuck process)"
        issues=$((issues + 1))
    elif [[ $backup_processes -eq 1 ]]; then
        log "Backup process currently running"
    fi
    
    return $issues
}

# Check backup integrity
check_backup_integrity() {
    local issues=0
    
    # Find most recent backup
    local latest_backup=$(find /backups -name "*-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]*" -type f 2>/dev/null | \
                         sort | tail -1)
    
    if [[ -n "$latest_backup" ]]; then
        local filename=$(basename "$latest_backup")
        
        # Check compressed files
        if [[ "$filename" == *.gz ]]; then
            if ! gzip -t "$latest_backup" 2>/dev/null; then
                error "Backup file corruption detected: $filename"
                issues=$((issues + 1))
            else
                log "Backup integrity check passed: $filename"
            fi
        elif [[ "$filename" == *.tar.gz ]]; then
            if ! tar -tzf "$latest_backup" >/dev/null 2>&1; then
                error "Backup archive corruption detected: $filename"
                issues=$((issues + 1))
            else
                log "Backup archive integrity check passed: $filename"
            fi
        fi
    fi
    
    return $issues
}

# Check system resources
check_system_resources() {
    local issues=0
    
    # Check memory usage
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [[ $memory_usage -gt 90 ]]; then
        error "High memory usage: ${memory_usage}%"
        issues=$((issues + 1))
    else
        log "Memory usage check passed: ${memory_usage}%"
    fi
    
    # Check load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    
    if (( $(echo "$load_avg > $cpu_cores * 2" | bc -l 2>/dev/null || echo 0) )); then
        error "High system load: $load_avg (${cpu_cores} cores)"
        issues=$((issues + 1))
    else
        log "System load check passed: $load_avg"
    fi
    
    return $issues
}

# Generate health report
generate_health_report() {
    local status="$1"
    local total_issues="$2"
    
    local report_file="/backups/reports/health-report-$(date +%Y%m%d_%H%M%S).json"
    mkdir -p "/backups/reports"
    
    # System information
    local disk_usage=$(df /backups | awk 'NR==2 {print $5}' | sed 's/%//')
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    # Backup information
    local latest_db_backup=$(find /backups/postgres -name "postgres-*.sql.gz" -o -name "postgres-*.custom" 2>/dev/null | sort | tail -1)
    local db_backup_age=""
    if [[ -n "$latest_db_backup" ]]; then
        db_backup_age=$(stat -c %Y "$latest_db_backup" 2>/dev/null || echo 0)
    fi
    
    # Generate JSON report
    cat > "$report_file" <<EOF
{
    "health_check": {
        "timestamp": "$(date -Iseconds)",
        "status": "$status",
        "total_issues": $total_issues,
        "checks": {
            "directories": "$(check_directories >/dev/null 2>&1 && echo "pass" || echo "fail")",
            "disk_space": "$(check_disk_space >/dev/null 2>&1 && echo "pass" || echo "fail")",
            "recent_backups": "$(check_recent_backups >/dev/null 2>&1 && echo "pass" || echo "fail")",
            "database_connectivity": "$(check_database_connectivity >/dev/null 2>&1 && echo "pass" || echo "fail")",
            "s3_connectivity": "$(check_s3_connectivity >/dev/null 2>&1 && echo "pass" || echo "fail")",
            "backup_process": "$(check_backup_process >/dev/null 2>&1 && echo "pass" || echo "fail")",
            "backup_integrity": "$(check_backup_integrity >/dev/null 2>&1 && echo "pass" || echo "fail")",
            "system_resources": "$(check_system_resources >/dev/null 2>&1 && echo "pass" || echo "fail")"
        },
        "system": {
            "disk_usage_percent": $disk_usage,
            "memory_usage_percent": $memory_usage,
            "load_average": "$load_avg",
            "backup_count": $(find /backups -name "*-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*" -type f 2>/dev/null | wc -l)
        },
        "latest_backup": {
            "database_backup": "$(basename "$latest_db_backup" 2>/dev/null || echo "none")",
            "database_backup_age_seconds": $(($(date +%s) - ${db_backup_age:-0}))
        }
    }
}
EOF
    
    log "Health report generated: $report_file"
}

# Main health check process
main() {
    local total_issues=0
    
    log "Starting backup system health check..."
    
    # Ensure log directory exists
    mkdir -p "/backups/logs"
    
    # Run all health checks
    check_directories || total_issues=$((total_issues + $?))
    check_disk_space || total_issues=$((total_issues + $?))
    check_recent_backups || total_issues=$((total_issues + $?))
    check_database_connectivity || total_issues=$((total_issues + $?))
    check_s3_connectivity || total_issues=$((total_issues + $?))
    check_backup_process || total_issues=$((total_issues + $?))
    check_backup_integrity || total_issues=$((total_issues + $?))
    check_system_resources || total_issues=$((total_issues + $?))
    
    # Determine overall health status
    local health_status
    if [[ $total_issues -eq 0 ]]; then
        health_status="healthy"
        log "Health check completed successfully - no issues found"
    elif [[ $total_issues -le 2 ]]; then
        health_status="warning"
        log "Health check completed with warnings - $total_issues minor issues found"
    else
        health_status="critical"
        error "Health check failed - $total_issues issues found"
    fi
    
    # Generate health report
    generate_health_report "$health_status" "$total_issues"
    
    # Exit with appropriate code
    case "$health_status" in
        "healthy")
            exit 0
            ;;
        "warning")
            exit 1
            ;;
        "critical")
            exit 2
            ;;
    esac
}

# Run main function
main "$@"
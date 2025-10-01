#!/bin/bash

# StillOnTime Comprehensive Backup Script
# Performs full system backup including database, files, and configurations

set -euo pipefail

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
LOG_FILE="$BACKUP_DIR/logs/backup-$TIMESTAMP.log"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
NOTIFICATION_WEBHOOK="${BACKUP_NOTIFICATION_WEBHOOK:-}"

# Database configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-stillontime}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# S3 configuration
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/stillontime}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"

# Ensure log directory exists
mkdir -p "$BACKUP_DIR/logs"

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" | tee -a "$LOG_FILE" >&2
}

success() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" | tee -a "$LOG_FILE"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"status\": \"$status\",
                \"message\": \"$message\",
                \"timestamp\": \"$(date -Iseconds)\",
                \"service\": \"stillontime-backup\"
            }" \
            --max-time 30 || error "Failed to send notification"
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf /tmp/backup-* 2>/dev/null || true
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log "Checking backup prerequisites..."
    
    # Check PostgreSQL connectivity
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
        error "Cannot connect to PostgreSQL database"
        return 1
    fi
    
    # Check S3 credentials if S3 backup is enabled
    if [[ -n "$S3_BUCKET" ]]; then
        if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" ]]; then
            error "S3 backup enabled but AWS credentials not provided"
            return 1
        fi
        
        # Test S3 connectivity
        if ! aws s3 ls "s3://$S3_BUCKET/" >/dev/null 2>&1; then
            error "Cannot access S3 bucket: $S3_BUCKET"
            return 1
        fi
    fi
    
    success "All prerequisites met"
    return 0
}

# Database backup
backup_database() {
    log "Starting PostgreSQL database backup..."
    
    local db_backup_file="$BACKUP_DIR/postgres/postgres-$TIMESTAMP.sql"
    local db_backup_compressed="$db_backup_file.gz"
    
    mkdir -p "$BACKUP_DIR/postgres"
    
    # Create database dump
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-password \
        --format=custom \
        --no-privileges \
        --no-owner \
        --file="$db_backup_file.custom" 2>>"$LOG_FILE"
    
    # Also create SQL dump for easier restore
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-password \
        --no-privileges \
        --no-owner > "$db_backup_file" 2>>"$LOG_FILE"
    
    # Compress SQL dump
    gzip "$db_backup_file"
    
    # Verify backup integrity
    if [[ -f "$db_backup_compressed" && -f "$db_backup_file.custom" ]]; then
        local backup_size=$(du -h "$db_backup_compressed" | cut -f1)
        success "Database backup completed successfully (Size: $backup_size)"
        
        # Store backup metadata
        cat > "$BACKUP_DIR/postgres/postgres-$TIMESTAMP.meta" <<EOF
{
    "timestamp": "$TIMESTAMP",
    "database": "$POSTGRES_DB",
    "host": "$POSTGRES_HOST",
    "backup_size": "$(stat -c%s "$db_backup_compressed")",
    "backup_type": "full",
    "compression": "gzip",
    "format": "sql"
}
EOF
        
        return 0
    else
        error "Database backup failed"
        return 1
    fi
}

# File system backup
backup_files() {
    log "Starting file system backup..."
    
    local files_backup_dir="$BACKUP_DIR/files/$TIMESTAMP"
    mkdir -p "$files_backup_dir"
    
    # Backup application uploads
    if [[ -d "/app/uploads" ]]; then
        log "Backing up application uploads..."
        rsync -av --progress "/app/uploads/" "$files_backup_dir/uploads/" 2>>"$LOG_FILE" || {
            error "Failed to backup uploads"
            return 1
        }
    fi
    
    # Backup configuration files
    if [[ -d "/app/config" ]]; then
        log "Backing up configuration files..."
        rsync -av --progress "/app/config/" "$files_backup_dir/config/" 2>>"$LOG_FILE" || {
            error "Failed to backup config"
            return 1
        }
    fi
    
    # Backup logs (last 7 days)
    if [[ -d "/app/logs" ]]; then
        log "Backing up recent log files..."
        find "/app/logs" -name "*.log" -mtime -7 -exec cp {} "$files_backup_dir/logs/" \; 2>>"$LOG_FILE" || {
            log "Warning: Some log files could not be backed up"
        }
    fi
    
    # Create archive of file backup
    local files_archive="$BACKUP_DIR/files/files-$TIMESTAMP.tar.gz"
    tar -czf "$files_archive" -C "$files_backup_dir" . 2>>"$LOG_FILE" || {
        error "Failed to create file archive"
        return 1
    }
    
    # Clean up temporary directory
    rm -rf "$files_backup_dir"
    
    local archive_size=$(du -h "$files_archive" | cut -f1)
    success "File system backup completed successfully (Size: $archive_size)"
    
    # Store file backup metadata
    cat > "$BACKUP_DIR/files/files-$TIMESTAMP.meta" <<EOF
{
    "timestamp": "$TIMESTAMP",
    "backup_size": "$(stat -c%s "$files_archive")",
    "backup_type": "files",
    "compression": "tar.gz",
    "includes": ["uploads", "config", "logs"]
}
EOF
    
    return 0
}

# Redis backup
backup_redis() {
    log "Starting Redis backup..."
    
    local redis_backup_dir="$BACKUP_DIR/redis"
    mkdir -p "$redis_backup_dir"
    
    # Redis data backup (if Redis is accessible)
    if command -v redis-cli >/dev/null 2>&1; then
        log "Creating Redis data backup..."
        
        # Save Redis snapshot
        redis-cli -h "${REDIS_HOST:-redis}" BGSAVE 2>>"$LOG_FILE" || {
            log "Warning: Could not create Redis background save"
        }
        
        # Wait for background save to complete
        sleep 5
        
        # Copy RDB file if available
        if [[ -f "/data/dump.rdb" ]]; then
            cp "/data/dump.rdb" "$redis_backup_dir/redis-$TIMESTAMP.rdb" 2>>"$LOG_FILE" || {
                log "Warning: Could not copy Redis RDB file"
            }
        fi
    else
        log "Redis CLI not available, skipping Redis backup"
    fi
    
    success "Redis backup completed"
    return 0
}

# Encrypt backup if encryption key is provided
encrypt_backup() {
    local file="$1"
    
    if [[ -n "$ENCRYPTION_KEY" && -f "$file" ]]; then
        log "Encrypting backup file: $(basename "$file")"
        
        gpg --batch --yes --passphrase "$ENCRYPTION_KEY" \
            --symmetric --cipher-algo AES256 \
            --output "$file.gpg" "$file" 2>>"$LOG_FILE" || {
            error "Failed to encrypt backup file"
            return 1
        }
        
        # Remove unencrypted file
        rm "$file"
        log "Backup file encrypted successfully"
    fi
    
    return 0
}

# Upload to S3
upload_to_s3() {
    if [[ -z "$S3_BUCKET" ]]; then
        log "S3 upload disabled, skipping..."
        return 0
    fi
    
    log "Uploading backups to S3 bucket: $S3_BUCKET"
    
    # Upload all backup files
    for backup_type in postgres files redis; do
        local backup_dir="$BACKUP_DIR/$backup_type"
        
        if [[ -d "$backup_dir" ]]; then
            aws s3 sync "$backup_dir" "s3://$S3_BUCKET/$S3_PREFIX/$backup_type/" \
                --exclude "*.tmp" \
                --include "*$TIMESTAMP*" 2>>"$LOG_FILE" || {
                error "Failed to upload $backup_type backups to S3"
                return 1
            }
        fi
    done
    
    # Upload logs
    aws s3 cp "$LOG_FILE" "s3://$S3_BUCKET/$S3_PREFIX/logs/" 2>>"$LOG_FILE" || {
        log "Warning: Failed to upload backup log to S3"
    }
    
    success "All backups uploaded to S3 successfully"
    return 0
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    for backup_type in postgres files redis logs; do
        local backup_dir="$BACKUP_DIR/$backup_type"
        
        if [[ -d "$backup_dir" ]]; then
            find "$backup_dir" -name "*" -type f -mtime +$RETENTION_DAYS -delete 2>>"$LOG_FILE" || {
                log "Warning: Could not clean up old $backup_type backups"
            }
        fi
    done
    
    # S3 cleanup (if enabled)
    if [[ -n "$S3_BUCKET" ]]; then
        log "Cleaning up old S3 backups..."
        
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
        
        # List and delete old backups
        aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --recursive | \
        awk '$1 < "'$cutoff_date'" {print $4}' | \
        while read -r file; do
            if [[ -n "$file" ]]; then
                aws s3 rm "s3://$S3_BUCKET/$file" 2>>"$LOG_FILE" || {
                    log "Warning: Could not delete old S3 backup: $file"
                }
            fi
        done
    fi
    
    success "Old backup cleanup completed"
}

# Generate backup report
generate_report() {
    local status="$1"
    local start_time="$2"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local report_file="$BACKUP_DIR/reports/backup-report-$TIMESTAMP.json"
    mkdir -p "$BACKUP_DIR/reports"
    
    # Calculate total backup size
    local total_size=0
    for backup_type in postgres files redis; do
        local backup_dir="$BACKUP_DIR/$backup_type"
        if [[ -d "$backup_dir" ]]; then
            local size=$(find "$backup_dir" -name "*$TIMESTAMP*" -type f -exec stat -c%s {} \; 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
            total_size=$((total_size + size))
        fi
    done
    
    # Generate JSON report
    cat > "$report_file" <<EOF
{
    "backup_id": "$TIMESTAMP",
    "status": "$status",
    "start_time": "$(date -d @$start_time -Iseconds)",
    "end_time": "$(date -Iseconds)",
    "duration_seconds": $duration,
    "total_size_bytes": $total_size,
    "total_size_human": "$(numfmt --to=iec $total_size)",
    "components": {
        "database": $([ -f "$BACKUP_DIR/postgres/postgres-$TIMESTAMP.sql.gz" ] && echo "true" || echo "false"),
        "files": $([ -f "$BACKUP_DIR/files/files-$TIMESTAMP.tar.gz" ] && echo "true" || echo "false"),
        "redis": $([ -f "$BACKUP_DIR/redis/redis-$TIMESTAMP.rdb" ] && echo "true" || echo "false")
    },
    "s3_upload": $([ -n "$S3_BUCKET" ] && echo "true" || echo "false"),
    "encryption": $([ -n "$ENCRYPTION_KEY" ] && echo "true" || echo "false"),
    "retention_days": $RETENTION_DAYS,
    "log_file": "$LOG_FILE"
}
EOF
    
    log "Backup report generated: $report_file"
    
    # Send notification
    local message="Backup $status for StillOnTime (ID: $TIMESTAMP, Duration: ${duration}s, Size: $(numfmt --to=iec $total_size))"
    send_notification "$status" "$message"
}

# Main backup process
main() {
    local start_time=$(date +%s)
    local backup_status="failed"
    
    log "Starting comprehensive backup process (ID: $TIMESTAMP)"
    
    # Check prerequisites
    if ! check_prerequisites; then
        error "Prerequisites check failed"
        generate_report "failed" "$start_time"
        exit 1
    fi
    
    # Perform backups
    local failed_components=()
    
    # Database backup
    if ! backup_database; then
        failed_components+=("database")
    fi
    
    # File system backup
    if ! backup_files; then
        failed_components+=("files")
    fi
    
    # Redis backup
    if ! backup_redis; then
        failed_components+=("redis")
    fi
    
    # Check if any critical components failed
    if [[ ${#failed_components[@]} -gt 0 ]]; then
        error "Some backup components failed: ${failed_components[*]}"
    fi
    
    # Encrypt backups if encryption is enabled
    if [[ -n "$ENCRYPTION_KEY" ]]; then
        log "Encrypting backup files..."
        
        for file in "$BACKUP_DIR"/postgres/*"$TIMESTAMP"* "$BACKUP_DIR"/files/*"$TIMESTAMP"*; do
            if [[ -f "$file" && "$file" != *.gpg ]]; then
                encrypt_backup "$file"
            fi
        done
    fi
    
    # Upload to S3
    if ! upload_to_s3; then
        error "S3 upload failed"
        failed_components+=("s3_upload")
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Determine final status
    if [[ ${#failed_components[@]} -eq 0 ]]; then
        backup_status="success"
        success "All backup operations completed successfully"
    elif [[ " ${failed_components[*]} " =~ " database " ]]; then
        backup_status="failed"
        error "Critical component (database) backup failed"
    else
        backup_status="partial"
        log "Backup completed with some failures: ${failed_components[*]}"
    fi
    
    # Generate final report
    generate_report "$backup_status" "$start_time"
    
    # Exit with appropriate code
    if [[ "$backup_status" == "success" ]]; then
        exit 0
    elif [[ "$backup_status" == "partial" ]]; then
        exit 2
    else
        exit 1
    fi
}

# Run main function
main "$@"
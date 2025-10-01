#!/bin/bash

# StillOnTime Backup Restoration Script
# Restores system from backup files

set -euo pipefail

# Configuration
RESTORE_TIMESTAMP="${1:-}"
BACKUP_DIR="/backups"
LOG_FILE="$BACKUP_DIR/logs/restore-$(date +%Y%m%d_%H%M%S).log"
DRY_RUN="${DRY_RUN:-false}"
FORCE_RESTORE="${FORCE_RESTORE:-false}"

# Database configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-stillontime}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# S3 configuration
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/stillontime}"

# Encryption
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

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

# Usage information
show_usage() {
    cat <<EOF
Usage: $0 [TIMESTAMP] [OPTIONS]

Restore StillOnTime system from backup.

Arguments:
    TIMESTAMP           Backup timestamp to restore (YYYYMMDD_HHMMSS format)
                       If not provided, will list available backups

Environment Variables:
    DRY_RUN            Set to 'true' to perform dry run (default: false)
    FORCE_RESTORE      Set to 'true' to skip confirmations (default: false)
    S3_BUCKET          S3 bucket for remote backups
    BACKUP_ENCRYPTION_KEY  Encryption key for encrypted backups

Examples:
    $0                          # List available backups
    $0 20240315_020000         # Restore specific backup
    DRY_RUN=true $0 20240315_020000  # Dry run
    FORCE_RESTORE=true $0 20240315_020000  # Force restore

EOF
}

# List available backups
list_backups() {
    log "Available local backups:"
    
    echo "Local Backups:"
    echo "=============="
    
    # List local database backups
    if [[ -d "$BACKUP_DIR/postgres" ]]; then
        echo "Database backups:"
        find "$BACKUP_DIR/postgres" -name "postgres-*.sql.gz" -o -name "postgres-*.custom" | \
        sed 's/.*postgres-\([0-9_]*\)\..*/  \1/' | \
        sort -r | head -10
    fi
    
    # List local file backups
    if [[ -d "$BACKUP_DIR/files" ]]; then
        echo -e "\nFile backups:"
        find "$BACKUP_DIR/files" -name "files-*.tar.gz" | \
        sed 's/.*files-\([0-9_]*\)\.tar\.gz/  \1/' | \
        sort -r | head -10
    fi
    
    # List S3 backups if available
    if [[ -n "$S3_BUCKET" ]]; then
        echo -e "\nS3 Backups (last 10):"
        echo "====================="
        
        aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/postgres/" --recursive | \
        grep "postgres-.*\.sql\.gz" | \
        sed 's/.*postgres-\([0-9_]*\)\.sql\.gz/  \1/' | \
        sort -r | head -10 2>/dev/null || echo "  (Cannot access S3 backups)"
    fi
    
    echo -e "\nUse one of the timestamps above as argument to restore."
}

# Download backup from S3
download_from_s3() {
    local timestamp="$1"
    
    if [[ -z "$S3_BUCKET" ]]; then
        log "S3 not configured, skipping S3 download"
        return 0
    fi
    
    log "Downloading backup $timestamp from S3..."
    
    # Create temporary download directory
    local download_dir="$BACKUP_DIR/temp/s3-download-$timestamp"
    mkdir -p "$download_dir"
    
    # Download database backup
    aws s3 cp "s3://$S3_BUCKET/$S3_PREFIX/postgres/postgres-$timestamp.sql.gz" \
        "$BACKUP_DIR/postgres/" 2>>"$LOG_FILE" || {
        log "Database backup not found in S3 or download failed"
    }
    
    aws s3 cp "s3://$S3_BUCKET/$S3_PREFIX/postgres/postgres-$timestamp.custom" \
        "$BACKUP_DIR/postgres/" 2>>"$LOG_FILE" || {
        log "Custom database backup not found in S3"
    }
    
    # Download file backup
    aws s3 cp "s3://$S3_BUCKET/$S3_PREFIX/files/files-$timestamp.tar.gz" \
        "$BACKUP_DIR/files/" 2>>"$LOG_FILE" || {
        log "File backup not found in S3 or download failed"
    }
    
    # Download Redis backup
    aws s3 cp "s3://$S3_BUCKET/$S3_PREFIX/redis/redis-$timestamp.rdb" \
        "$BACKUP_DIR/redis/" 2>>"$LOG_FILE" || {
        log "Redis backup not found in S3 or download failed"
    }
    
    success "S3 download completed"
    return 0
}

# Decrypt backup file
decrypt_backup() {
    local encrypted_file="$1"
    local decrypted_file="${encrypted_file%.gpg}"
    
    if [[ -z "$ENCRYPTION_KEY" ]]; then
        error "Encrypted backup found but no encryption key provided"
        return 1
    fi
    
    log "Decrypting backup file: $(basename "$encrypted_file")"
    
    gpg --batch --yes --passphrase "$ENCRYPTION_KEY" \
        --decrypt --output "$decrypted_file" "$encrypted_file" 2>>"$LOG_FILE" || {
        error "Failed to decrypt backup file"
        return 1
    }
    
    log "Backup file decrypted successfully"
    return 0
}

# Verify backup integrity
verify_backup() {
    local timestamp="$1"
    
    log "Verifying backup integrity for timestamp: $timestamp"
    
    local errors=()
    
    # Check database backup
    local db_backup="$BACKUP_DIR/postgres/postgres-$timestamp.sql.gz"
    local db_custom="$BACKUP_DIR/postgres/postgres-$timestamp.custom"
    
    if [[ -f "$db_backup.gpg" ]]; then
        decrypt_backup "$db_backup.gpg" || errors+=("database_decrypt")
    fi
    
    if [[ -f "$db_backup" ]]; then
        # Test gzip integrity
        if ! gzip -t "$db_backup" 2>/dev/null; then
            errors+=("database_corrupt")
        fi
    elif [[ -f "$db_custom" ]]; then
        log "Using custom format database backup"
    else
        errors+=("database_missing")
    fi
    
    # Check file backup
    local files_backup="$BACKUP_DIR/files/files-$timestamp.tar.gz"
    
    if [[ -f "$files_backup.gpg" ]]; then
        decrypt_backup "$files_backup.gpg" || errors+=("files_decrypt")
    fi
    
    if [[ -f "$files_backup" ]]; then
        # Test tar integrity
        if ! tar -tzf "$files_backup" >/dev/null 2>&1; then
            errors+=("files_corrupt")
        fi
    else
        log "Warning: File backup not found (non-critical)"
    fi
    
    # Report verification results
    if [[ ${#errors[@]} -eq 0 ]]; then
        success "Backup verification passed"
        return 0
    else
        error "Backup verification failed: ${errors[*]}"
        return 1
    fi
}

# Restore database
restore_database() {
    local timestamp="$1"
    
    log "Starting database restoration..."
    
    local db_backup="$BACKUP_DIR/postgres/postgres-$timestamp.sql.gz"
    local db_custom="$BACKUP_DIR/postgres/postgres-$timestamp.custom"
    
    # Check connectivity
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; then
        error "Cannot connect to PostgreSQL database"
        return 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would restore database from backup"
        return 0
    fi
    
    # Warning about data loss
    if [[ "$FORCE_RESTORE" != "true" ]]; then
        echo "WARNING: This will completely replace the current database!"
        echo "All existing data will be lost. Are you sure you want to continue?"
        read -p "Type 'yes' to confirm: " confirmation
        
        if [[ "$confirmation" != "yes" ]]; then
            error "Database restore cancelled by user"
            return 1
        fi
    fi
    
    # Create backup of current database before restore
    log "Creating backup of current database before restore..."
    local pre_restore_backup="$BACKUP_DIR/postgres/pre-restore-$(date +%Y%m%d_%H%M%S).sql"
    
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --no-password > "$pre_restore_backup" 2>>"$LOG_FILE" || {
        log "Warning: Could not create pre-restore backup"
    }
    
    # Drop existing database
    log "Dropping existing database..."
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d postgres \
        -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" 2>>"$LOG_FILE" || {
        error "Failed to drop existing database"
        return 1
    }
    
    # Create new database
    log "Creating new database..."
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d postgres \
        -c "CREATE DATABASE $POSTGRES_DB;" 2>>"$LOG_FILE" || {
        error "Failed to create new database"
        return 1
    }
    
    # Restore from backup
    if [[ -f "$db_custom" ]]; then
        log "Restoring from custom format backup..."
        PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            --verbose \
            --no-password \
            --no-privileges \
            --no-owner \
            "$db_custom" 2>>"$LOG_FILE" || {
            error "Database restore from custom format failed"
            return 1
        }
    elif [[ -f "$db_backup" ]]; then
        log "Restoring from SQL backup..."
        PGPASSWORD="$POSTGRES_PASSWORD" zcat "$db_backup" | \
        psql -h "$POSTGRES_HOST" \
             -p "$POSTGRES_PORT" \
             -U "$POSTGRES_USER" \
             -d "$POSTGRES_DB" \
             --no-password 2>>"$LOG_FILE" || {
            error "Database restore from SQL backup failed"
            return 1
        }
    else
        error "No database backup file found"
        return 1
    fi
    
    success "Database restoration completed successfully"
    return 0
}

# Restore files
restore_files() {
    local timestamp="$1"
    
    log "Starting file system restoration..."
    
    local files_backup="$BACKUP_DIR/files/files-$timestamp.tar.gz"
    
    if [[ ! -f "$files_backup" ]]; then
        log "File backup not found, skipping file restoration"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would restore files from backup"
        tar -tzf "$files_backup" | head -20
        local total_files=$(tar -tzf "$files_backup" | wc -l)
        log "[DRY RUN] Total files to restore: $total_files"
        return 0
    fi
    
    # Create temporary extraction directory
    local extract_dir="/tmp/restore-files-$timestamp"
    mkdir -p "$extract_dir"
    
    # Extract backup
    log "Extracting file backup..."
    tar -xzf "$files_backup" -C "$extract_dir" 2>>"$LOG_FILE" || {
        error "Failed to extract file backup"
        rm -rf "$extract_dir"
        return 1
    }
    
    # Restore uploads
    if [[ -d "$extract_dir/uploads" ]]; then
        log "Restoring application uploads..."
        mkdir -p "/app/uploads"
        rsync -av "$extract_dir/uploads/" "/app/uploads/" 2>>"$LOG_FILE" || {
            error "Failed to restore uploads"
        }
    fi
    
    # Restore configuration (with caution)
    if [[ -d "$extract_dir/config" && "$FORCE_RESTORE" == "true" ]]; then
        log "Restoring configuration files..."
        mkdir -p "/app/config"
        rsync -av "$extract_dir/config/" "/app/config/" 2>>"$LOG_FILE" || {
            error "Failed to restore config files"
        }
    else
        log "Skipping config restoration (use FORCE_RESTORE=true to enable)"
    fi
    
    # Cleanup
    rm -rf "$extract_dir"
    
    success "File system restoration completed"
    return 0
}

# Restore Redis data
restore_redis() {
    local timestamp="$1"
    
    log "Starting Redis restoration..."
    
    local redis_backup="$BACKUP_DIR/redis/redis-$timestamp.rdb"
    
    if [[ ! -f "$redis_backup" ]]; then
        log "Redis backup not found, skipping Redis restoration"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would restore Redis from backup"
        return 0
    fi
    
    log "Warning: Redis restoration requires Redis service restart"
    
    # Copy RDB file to Redis data directory
    if [[ -d "/data" ]]; then
        log "Copying Redis backup to data directory..."
        cp "$redis_backup" "/data/dump.rdb" 2>>"$LOG_FILE" || {
            error "Failed to copy Redis backup"
            return 1
        }
        
        success "Redis backup copied successfully"
        log "Note: Redis service restart required to load backup data"
    else
        log "Redis data directory not accessible, skipping Redis restore"
    fi
    
    return 0
}

# Post-restore validation
validate_restore() {
    local timestamp="$1"
    
    log "Performing post-restore validation..."
    
    local validation_errors=()
    
    # Validate database
    if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; then
        local table_count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
        
        if [[ "$table_count" -gt 0 ]]; then
            log "Database validation passed ($table_count tables found)"
        else
            validation_errors+=("database_empty")
        fi
    else
        validation_errors+=("database_unreachable")
    fi
    
    # Validate file restoration
    if [[ -d "/app/uploads" ]]; then
        local file_count=$(find "/app/uploads" -type f | wc -l)
        log "File validation: $file_count files in uploads directory"
    fi
    
    # Report validation results
    if [[ ${#validation_errors[@]} -eq 0 ]]; then
        success "Post-restore validation passed"
        return 0
    else
        error "Post-restore validation failed: ${validation_errors[*]}"
        return 1
    fi
}

# Main restore process
main() {
    if [[ -z "$RESTORE_TIMESTAMP" ]]; then
        show_usage
        list_backups
        exit 0
    fi
    
    log "Starting restoration process for backup: $RESTORE_TIMESTAMP"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Download from S3 if needed
    download_from_s3 "$RESTORE_TIMESTAMP"
    
    # Verify backup integrity
    if ! verify_backup "$RESTORE_TIMESTAMP"; then
        error "Backup verification failed, aborting restore"
        exit 1
    fi
    
    # Perform restoration
    local failed_components=()
    
    # Restore database
    if ! restore_database "$RESTORE_TIMESTAMP"; then
        failed_components+=("database")
    fi
    
    # Restore files
    if ! restore_files "$RESTORE_TIMESTAMP"; then
        failed_components+=("files")
    fi
    
    # Restore Redis
    if ! restore_redis "$RESTORE_TIMESTAMP"; then
        failed_components+=("redis")
    fi
    
    # Validate restoration
    if [[ "$DRY_RUN" != "true" ]]; then
        if ! validate_restore "$RESTORE_TIMESTAMP"; then
            failed_components+=("validation")
        fi
    fi
    
    # Final report
    if [[ ${#failed_components[@]} -eq 0 ]]; then
        success "Restoration completed successfully!"
        
        if [[ "$DRY_RUN" != "true" ]]; then
            log "Please restart application services to ensure all changes take effect"
        fi
        
        exit 0
    else
        error "Restoration completed with failures: ${failed_components[*]}"
        exit 1
    fi
}

# Run main function
main "$@"
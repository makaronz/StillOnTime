#!/bin/bash

# StillOnTime Backup Scheduler
# Orchestrates all backup operations on schedule

set -euo pipefail

# Configuration
BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"  # Daily at 2 AM
LOG_FILE="/backups/logs/backup-scheduler.log"
PID_FILE="/tmp/backup-scheduler.pid"

# Logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SCHEDULER] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" | tee -a "$LOG_FILE" >&2
}

# Cleanup function
cleanup() {
    log "Backup scheduler shutting down..."
    if [[ -f "$PID_FILE" ]]; then
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Signal handlers
trap cleanup SIGTERM SIGINT

# Check if another instance is running
if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        error "Backup scheduler already running with PID $OLD_PID"
        exit 1
    else
        log "Removing stale PID file"
        rm -f "$PID_FILE"
    fi
fi

# Create PID file
echo $$ > "$PID_FILE"

log "Starting backup scheduler with schedule: $BACKUP_SCHEDULE"

# Install cron job if running as scheduled service
if [[ "${BACKUP_MODE:-scheduled}" == "scheduled" ]]; then
    log "Setting up cron job for scheduled backups"
    
    # Create crontab entry
    echo "$BACKUP_SCHEDULE /scripts/run-backup.sh" > /tmp/backup-cron
    
    # Install cron job (note: in container environments, this might need adjustment)
    if command -v crontab >/dev/null 2>&1; then
        crontab /tmp/backup-cron
        log "Cron job installed successfully"
    else
        log "Cron not available, running in continuous mode"
        BACKUP_MODE="continuous"
    fi
fi

# Main loop
if [[ "${BACKUP_MODE:-scheduled}" == "continuous" ]]; then
    log "Running in continuous mode - checking every hour"
    
    while true; do
        # Check if it's time for backup (daily at configured hour)
        CURRENT_HOUR=$(date +%H)
        BACKUP_HOUR=$(echo "$BACKUP_SCHEDULE" | awk '{print $2}')
        
        if [[ "$CURRENT_HOUR" == "$BACKUP_HOUR" ]]; then
            log "Backup time reached, starting backup process"
            /scripts/run-backup.sh
            
            # Sleep until next hour to avoid multiple backups
            sleep 3600
        else
            # Check every 10 minutes
            sleep 600
        fi
    done
else
    log "Running in scheduled mode with cron"
    
    # Keep the container running for cron
    while true; do
        sleep 3600
        
        # Health check - ensure backup processes are working
        if ! /scripts/health-check.sh; then
            error "Health check failed"
        fi
    done
fi
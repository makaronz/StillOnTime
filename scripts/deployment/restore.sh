#!/bin/bash

# StillOnTime Restore Script
# Usage: ./restore.sh [backup-file] [namespace] [database]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_FILE=${1:-}
NAMESPACE=${2:-stillontime}
DATABASE=${3:-stillontime}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage information
usage() {
    echo "Usage: $0 [backup-file] [namespace] [database]"
    echo ""
    echo "Arguments:"
    echo "  backup-file  Path to backup file (local or S3 URL)"
    echo "  namespace    Kubernetes namespace (default: stillontime)"
    echo "  database     Database name (default: stillontime)"
    echo ""
    echo "Examples:"
    echo "  $0 backup_20231020.sql stillontime stillontime"
    echo "  $0 s3://stillontime-backups/postgres/backup_20231020.sql.gz"
    echo ""
    echo "Environment variables:"
    echo "  AWS_ACCESS_KEY_ID     AWS access key (for S3 restores)"
    echo "  AWS_SECRET_ACCESS_KEY AWS secret key (for S3 restores)"
    echo "  PGPASSWORD            PostgreSQL password"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check if connected to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Not connected to Kubernetes cluster"
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi

    # Check backup file argument
    if [ -z "$BACKUP_FILE" ]; then
        log_error "Backup file is required"
        usage
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Download backup from S3 if needed
download_backup() {
    if [[ "$BACKUP_FILE" == s3://* ]]; then
        log_info "Downloading backup from S3..."

        # Check if AWS CLI is installed
        if ! command -v aws &> /dev/null; then
            log_error "AWS CLI is not installed"
            exit 1
        fi

        # Check AWS credentials
        if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
            log_error "AWS credentials are required for S3 restores"
            exit 1
        fi

        # Download file
        LOCAL_BACKUP="/tmp/$(basename "$BACKUP_FILE")"
        aws s3 cp "$BACKUP_FILE" "$LOCAL_BACKUP"
        BACKUP_FILE="$LOCAL_BACKUP

        log_success "Backup downloaded from S3"
    else
        # Check if local file exists
        if [ ! -f "$BACKUP_FILE" ]; then
            log_error "Backup file $BACKUP_FILE does not exist"
            exit 1
        fi
    fi
}

# Create restore job
create_restore_job() {
    log_info "Creating restore job..."

    # Extract base filename
    BACKUP_BASENAME=$(basename "$BACKUP_FILE")

    # Create Kubernetes job manifest
    cat > /tmp/restore-job.yaml << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: postgres-restore-$(date +%s)
  namespace: $NAMESPACE
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: postgres-restore
        image: postgres:15-alpine
        command:
        - /bin/bash
        - -c
        - |
          echo "Starting database restore at $(date)"

          # Copy backup file
          cp /backup-source/$BACKUP_BASENAME /backup/

          # Decompress if needed
          if [[ "$BACKUP_BASENAME" == *.gz ]]; then
            echo "Decompressing backup file..."
            gunzip -c "/backup/$BACKUP_BASENAME" > "/backup/restore.sql"
            RESTORE_FILE="/backup/restore.sql"
          else
            RESTORE_FILE="/backup/$BACKUP_BASENAME"
          fi

          # Stop application pods (optional)
          echo "Scaling down application..."
          kubectl scale deployment backend --replicas=0 -n $NAMESPACE
          sleep 30

          # Restore database
          echo "Restoring database..."
          psql -h postgres -U postgres -d $DATABASE < "\$RESTORE_FILE"

          # Restart application
          echo "Restarting application..."
          kubectl scale deployment backend --replicas=3 -n $NAMESPACE

          echo "Restore completed at $(date)"
        env:
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-password
        volumeMounts:
        - name: backup-source
          mountPath: /backup-source
        - name: backup-workspace
          mountPath: /backup
      volumes:
      - name: backup-source
        hostPath:
          path: $(dirname "$BACKUP_FILE")
          type: Directory
      - name: backup-workspace
        emptyDir: {}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
EOF

    # Apply job
    kubectl apply -f /tmp/restore-job.yaml

    # Wait for job completion
    log_info "Waiting for restore job to complete..."
    kubectl wait --for=condition=complete job -l job-name=postgres-restore -n "$NAMESPACE" --timeout=1800s

    # Check job status
    JOB_STATUS=$(kubectl get job -l job-name=postgres-restore -n "$NAMESPACE" -o jsonpath='{.items[0].status.succeeded}')
    if [ "$JOB_STATUS" = "1" ]; then
        log_success "Database restore completed successfully"
    else
        log_error "Database restore failed"
        kubectl logs job -l job-name=postgres-restore -n "$NAMESPACE"
        exit 1
    fi

    # Clean up job
    kubectl delete job -l job-name=postgres-restore -n "$NAMESPACE"
    rm -f /tmp/restore-job.yaml
}

# Verify restore
verify_restore() {
    log_info "Verifying database restore..."

    # Wait for application to be ready
    kubectl wait --for=condition=available deployment/backend -n "$NAMESPACE" --timeout=600s

    # Run health check
    sleep 30

    # Check database connectivity
    kubectl exec -n "$NAMESPACE" deployment/backend -- node -e "
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      pool.query('SELECT COUNT(*) FROM users')
        .then(result => {
          console.log('Database connectivity verified');
          console.log('Users count:', result.rows[0].count);
          process.exit(0);
        })
        .catch(err => {
          console.error('Database verification failed:', err);
          process.exit(1);
        });
    "

    log_success "Database restore verification completed"
}

# Create backup of current state before restore
create_pre_restore_backup() {
    log_info "Creating pre-restore backup..."

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    PRE_RESTORE_BACKUP="pre_restore_backup_${TIMESTAMP}.sql"

    kubectl exec -n "$NAMESPACE" deployment/postgres -- pg_dump -U postgres "$DATABASE" > "/tmp/$PRE_RESTORE_BACKUP"

    log_success "Pre-restore backup created: /tmp/$PRE_RESTORE_BACKUP"
}

# Main restore function
restore() {
    log_info "Starting database restore from $BACKUP_FILE"
    log_info "Namespace: $NAMESPACE, Database: $DATABASE"

    check_prerequisites
    create_pre_restore_backup
    download_backup
    create_restore_job
    verify_restore

    log_success "Database restore completed successfully"
    log_info "Pre-restore backup saved at /tmp/pre_restore_backup_*.sql"
}

# Handle script arguments
case "${1:-}" in
    "")
        usage
        exit 1
        ;;
    "--help"|"-h")
        usage
        exit 0
        ;;
    *)
        restore
        ;;
esac
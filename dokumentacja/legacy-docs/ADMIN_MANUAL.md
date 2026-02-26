# StillOnTime Administrator Manual

Comprehensive guide for system administrators managing StillOnTime production environments.

## Table of Contents

1. [System Overview](#system-overview)
2. [Daily Operations](#daily-operations)
3. [User Management](#user-management)
4. [System Monitoring](#system-monitoring)
5. [Backup Management](#backup-management)
6. [Security Administration](#security-administration)
7. [Performance Tuning](#performance-tuning)
8. [Troubleshooting](#troubleshooting)
9. [Incident Response](#incident-response)
10. [Maintenance Procedures](#maintenance-procedures)

## System Overview

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Web Frontend  │    │   Mobile Apps   │
│    (nginx)      │    │    (React)      │    │ (React Native)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Express)     │
                    └─────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │    │   File Storage  │
│   (Primary +    │    │    (Cache +     │    │   (Local/S3)    │
│   Replicas)     │    │     Queue)      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Services

- **Frontend**: React application serving the web interface
- **Backend**: Node.js/Express API server with business logic
- **Database**: PostgreSQL with read replicas for high availability
- **Cache**: Redis for session storage and application caching
- **Queue**: Bull/Redis for background job processing
- **Monitoring**: Prometheus, Grafana, and ELK stack
- **Backup**: Automated daily backups with S3 storage

### System Resources

- **CPU**: 8-16 cores per node
- **Memory**: 16-32GB per node
- **Storage**: SSD with 500GB+ capacity
- **Network**: 1Gbps minimum bandwidth

## Daily Operations

### Morning Checklist

```bash
#!/bin/bash
# Daily morning health check script

echo "StillOnTime Daily Health Check - $(date)"
echo "=========================================="

# 1. Check service status
echo "1. Service Status:"
kubectl get pods -n stillontime-production --no-headers | \
  awk '{print $1 ": " $3}' | column -t

# 2. Check resource usage
echo -e "\n2. Resource Usage:"
kubectl top nodes
kubectl top pods -n stillontime-production

# 3. Check recent alerts
echo -e "\n3. Recent Alerts (last 24h):"
curl -s "http://prometheus:9090/api/v1/query?query=ALERTS{alertstate=\"firing\"}" | \
  jq -r '.data.result[] | .metric.alertname + ": " + .metric.instance'

# 4. Check backup status
echo -e "\n4. Last Backup Status:"
ls -la /backups/reports/ | tail -3

# 5. Check certificate expiry
echo -e "\n5. Certificate Status:"
echo | openssl s_client -servername stillontime.com -connect stillontime.com:443 2>/dev/null | \
  openssl x509 -noout -dates

echo -e "\nDaily check completed at $(date)"
```

### Key Metrics to Monitor

- **Response Time**: < 2 seconds for 95th percentile
- **Error Rate**: < 1% for all endpoints
- **Uptime**: > 99.9% availability
- **Database Connections**: < 80% of max connections
- **Memory Usage**: < 80% of available memory
- **Disk Usage**: < 85% of available storage

### Log Locations

```bash
# Application logs
/var/log/stillontime/backend/
/var/log/stillontime/frontend/

# System logs
/var/log/syslog
/var/log/nginx/
/var/log/postgresql/

# Kubernetes logs
kubectl logs -f deployment/stillontime-backend -n stillontime-production
kubectl logs -f deployment/stillontime-frontend -n stillontime-production
```

## User Management

### Admin Dashboard Access

```bash
# Access admin dashboard
https://app.stillontime.com/admin

# Default admin credentials (change immediately)
Username: admin@stillontime.com
Password: [Set during deployment]
```

### User Operations

#### Create New User

```bash
# Via admin API
curl -X POST https://api.stillontime.com/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "company": "Production Company"
  }'
```

#### Reset User Password

```bash
# Generate password reset link
curl -X POST https://api.stillontime.com/api/admin/users/{userId}/reset-password \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Disable User Account

```sql
-- Database query to disable user
UPDATE users 
SET status = 'disabled', updated_at = NOW() 
WHERE email = 'user@example.com';
```

### Role Management

- **Admin**: Full system access and user management
- **Producer**: Production management and team oversight
- **Coordinator**: Schedule management and crew coordination
- **Crew**: View schedules and receive notifications
- **Viewer**: Read-only access to public information

### Bulk Operations

```bash
# Export user list
curl -X GET https://api.stillontime.com/api/admin/users/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o users_export_$(date +%Y%m%d).csv

# Import users from CSV
curl -X POST https://api.stillontime.com/api/admin/users/import \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@users_import.csv"
```

## System Monitoring

### Grafana Dashboards

#### Primary Dashboard: StillOnTime Overview
- URL: `https://grafana.stillontime.com/d/stillontime-overview`
- Key Metrics:
  - Request rate and response times
  - Error rates by service
  - Resource utilization
  - Business metrics (active users, processed schedules)

#### Infrastructure Dashboard
- Node resource usage (CPU, memory, disk)
- Network I/O and latency
- Container health and restarts
- Storage utilization

#### Application Dashboard
- API endpoint performance
- Database query performance
- Queue processing metrics
- Cache hit rates

### Alert Configuration

#### Critical Alerts (Immediate Response)

```yaml
- alert: ServiceDown
  expr: up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Service {{ $labels.job }} is down"

- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
```

#### Warning Alerts (Monitor Closely)

```yaml
- alert: HighMemoryUsage
  expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
  for: 10m
  labels:
    severity: warning

- alert: SlowResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
  for: 5m
  labels:
    severity: warning
```

### Log Analysis

#### Common Log Queries

```bash
# View recent errors
kubectl logs -n stillontime-production --selector app=stillontime-backend --since=1h | grep ERROR

# Search for specific user activity
kubectl logs -n stillontime-production --selector app=stillontime-backend | \
  grep "user_id:12345" | tail -50

# Monitor API response times
kubectl logs -n stillontime-production --selector app=stillontime-backend | \
  grep "request_duration" | awk '{print $NF}' | sort -n
```

#### Log Retention

- **Application Logs**: 30 days local, 90 days in S3
- **Access Logs**: 7 days local, 30 days in S3
- **System Logs**: 14 days local, 60 days in S3

## Backup Management

### Backup Schedule

- **Database**: Daily at 2:00 AM UTC
- **Files**: Daily at 3:00 AM UTC
- **Configuration**: Weekly on Sundays
- **Full System**: Monthly on first Sunday

### Backup Verification

```bash
# Check backup status
kubectl logs -f cronjob/stillontime-backup -n stillontime-production

# List recent backups
aws s3 ls s3://stillontime-backups/postgres/ --recursive | tail -10

# Verify backup integrity
kubectl exec -it backup-pod -n stillontime-production -- \
  /scripts/health-check.sh
```

### Backup Restoration

#### Database Restore

```bash
# List available backups
kubectl exec -it backup-pod -n stillontime-production -- \
  /scripts/restore-backup.sh

# Restore specific backup
kubectl exec -it backup-pod -n stillontime-production -- \
  /scripts/restore-backup.sh 20240315_020000

# Verify restoration
kubectl exec -it stillontime-postgres-0 -n stillontime-production -- \
  psql -U postgres -d stillontime -c "SELECT COUNT(*) FROM users;"
```

#### File Restore

```bash
# Restore application files
kubectl exec -it backup-pod -n stillontime-production -- \
  bash -c "cd /backups/files && tar -xzf files-20240315_020000.tar.gz -C /app/uploads/"
```

### Disaster Recovery

#### RTO/RPO Targets
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 1 hour

#### Recovery Procedures

1. **Assess Impact**: Determine scope of outage
2. **Notify Stakeholders**: Send incident notifications
3. **Activate DR Site**: If primary site is down
4. **Restore Data**: From most recent backup
5. **Validate Service**: Run health checks
6. **Resume Operations**: Switch traffic to recovered service

## Security Administration

### SSL/TLS Management

```bash
# Check certificate expiry
echo | openssl s_client -servername stillontime.com -connect stillontime.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Renew certificates (automatic via cert-manager)
kubectl get certificates -n stillontime-production

# Manual certificate renewal (if needed)
kubectl delete secret stillontime-tls-cert -n stillontime-production
kubectl annotate certificate stillontime-tls cert-manager.io/issue-temporary-certificate=""
```

### Security Monitoring

#### Failed Login Attempts

```sql
-- Check failed login attempts
SELECT email, COUNT(*) as attempts, MAX(created_at) as last_attempt
FROM audit_logs 
WHERE action = 'login_failed' 
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY email
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

#### Suspicious Activity

```bash
# Monitor for unusual API usage
kubectl logs -n stillontime-production --selector app=stillontime-backend | \
  grep -E "(429|403)" | \
  awk '{print $1}' | sort | uniq -c | sort -nr
```

### Access Control

#### API Key Management

```bash
# Generate new API key
curl -X POST https://api.stillontime.com/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "Integration Key", "permissions": ["read"], "expires_at": "2024-12-31"}'

# Revoke API key
curl -X DELETE https://api.stillontime.com/api/admin/api-keys/{keyId} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Session Management

```bash
# View active sessions
redis-cli -h redis-host KEYS "session:*" | wc -l

# Force logout all users
redis-cli -h redis-host FLUSHDB 1
```

## Performance Tuning

### Database Optimization

#### Query Performance

```sql
-- Identify slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'processed_emails'
ORDER BY n_distinct DESC;
```

#### Connection Pooling

```bash
# Check current connections
kubectl exec -it stillontime-postgres-0 -n stillontime-production -- \
  psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Optimize connection pool
# Edit backend configuration
MAX_POOL_SIZE=20
MIN_POOL_SIZE=5
IDLE_TIMEOUT=30000
```

### Application Scaling

#### Horizontal Scaling

```bash
# Scale backend pods
kubectl scale deployment stillontime-backend \
  --replicas=5 \
  --namespace stillontime-production

# Enable autoscaling
kubectl autoscale deployment stillontime-backend \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  --namespace stillontime-production
```

#### Vertical Scaling

```yaml
# Update resource limits
resources:
  requests:
    memory: "512Mi"
    cpu: "200m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Caching Optimization

```bash
# Check Redis memory usage
redis-cli -h redis-host INFO memory

# Optimize cache settings
redis-cli -h redis-host CONFIG SET maxmemory-policy allkeys-lru
redis-cli -h redis-host CONFIG SET maxmemory 512mb
```

## Troubleshooting

### Common Issues

#### 1. High Response Times

```bash
# Check for database bottlenecks
kubectl exec -it stillontime-postgres-0 -n stillontime-production -- \
  psql -U postgres -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Monitor slow queries
kubectl logs -n stillontime-production --selector app=stillontime-backend | \
  grep "slow_query" | tail -10

# Check cache hit rate
redis-cli -h redis-host INFO stats | grep keyspace
```

#### 2. Memory Leaks

```bash
# Monitor memory usage over time
kubectl top pods -n stillontime-production --sort-by=memory

# Check for memory leaks in Node.js
kubectl exec -it stillontime-backend-xxx -n stillontime-production -- \
  node --expose-gc --inspect=0.0.0.0:9229 index.js
```

#### 3. Database Connection Issues

```bash
# Check connection limits
kubectl exec -it stillontime-postgres-0 -n stillontime-production -- \
  psql -U postgres -c "SHOW max_connections;"

# View current connections
kubectl exec -it stillontime-postgres-0 -n stillontime-production -- \
  psql -U postgres -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

### Emergency Procedures

#### Service Recovery

```bash
# Emergency restart
kubectl rollout restart deployment/stillontime-backend -n stillontime-production

# Check rollout status
kubectl rollout status deployment/stillontime-backend -n stillontime-production

# Rollback if needed
kubectl rollout undo deployment/stillontime-backend -n stillontime-production
```

#### Database Recovery

```bash
# Check database status
kubectl exec -it stillontime-postgres-0 -n stillontime-production -- \
  pg_isready -U postgres

# Restart database cluster
kubectl delete pod stillontime-postgres-0 -n stillontime-production
kubectl wait --for=condition=Ready pod/stillontime-postgres-0 -n stillontime-production
```

## Incident Response

### Incident Classification

#### Severity Levels

- **P0 (Critical)**: Complete service outage
- **P1 (High)**: Major functionality impaired
- **P2 (Medium)**: Minor functionality impaired
- **P3 (Low)**: No user impact, internal issues

#### Response Times

- **P0**: 15 minutes
- **P1**: 1 hour
- **P2**: 4 hours
- **P3**: Next business day

### Incident Management

#### Communication Plan

```bash
# Incident notification script
#!/bin/bash
INCIDENT_ID=$1
SEVERITY=$2
DESCRIPTION=$3

# Notify team
curl -X POST $SLACK_WEBHOOK \
  -d "{\"text\": \"🚨 INCIDENT $INCIDENT_ID ($SEVERITY): $DESCRIPTION\"}"

# Update status page
curl -X POST $STATUS_PAGE_API \
  -H "Authorization: Bearer $STATUS_TOKEN" \
  -d "{\"status\": \"major_outage\", \"message\": \"$DESCRIPTION\"}"
```

#### Post-Incident Review

1. **Timeline Creation**: Document incident timeline
2. **Root Cause Analysis**: Identify underlying cause
3. **Action Items**: Define preventive measures
4. **Process Improvement**: Update runbooks and procedures

## Maintenance Procedures

### Scheduled Maintenance

#### Monthly Updates

```bash
# Update container images
kubectl set image deployment/stillontime-backend \
  backend=stillontime/backend:1.0.1 \
  -n stillontime-production

# Update system packages
kubectl create job system-update-$(date +%s) \
  --image=ubuntu:20.04 \
  --restart=Never \
  -- /bin/bash -c "apt update && apt upgrade -y"
```

#### Database Maintenance

```sql
-- Monthly vacuum and analyze
VACUUM ANALYZE;

-- Update table statistics
ANALYZE processed_emails;
ANALYZE schedule_data;

-- Reindex if needed
REINDEX INDEX CONCURRENTLY idx_emails_created_at;
```

### Health Checks

#### Automated Health Monitoring

```bash
# Health check script
#!/bin/bash
HEALTH_ENDPOINT="https://api.stillontime.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_ENDPOINT)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Service healthy"
    exit 0
else
    echo "❌ Service unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

### Configuration Management

#### Environment Updates

```bash
# Update configuration
kubectl create configmap stillontime-config \
  --from-file=config/ \
  --dry-run=client -o yaml | \
  kubectl apply -f -

# Rolling restart to pick up changes
kubectl rollout restart deployment/stillontime-backend -n stillontime-production
```

### Capacity Planning

#### Monthly Review

- Analyze resource usage trends
- Plan for scaling requirements
- Review storage growth
- Update capacity forecasts

#### Scaling Triggers

- CPU usage > 80% for 5 minutes
- Memory usage > 85% for 5 minutes
- Response time > 3 seconds for 95th percentile
- Error rate > 2% for 10 minutes

## Emergency Contacts

### On-Call Rotation

- **Primary**: +1-XXX-XXX-XXXX
- **Secondary**: +1-XXX-XXX-XXXX
- **Manager**: +1-XXX-XXX-XXXX

### Vendor Contacts

- **Cloud Provider**: [Support Portal]
- **Database Support**: [Vendor Contact]
- **Monitoring**: [Vendor Support]

### Escalation Matrix

1. **L1 Support**: Basic troubleshooting
2. **L2 Support**: Advanced technical issues
3. **L3 Support**: Development team escalation
4. **Management**: Business impact decisions

---

*This administrator manual provides comprehensive guidance for day-to-day operations. Keep this document updated as systems evolve.*
# StillOnTime Production Deployment Guide

Complete guide for deploying StillOnTime to production environments with enterprise-grade infrastructure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Docker Compose Deployment](#docker-compose-deployment)
5. [Configuration Management](#configuration-management)
6. [Security Hardening](#security-hardening)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup Configuration](#backup-configuration)
9. [SSL/TLS Setup](#ssltls-setup)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Kubernetes Cluster**: v1.25+ with at least 3 nodes
- **CPU**: Minimum 8 cores per node (16 cores recommended)
- **Memory**: Minimum 16GB per node (32GB recommended)
- **Storage**: SSD storage with 500GB+ available
- **Network**: Load balancer with SSL termination capability

### Required Tools

```bash
# Install required tools
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
```

### External Services

- **Google Cloud Platform**: APIs enabled for Gmail, Calendar, Drive, Maps
- **OpenWeatherMap**: API key for weather data
- **Twilio**: Account for SMS notifications
- **AWS S3**: Bucket for backups (optional)
- **Domain & DNS**: Configured domains for web access

## Infrastructure Setup

### 1. Container Registry

```bash
# Build and push images
docker build -t stillontime/backend:1.0.0 ./backend
docker build -t stillontime/frontend:1.0.0 ./frontend

# Push to registry
docker push stillontime/backend:1.0.0
docker push stillontime/frontend:1.0.0
```

### 2. SSL Certificates

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager

# Apply certificate issuer
kubectl apply -f kubernetes/ingress.yaml
```

### 3. Storage Classes

```yaml
# Create SSD storage class
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Retain
allowVolumeExpansion: true
```

## Kubernetes Deployment

### 1. Create Namespaces

```bash
kubectl apply -f kubernetes/namespace.yaml
```

### 2. Create Secrets

```bash
# Create main application secrets
kubectl create secret generic stillontime-secrets \
  --namespace=stillontime-production \
  --from-literal=database-url="postgresql://user:password@postgres:5432/stillontime" \
  --from-literal=redis-url="redis://redis:6379" \
  --from-literal=jwt-secret="your-jwt-secret" \
  --from-literal=google-client-id="your-google-client-id" \
  --from-literal=google-client-secret="your-google-client-secret" \
  --from-literal=openweather-api-key="your-openweather-key" \
  --from-literal=twilio-account-sid="your-twilio-sid" \
  --from-literal=twilio-auth-token="your-twilio-token" \
  --from-literal=postgres-db="stillontime" \
  --from-literal=postgres-user="postgres" \
  --from-literal=postgres-password="your-postgres-password" \
  --from-literal=postgres-replication-password="your-replication-password" \
  --from-literal=postgres-exporter-dsn="postgresql://postgres:password@localhost:5432/stillontime?sslmode=disable" \
  --from-literal=redis-password="your-redis-password"
```

### 3. Deploy Database

```bash
# Deploy PostgreSQL with replication
kubectl apply -f kubernetes/database-deployment.yaml

# Wait for StatefulSet to be ready
kubectl wait --for=condition=Ready --timeout=300s statefulset/stillontime-postgres -n stillontime-production
```

### 4. Deploy Redis

```bash
# Deploy Redis cluster
kubectl apply -f kubernetes/redis-deployment.yaml

# Wait for StatefulSet to be ready
kubectl wait --for=condition=Ready --timeout=300s statefulset/stillontime-redis -n stillontime-production
```

### 5. Deploy Backend

```bash
# Deploy backend application
kubectl apply -f kubernetes/backend-deployment.yaml

# Wait for deployment to be ready
kubectl wait --for=condition=Available --timeout=300s deployment/stillontime-backend -n stillontime-production
```

### 6. Deploy Frontend

```bash
# Deploy frontend application
kubectl apply -f kubernetes/frontend-deployment.yaml

# Wait for deployment to be ready
kubectl wait --for=condition=Available --timeout=300s deployment/stillontime-frontend -n stillontime-production
```

### 7. Configure Ingress

```bash
# Deploy ingress controller and routes
kubectl apply -f kubernetes/ingress.yaml

# Check certificate status
kubectl get certificates -n stillontime-production
```

## Docker Compose Deployment

### 1. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.production

# Edit production environment
nano .env.production
```

### 2. Deploy with Docker Compose

```bash
# Deploy production stack
docker-compose -f docker-compose.production.yml up -d

# Check service status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### 3. Initialize Database

```bash
# Run database migrations
docker-compose -f docker-compose.production.yml exec backend-1 npm run prisma:migrate:deploy

# Seed initial data (if needed)
docker-compose -f docker-compose.production.yml exec backend-1 npm run db:seed
```

## Configuration Management

### Environment Variables

```bash
# Backend Configuration
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@postgres:5432/stillontime
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRY=24h

# Google API Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://api.stillontime.com/auth/google/callback

# External APIs
OPENWEATHER_API_KEY=your-openweather-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@stillontime.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH=/app/uploads

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
TRACING_ENABLED=true
```

### Frontend Configuration

```bash
# Frontend Environment
REACT_APP_API_URL=https://api.stillontime.com
REACT_APP_WS_URL=wss://api.stillontime.com
REACT_APP_ENVIRONMENT=production
REACT_APP_VERSION=1.0.0

# Analytics
REACT_APP_GA_TRACKING_ID=UA-XXXXXXXXX-X
REACT_APP_SENTRY_DSN=https://your-sentry-dsn

# Feature Flags
REACT_APP_ENABLE_PWA=true
REACT_APP_ENABLE_OFFLINE=true
REACT_APP_DEBUG_MODE=false
```

## Security Hardening

### 1. Network Security

```bash
# Apply network policies
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: stillontime-network-policy
  namespace: stillontime-production
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/part-of: stillontime
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: stillontime-production
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  - to: []
    ports:
    - protocol: TCP
      port: 443
EOF
```

### 2. Pod Security Standards

```bash
# Apply pod security standards
kubectl label namespace stillontime-production \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### 3. RBAC Configuration

```bash
# Create service accounts with minimal permissions
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: stillontime-readonly
  namespace: stillontime-production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: stillontime-production
  name: readonly-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: readonly-binding
  namespace: stillontime-production
subjects:
- kind: ServiceAccount
  name: stillontime-readonly
  namespace: stillontime-production
roleRef:
  kind: Role
  name: readonly-role
  apiGroup: rbac.authorization.k8s.io
EOF
```

## Monitoring Setup

### 1. Deploy Prometheus Stack

```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus operator
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace stillontime-monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set grafana.adminPassword=your-grafana-password
```

### 2. Configure Custom Dashboards

```bash
# Import StillOnTime dashboard
kubectl create configmap stillontime-dashboard \
  --from-file=monitoring/grafana/dashboards/stillontime-overview.json \
  --namespace stillontime-monitoring

# Label for automatic discovery
kubectl label configmap stillontime-dashboard \
  grafana_dashboard=1 \
  --namespace stillontime-monitoring
```

### 3. Set Up Alerting

```bash
# Apply custom alerting rules
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: stillontime-alerts
  namespace stillontime-monitoring
  labels:
    prometheus: kube-prometheus
    role: alert-rules
data:
  stillontime.rules: |
$(cat monitoring/alerting-rules.yml | sed 's/^/    /')
EOF
```

## Backup Configuration

### 1. Deploy Backup Service

```bash
# Create backup secrets
kubectl create secret generic backup-secrets \
  --namespace=stillontime-production \
  --from-literal=aws-access-key-id="your-aws-key" \
  --from-literal=aws-secret-access-key="your-aws-secret" \
  --from-literal=s3-bucket="your-backup-bucket" \
  --from-literal=backup-encryption-key="your-encryption-key"

# Deploy backup job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: stillontime-backup
  namespace: stillontime-production
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: stillontime/backup:1.0.0
            env:
            - name: POSTGRES_HOST
              value: stillontime-postgres-master
            - name: S3_BUCKET
              valueFrom:
                secretKeyRef:
                  name: backup-secrets
                  key: s3-bucket
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
EOF
```

### 2. Test Backup System

```bash
# Run manual backup
kubectl create job manual-backup-$(date +%s) \
  --from=cronjob/stillontime-backup \
  --namespace stillontime-production

# Check backup logs
kubectl logs -f job/manual-backup-... -n stillontime-production
```

## SSL/TLS Setup

### 1. Certificate Management

```bash
# Create certificate for main domains
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: stillontime-tls
  namespace: stillontime-production
spec:
  secretName: stillontime-tls-cert
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - stillontime.com
  - www.stillontime.com
  - app.stillontime.com
  - api.stillontime.com
EOF
```

### 2. Security Headers

```nginx
# Add to nginx configuration
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## Health Checks

### 1. Application Health

```bash
# Check application health
curl -f https://api.stillontime.com/health

# Check detailed health
curl -s https://api.stillontime.com/api/health | jq .
```

### 2. Database Health

```bash
# Check database connectivity
kubectl exec -it stillontime-postgres-0 -n stillontime-production -- \
  psql -U postgres -d stillontime -c "SELECT version();"
```

### 3. Redis Health

```bash
# Check Redis connectivity
kubectl exec -it stillontime-redis-0 -n stillontime-production -- \
  redis-cli ping
```

## Performance Tuning

### 1. Database Optimization

```sql
-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET random_page_cost = 1.1;

-- Reload configuration
SELECT pg_reload_conf();
```

### 2. Application Scaling

```bash
# Scale backend deployment
kubectl scale deployment stillontime-backend \
  --replicas=5 \
  --namespace stillontime-production

# Enable horizontal pod autoscaler
kubectl autoscale deployment stillontime-backend \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  --namespace stillontime-production
```

## Troubleshooting

### Common Issues

#### 1. Pod Startup Failures

```bash
# Check pod status
kubectl get pods -n stillontime-production

# View pod logs
kubectl logs <pod-name> -n stillontime-production

# Describe pod for events
kubectl describe pod <pod-name> -n stillontime-production
```

#### 2. Database Connection Issues

```bash
# Test database connection
kubectl exec -it stillontime-backend-xxx -n stillontime-production -- \
  node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.\$connect().then(() => console.log('Connected')).catch(console.error);
  "
```

#### 3. Certificate Issues

```bash
# Check certificate status
kubectl get certificates -n stillontime-production

# View certificate details
kubectl describe certificate stillontime-tls -n stillontime-production

# Check cert-manager logs
kubectl logs -f deployment/cert-manager -n cert-manager
```

#### 4. Performance Issues

```bash
# Check resource usage
kubectl top pods -n stillontime-production

# View metrics in Grafana
# Navigate to http://grafana.stillontime.com
```

### Log Analysis

```bash
# Backend application logs
kubectl logs -f deployment/stillontime-backend -n stillontime-production

# Database logs
kubectl logs -f statefulset/stillontime-postgres -n stillontime-production

# Ingress logs
kubectl logs -f deployment/nginx-ingress-controller -n ingress-nginx
```

### Recovery Procedures

#### 1. Database Recovery

```bash
# Restore from backup
kubectl exec -it backup-pod -n stillontime-production -- \
  /scripts/restore-backup.sh 20240315_020000
```

#### 2. Application Recovery

```bash
# Restart all pods
kubectl rollout restart deployment/stillontime-backend -n stillontime-production
kubectl rollout restart deployment/stillontime-frontend -n stillontime-production
```

## Maintenance

### Regular Tasks

1. **Weekly**: Review monitoring dashboards and alerts
2. **Monthly**: Update container images and security patches
3. **Quarterly**: Review backup integrity and disaster recovery procedures
4. **Annually**: Security audit and penetration testing

### Update Procedures

```bash
# Update backend image
kubectl set image deployment/stillontime-backend \
  backend=stillontime/backend:1.0.1 \
  -n stillontime-production

# Monitor rollout
kubectl rollout status deployment/stillontime-backend -n stillontime-production

# Rollback if needed
kubectl rollout undo deployment/stillontime-backend -n stillontime-production
```

## Support

For deployment issues or questions:

- **Documentation**: https://docs.stillontime.com
- **Issue Tracker**: https://github.com/stillontime/stillontime/issues
- **Support Email**: support@stillontime.com
- **Emergency Contact**: +1-XXX-XXX-XXXX

---

*This deployment guide provides comprehensive instructions for production deployment. Always test in staging environment first.*
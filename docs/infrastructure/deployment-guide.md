# StillOnTime Infrastructure Deployment Guide

## Overview

This guide covers the complete infrastructure setup and deployment procedures for the StillOnTime automation system, including CI/CD pipelines, containerization, Kubernetes orchestration, monitoring, and security.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Local Development Setup](#local-development-setup)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Container Configuration](#container-configuration)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Monitoring and Observability](#monitoring-and-observability)
8. [Security Configuration](#security-configuration)
9. [Environment Management](#environment-management)
10. [Troubleshooting](#troubleshooting)
11. [Backup and Recovery](#backup-and-recovery)

## Prerequisites

### Required Tools

- **Docker** 20.10+
- **Kubernetes** 1.25+ (for production)
- **kubectl** configured with cluster access
- **Helm** 3.8+
- **Node.js** 20+
- **npm** 9+
- **GitHub CLI** (for automation)

### Development Environment

```bash
# Clone repository
git clone https://github.com/ruvnet/StillOnTime.git
cd StillOnTime

# Install dependencies
npm run install:all

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start local development
npm run dev
```

### Production Environment Setup

```bash
# Install kubectl plugins
kubectl krew install view-secret

# Install Helm charts (optional)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Set up namespace
kubectl create namespace stillontime
kubectl create namespace stillontime-staging
```

## Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Monitoring    │
│   (React/Vite)  │◄──►│   (Node.js)     │◄──►│  (Prometheus)   │
│   Port: 8080    │    │   Port: 3000    │    │   Port: 9090    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   PostgreSQL    │    │    Grafana      │
│    (Nginx)      │    │    Port: 5432   │    │   Port: 3001    │
│   Port: 80/443  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │      Redis      │
                       │    Port: 6379   │
                       └─────────────────┘
```

### Deployment Architecture

- **Environments**: Development, Staging, Production
- **Orchestration**: Kubernetes with Helm charts
- **Containerization**: Docker multi-stage builds
- **Load Balancing**: Nginx ingress controller
- **Auto-scaling**: Horizontal Pod Autoscaler (HPA)
- **Monitoring**: Prometheus + Grafana + AlertManager
- **Security**: Pod Security Policies, Network Policies

## Local Development Setup

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

Create `.env` file:

```bash
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8080

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/stillontime
POSTGRES_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=redis-password

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# JWT
JWT_SECRET=your-jwt-secret

# Monitoring
GRAFANA_PASSWORD=admin-password
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline is triggered by:
- Push to `main` or `develop` branches
- Pull requests to `main`
- Release creation

### Pipeline Stages

1. **Code Quality & Security**
   - Linting and type checking
   - Security audit (npm audit)
   - SAST scan (SuperLinter)

2. **Testing**
   - Unit tests with coverage
   - E2E tests (Playwright)
   - Performance tests

3. **Build & Container Security**
   - Multi-platform Docker builds
   - Container vulnerability scanning (Trivy)
   - Push to GitHub Container Registry

4. **Deployment**
   - Staging (develop branch)
   - Production (release tag)
   - Health checks and smoke tests

### Manual Deployment

```bash
# Deploy to staging
./scripts/deployment/deploy.sh staging

# Deploy to production
./scripts/deployment/deploy.sh production v1.2.3

# Skip build (use existing images)
SKIP_BUILD=true ./scripts/deployment/deploy.sh staging

# Run tests after deployment
RUN_TESTS=true ./scripts/deployment/deploy.sh production
```

## Container Configuration

### Docker Images

- **Backend**: Multi-stage Node.js build
- **Frontend**: Multi-stage build with Nginx
- **Monitoring**: Official Prometheus and Grafana images

### Image Security

- Non-root user execution
- Read-only filesystems
- Minimal base images (Alpine)
- Security scanning integrated

### Registry

Images are stored in GitHub Container Registry:
- `ghcr.io/ruvnet/stillontime/backend:latest`
- `ghcr.io/ruvnet/stillontime/frontend:latest`

## Kubernetes Deployment

### Namespace Structure

```yaml
# Production
namespace: stillontime

# Staging
namespace: stillontime-staging
```

### Resource Configuration

**Backend Resources:**
- **Production**: 256-512Mi memory, 250-500m CPU
- **Staging**: 128-256Mi memory, 100-250m CPU

**Frontend Resources:**
- **Production**: 64-128Mi memory, 50-100m CPU
- **Staging**: 32-64Mi memory, 25-50m CPU

### Auto-scaling Configuration

```yaml
# HPA Settings
minReplicas: 2-3
maxReplicas: 6-10
targetCPUUtilization: 70%
targetMemoryUtilization: 80%
```

### Health Checks

```yaml
# Backend
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Persistent Storage

```yaml
# Storage Classes
storageClassName: gp2

# PVC Sizes
backend-logs: 10Gi
backend-uploads: 50Gi
postgres-data: 100Gi
redis-data: 20Gi
prometheus-data: 50Gi
grafana-data: 10Gi
```

## Monitoring and Observability

### Prometheus Configuration

**Scrape Intervals:**
- Application metrics: 15s
- Infrastructure metrics: 30s
- External monitoring: 60s

**Key Metrics:**
- HTTP request rate and latency
- Error rates by status code
- Resource utilization (CPU, memory)
- Database connections and query performance
- Cache hit rates and memory usage

### Grafana Dashboards

1. **Application Dashboard**
   - Request metrics
   - Response times
   - Error rates
   - Resource usage

2. **Infrastructure Dashboard**
   - Node metrics
   - Pod status
   - Network I/O
   - Disk usage

3. **Business Metrics Dashboard**
   - User activity
   - Feature usage
   - Performance trends

### Alerting Rules

**Critical Alerts:**
- Service downtime (>1 minute)
- High error rates (>10%)
- Resource exhaustion (>90%)

**Warning Alerts:**
- High latency (>95th percentile >1s)
- Elevated error rates (>5%)
- Resource usage (>80%)

## Security Configuration

### Container Security

- Non-root user execution
- Read-only filesystems
- Minimal attack surface
- Security scanning

### Network Security

```yaml
# Network Policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: stillontime-network-policy
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000
```

### RBAC Configuration

```yaml
# Service Account with minimal permissions
apiVersion: v1
kind: ServiceAccount
metadata:
  name: stillontime-sa

# Role with necessary permissions only
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
```

### Secrets Management

```bash
# Create secrets from environment variables
kubectl create secret generic backend-secrets \
  --from-literal=database-url="$DATABASE_URL" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --namespace=stillontime

# Encrypt sensitive data at rest
kubectl apply -f infrastructure/kubernetes/secrets.yaml
```

## Environment Management

### Environment Differences

| Feature | Development | Staging | Production |
|---------|-------------|---------|------------|
| Replicas | 1 | 2 | 3+ |
| Resources | Minimal | Moderate | Full |
| Auto-scaling | Disabled | Limited | Full |
| Monitoring | Basic | Standard | Comprehensive |
| Security | Development | Production | Production+ |

### Configuration Management

```bash
# Deploy to specific environment
kubectl apply -f infrastructure/kubernetes/ -n stillontime-staging

# Use Kustomize for environment-specific configs
kubectl apply -k infrastructure/kubernetes/overlays/production/
```

## Troubleshooting

### Common Issues

**Pod Not Starting:**
```bash
# Check pod status
kubectl get pods -n stillontime

# View pod logs
kubectl logs -f deployment/backend -n stillontime

# Describe pod for detailed information
kubectl describe pod <pod-name> -n stillontime
```

**High Memory Usage:**
```bash
# Check resource usage
kubectl top pods -n stillontime

# Check HPA status
kubectl get hpa -n stillontime

# View resource limits
kubectl describe deployment backend -n stillontime
```

**Database Connection Issues:**
```bash
# Check database connectivity
kubectl exec -it deployment/backend -n stillontime -- nc -zv postgres 5432

# View database logs
kubectl logs -f deployment/postgres -n stillontime

# Check secrets
kubectl get secret backend-secrets -n stillontime -o yaml
```

### Debugging Commands

```bash
# Port forward for local debugging
kubectl port-forward svc/backend-service 3000:80 -n stillontime

# Execute shell in container
kubectl exec -it deployment/backend -n stillontime -- /bin/sh

# Check events
kubectl get events -n stillontime --sort-by=.metadata.creationTimestamp

# Validate manifests
kubectl apply --dry-run=client -f infrastructure/kubernetes/
```

## Backup and Recovery

### Database Backups

```bash
# Create backup
kubectl exec -it deployment/postgres -n stillontime -- \
  pg_dump -U postgres stillontime > backup-$(date +%Y%m%d).sql

# Automate with cronjob
kubectl apply -f infrastructure/kubernetes/backup-cronjob.yaml
```

### Configuration Backups

```bash
# Backup all configurations
kubectl get all,configmaps,secrets,pvc -n stillontime -o yaml > backup-config.yaml

# Restore configuration
kubectl apply -f backup-config.yaml
```

### Disaster Recovery

1. **Assess Impact**: Identify affected components
2. **Restore Database**: From latest backup
3. **Deploy Application**: Using last known good configuration
4. **Verify Health**: Run health checks and smoke tests
5. **Monitor**: Enhanced monitoring during recovery

### Recovery Scripts

```bash
#!/bin/bash
# Recovery script template
./scripts/deployment/restore.sh backup-20231020.sql stillontime-prod

# Health verification
./scripts/deployment/health-check.sh production

# Rollback if needed
./scripts/deployment/rollback.sh production
```

## Support and Maintenance

### Regular Maintenance Tasks

- **Daily**: Monitor dashboards and alerts
- **Weekly**: Review security scan results
- **Monthly**: Update dependencies and images
- **Quarterly**: Performance review and optimization

### Documentation Updates

- Update this guide with architecture changes
- Document new monitoring requirements
- Maintain runbooks for common issues
- Review and update security configurations

### Contact Information

- **Infrastructure Team**: [team-email@company.com]
- **On-call Support**: [oncall-rotation]
- **Emergency Contact**: [emergency-contact]

---

*This document is part of the StillOnTime infrastructure documentation. For the latest version, see the project repository.*
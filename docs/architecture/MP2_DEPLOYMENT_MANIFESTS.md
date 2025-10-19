# MP2 Film Schedule Automation - Deployment Manifests and Configuration

## Deployment Overview

This document contains comprehensive Kubernetes deployment manifests and configuration files for the MP2 Film Schedule Automation System. The deployment strategy follows cloud-native best practices with high availability, scalability, and security in mind.

## 1. Namespace Configuration

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mp2-automation
  labels:
    name: mp2-automation
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: mp2-automation-staging
  labels:
    name: mp2-automation-staging
    environment: staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: mp2-automation-dev
  labels:
    name: mp2-automation-dev
    environment: development
```

## 2. ConfigMaps

```yaml
# configmaps/common-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mp2-common-config
  namespace: mp2-automation
data:
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  TRACING_ENABLED: "true"
  METRICS_ENABLED: "true"
  HEALTH_CHECK_INTERVAL: "30s"
  GRACEFUL_SHUTDOWN_TIMEOUT: "30s"
  CORS_ORIGINS: "https://app.mp2-automation.com,https://admin.mp2-automation.com"
  DEFAULT_TIMEZONE: "Europe/Warsaw"
  DEFAULT_LANGUAGE: "pl"
  MAX_UPLOAD_SIZE: "50MB"
  REDIS_TTL: "3600"
  CACHE_CLEANUP_INTERVAL: "3600"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mp2-api-gateway-config
  namespace: mp2-automation
data:
  NGINX_CONFIG: |
    upstream email_service {
        server mp2-email-service:3000;
        keepalive 32;
    }
    upstream schedule_service {
        server mp2-schedule-service:3000;
        keepalive 32;
    }
    upstream route_service {
        server mp2-route-service:3000;
        keepalive 32;
    }
    upstream calendar_service {
        server mp2-calendar-service:3000;
        keepalive 32;
    }
    upstream weather_service {
        server mp2-weather-service:3000;
        keepalive 32;
    }
    upstream notification_service {
        server mp2-notification-service:3000;
        keepalive 32;
    }
    upstream auth_service {
        server mp2-auth-service:3000;
        keepalive 32;
    }

    server {
        listen 80;
        server_name api.mp2-automation.com;

        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # Location blocks for services
        location /api/v1/email/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://email_service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/v1/schedule/ {
            limit_req zone=api burst=30 nodelay;
            proxy_pass http://schedule_service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Other service locations...

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
```

## 3. Secrets

```yaml
# secrets/database-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mp2-database-secrets
  namespace: mp2-automation
type: Opaque
data:
  POSTGRES_USER: cG9zdGdyZXMtdXNlcg==  # postgres-user (base64)
  POSTGRES_PASSWORD: c3VwZXItc2VjdXJlLXBhc3M=  # super-secure-pass (base64)
  POSTGRES_DB: bXAyLWF1dG9tYXRpb24=  # mp2-automation (base64)
  POSTGRES_URI: cG9zdGdyZXNxbDovL3Bvc3RncmVzLXVzZXI6c3VwZXItc2VjdXJlLXBhc3NAcG9zdGdyZXMtc2VydmljZTo1NDMyL21wMi1hdXRvbWF0aW9u  # postgresql://postgres-user:super-secure-pass@postgres-service:5432/mp2-automation (base64)
---
apiVersion: v1
kind: Secret
metadata:
  name: mp2-redis-secrets
  namespace: mp2-automation
type: Opaque
data:
  REDIS_PASSWORD: cmVkaXMtc2VjdXJlLXBhc3M=  # redis-secure-pass (base64)
  REDIS_URI: cmVkaXM6Ly86cmVkaXMtc2VjdXJlLXBhc3NAcmVkaXMtc2VydmljZTo2Mzc5  # redis://:redis-secure-pass@redis-service:6379 (base64)
---
apiVersion: v1
kind: Secret
metadata:
  name: mp2-google-secrets
  namespace: mp2-automation
type: Opaque
data:
  GOOGLE_CLIENT_ID: eWFvdXItZ29vZ2xlLWNsaWVudC1pZA==  # your-google-client-id (base64)
  GOOGLE_CLIENT_SECRET: eWFvdXItZ29vZ2xlLWNsaWVudC1zZWNyZXQ=  # your-google-client-secret (base64)
  GOOGLE_MAPS_API_KEY: eWFvdXItZ29vZ2xlLW1hcHMtYXBpLWtleQ==  # your-google-maps-api-key (base64)
  GMAIL_SERVICE_ACCOUNT_KEY: eWFvdXItZ21haWwtc2VydmljZS1hY2NvdW50LWtleQ==  # your-gmail-service-account-key (base64)
---
apiVersion: v1
kind: Secret
metadata:
  name: mp2-weather-secrets
  namespace: mp2-automation
type: Opaque
data:
  OPENWEATHER_API_KEY: eWFvdXItb3BlbndlYXRoZXItYXBpLWtleQ==  # your-openweather-api-key (base64)
---
apiVersion: v1
kind: Secret
metadata:
  name: mp2-notification-secrets
  namespace: mp2-automation
type: Opaque
data:
  SENDGRID_API_KEY: eWFvdXItc2VuZGdyaWQtYXBpLWtleQ==  # your-sendgrid-api-key (base64)
  TWILIO_ACCOUNT_SID: eWFvdXIdd2lsaW8tYWNjb3VudC1zaWQ=  # your-twilio-account-sid (base64)
  TWILIO_AUTH_TOKEN: eWFvdXIdd2lsaW8tYXV0aC10b2tlbg==  # your-twilio-auth-token (base64)
```

## 4. Storage Configuration

```yaml
# storage/persistent-volumes.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mp2-postgres-pv
  namespace: mp2-automation
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: fast-ssd
  hostPath:
    path: /data/mp2/postgres
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mp2-postgres-pvc
  namespace: mp2-automation
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: fast-ssd
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mp2-redis-pv
  namespace: mp2-automation
spec:
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: fast-ssd
  hostPath:
    path: /data/mp2/redis
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mp2-redis-pvc
  namespace: mp2-automation
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: fast-ssd
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mp2-uploads-pv
  namespace: mp2-automation
spec:
  capacity:
    storage: 500Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: nfs
  nfs:
    server: nfs-server.mp2-automation.svc.cluster.local
    path: /data/mp2/uploads
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mp2-uploads-pvc
  namespace: mp2-automation
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 500Gi
  storageClassName: nfs
```

## 5. Database Deployments

```yaml
# deployments/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mp2-postgres
  namespace: mp2-automation
  labels:
    app: mp2-postgres
spec:
  serviceName: mp2-postgres
  replicas: 1
  selector:
    matchLabels:
      app: mp2-postgres
  template:
    metadata:
      labels:
        app: mp2-postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: mp2-database-secrets
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: mp2-database-secrets
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mp2-database-secrets
              key: POSTGRES_PASSWORD
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
            - -d
            - $(POSTGRES_DB)
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
            - -d
            - $(POSTGRES_DB)
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: mp2-postgres-pvc
      - name: postgres-config
        configMap:
          name: mp2-postgres-config
---
apiVersion: v1
kind: Service
metadata:
  name: mp2-postgres
  namespace: mp2-automation
  labels:
    app: mp2-postgres
spec:
  selector:
    app: mp2-postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mp2-postgres-config
  namespace: mp2-automation
data:
  postgresql.conf: |
    # Connection settings
    listen_addresses = '*'
    port = 5432
    max_connections = 200

    # Memory settings
    shared_buffers = 1GB
    effective_cache_size = 3GB
    work_mem = 16MB
    maintenance_work_mem = 256MB

    # Checkpoint settings
    checkpoint_completion_target = 0.9
    wal_buffers = 16MB

    # Logging
    log_destination = 'stderr'
    logging_collector = on
    log_directory = 'pg_log'
    log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
    log_statement = 'all'
    log_min_duration_statement = 1000

    # Performance
    random_page_cost = 1.1
    effective_io_concurrency = 200

    # Autovacuum
    autovacuum = on
    autovacuum_max_workers = 3
    autovacuum_naptime = 1min
```

```yaml
# deployments/redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mp2-redis
  namespace: mp2-automation
  labels:
    app: mp2-redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mp2-redis
  template:
    metadata:
      labels:
        app: mp2-redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - /etc/redis/redis.conf
        - --requirepass
        - $(REDIS_PASSWORD)
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mp2-redis-secrets
              key: REDIS_PASSWORD
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        - name: redis-config
          mountPath: /etc/redis
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: mp2-redis-pvc
      - name: redis-config
        configMap:
          name: mp2-redis-config
---
apiVersion: v1
kind: Service
metadata:
  name: mp2-redis
  namespace: mp2-automation
  labels:
    app: mp2-redis
spec:
  selector:
    app: mp2-redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mp2-redis-config
  namespace: mp2-automation
data:
  redis.conf: |
    # Network
    bind 0.0.0.0
    port 6379
    protected-mode yes

    # Memory management
    maxmemory 512mb
    maxmemory-policy allkeys-lru

    # Persistence
    save 900 1
    save 300 10
    save 60 10000
    appendonly yes
    appendfsync everysec

    # Logging
    loglevel notice
    logfile ""

    # Performance
    tcp-keepalive 300
    timeout 0

    # Security
    requirepass ${REDIS_PASSWORD}
```

## 6. Application Service Deployments

```yaml
# deployments/email-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mp2-email-service
  namespace: mp2-automation
  labels:
    app: mp2-email-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mp2-email-service
      version: v1
  template:
    metadata:
      labels:
        app: mp2-email-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: email-service
        image: mp2/email-service:latest
        ports:
        - containerPort: 3000
        - containerPort: 9090  # Metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: METRICS_PORT
          value: "9090"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mp2-database-secrets
              key: POSTGRES_URI
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: mp2-redis-secrets
              key: REDIS_URI
        - name: GOOGLE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: mp2-google-secrets
              key: GOOGLE_CLIENT_ID
        - name: GOOGLE_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: mp2-google-secrets
              key: GOOGLE_CLIENT_SECRET
        - name: GMAIL_SERVICE_ACCOUNT_KEY
          valueFrom:
            secretKeyRef:
              name: mp2-google-secrets
              key: GMAIL_SERVICE_ACCOUNT_KEY
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: mp2-common-config
              key: LOG_LEVEL
        - name: LOG_FORMAT
          valueFrom:
            configMapKeyRef:
              name: mp2-common-config
              key: LOG_FORMAT
        - name: TRACING_ENABLED
          valueFrom:
            configMapKeyRef:
              name: mp2-common-config
              key: TRACING_ENABLED
        - name: JAEGER_ENDPOINT
          value: "http://jaeger-collector:14268/api/traces"
        - name: MAX_UPLOAD_SIZE
          valueFrom:
            configMapKeyRef:
              name: mp2-common-config
              key: MAX_UPLOAD_SIZE
        volumeMounts:
        - name: uploads-storage
          mountPath: /app/uploads
        - name: temp-storage
          mountPath: /tmp
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
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
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
      volumes:
      - name: uploads-storage
        persistentVolumeClaim:
          claimName: mp2-uploads-pvc
      - name: temp-storage
        emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - mp2-email-service
              topologyKey: kubernetes.io/hostname
---
apiVersion: v1
kind: Service
metadata:
  name: mp2-email-service
  namespace: mp2-automation
  labels:
    app: mp2-email-service
spec:
  selector:
    app: mp2-email-service
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mp2-email-service-hpa
  namespace: mp2-automation
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mp2-email-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

```yaml
# deployments/schedule-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mp2-schedule-service
  namespace: mp2-automation
  labels:
    app: mp2-schedule-service
    version: v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mp2-schedule-service
      version: v1
  template:
    metadata:
      labels:
        app: mp2-schedule-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
      - name: schedule-service
        image: mp2/schedule-service:latest
        ports:
        - containerPort: 3000
        - containerPort: 9090
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: METRICS_PORT
          value: "9090"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mp2-database-secrets
              key: POSTGRES_URI
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: mp2-redis-secrets
              key: REDIS_URI
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: mp2-jwt-secrets
              key: JWT_SECRET
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: mp2-common-config
              key: LOG_LEVEL
        - name: TRACING_ENABLED
          valueFrom:
            configMapKeyRef:
              name: mp2-common-config
              key: TRACING_ENABLED
        - name: JAEGER_ENDPOINT
          value: "http://jaeger-collector:14268/api/traces"
        - name: CACHE_TTL
          valueFrom:
            configMapKeyRef:
              name: mp2-common-config
              key: REDIS_TTL
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "400m"
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
---
apiVersion: v1
kind: Service
metadata:
  name: mp2-schedule-service
  namespace: mp2-automation
  labels:
    app: mp2-schedule-service
spec:
  selector:
    app: mp2-schedule-service
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mp2-schedule-service-hpa
  namespace: mp2-automation
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mp2-schedule-service
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## 7. API Gateway Deployment

```yaml
# deployments/api-gateway.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mp2-api-gateway
  namespace: mp2-automation
  labels:
    app: mp2-api-gateway
    version: v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mp2-api-gateway
      version: v1
  template:
    metadata:
      labels:
        app: mp2-api-gateway
        version: v1
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        - containerPort: 443
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
        - name: nginx-config
          mountPath: /etc/nginx/conf.d
        - name: ssl-certs
          mountPath: /etc/nginx/ssl
        - name: log-volume
          mountPath: /var/log/nginx
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "400m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: nginx-config
        configMap:
          name: mp2-api-gateway-config
      - name: ssl-certs
        secret:
          secretName: mp2-ssl-certs
      - name: log-volume
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: mp2-api-gateway
  namespace: mp2-automation
  labels:
    app: mp2-api-gateway
spec:
  selector:
    app: mp2-api-gateway
  ports:
  - name: http
    port: 80
    targetPort: 80
  - name: https
    port: 443
    targetPort: 443
  type: LoadBalancer
  loadBalancerIP: 192.168.1.100  # Static IP if needed
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mp2-ingress
  namespace: mp2-automation
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.mp2-automation.com
    - app.mp2-automation.com
    - admin.mp2-automation.com
    secretName: mp2-tls-secret
  rules:
  - host: api.mp2-automation.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mp2-api-gateway
            port:
              number: 80
  - host: app.mp2-automation.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mp2-frontend
            port:
              number: 3000
  - host: admin.mp2-automation.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mp2-admin
            port:
              number: 3000
```

## 8. Monitoring and Observability

```yaml
# monitoring/prometheus.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: prometheus-config
          mountPath: /etc/prometheus
        - name: prometheus-storage
          mountPath: /prometheus
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
      volumes:
      - name: prometheus-config
        configMap:
          name: prometheus-config
      - name: prometheus-storage
        persistentVolumeClaim:
          claimName: prometheus-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  selector:
    app: prometheus
  ports:
  - port: 9090
    targetPort: 9090
  type: ClusterIP
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    rule_files:
      - "alert_rules.yml"

    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager:9093

    scrape_configs:
      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: $1:$2
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_pod_label_(.+)
          - source_labels: [__meta_kubernetes_namespace]
            action: replace
            target_label: kubernetes_namespace
          - source_labels: [__meta_kubernetes_pod_name]
            action: replace
            target_label: kubernetes_pod_name

      - job_name: 'mp2-services'
        kubernetes_sd_configs:
          - role: endpoints
            namespaces:
              names:
                - mp2-automation
        relabel_configs:
          - source_labels: [__meta_kubernetes_service_label_app]
            action: keep
            regex: mp2-.*
          - source_labels: [__meta_kubernetes_endpoint_port_name]
            action: keep
            regex: metrics|http
          - source_labels: [__meta_kubernetes_endpoint_address_target_kind, __meta_kubernetes_endpoint_address_target_name]
            separator: ;
            regex: Node;(.*)
            target_label: node
          - source_labels: [__meta_kubernetes_endpoint_address_target_kind, __meta_kubernetes_endpoint_address_target_name]
            separator: ;
            regex: Pod;(.*)
            target_label: pod
  alert_rules.yml: |
    groups:
    - name: mp2-alerts
      rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: Error rate is {{ $value }} errors per second.

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High response time detected
          description: 95th percentile response time is {{ $value }} seconds.

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Service is down
          description: Service {{ $labels.instance }} has been down for more than 1 minute.
```

```yaml
# monitoring/grafana.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-secrets
              key: admin-password
        - name: GF_INSTALL_PLUGINS
          value: "grafana-piechart-panel"
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
        - name: grafana-config
          mountPath: /etc/grafana/provisioning
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: grafana-storage
        persistentVolumeClaim:
          claimName: grafana-pvc
      - name: grafana-config
        configMap:
          name: grafana-config
---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: monitoring
spec:
  selector:
    app: grafana
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

## 9. Network Policies

```yaml
# network-policies/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mp2-network-policy
  namespace: mp2-automation
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: mp2-automation
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 9090
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: mp2-automation
    - namespaceSelector:
        matchLabels:
          name: monitoring
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

## 10. Horizontal Pod Autoscalers

```yaml
# hpa/hpa-config.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mp2-email-service-hpa
  namespace: mp2-automation
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mp2-email-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mp2-route-service-hpa
  namespace: mp2-automation
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mp2-route-service
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 85
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mp2-notification-service-hpa
  namespace: mp2-automation
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mp2-notification-service
  minReplicas: 2
  maxReplicas: 12
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 65
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 75
```

## 11. Pod Disruption Budgets

```yaml
# pdb/pod-disruption-budgets.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mp2-email-service-pdb
  namespace: mp2-automation
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: mp2-email-service
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mp2-schedule-service-pdb
  namespace: mp2-automation
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: mp2-schedule-service
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mp2-route-service-pdb
  namespace: mp2-automation
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: mp2-route-service
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mp2-calendar-service-pdb
  namespace: mp2-automation
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: mp2-calendar-service
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mp2-notification-service-pdb
  namespace: mp2-automation
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: mp2-notification-service
```

## 12. Service Mesh (Optional - Istio)

```yaml
# service-mesh/istio-gateway.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: mp2-gateway
  namespace: mp2-automation
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - api.mp2-automation.com
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: mp2-tls-secret
    hosts:
    - api.mp2-automation.com
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: mp2-virtual-service
  namespace: mp2-automation
spec:
  hosts:
  - api.mp2-automation.com
  gateways:
  - mp2-gateway
  http:
  - match:
    - uri:
        prefix: /api/v1/email
    route:
    - destination:
        host: mp2-email-service
        port:
          number: 3000
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
  - match:
    - uri:
        prefix: /api/v1/schedule
    route:
    - destination:
        host: mp2-schedule-service
        port:
          number: 3000
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
```

## 13. Deployment Scripts

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

# Configuration
NAMESPACE="mp2-automation"
ENVIRONMENT=${1:-production}
DRY_RUN=${2:-false}

echo "Deploying MP2 Automation System to ${ENVIRONMENT} environment..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "kubectl is not installed or not in PATH"
    exit 1
fi

# Create namespace if it doesn't exist
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets first
echo "Applying secrets..."
kubectl apply -f secrets/ -n ${NAMESPACE}

# Apply ConfigMaps
echo "Applying configurations..."
kubectl apply -f configmaps/ -n ${NAMESPACE}

# Apply storage
echo "Applying storage configurations..."
kubectl apply -f storage/ -n ${NAMESPACE}

# Deploy databases
echo "Deploying databases..."
kubectl apply -f deployments/postgres.yaml -n ${NAMESPACE}
kubectl apply -f deployments/redis.yaml -n ${NAMESPACE}

# Wait for databases to be ready
echo "Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=mp2-postgres -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app=mp2-redis -n ${NAMESPACE} --timeout=300s

# Deploy application services
echo "Deploying application services..."
kubectl apply -f deployments/email-service.yaml -n ${NAMESPACE}
kubectl apply -f deployments/schedule-service.yaml -n ${NAMESPACE}
kubectl apply -f deployments/route-service.yaml -n ${NAMESPACE}
kubectl apply -f deployments/calendar-service.yaml -n ${NAMESPACE}
kubectl apply -f deployments/weather-service.yaml -n ${NAMESPACE}
kubectl apply -f deployments/notification-service.yaml -n ${NAMESPACE}
kubectl apply -f deployments/auth-service.yaml -n ${NAMESPACE}

# Deploy API gateway
echo "Deploying API gateway..."
kubectl apply -f deployments/api-gateway.yaml -n ${NAMESPACE}

# Apply auto-scaling
echo "Applying auto-scaling configurations..."
kubectl apply -f hpa/ -n ${NAMESPACE}

# Apply network policies
echo "Applying network policies..."
kubectl apply -f network-policies/ -n ${NAMESPACE}

# Apply pod disruption budgets
echo "Applying pod disruption budgets..."
kubectl apply -f pdb/ -n ${NAMESPACE}

# Wait for all services to be ready
echo "Waiting for all services to be ready..."
kubectl wait --for=condition=ready pod -l app=mp2-email-service -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app=mp2-schedule-service -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app=mp2-route-service -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app=mp2-calendar-service -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app=mp2-weather-service -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app=mp2-notification-service -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app=mp2-auth-service -n ${NAMESPACE} --timeout=300s

# Verify deployment
echo "Verifying deployment..."
kubectl get pods -n ${NAMESPACE}
kubectl get services -n ${NAMESPACE}
kubectl get hpa -n ${NAMESPACE}

# Run smoke tests
echo "Running smoke tests..."
./scripts/smoke-tests.sh ${NAMESPACE}

echo "Deployment completed successfully!"
echo "API Gateway URL: https://api.mp2-automation.com"
echo "Grafana Dashboard: https://grafana.mp2-automation.com"
echo "Prometheus: https://prometheus.mp2-automation.com"
```

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

NAMESPACE=${1:-mp2-automation}
REVISION=${2:-previous}

echo "Rolling back MP2 Automation System in ${NAMESPACE} to revision ${REVISION}..."

# Rollback all deployments
for deployment in $(kubectl get deployments -n ${NAMESPACE} -o name); do
    echo "Rolling back ${deployment}..."
    kubectl rollout undo ${deployment} -n ${NAMESPACE} --to-revision=${REVISION}
done

# Wait for rollout to complete
for deployment in $(kubectl get deployments -n ${NAMESPACE} -o name); do
    echo "Waiting for ${deployment} rollout to complete..."
    kubectl rollout status ${deployment} -n ${NAMESPACE} --timeout=300s
done

echo "Rollback completed!"
```

This comprehensive deployment configuration provides production-ready Kubernetes manifests for the MP2 Film Schedule Automation System, including high availability, auto-scaling, monitoring, security, and observability features.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-19
**DevOps Team**: MP2 System Architecture Group
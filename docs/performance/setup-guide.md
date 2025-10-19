# Performance Monitoring Setup Guide

This guide provides step-by-step instructions for setting up the comprehensive performance monitoring system for StillOnTime.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
# Install performance monitoring tools
npm install -g artillery
npm install -g @lhci/cli@0.12.x

# Install local dependencies
npm install
cd monitoring/performance && npm install
```

### 2. Environment Configuration

Create the required environment variables:

```bash
# Performance Monitoring Configuration
PERFORMANCE_MONITORING=true
METRICS_ENABLED=true
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Database Performance
DB_QUERY_LOGGING=true
SLOW_QUERY_THRESHOLD=500

# Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL=300
CACHE_MONITORING=true

# Frontend Performance
WEB_VITALS_SAMPLE_RATE=1.0
PERFORMANCE_ENDPOINT=/api/performance/metrics
```

### 3. Database Setup

Apply performance optimizations:

```bash
# Apply performance indexes
cd backend
psql -d stillontime -f migrations/001_performance_indexes.sql

# Verify index usage
SELECT * FROM analyze_index_usage();
```

### 4. Monitoring Services

Start the monitoring stack:

```bash
# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Or start individual services
npm run monitoring:start
```

## 📊 GitHub Actions Setup

### 1. Required Secrets

Configure these secrets in your GitHub repository:

- `LHCI_GITHUB_APP_TOKEN`: For Lighthouse CI integration
- `SLACK_WEBHOOK_URL`: For performance alerts
- `DATABASE_URL`: Production database connection
- `REDIS_URL`: Redis connection string

### 2. Workflow Files

The following workflow files are automatically configured:

- `.github/workflows/performance-monitoring.yml`: Main performance testing
- `.github/workflows/performance-budget.yml`: Budget enforcement

### 3. Configure Lighthouse CI

1. Create a Lighthouse GitHub App
2. Install the app in your repository
3. Add the `LHCI_GITHUB_APP_TOKEN` secret

## 🎛️ Grafana Dashboard Setup

### 1. Import Dashboard

```bash
# Import the performance dashboard
curl -X POST \
  http://admin:admin@localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @monitoring/performance/grafana-dashboard.json
```

### 2. Configure Prometheus

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'stillontime'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### 3. Configure Alerting

Import alert rules:

```bash
# Import alert rules
curl -X POST \
  http://admin:admin@localhost:9093/api/v1/rules \
  -H 'Content-Type: application/json' \
  -d @monitoring/performance/alert-rules.yml
```

## 🧪 Running Performance Tests

### 1. Local Testing

```bash
# Run full performance test suite
npm run test:performance

# Run individual tests
npm run performance:bundle
npm run test:lighthouse
npm run test:api-performance

# Check performance budgets
npm run performance:budget-check
```

### 2. CI/CD Testing

Performance tests automatically run on:
- Pull requests
- Pushes to main branch
- Daily scheduled runs

### 3. Manual Performance Testing

```bash
# Bundle analysis
npm run performance:bundle

# Lighthouse testing
npx lhci autorun

# API load testing
artillery run scripts/performance/api-load-test.yml

# Database performance testing
node scripts/performance/database-performance-test.js
```

## 📈 Performance Budgets

### 1. Budget Configuration

Performance budgets are defined in:
- `scripts/performance/check-performance-budget.js`
- `.lighthouserc-budget.js`

### 2. Budget Thresholds

- **JavaScript Bundle**: < 500KB
- **CSS Bundle**: < 50KB
- **Total Bundle**: < 1MB
- **Lighthouse Performance**: > 90
- **API Response Time**: < 200ms average

### 3. Budget Enforcement

Budgets are enforced in CI/CD:
- Builds fail if budgets are exceeded
- PR comments include budget analysis
- Performance regression alerts are created

## 🚨 Alert Configuration

### 1. Alert Rules

Alert rules are defined in `monitoring/performance/alert-rules.yml`:

- **API Latency**: > 1s (warning), > 2s (critical)
- **Error Rate**: > 5% (warning), > 15% (critical)
- **Bundle Size**: Exceeds budget thresholds
- **Web Vitals**: Poor performance scores

### 2. Alert Channels

Configure alert channels:

```bash
# Slack alerts
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Email alerts
export ALERT_EMAIL=admin@stillontime.com

# PagerDuty alerts
export PAGERDUTY_SERVICE_KEY=your-service-key
```

### 3. Alert Response

1. **Acknowledge alerts** in monitoring system
2. **Check dashboard** for current status
3. **Identify impact** on users
4. **Follow runbook** for specific alert type
5. **Document resolution** in incident report

## 📊 Monitoring Dashboards

### 1. Access Dashboards

- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

### 2. Key Dashboards

- **Performance Overview**: Main performance metrics
- **API Performance**: Response times and error rates
- **Database Performance**: Query performance and index usage
- **Frontend Performance**: Web Vitals and bundle size

### 3. Custom Dashboards

Create custom dashboards:

1. Go to Grafana > Dashboards > New Dashboard
2. Add panels for your metrics
3. Set appropriate thresholds
4. Configure alerts if needed

## 🔧 Performance Optimization

### 1. Database Optimization

```bash
# Apply performance indexes
npm run prisma:migrate:performance

# Analyze slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 2. API Optimization

```bash
# Enable Redis caching
export CACHE_ENABLED=true

# Monitor cache performance
redis-cli info stats
```

### 3. Frontend Optimization

```bash
# Analyze bundle size
npm run performance:bundle

# Run Lighthouse CI
npm run test:lighthouse
```

## 🛠️ Troubleshooting

### 1. Common Issues

**Performance tests failing**:
- Check environment variables
- Verify services are running
- Review test configuration

**Missing alerts**:
- Check alert rule configuration
- Verify alert channel setup
- Check Prometheus targets

**Dashboard not showing data**:
- Verify Prometheus is scraping metrics
- Check data source configuration
- Review query syntax

### 2. Debug Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana data sources
curl http://admin:admin@localhost:3000/api/datasources

# Test alerts
curl -X POST http://localhost:9093/api/v1/alerts
```

### 3. Performance Issues

**Slow API responses**:
- Check database query performance
- Verify Redis is working
- Review application logs

**High bundle size**:
- Run bundle analyzer
- Check for unused dependencies
- Implement code splitting

## 📚 Additional Resources

- [Performance Monitoring Guide](./monitoring-guide.md)
- [Performance Optimization Documentation](../../PERFORMANCE_OPTIMIZATION.md)
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)

## 🆘 Support

For setup issues:

1. Check the troubleshooting section
2. Review GitHub issues
3. Contact the performance team
4. Create a support ticket

---

This setup guide covers all the essential components for running a comprehensive performance monitoring system for StillOnTime.
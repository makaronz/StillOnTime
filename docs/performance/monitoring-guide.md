# Performance Monitoring Guide

This guide provides comprehensive documentation for the StillOnTime performance monitoring system, including setup procedures, monitoring dashboards, alerting, and troubleshooting.

## 📊 Overview

The StillOnTime performance monitoring system provides:

- **Real-time monitoring** of API performance, database queries, and frontend metrics
- **Automated performance testing** in CI/CD pipelines
- **Performance budget enforcement** to prevent regressions
- **Alerting system** for performance degradation
- **Historical performance data** analysis
- **Performance regression detection** and reporting

## 🚀 Quick Start

### 1. Prerequisites

Ensure you have the following services installed and running:

- **Node.js** 20+
- **PostgreSQL** 15+
- **Redis** 7+
- **Grafana** (for dashboards)
- **Prometheus** (for metrics collection)

### 2. Initial Setup

```bash
# Install performance monitoring dependencies
npm install -g artillery
npm install -g @lhci/cli@0.12.x

# Setup monitoring environment
cd monitoring/performance
npm install

# Apply performance database optimizations
cd ../../backend
npm run prisma:migrate:performance
```

### 3. Configure Monitoring

Set up the following environment variables:

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

## 📈 Monitoring Components

### 1. API Performance Monitoring

#### Metrics Tracked
- **Response times** (avg, p95, p99)
- **Request throughput** (requests per second)
- **Error rates** (4xx, 5xx responses)
- **Endpoint-specific performance**
- **Database query performance**

#### Dashboard Access
- **Grafana Dashboard**: `http://grafana.stillontime.com/d/performance`
- **API Metrics**: `http://localhost:3001/metrics`

#### Alerting Rules
Key API performance alerts:
- **High API Latency**: 95th percentile > 1s (warning), > 2s (critical)
- **High Error Rate**: > 5% (warning), > 15% (critical)
- **Slow Database Queries**: 95th percentile > 500ms (warning), > 1s (critical)

### 2. Frontend Performance Monitoring

#### Web Vitals Tracked
- **Largest Contentful Paint (LCP)**: Main content loading time
- **First Input Delay (FID)**: Inter responsiveness
- **Cumulative Layout Shift (CLS)**: Visual stability
- **First Contentful Paint (FCP)**: Initial content render

#### Bundle Size Monitoring
- **JavaScript bundle size**: < 500KB budget
- **CSS bundle size**: < 50KB budget
- **Image optimization**: < 300KB budget
- **Total bundle size**: < 1MB budget

#### Performance Scores
- **Lighthouse Performance**: > 90 target
- **Lighthouse Accessibility**: > 95 target
- **Lighthouse Best Practices**: > 90 target

### 3. Database Performance Monitoring

#### Query Performance
- **Query execution times** tracking
- **Slow query identification** (> 500ms threshold)
- **Index usage analysis**
- **Connection pool monitoring**

#### Optimization Features
- **Performance indexes** on frequently queried columns
- **Materialized views** for dashboard queries
- **Query result caching** with Redis
- **Read replicas** for load distribution

### 4. Cache Performance Monitoring

#### Redis Metrics
- **Cache hit/miss ratios**: > 80% target
- **Memory usage**: < 80% threshold
- **Eviction rates**: Monitoring for cache churn
- **Key distribution**: Analyzing access patterns

#### Cache Strategies
- **API response caching**: 5-minute TTL
- **Database query caching**: Variable TTL
- **User session caching**: 30-minute TTL
- **Static asset caching**: Long-term TTL

## 🔧 Performance Testing

### 1. Automated Performance Tests

#### GitHub Actions Workflows
- **Performance Monitoring**: `.github/workflows/performance-monitoring.yml`
- **Performance Budget**: `.github/workflows/performance-budget.yml`

#### Test Types
- **Bundle Size Analysis**: Automated bundle size checking
- **Lighthouse CI**: Automated performance score testing
- **API Load Testing**: Artillery-based load testing
- **Database Performance**: Query performance testing

### 2. Running Performance Tests Locally

```bash
# Run full performance test suite
npm run test:performance

# Run bundle analysis
npm run performance:bundle

# Run Lighthouse testing
npx lhci autorun

# Run API load testing
artillery run scripts/performance/api-load-test.yml

# Generate performance report
npm run performance:monitor
```

### 3. Performance Budget Checking

```bash
# Check against performance budgets
node scripts/performance/check-performance-budget.js

# Analyze bundle size
node scripts/performance/analyze-bundle-size.js

# Run performance regression analysis
node scripts/performance/performance-regression-analysis.js
```

## 🚨 Alerting System

### 1. Alert Configuration

Alert rules are defined in `monitoring/performance/alert-rules.yml` and include:

#### Severity Levels
- **Critical**: Immediate attention required
- **Warning**: Investigate within business hours
- **Info**: For awareness and trend monitoring

#### Alert Channels
- **Slack**: Primary notification channel
- **Email**: For critical alerts
- **PagerDuty**: For critical infrastructure issues

### 2. Key Performance Alerts

#### API Performance Alerts
- **High API Latency**: Response times exceeding thresholds
- **Error Rate Spikes**: Increased error rates
- **Throughput Degradation**: Reduced request capacity

#### Frontend Performance Alerts
- **Slow Web Vitals**: Poor user experience metrics
- **Bundle Size Increases**: Exceeding performance budgets
- **JavaScript Errors**: Increased frontend error rates

#### System Resource Alerts
- **High CPU Usage**: > 80% (warning), > 95% (critical)
- **Memory Pressure**: > 85% (warning), > 95% (critical)
- **Disk Space**: > 80% usage warning

### 3. Alert Response Procedures

#### Immediate Response (Critical)
1. **Acknowledge alert** in monitoring system
2. **Check dashboard** for current status
3. **Identify affected services** and user impact
4. **Engage on-call team** if needed

#### Investigation (Warning)
1. **Review metrics trends** over past 24 hours
2. **Check recent deployments** for correlation
3. **Analyze error logs** for patterns
4. **Document findings** in incident report

## 📊 Performance Dashboards

### 1. Grafana Dashboard Configuration

Import the performance dashboard from `monitoring/performance/grafana-dashboard.json`:

```bash
# Import dashboard to Grafana
curl -X POST \
  http://admin:admin@localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @monitoring/performance/grafana-dashboard.json
```

### 2. Dashboard Panels

#### API Performance
- **Response Time Trends**: 95th and 50th percentiles
- **Request Rate**: Requests per second over time
- **Error Rate**: Percentage of failed requests
- **Endpoint Performance**: Individual endpoint metrics

#### Database Performance
- **Query Performance**: Execution time trends
- **Connection Pool**: Active connections
- **Slow Queries**: Query performance analysis
- **Index Efficiency**: Index usage statistics

#### Frontend Performance
- **Web Vitals**: LCP, FID, CLS trends
- **Bundle Size**: JavaScript and CSS bundle sizes
- **Page Load Times**: Performance over time
- **User Experience**: Performance scores

#### System Resources
- **CPU Usage**: System and process utilization
- **Memory Usage**: Memory consumption trends
- **Disk I/O**: Read/write performance
- **Network Traffic**: Bandwidth utilization

### 3. Custom Dashboard Creation

To create custom performance dashboards:

1. **Identify key metrics** for your use case
2. **Use appropriate panel types** (graphs, stats, tables)
3. **Set meaningful time ranges** (1h, 24h, 7d)
4. **Configure alerts** on important panels
5. **Share with team members**

## 🔍 Performance Analysis

### 1. Identifying Performance Issues

#### Key Indicators
- **Response Time Degradation**: Increasing API response times
- **Error Rate Increases**: Higher failure percentages
- **Throughput Reductions**: Decreased request capacity
- **Resource Exhaustion**: High CPU/memory usage

#### Analysis Techniques
- **Trend Analysis**: Review historical performance data
- **Correlation Analysis**: Link performance to deployments/events
- **Comparative Analysis**: Compare against baseline performance
- **Root Cause Analysis**: Identify underlying issues

### 2. Performance Optimization Workflow

#### Investigation Process
1. **Gather metrics** from monitoring dashboards
2. **Identify bottlenecks** through analysis
3. **Form hypotheses** about root causes
4. **Test hypotheses** with targeted experiments
5. **Implement fixes** and validate improvements

#### Common Optimization Areas
- **Database queries**: Add indexes, optimize queries
- **API responses**: Implement caching, reduce payload
- **Frontend assets**: Optimize bundles, lazy loading
- **System resources**: Scale resources, optimize usage

### 3. Performance Reporting

#### Regular Reports
- **Daily Performance Summary**: Automated daily reports
- **Weekly Performance Review**: Team performance analysis
- **Monthly Performance Trends**: Long-term performance analysis
- **Quarterly Performance Planning**: Strategic optimization planning

#### Report Contents
- **Performance metrics overview**
- **Trend analysis and insights**
- **Incident summary and impact**
- **Optimization recommendations**
- **Performance improvement roadmap**

## 🛠️ Troubleshooting

### 1. Common Performance Issues

#### Slow API Responses
**Symptoms**: High response times, user complaints
**Causes**: Database queries, inefficient code, network latency
**Solutions**: Query optimization, caching, code profiling

#### High Error Rates
**Symptoms**: Increased 5xx responses, failed requests
**Causes**: Code bugs, resource exhaustion, external dependencies
**Solutions**: Error handling, resource scaling, dependency monitoring

#### Frontend Performance Issues
**Symptoms**: Slow page loads, poor user experience
**Causes**: Large bundles, unoptimized images, render blocking
**Solutions**: Bundle optimization, image compression, critical path optimization

### 2. Diagnostic Tools

#### Backend Tools
- **Application Performance Monitoring (APM)**: New Relic, DataDog
- **Profiling Tools**: Node.js profiler, Chrome DevTools
- **Log Analysis**: ELK stack, Splunk
- **Database Analysis**: EXPLAIN ANALYZE, slow query logs

#### Frontend Tools
- **Lighthouse**: Web performance auditing
- **Chrome DevTools**: Performance profiling
- **WebPageTest**: Real-world performance testing
- **Bundle Analyzer**: Webpack Bundle Analyzer

### 3. Performance Emergency Procedures

#### Immediate Response
1. **Assess impact** on users and business operations
2. **Check monitoring dashboards** for current status
3. **Review recent changes** for correlation
4. **Implement quick fixes** if available
5. **Communicate status** to stakeholders

#### Recovery Process
1. **Stabilize service** with temporary measures
2. **Identify root cause** through detailed analysis
3. **Implement permanent fix** with proper testing
4. **Monitor closely** post-implementation
5. **Document lessons learned** for prevention

## 📚 Best Practices

### 1. Performance Monitoring

#### Setup Guidelines
- **Monitor critical paths**: User journeys and key business flows
- **Set appropriate thresholds**: Based on user expectations and business requirements
- **Use meaningful alerts**: Actionable notifications with clear context
- **Maintain dashboards**: Keep visualizations up-to-date and relevant

#### Data Collection
- **Collect relevant metrics**: Focus on actionable performance data
- **Use appropriate granularity**: Balance detail with storage costs
- **Implement sampling**: Reduce overhead while maintaining accuracy
- **Retain historical data**: Support trend analysis and capacity planning

### 2. Performance Testing

#### Testing Strategy
- **Test regularly**: Integrate performance testing into CI/CD
- **Test realistic scenarios**: Mirror real-world usage patterns
- **Test under load**: Validate performance at scale
- **Test regressions**: Catch performance issues early

#### Test Execution
- **Automate testing**: Reduce manual effort and ensure consistency
- **Use multiple tools**: Combine different testing approaches
- **Test in production-like environments**: Ensure realistic results
- **Document test results**: Track performance over time

### 3. Performance Optimization

#### Optimization Principles
- **Measure first**: Quantify performance before optimizing
- **Focus on users**: Prioritize optimizations that improve user experience
- **Consider trade-offs**: Balance performance with other concerns
- **Iterate continuously**: Performance is an ongoing process

#### Implementation Guidelines
- **Optimize critical paths**: Focus on high-impact improvements
- **Use caching strategically**: Reduce redundant work
- **Implement lazy loading**: Defer non-critical operations
- **Monitor optimizations**: Validate that changes have desired effect

## 🔗 Additional Resources

### Documentation
- [Performance Optimization Documentation](../PERFORMANCE_OPTIMIZATION.md)
- [API Documentation](../../backend/docs/api.md)
- [Frontend Performance Guide](../../frontend/docs/performance.md)

### Tools and Services
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Artillery Documentation](https://artillery.io/docs/)

### Community and Support
- [StillOnTime GitHub Repository](https://github.com/stillontime/performance)
- [Performance Engineering Slack Channel](#performance-engineering)
- [Performance Best Practices Blog](https://blog.stillontime.com/performance)

---

For questions or support with performance monitoring, contact the performance engineering team or create an issue in the performance repository.
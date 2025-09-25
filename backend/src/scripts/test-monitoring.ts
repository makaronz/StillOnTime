/**
 * Test script to demonstrate advanced monitoring and alerting functionality
 * This script shows the key features implemented in task 12.2
 */

import { MonitoringService } from "../services/monitoring.service";
import { ErrorHandlerService } from "../services/error-handler.service";
import { CacheService } from "../services/cache.service";
import { NotificationService } from "../services/notification.service";

// Mock dependencies for demonstration
class MockErrorHandlerService {
  getErrorMetrics() {
    return {
      oauth_errors: {
        errorCount: 5,
        lastOccurrence: new Date(),
        errorRate: 2.5,
        category: "authentication",
      },
      pdf_parsing_errors: {
        errorCount: 2,
        lastOccurrence: new Date(),
        errorRate: 1.0,
        category: "processing",
      },
    };
  }

  getCriticalFailures() {
    return [
      {
        serviceName: "gmail_api",
        failureTime: new Date(),
        errorCode: "QUOTA_EXCEEDED",
        impact: "high" as const,
        affectedOperations: ["email_processing"],
        recoveryTime: 300,
      },
    ];
  }
}

class MockCacheService {
  async set(key: string, value: any, ttl?: number) {
    console.log(`Cache SET: ${key} = ${value} (TTL: ${ttl}s)`);
  }

  async get(key: string) {
    console.log(`Cache GET: ${key}`);
    return "cached_value";
  }

  async delete(key: string) {
    console.log(`Cache DELETE: ${key}`);
  }
}

class MockNotificationService {
  async sendAlert(alertData: any) {
    console.log(`🚨 ALERT SENT: ${alertData.title} (${alertData.severity})`);
    console.log(`   Message: ${alertData.message}`);
    console.log(`   Metadata:`, alertData.metadata);
  }
}

async function demonstrateMonitoring() {
  console.log("🔍 StillOnTime Advanced Monitoring & Alerting Demo");
  console.log("=".repeat(60));

  // Initialize monitoring service with mocks
  const errorHandler = new MockErrorHandlerService() as any;
  const cache = new MockCacheService() as any;
  const notifications = new MockNotificationService() as any;

  const monitoring = new MonitoringService(errorHandler, cache, notifications);

  console.log("\n📊 1. Recording Request Metrics");
  console.log("-".repeat(40));

  // Simulate various request patterns
  const endpoints = [
    "GET /api/email/process",
    "POST /api/schedule/create",
    "GET /api/calendar/events",
    "POST /api/notifications/send",
  ];

  // Record successful requests
  for (let i = 0; i < 50; i++) {
    const endpoint = endpoints[i % endpoints.length];
    const responseTime = Math.random() * 1000 + 50; // 50-1050ms
    const isError = Math.random() < 0.05; // 5% error rate

    monitoring.recordRequest(endpoint, responseTime, isError);
  }

  // Record some slow requests to trigger alerts
  monitoring.recordRequest("GET /api/email/process", 8000, false); // Slow request
  monitoring.recordRequest("POST /api/schedule/create", 12000, true); // Very slow + error

  console.log(
    "✅ Recorded 52 requests with varying response times and error rates"
  );

  console.log("\n📈 2. Recording Business Metrics");
  console.log("-".repeat(40));

  // Record business metrics
  monitoring.recordBusinessMetric("emails_processed_per_hour", 25);
  monitoring.recordBusinessMetric("schedule_creation_success_rate", 94.5); // Below 95% threshold
  monitoring.recordBusinessMetric("calendar_event_creation_rate", 98.2);
  monitoring.recordBusinessMetric("notification_delivery_rate", 89.1); // Below 90% threshold
  monitoring.recordBusinessMetric("oauth_token_refresh_rate", 99.8);

  console.log("✅ Recorded business metrics including some below thresholds");

  console.log("\n🎯 3. Recording Custom Metrics");
  console.log("-".repeat(40));

  // Record custom metrics with metadata
  monitoring.recordCustomMetric(
    "pdf_processing_time",
    2500,
    "milliseconds",
    { complexity: "high", pages: "15" },
    "Time taken to process complex PDF documents"
  );

  monitoring.recordCustomMetric(
    "oauth_token_cache_hit_rate",
    85.5,
    "percent",
    { cache_type: "redis", region: "us-east-1" },
    "OAuth token cache hit rate for performance optimization"
  );

  monitoring.recordCustomMetric(
    "email_attachment_size_avg",
    2.8,
    "megabytes",
    { file_type: "pdf", source: "stillontime" },
    "Average size of email attachments processed"
  );

  console.log("✅ Recorded 3 custom metrics with tags and descriptions");

  console.log("\n🔔 4. Alerting Rules Configuration");
  console.log("-".repeat(40));

  const alertingRules = monitoring.getAlertingRules();
  console.log(`📋 Total alerting rules configured: ${alertingRules.length}`);

  const criticalRules = alertingRules.filter(
    (rule) => rule.severity === "critical"
  );
  const highRules = alertingRules.filter((rule) => rule.severity === "high");
  const mediumRules = alertingRules.filter(
    (rule) => rule.severity === "medium"
  );

  console.log(`   🚨 Critical: ${criticalRules.length} rules`);
  console.log(`   ⚠️  High: ${highRules.length} rules`);
  console.log(`   📊 Medium: ${mediumRules.length} rules`);

  // Show some example rules
  console.log("\n📝 Example Alerting Rules:");
  criticalRules.slice(0, 2).forEach((rule) => {
    console.log(`   • ${rule.name}: ${rule.description}`);
    console.log(
      `     Condition: ${rule.condition} (threshold: ${rule.threshold})`
    );
    console.log(`     Channels: ${rule.notificationChannels.join(", ")}`);
  });

  console.log("\n🎛️  5. Monitoring Dashboard Data");
  console.log("-".repeat(40));

  const dashboard = await monitoring.getMonitoringDashboard();

  console.log("📊 System Overview:");
  console.log(`   Status: ${dashboard.systemOverview.status.toUpperCase()}`);
  console.log(
    `   Uptime: ${Math.floor(
      dashboard.systemOverview.uptime / 3600
    )}h ${Math.floor((dashboard.systemOverview.uptime % 3600) / 60)}m`
  );
  console.log(`   Total Requests: ${dashboard.systemOverview.totalRequests}`);
  console.log(
    `   Error Rate: ${dashboard.systemOverview.errorRate.toFixed(2)}%`
  );
  console.log(
    `   Avg Response Time: ${dashboard.systemOverview.averageResponseTime.toFixed(
      0
    )}ms`
  );

  console.log("\n📈 APM Metrics:");
  console.log(
    `   APDEX Score: ${dashboard.apmMetrics.applicationPerformance.apdex.toFixed(
      3
    )}`
  );
  console.log(
    `   P99 Response Time: ${dashboard.apmMetrics.applicationPerformance.responseTimeP99.toFixed(
      0
    )}ms`
  );
  console.log(
    `   Throughput: ${dashboard.apmMetrics.applicationPerformance.throughput} req/min`
  );

  console.log("\n💼 Business Metrics:");
  console.log(
    `   Emails/Hour: ${dashboard.apmMetrics.businessMetrics.emailsProcessedPerHour}`
  );
  console.log(
    `   Schedule Success: ${dashboard.apmMetrics.businessMetrics.scheduleCreationSuccessRate.toFixed(
      1
    )}%`
  );
  console.log(
    `   Calendar Events: ${dashboard.apmMetrics.businessMetrics.calendarEventCreationRate.toFixed(
      1
    )}%`
  );
  console.log(
    `   Notifications: ${dashboard.apmMetrics.businessMetrics.notificationDeliveryRate.toFixed(
      1
    )}%`
  );

  console.log("\n🖥️  Resource Utilization:");
  console.log(
    `   CPU Usage: ${dashboard.apmMetrics.resourceUtilization.cpuUsagePercent.toFixed(
      1
    )}%`
  );
  console.log(
    `   Memory Usage: ${dashboard.apmMetrics.resourceUtilization.memoryUsagePercent.toFixed(
      1
    )}%`
  );
  console.log(
    `   DB Connections: ${dashboard.apmMetrics.resourceUtilization.databaseConnectionsActive}`
  );
  console.log(
    `   Redis Connections: ${dashboard.apmMetrics.resourceUtilization.redisConnectionsActive}`
  );

  console.log("\n🎯 Custom Metrics:");
  const customMetrics = monitoring.getCustomMetrics();
  customMetrics.forEach((metric) => {
    console.log(`   • ${metric.name}: ${metric.value} ${metric.unit}`);
    if (Object.keys(metric.tags).length > 0) {
      console.log(
        `     Tags: ${Object.entries(metric.tags)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      );
    }
  });

  console.log("\n🚨 6. Active Alerts");
  console.log("-".repeat(40));

  if (dashboard.alerts.length > 0) {
    console.log(`📢 ${dashboard.alerts.length} active alerts:`);
    dashboard.alerts.forEach((alert) => {
      const emoji =
        {
          critical: "🚨",
          high: "⚠️",
          medium: "📊",
          low: "💡",
        }[alert.severity] || "📢";

      console.log(`   ${emoji} ${alert.message}`);
      console.log(`     Severity: ${alert.severity.toUpperCase()}`);
      console.log(`     Time: ${alert.timestamp.toLocaleString()}`);
      if (alert.metadata.currentValue !== undefined) {
        console.log(
          `     Current: ${alert.metadata.currentValue} (threshold: ${alert.metadata.threshold})`
        );
      }
    });
  } else {
    console.log("✅ No active alerts");
  }

  console.log("\n🔧 7. Health Check Endpoints");
  console.log("-".repeat(40));
  console.log("Available health check endpoints:");
  console.log("   • GET /api/monitoring/health - Basic health check");
  console.log(
    "   • GET /api/monitoring/health/detailed - Detailed health with circuit breakers"
  );
  console.log(
    "   • GET /api/monitoring/health/readiness - Kubernetes readiness probe"
  );
  console.log(
    "   • GET /api/monitoring/health/liveness - Kubernetes liveness probe"
  );

  console.log("\n📊 8. Advanced Monitoring Endpoints");
  console.log("-".repeat(40));
  console.log("Available monitoring endpoints:");
  console.log(
    "   • GET /api/monitoring/dashboard - Comprehensive monitoring dashboard"
  );
  console.log("   • GET /api/monitoring/apm/history - APM metrics history");
  console.log(
    "   • GET /api/monitoring/performance/history - Performance metrics history"
  );
  console.log(
    "   • GET /api/monitoring/services/:name/history - Service health history"
  );
  console.log("   • GET /api/monitoring/metrics/custom - Custom metrics");
  console.log(
    "   • POST /api/monitoring/metrics/custom - Record custom metric"
  );
  console.log("   • GET /api/monitoring/alerts/rules - Alerting rules");
  console.log(
    "   • PUT /api/monitoring/alerts/rules/:id - Update alerting rule"
  );
  console.log("   • POST /api/monitoring/alerts/:id/resolve - Resolve alert");

  console.log("\n✨ 9. Key Features Implemented");
  console.log("-".repeat(40));
  console.log("✅ Application Performance Monitoring (APM):");
  console.log("   • Response time percentiles (P50, P95, P99)");
  console.log("   • APDEX score calculation");
  console.log("   • Throughput and error rate tracking");
  console.log("   • Resource utilization monitoring");

  console.log("\n✅ Custom Metrics and Dashboards:");
  console.log("   • Business metrics tracking");
  console.log("   • Custom metrics with tags and metadata");
  console.log("   • Comprehensive monitoring dashboard");
  console.log("   • Historical data collection and analysis");

  console.log("\n✅ Automated Alerting:");
  console.log("   • Advanced alerting rules with conditions");
  console.log("   • Multiple severity levels and cooldown periods");
  console.log("   • Multi-channel notifications (email, SMS)");
  console.log("   • Alert resolution and management");

  console.log("\n✅ Health Check Endpoints:");
  console.log("   • Detailed service status monitoring");
  console.log("   • Kubernetes-compatible probes");
  console.log("   • Circuit breaker status tracking");
  console.log("   • Error metrics and critical failure tracking");

  // Cleanup
  monitoring.stopMonitoring();

  console.log("\n🎉 Monitoring demonstration completed successfully!");
  console.log("=".repeat(60));
}

// Run the demonstration
if (require.main === module) {
  demonstrateMonitoring().catch(console.error);
}

export { demonstrateMonitoring };

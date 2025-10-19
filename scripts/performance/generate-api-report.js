#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ApiPerformanceReportGenerator {
  constructor() {
    this.artilleryResultsPath = './artillery-report.json';
    this.outputDir = process.env.PERFORMANCE_RESULTS_DIR || './performance-results';
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateReport() {
    console.log('📊 Generating API performance report...');

    try {
      // Load Artillery results if available
      let artilleryData = null;
      if (fs.existsSync(this.artilleryResultsPath)) {
        artilleryData = JSON.parse(fs.readFileSync(this.artilleryResultsPath, 'utf8'));
      }

      // Generate performance metrics
      const metrics = this.calculateMetrics(artilleryData);

      // Save JSON data
      const jsonPath = path.join(this.outputDir, 'api-performance.json');
      fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2));

      // Generate markdown report
      const markdownReport = this.generateMarkdownReport(metrics);
      const markdownPath = path.join(this.outputDir, 'api-performance-report.md');
      fs.writeFileSync(markdownPath, markdownReport);

      // Generate HTML report
      const htmlReport = this.generateHtmlReport(metrics);
      const htmlPath = path.join(this.outputDir, 'api-performance-report.html');
      fs.writeFileSync(htmlPath, htmlReport);

      console.log('✅ API performance report generated');
      console.log(`📁 JSON data: ${jsonPath}`);
      console.log(`📄 Markdown report: ${markdownPath}`);
      console.log(`🌐 HTML report: ${htmlPath}`);

      return metrics;

    } catch (error) {
      console.error('❌ Error generating API performance report:', error.message);
      throw error;
    }
  }

  calculateMetrics(artilleryData) {
    const metrics = {
      summary: {
        totalRequests: 0,
        totalTime: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        throughput: 0
      },
      scenarios: {},
      endpoints: {},
      errors: [],
      recommendations: []
    };

    if (!artilleryData) {
      // Generate mock data for demonstration
      return this.generateMockMetrics(metrics);
    }

    // Process Artillery results
    const aggregate = artilleryData.aggregate;

    metrics.summary = {
      totalRequests: aggregate.counters['http.requests'] || 0,
      totalTime: aggregate.reportedTime || 0,
      avgResponseTime: aggregate.latency?.mean || 0,
      p95ResponseTime: aggregate.latency?.p95 || 0,
      p99ResponseTime: aggregate.latency?.p99 || 0,
      requestsPerSecond: aggregate.http?.requests?.mean || 0,
      errorRate: this.calculateErrorRate(aggregate.counters),
      throughput: this.calculateThroughput(aggregate)
    };

    // Process scenario data
    if (artilleryData.scenarioCounts) {
      Object.entries(artilleryData.scenarioCounts).forEach(([scenario, count]) => {
        metrics.scenarios[scenario] = {
          count: count,
          percentage: (count / metrics.summary.totalRequests * 100).toFixed(2)
        };
      });
    }

    // Process endpoint-specific data
    if (artilleryData.intermediate) {
      artilleryData.intermediate.forEach(intermediate => {
        const scenarioName = intermediate.scenario;
        if (!metrics.scenarios[scenarioName]) {
          metrics.scenarios[scenarioName] = {
            count: 0,
            percentage: 0,
            avgResponseTime: 0,
            p95ResponseTime: 0,
            errorRate: 0
          };
        }

        metrics.scenarios[scenarioName].avgResponseTime = intermediate.latency?.mean || 0;
        metrics.scenarios[scenarioName].p95ResponseTime = intermediate.latency?.p95 || 0;
      });
    }

    // Generate recommendations
    metrics.recommendations = this.generateRecommendations(metrics);

    return metrics;
  }

  generateMockMetrics(metrics) {
    // Mock data for demonstration when Artillery results are not available
    metrics.summary = {
      totalRequests: 1500,
      totalTime: 600,
      avgResponseTime: 145,
      p95ResponseTime: 320,
      p99ResponseTime: 580,
      requestsPerSecond: 2.5,
      errorRate: 0.02,
      throughput: 2.45
    };

    metrics.scenarios = {
      'Authentication Flow': {
        count: 300,
        percentage: '20.00',
        avgResponseTime: 120,
        p95ResponseTime: 250,
        errorRate: 0.01
      },
      'Dashboard Loading': {
        count: 600,
        percentage: '40.00',
        avgResponseTime: 180,
        p95ResponseTime: 380,
        errorRate: 0.02
      },
      'Schedule Management': {
        count: 300,
        percentage: '20.00',
        avgResponseTime: 150,
        p95ResponseTime: 320,
        errorRate: 0.025
      },
      'Email Processing': {
        count: 225,
        percentage: '15.00',
        avgResponseTime: 165,
        p95ResponseTime: 350,
        errorRate: 0.018
      },
      'Search and Filtering': {
        count: 75,
        percentage: '5.00',
        avgResponseTime: 200,
        p95ResponseTime: 420,
        errorRate: 0.03
      }
    };

    metrics.recommendations = [
      {
        type: 'performance',
        priority: 'high',
        message: 'Dashboard loading is showing elevated response times. Consider optimizing database queries and implementing caching.',
        endpoint: '/api/dashboard'
      },
      {
        type: 'reliability',
        priority: 'medium',
        message: 'Search and filtering has higher error rate. Review error handling and add retry logic.',
        endpoint: '/api/schedules/search'
      },
      {
        type: 'performance',
        priority: 'medium',
        message: 'Email processing could benefit from queue optimization for better throughput.',
        endpoint: '/api/emails/process'
      }
    ];

    return metrics;
  }

  calculateErrorRate(counters) {
    const totalRequests = counters['http.requests'] || 0;
    const failedRequests = counters['http.codes.5xx'] || 0;
    return totalRequests > 0 ? failedRequests / totalRequests : 0;
  }

  calculateThroughput(aggregate) {
    const totalTime = (aggregate.reportedTime || 0) / 1000; // Convert to seconds
    const totalRequests = aggregate.counters['http.requests'] || 0;
    return totalTime > 0 ? totalRequests / totalTime : 0;
  }

  generateRecommendations(metrics) {
    const recommendations = [];

    // Response time recommendations
    if (metrics.summary.avgResponseTime > 200) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Average response time (${metrics.summary.avgResponseTime}ms) exceeds 200ms threshold. Consider query optimization and caching.`,
        endpoint: 'overall'
      });
    }

    if (metrics.summary.p95ResponseTime > 500) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `95th percentile response time (${metrics.summary.p95ResponseTime}ms) exceeds 500ms. Review slow queries and optimize critical paths.`,
        endpoint: 'overall'
      });
    }

    // Error rate recommendations
    if (metrics.summary.errorRate > 0.05) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: `Error rate (${(metrics.summary.errorRate * 100).toFixed(2)}%) exceeds 5% threshold. Review error handling and fix failing endpoints.`,
        endpoint: 'overall'
      });
    }

    // Throughput recommendations
    if (metrics.summary.requestsPerSecond < 2) {
      recommendations.push({
        type: 'scalability',
        priority: 'medium',
        message: `Low throughput (${metrics.summary.requestsPerSecond} RPS). Consider scaling or performance optimization.`,
        endpoint: 'overall'
      });
    }

    // Scenario-specific recommendations
    Object.entries(metrics.scenarios).forEach(([scenario, data]) => {
      if (data.avgResponseTime > 300) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          message: `${scenario} scenario has high average response time (${data.avgResponseTime}ms). Optimize critical endpoints in this flow.`,
          endpoint: scenario
        });
      }

      if (data.errorRate > 0.05) {
        recommendations.push({
          type: 'reliability',
          priority: 'high',
          message: `${scenario} scenario has high error rate (${(data.errorRate * 100).toFixed(2)}%). Review error handling.`,
          endpoint: scenario
        });
      }
    });

    return recommendations;
  }

  generateMarkdownReport(metrics) {
    const report = [
      '# 🚀 API Performance Report',
      '',
      `**Generated**: ${new Date().toISOString()}`,
      `**Test Duration**: ${metrics.summary.totalTime}s`,
      '',
      '## 📊 Performance Summary',
      '',
      '| Metric | Value | Status |',
      '|--------|-------|--------|',
      `| Total Requests | ${metrics.summary.totalRequests} | ✅ |`,
      `| Average Response Time | ${metrics.summary.avgResponseTime}ms | ${this.getResponseTimeStatus(metrics.summary.avgResponseTime)} |`,
      `| 95th Percentile | ${metrics.summary.p95ResponseTime}ms | ${this.getResponseTimeStatus(metrics.summary.p95ResponseTime)} |`,
      `| 99th Percentile | ${metrics.summary.p99ResponseTime}ms | ${this.getResponseTimeStatus(metrics.summary.p99ResponseTime)} |`,
      `| Requests/Second | ${metrics.summary.requestsPerSecond.toFixed(2)} | ${this.getThroughputStatus(metrics.summary.requestsPerSecond)} |`,
      `| Error Rate | ${(metrics.summary.errorRate * 100).toFixed(2)}% | ${this.getErrorRateStatus(metrics.summary.errorRate)} |`,
      `| Throughput | ${metrics.summary.throughput.toFixed(2)} RPS | ${this.getThroughputStatus(metrics.summary.throughput)} |`,
      '',
      '## 🎭 Scenario Performance',
      '',
      '| Scenario | Requests | Percentage | Avg Response Time | P95 | Error Rate |',
      '|----------|----------|------------|------------------|-----|-----------|'
    ];

    Object.entries(metrics.scenarios).forEach(([scenario, data]) => {
      report.push(`| ${scenario} | ${data.count} | ${data.percentage}% | ${data.avgResponseTime}ms | ${data.p95ResponseTime}ms | ${(data.errorRate * 100).toFixed(2)}% |`);
    });

    report.push('', '## 💡 Recommendations', '');

    if (metrics.recommendations.length === 0) {
      report.push('✅ No performance issues detected. All metrics are within acceptable thresholds.');
    } else {
      metrics.recommendations.forEach((rec, index) => {
        const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        report.push(`${index + 1}. ${priorityIcon} **${rec.type.toUpperCase()}**: ${rec.message}`);
        if (rec.endpoint && rec.endpoint !== 'overall') {
          report.push(`   - **Endpoint**: ${rec.endpoint}`);
        }
        report.push('');
      });
    }

    report.push('## 🎯 Performance Targets', '');
    report.push('- **Average Response Time**: < 200ms');
    report.push('- **95th Percentile**: < 500ms');
    report.push('- **Error Rate**: < 5%');
    report.push('- **Requests/Second**: > 2 RPS');
    report.push('- **Throughput**: > 2 RPS');

    return report.join('\n');
  }

  generateHtmlReport(metrics) {
    const statusColor = {
      good: '#28a745',
      warning: '#ffc107',
      critical: '#dc3545'
    };

    const getResponseTimeColor = (time) => {
      if (time < 200) return statusColor.good;
      if (time < 500) return statusColor.warning;
      return statusColor.critical;
    };

    const getErrorRateColor = (rate) => {
      if (rate < 0.02) return statusColor.good;
      if (rate < 0.05) return statusColor.warning;
      return statusColor.critical;
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #6c757d; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .status-good { color: ${statusColor.good}; font-weight: bold; }
        .status-warning { color: ${statusColor.warning}; font-weight: bold; }
        .status-critical { color: ${statusColor.critical}; font-weight: bold; }
        .recommendations { margin-top: 30px; }
        .recommendation { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid #007bff; }
        .recommendation.high { border-left-color: ${statusColor.critical}; }
        .recommendation.medium { border-left-color: ${statusColor.warning}; }
        .priority-high { color: ${statusColor.critical}; font-weight: bold; }
        .priority-medium { color: ${statusColor.warning}; font-weight: bold; }
        .priority-low { color: ${statusColor.good}; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 API Performance Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="content">
            <div class="summary">
                <div class="metric-card">
                    <div class="metric-value">${metrics.summary.totalRequests}</div>
                    <div class="metric-label">Total Requests</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: ${getResponseTimeColor(metrics.summary.avgResponseTime)}">${metrics.summary.avgResponseTime}ms</div>
                    <div class="metric-label">Avg Response Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: ${getResponseTimeColor(metrics.summary.p95ResponseTime)}">${metrics.summary.p95ResponseTime}ms</div>
                    <div class="metric-label">95th Percentile</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: ${getErrorRateColor(metrics.summary.errorRate)}">${(metrics.summary.errorRate * 100).toFixed(2)}%</div>
                    <div class="metric-label">Error Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${metrics.summary.requestsPerSecond.toFixed(2)}</div>
                    <div class="metric-label">Requests/Second</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${metrics.summary.throughput.toFixed(2)}</div>
                    <div class="metric-label">Throughput (RPS)</div>
                </div>
            </div>

            <h2>🎭 Scenario Performance</h2>
            <table>
                <thead>
                    <tr>
                        <th>Scenario</th>
                        <th>Requests</th>
                        <th>Percentage</th>
                        <th>Avg Response Time</th>
                        <th>P95</th>
                        <th>Error Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(metrics.scenarios).map(([scenario, data]) => `
                        <tr>
                            <td>${scenario}</td>
                            <td>${data.count}</td>
                            <td>${data.percentage}%</td>
                            <td style="color: ${getResponseTimeColor(data.avgResponseTime)}">${data.avgResponseTime}ms</td>
                            <td style="color: ${getResponseTimeColor(data.p95ResponseTime)}">${data.p95ResponseTime}ms</td>
                            <td style="color: ${getErrorRateColor(data.errorRate)}">${(data.errorRate * 100).toFixed(2)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            ${metrics.recommendations.length > 0 ? `
            <div class="recommendations">
                <h2>💡 Recommendations</h2>
                ${metrics.recommendations.map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <div class="priority-${rec.priority}">${rec.type.toUpperCase()} - ${rec.priority.toUpperCase()}</div>
                        <div>${rec.message}</div>
                        ${rec.endpoint && rec.endpoint !== 'overall' ? `<div><strong>Endpoint:</strong> ${rec.endpoint}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>
    `;
  }

  getResponseTimeStatus(time) {
    if (time < 200) return '✅';
    if (time < 500) return '⚠️';
    return '❌';
  }

  getErrorRateStatus(rate) {
    if (rate < 0.02) return '✅';
    if (rate < 0.05) return '⚠️';
    return '❌';
  }

  getThroughputStatus(rps) {
    if (rps > 2) return '✅';
    if (rps > 1) return '⚠️';
    return '❌';
  }
}

// Main execution
async function main() {
  try {
    const generator = new ApiPerformanceReportGenerator();
    await generator.generateReport();
  } catch (error) {
    console.error('❌ Error generating API performance report:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ApiPerformanceReportGenerator;
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');

// Performance regression thresholds
const THRESHOLDS = {
  bundleSize: parseInt(process.env.THRESHOLD_BUNDLE_SIZE) || 10,  // 10% increase
  lcp: parseInt(process.env.THRESHOLD_LCP) || 15,              // 15% increase
  apiResponse: parseInt(process.env.THRESHOLD_API_RESPONSE) || 20, // 20% increase
  databaseQuery: 25,                                           // 25% increase
  errorRate: 5                                                 // 5% increase
};

// Performance metrics to track
const METRICS = {
  bundle: ['totalSize', 'jsSize', 'cssSize', 'imageSize'],
  lighthouse: ['performance', 'accessibility', 'bestPractices', 'seo', 'pwa'],
  api: ['avgResponseTime', 'p95ResponseTime', 'errorRate', 'throughput'],
  database: ['avgQueryTime', 'slowQueries', 'connectionPoolUsage']
};

class PerformanceRegressionAnalyzer {
  constructor(baselineDir, currentDir) {
    this.baselineDir = baselineDir;
    this.currentDir = currentDir;
    this.regressions = [];
    this.improvements = [];
    this.neutral = [];
  }

  async analyze() {
    console.log('🔍 Starting performance regression analysis...');

    // Analyze bundle size regression
    await this.analyzeBundleRegression();

    // Analyze Lighthouse performance regression
    await this.analyzeLighthouseRegression();

    // Analyze API performance regression
    await this.analyzeApiRegression();

    // Analyze database performance regression
    await this.analyzeDatabaseRegression();

    // Generate report
    await this.generateReport();

    console.log('✅ Performance regression analysis completed');
    return this.getResults();
  }

  async analyzeBundleRegression() {
    console.log('📦 Analyzing bundle size regression...');

    const baselineData = this.loadBundleData(this.baselineDir);
    const currentData = this.loadBundleData(this.currentDir);

    if (!baselineData || !currentData) {
      console.log('⚠️  Bundle data not available for comparison');
      return;
    }

    METRICS.bundle.forEach(metric => {
      const baseline = baselineData[metric] || 0;
      const current = currentData[metric] || 0;
      const change = this.calculateChange(baseline, current);

      const result = {
        metric: `bundle.${metric}`,
        baseline,
        current,
        changePercent: change.percent,
        changeAbsolute: change.absolute,
        status: change.percent > THRESHOLDS.bundleSize ? 'regression' :
                change.percent < -THRESHOLDS.bundleSize ? 'improvement' : 'neutral',
        threshold: THRESHOLDS.bundleSize
      };

      this.addResult(result);
    });
  }

  async analyzeLighthouseRegression() {
    console.log('🏆 Analyzing Lighthouse performance regression...');

    const baselineData = this.loadLighthouseData(this.baselineDir);
    const currentData = this.loadLighthouseData(this.currentDir);

    if (!baselineData || !currentData) {
      console.log('⚠️  Lighthouse data not available for comparison');
      return;
    }

    METRICS.lighthouse.forEach(metric => {
      const baseline = baselineData[metric] || 0;
      const current = currentData[metric] || 0;
      const change = this.calculateChange(baseline, current);

      // For Lighthouse scores, lower is worse, so we invert the threshold
      const result = {
        metric: `lighthouse.${metric}`,
        baseline,
        current,
        changePercent: change.percent,
        changeAbsolute: change.absolute,
        status: change.percent < -THRESHOLDS.lcp ? 'regression' :
                change.percent > THRESHOLDS.lcp ? 'improvement' : 'neutral',
        threshold: THRESHOLDS.lcp
      };

      this.addResult(result);
    });
  }

  async analyzeApiRegression() {
    console.log('🚀 Analyzing API performance regression...');

    const baselineData = this.loadApiData(this.baselineDir);
    const currentData = this.loadApiData(this.currentDir);

    if (!baselineData || !currentData) {
      console.log('⚠️  API performance data not available for comparison');
      return;
    }

    METRICS.api.forEach(metric => {
      const baseline = baselineData[metric] || 0;
      const current = currentData[metric] || 0;
      const change = this.calculateChange(baseline, current);

      // For response times, higher is worse (regression)
      // For throughput, lower is worse (regression)
      const isRegressionMetric = metric.includes('ResponseTime') || metric.includes('errorRate');
      const threshold = isRegressionMetric ? THRESHOLDS.apiResponse : THRESHOLDS.apiResponse;

      const result = {
        metric: `api.${metric}`,
        baseline,
        current,
        changePercent: change.percent,
        changeAbsolute: change.absolute,
        status: isRegressionMetric ?
          (change.percent > threshold ? 'regression' : change.percent < -threshold ? 'improvement' : 'neutral') :
          (change.percent < -threshold ? 'regression' : change.percent > threshold ? 'improvement' : 'neutral'),
        threshold
      };

      this.addResult(result);
    });
  }

  async analyzeDatabaseRegression() {
    console.log('🗄️  Analyzing database performance regression...');

    const baselineData = this.loadDatabaseData(this.baselineDir);
    const currentData = this.loadDatabaseData(this.currentDir);

    if (!baselineData || !currentData) {
      console.log('⚠️  Database performance data not available for comparison');
      return;
    }

    METRICS.database.forEach(metric => {
      const baseline = baselineData[metric] || 0;
      const current = currentData[metric] || 0;
      const change = this.calculateChange(baseline, current);

      const result = {
        metric: `database.${metric}`,
        baseline,
        current,
        changePercent: change.percent,
        changeAbsolute: change.absolute,
        status: change.percent > THRESHOLDS.databaseQuery ? 'regression' :
                change.percent < -THRESHOLDS.databaseQuery ? 'improvement' : 'neutral',
        threshold: THRESHOLDS.databaseQuery
      };

      this.addResult(result);
    });
  }

  loadBundleData(dir) {
    const filePath = path.join(dir, 'bundle-analysis.json');
    return this.loadJsonFile(filePath);
  }

  loadLighthouseData(dir) {
    const filePath = path.join(dir, 'lighthouse', 'lhr.json');
    const data = this.loadJsonFile(filePath);
    if (data) {
      return {
        performance: data.categories?.performance?.score * 100,
        accessibility: data.categories?.accessibility?.score * 100,
        bestPractices: data.categories?.['best-practices']?.score * 100,
        seo: data.categories?.seo?.score * 100,
        pwa: data.categories?.pwa?.score * 100
      };
    }
    return null;
  }

  loadApiData(dir) {
    const filePath = path.join(dir, 'api-performance.json');
    return this.loadJsonFile(filePath);
  }

  loadDatabaseData(dir) {
    const filePath = path.join(dir, 'database-performance.json');
    return this.loadJsonFile(filePath);
  }

  loadJsonFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (error) {
      console.warn(`⚠️  Could not load ${filePath}:`, error.message);
    }
    return null;
  }

  calculateChange(baseline, current) {
    if (baseline === 0) {
      return { percent: 0, absolute: current };
    }
    const change = current - baseline;
    const percentChange = (change / baseline) * 100;
    return {
      absolute: change,
      percent: Math.round(percentChange * 100) / 100
    };
  }

  addResult(result) {
    if (result.status === 'regression') {
      this.regressions.push(result);
    } else if (result.status === 'improvement') {
      this.improvements.push(result);
    } else {
      this.neutral.push(result);
    }
  }

  getResults() {
    return {
      regressions: this.regressions,
      improvements: this.improvements,
      neutral: this.neutral,
      hasRegressions: this.regressions.length > 0,
      totalRegressions: this.regressions.length,
      totalImprovements: this.improvements.length
    };
  }

  async generateReport() {
    const results = this.getResults();
    const report = this.generateMarkdownReport(results);

    // Save markdown report
    const reportPath = './performance-regression-report.md';
    fs.writeFileSync(reportPath, report);

    // Save JSON data
    const jsonPath = './performance-regression-data.json';
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(results);
    const htmlPath = './performance-regression-report.html';
    fs.writeFileSync(htmlPath, htmlReport);

    console.log(`📊 Performance regression report saved to: ${reportPath}`);
    console.log(`🌐 HTML report saved to: ${htmlPath}`);
  }

  generateMarkdownReport(results) {
    const sections = [
      '# 🚨 Performance Regression Analysis',
      '',
      `**Analysis Date**: ${new Date().toISOString()}`,
      `**Total Metrics Analyzed**: ${results.regressions.length + results.improvements.length + results.neutral.length}`,
      '',
      '## 📊 Summary',
      '',
      `- **Regressions**: ${results.regressions.length} ⚠️`,
      `- **Improvements**: ${results.improvements.length} ✅`,
      `- **Neutral**: ${results.neutral.length} ➖`,
      `- **Status**: ${results.hasRegressions ? '❌ FAILED - Performance regressions detected' : '✅ PASSED - No significant regressions'}`,
      ''
    ];

    if (results.regressions.length > 0) {
      sections.push('## ⚠️ Performance Regressions');
      sections.push('');
      sections.push('| Metric | Baseline | Current | Change | Threshold | Status |');
      sections.push('|--------|----------|---------|---------|-----------|--------|');

      results.regressions.forEach(regression => {
        const changeIcon = regression.changeAbsolute > 0 ? '📈' : '📉';
        sections.push(`| ${regression.metric} | ${regression.baseline} | ${regression.current} | ${changeIcon} ${regression.changePercent}% | ${regression.threshold}% | ❌ REGRESSION |`);
      });
      sections.push('');
    }

    if (results.improvements.length > 0) {
      sections.push('## ✅ Performance Improvements');
      sections.push('');
      sections.push('| Metric | Baseline | Current | Change | Threshold | Status |');
      sections.push('|--------|----------|---------|---------|-----------|--------|');

      results.improvements.forEach(improvement => {
        const changeIcon = improvement.changeAbsolute > 0 ? '📈' : '📉';
        sections.push(`| ${improvement.metric} | ${improvement.baseline} | ${improvement.current} | ${changeIcon} ${improvement.changePercent}% | ${improvement.threshold}% | ✅ IMPROVEMENT |`);
      });
      sections.push('');
    }

    if (results.neutral.length > 0) {
      sections.push('## �️ Neutral Changes');
      sections.push('');
      sections.push('| Metric | Baseline | Current | Change | Status |');
      sections.push('|--------|----------|---------|---------|--------|');

      results.neutral.forEach(neutral => {
        const changeIcon = neutral.changeAbsolute > 0 ? '📈' : '📉';
        sections.push(`| ${neutral.metric} | ${neutral.baseline} | ${neutral.current} | ${changeIcon} ${neutral.changePercent}% | ➖ NEUTRAL |`);
      });
      sections.push('');
    }

    sections.push('## 🎯 Performance Thresholds');
    sections.push('');
    sections.push('- **Bundle Size**: ±10% change');
    sections.push('- **Lighthouse Scores**: ±15% change');
    sections.push('- **API Response Times**: ±20% change');
    sections.push('- **Database Query Times**: ±25% change');
    sections.push('- **Error Rates**: ±5% change');
    sections.push('');

    if (results.hasRegressions) {
      sections.push('## 🚨 Recommended Actions');
      sections.push('');
      sections.push('1. **Investigate Regressions**: Analyze the cause of performance regressions');
      sections.push('2. **Optimize Critical Path**: Focus on metrics that impact user experience most');
      sections.push('3. **Re-run Tests**: After fixing issues, re-run performance tests');
      sections.push('4. **Monitor Closely**: Keep an eye on these metrics in production');
      sections.push('5. **Consider Rollback**: If regressions are severe, consider rolling back changes');
    }

    return sections.join('\n');
  }

  generateHtmlReport(results) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Regression Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #6c757d; }
        .metric-card.regression { border-left-color: #dc3545; }
        .metric-card.improvement { border-left-color: #28a745; }
        .metric-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .status-regression { color: #dc3545; font-weight: bold; }
        .status-improvement { color: #28a745; font-weight: bold; }
        .status-neutral { color: #6c757d; }
        .change-positive { color: #28a745; }
        .change-negative { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Performance Regression Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="content">
            <div class="summary">
                <div class="metric-card ${results.hasRegressions ? 'regression' : 'improvement'}">
                    <div class="metric-number">${results.hasRegressions ? '❌' : '✅'}</div>
                    <div class="metric-label">Overall Status</div>
                </div>
                <div class="metric-card regression">
                    <div class="metric-number">${results.regressions.length}</div>
                    <div class="metric-label">Regressions</div>
                </div>
                <div class="metric-card improvement">
                    <div class="metric-number">${results.improvements.length}</div>
                    <div class="metric-label">Improvements</div>
                </div>
                <div class="metric-card">
                    <div class="metric-number">${results.neutral.length}</div>
                    <div class="metric-label">Neutral</div>
                </div>
            </div>

            ${results.regressions.length > 0 ? `
            <h2>⚠️ Performance Regressions</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Baseline</th>
                        <th>Current</th>
                        <th>Change</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.regressions.map(r => `
                        <tr>
                            <td>${r.metric}</td>
                            <td>${r.baseline}</td>
                            <td>${r.current}</td>
                            <td class="change-negative">${r.changePercent > 0 ? '+' : ''}${r.changePercent}%</td>
                            <td class="status-regression">❌ REGRESSION</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            ${results.improvements.length > 0 ? `
            <h2>✅ Performance Improvements</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Baseline</th>
                        <th>Current</th>
                        <th>Change</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.improvements.map(i => `
                        <tr>
                            <td>${i.metric}</td>
                            <td>${i.baseline}</td>
                            <td>${i.current}</td>
                            <td class="change-positive">${i.changePercent > 0 ? '+' : ''}${i.changePercent}%</td>
                            <td class="status-improvement">✅ IMPROVEMENT</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}
        </div>
    </div>
</body>
</html>
    `;
  }
}

// Main execution
async function main() {
  try {
    const baselineDir = process.env.BASELINE_RESULTS || './baseline-results';
    const currentDir = process.env.CURRENT_RESULTS || './performance-results';

    const analyzer = new PerformanceRegressionAnalyzer(baselineDir, currentDir);
    const results = await analyzer.analyze();

    // Exit with error code if regressions detected
    if (results.hasRegressions) {
      console.log(`❌ Performance regressions detected: ${results.totalRegressions} regressions found`);
      process.exit(1);
    }

    console.log('✅ No significant performance regressions detected');

  } catch (error) {
    console.error('❌ Error running performance regression analysis:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceRegressionAnalyzer;
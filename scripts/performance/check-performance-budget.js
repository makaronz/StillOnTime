#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');

// Performance budgets (in bytes)
const BUDGETS = {
  js: parseInt(process.env.BUDGET_JS) || 500000,     // 500KB
  css: parseInt(process.env.BUDGET_CSS) || 50000,    // 50KB
  images: parseInt(process.env.BUDGET_IMAGES) || 300000, // 300KB
  total: parseInt(process.env.BUDGET_TOTAL) || 1000000, // 1MB
  'initial-js': 250000,   // 250KB for initial JS
  'critical-css': 20000,  // 20KB for critical CSS
};

// Lighthouse performance budgets (0-100 scale)
const LIGHTHOUSE_BUDGETS = {
  performance: 90,
  accessibility: 95,
  bestPractices: 90,
  seo: 90,
  firstContentfulPaint: 1.8,  // seconds
  largestContentfulPaint: 2.5, // seconds
  cumulativeLayoutShift: 0.1,
  firstInputDelay: 100, // milliseconds
};

class PerformanceBudgetChecker {
  constructor() {
    this.violations = [];
    this.warnings = [];
    this.passes = [];
  }

  async check() {
    console.log('💰 Checking performance budgets...');

    // Check bundle sizes
    await this.checkBundleSizes();

    // Check Lighthouse scores
    await this.checkLighthouseScores();

    // Generate report
    await this.generateBudgetReport();

    console.log('✅ Performance budget check completed');
    return this.getResults();
  }

  async checkBundleSizes() {
    console.log('📦 Checking bundle sizes...');

    const buildDir = './frontend/dist';
    if (!fs.existsSync(buildDir)) {
      this.violations.push({
        type: 'bundle',
        metric: 'build',
        message: 'Build directory not found. Run `npm run build` first.',
        severity: 'error'
      });
      return;
    }

    // Analyze all built files
    const files = this.getAllFiles(buildDir);
    const analysis = this.analyzeFileSizes(files);

    // Check against budgets
    Object.entries(BUDGETS).forEach(([key, budget]) => {
      const actual = analysis[key] || 0;
      const result = {
        type: 'bundle',
        metric: key,
        budget: this.formatBytes(budget),
        actual: this.formatBytes(actual),
        percentage: Math.round((actual / budget) * 100),
        severity: actual > budget ? 'error' : actual > budget * 0.9 ? 'warning' : 'pass'
      };

      if (actual > budget) {
        this.violations.push({
          ...result,
          message: `${key} exceeds budget: ${this.formatBytes(actual)} > ${this.formatBytes(budget)}`
        });
      } else if (actual > budget * 0.9) {
        this.warnings.push({
          ...result,
          message: `${key} is approaching budget limit: ${this.formatBytes(actual)} (${result.percentage}% of budget)`
        });
      } else {
        this.passes.push({
          ...result,
          message: `${key} within budget: ${this.formatBytes(actual)} (${result.percentage}% of budget)`
        });
      }
    });

    // Check individual large files
    analysis.largeFiles.forEach(file => {
      if (file.size > 100000) { // 100KB threshold for individual files
        this.warnings.push({
          type: 'bundle',
          metric: 'large-file',
          file: file.name,
          size: this.formatBytes(file.size),
          message: `Large file detected: ${file.name} (${this.formatBytes(file.size)})`
        });
      }
    });
  }

  async checkLighthouseScores() {
    console.log('🏆 Checking Lighthouse performance...');

    const lighthouseDir = './.lighthouseci';
    const lhrPath = path.join(lighthouseDir, 'lhr.json');

    if (!fs.existsSync(lhrPath)) {
      this.warnings.push({
        type: 'lighthouse',
        metric: 'report',
        message: 'Lighthouse report not found. Run Lighthouse CI first.',
        severity: 'warning'
      });
      return;
    }

    try {
      const lhr = JSON.parse(fs.readFileSync(lhrPath, 'utf8'));
      const audits = lhr.audits;

      // Check performance scores
      Object.entries(LIGHTHOUSE_BUDGETS).forEach(([metric, budget]) => {
        let actual, unit;

        if (['performance', 'accessibility', 'bestPractices', 'seo'].includes(metric)) {
          actual = lhr.categories[metric]?.score * 100 || 0;
          unit = 'points';
        } else {
          const audit = audits[metric];
          actual = audit?.numericValue || 0;
          unit = this.getUnitForMetric(metric);
        }

        const isHigherBetter = ['performance', 'accessibility', 'bestPractices', 'seo'].includes(metric);
        const passesBudget = isHigherBetter ? actual >= budget : actual <= budget;
        const percentage = isHigherBetter ? Math.round((actual / budget) * 100) : Math.round((budget / actual) * 100);

        const result = {
          type: 'lighthouse',
          metric,
          budget: `${budget}${unit}`,
          actual: `${this.formatValue(actual, metric)}${unit}`,
          percentage,
          severity: !passesBudget ? 'error' : percentage < 110 ? 'warning' : 'pass'
        };

        if (!passesBudget) {
          this.violations.push({
            ...result,
            message: `${metric} below budget: ${this.formatValue(actual, metric)}${unit} < ${budget}${unit}`
          });
        } else if (percentage < 110) {
          this.warnings.push({
            ...result,
            message: `${metric} is close to budget limit: ${this.formatValue(actual, metric)}${unit}`
          });
        } else {
          this.passes.push({
            ...result,
            message: `${metric} exceeds budget: ${this.formatValue(actual, metric)}${unit}`
          });
        }
      });

    } catch (error) {
      this.violations.push({
        type: 'lighthouse',
        metric: 'parse-error',
        message: `Error parsing Lighthouse report: ${error.message}`,
        severity: 'error'
      });
    }
  }

  getAllFiles(dir) {
    const files = [];

    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);

      items.forEach(item => {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else {
          files.push(fullPath);
        }
      });
    }

    traverse(dir);
    return files;
  }

  analyzeFileSizes(files) {
    const analysis = {
      total: 0,
      js: 0,
      css: 0,
      images: 0,
      'initial-js': 0,
      'critical-css': 0,
      largeFiles: []
    };

    files.forEach(filePath => {
      const stats = fs.statSync(filePath);
      const size = stats.size;
      const ext = path.extname(filePath);
      const relativePath = path.relative('./frontend/dist', filePath);

      analysis.total += size;

      if (ext === '.js') {
        analysis.js += size;
        // Check if it's an initial chunk (usually contains "index" or "main")
        if (relativePath.includes('index') || relativePath.includes('main') || relativePath.includes('vendor')) {
          analysis['initial-js'] += size;
        }
      } else if (ext === '.css') {
        analysis.css += size;
        // Check if it's critical CSS
        if (relativePath.includes('critical') || relativePath.includes('index')) {
          analysis['critical-css'] += size;
        }
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'].includes(ext)) {
        analysis.images += size;
      }

      // Track large files
      if (size > 50000) { // 50KB
        analysis.largeFiles.push({
          name: relativePath,
          size: size,
          type: ext.slice(1)
        });
      }
    });

    // Sort large files by size (largest first)
    analysis.largeFiles.sort((a, b) => b.size - a.size);

    return analysis;
  }

  getUnitForMetric(metric) {
    switch (metric) {
      case 'firstContentfulPaint':
      case 'largestContentfulPaint':
        return 's';
      case 'firstInputDelay':
        return 'ms';
      case 'cumulativeLayoutShift':
        return '';
      default:
        return '';
    }
  }

  formatValue(value, metric) {
    if (['firstContentfulPaint', 'largestContentfulPaint'].includes(metric)) {
      return (value / 1000).toFixed(2);
    }
    if (['firstInputDelay'].includes(metric)) {
      return Math.round(value);
    }
    if (['cumulativeLayoutShift'].includes(metric)) {
      return value.toFixed(3);
    }
    return Math.round(value);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getResults() {
    return {
      violations: this.violations,
      warnings: this.warnings,
      passes: this.passes,
      hasViolations: this.violations.length > 0,
      hasWarnings: this.warnings.length > 0,
      totalChecked: this.violations.length + this.warnings.length + this.passes.length
    };
  }

  async generateBudgetReport() {
    const results = this.getResults();
    const report = this.generateMarkdownReport(results);
    const htmlReport = this.generateHtmlReport(results);

    // Save reports
    fs.writeFileSync('./budget-report.md', report);
    fs.writeFileSync('./budget-report.html', htmlReport);

    // Save JSON data
    fs.writeFileSync('./budget-data.json', JSON.stringify(results, null, 2));

    console.log('📊 Budget report saved to: ./budget-report.md');
    console.log('🌐 HTML report saved to: ./budget-report.html');
  }

  generateMarkdownReport(results) {
    const sections = [
      '# 💰 Performance Budget Report',
      '',
      `**Generated**: ${new Date().toISOString()}`,
      `**Status**: ${results.hasViolations ? '❌ FAILED - Budget violations detected' : '✅ PASSED - All budgets met'}`,
      '',
      '## 📊 Summary',
      '',
      `- **Violations**: ${results.violations.length} ❌`,
      `- **Warnings**: ${results.warnings.length} ⚠️`,
      `- **Passes**: ${results.passes.length} ✅`,
      `- **Total Checks**: ${results.totalChecked}`,
      ''
    ];

    if (results.violations.length > 0) {
      sections.push('## ❌ Budget Violations');
      sections.push('');
      sections.push('| Type | Metric | Budget | Actual | Status |');
      sections.push('|------|--------|--------|--------|--------|');

      results.violations.forEach(violation => {
        sections.push(`| ${violation.type} | ${violation.metric} | ${violation.budget} | ${violation.actual} | ❌ VIOLATION |`);
      });
      sections.push('');
    }

    if (results.warnings.length > 0) {
      sections.push('## ⚠️ Budget Warnings');
      sections.push('');
      sections.push('| Type | Metric | Budget | Actual | Status |');
      sections.push('|------|--------|--------|--------|--------|');

      results.warnings.forEach(warning => {
        sections.push(`| ${warning.type} | ${warning.metric} | ${warning.budget} | ${warning.actual} | ⚠️ WARNING |`);
      });
      sections.push('');
    }

    if (results.passes.length > 0) {
      sections.push('## ✅ Budget Passes');
      sections.push('');
      sections.push('| Type | Metric | Budget | Actual | Status |');
      sections.push('|------|--------|--------|--------|--------|');

      results.passes.slice(0, 10).forEach(pass => { // Show only first 10 passes
        sections.push(`| ${pass.type} | ${pass.metric} | ${pass.budget} | ${pass.actual} | ✅ PASS |`);
      });

      if (results.passes.length > 10) {
        sections.push(`| ... | ... | ... | ... | ✅ ${results.passes.length - 10} more passes |`);
      }
      sections.push('');
    }

    sections.push('## 🎯 Performance Budgets');
    sections.push('');
    sections.push('### Bundle Size Budgets');
    sections.push('');
    sections.push('| Resource | Budget |');
    sections.push('|----------|--------|');
    sections.push(`| JavaScript | ${this.formatBytes(BUDGETS.js)} |`);
    sections.push(`| CSS | ${this.formatBytes(BUDGETS.css)} |`);
    sections.push(`| Images | ${this.formatBytes(BUDGETS.images)} |`);
    sections.push(`| Total | ${this.formatBytes(BUDGETS.total)} |`);
    sections.push(`| Initial JS | ${this.formatBytes(BUDGETS['initial-js'])} |`);
    sections.push(`| Critical CSS | ${this.formatBytes(BUDGETS['critical-css'])} |`);
    sections.push('');

    sections.push('### Lighthouse Performance Budgets');
    sections.push('');
    sections.push('| Metric | Budget |');
    sections.push('|--------|--------|');
    sections.push(`| Performance Score | ${LIGHTHOUSE_BUDGETS.performance}/100 |`);
    sections.push(`| Accessibility Score | ${LIGHTHOUSE_BUDGETS.accessibility}/100 |`);
    sections.push(`| Best Practices Score | ${LIGHTHOUSE_BUDGETS.bestPractices}/100 |`);
    sections.push(`| SEO Score | ${LIGHTHOUSE_BUDGETS.seo}/100 |`);
    sections.push(`| First Contentful Paint | ${LIGHTHOUSE_BUDGETS.firstContentfulPaint}s |`);
    sections.push(`| Largest Contentful Paint | ${LIGHTHOUSE_BUDGETS.largestContentfulPaint}s |`);
    sections.push(`| Cumulative Layout Shift | ${LIGHTHOUSE_BUDGETS.cumulativeLayoutShift} |`);
    sections.push(`| First Input Delay | ${LIGHTHOUSE_BUDGETS.firstInputDelay}ms |`);
    sections.push('');

    if (results.hasViolations) {
      sections.push('## 🚨 Recommended Actions');
      sections.push('');
      sections.push('1. **Address Violations**: Fix all budget violations before merging');
      sections.push('2. **Optimize Assets**: Compress images, minify code, remove unused dependencies');
      sections.push('3. **Code Splitting**: Implement dynamic imports for non-critical code');
      sections.push('4. **Lazy Loading**: Load images and components on demand');
      sections.push('5. **Review Budgets**: Consider if budgets need adjustment for your use case');
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
    <title>Performance Budget Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header.violations { background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #6c757d; }
        .metric-card.violation { border-left-color: #dc3545; }
        .metric-card.warning { border-left-color: #ffc107; }
        .metric-card.pass { border-left-color: #28a745; }
        .metric-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .status-violation { color: #dc3545; font-weight: bold; }
        .status-warning { color: #ffc107; font-weight: bold; }
        .status-pass { color: #28a745; font-weight: bold; }
        .alert { padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .alert-danger { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .alert-success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header ${results.hasViolations ? 'violations' : ''}">
            <h1>💰 Performance Budget Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="content">
            ${results.hasViolations ? '<div class="alert alert-danger"><strong>❌ Budget Violations Detected</strong> - Please address these issues before proceeding.</div>' : '<div class="alert alert-success"><strong>✅ All Budgets Passed</strong> - Performance is within acceptable limits.</div>'}

            <div class="summary">
                <div class="metric-card ${results.hasViolations ? 'violation' : 'pass'}">
                    <div class="metric-number">${results.hasViolations ? '❌' : '✅'}</div>
                    <div class="metric-label">Overall Status</div>
                </div>
                <div class="metric-card violation">
                    <div class="metric-number">${results.violations.length}</div>
                    <div class="metric-label">Violations</div>
                </div>
                <div class="metric-card warning">
                    <div class="metric-number">${results.warnings.length}</div>
                    <div class="metric-label">Warnings</div>
                </div>
                <div class="metric-card pass">
                    <div class="metric-number">${results.passes.length}</div>
                    <div class="metric-label">Passes</div>
                </div>
            </div>

            ${results.violations.length > 0 ? `
            <h2>❌ Budget Violations</h2>
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Metric</th>
                        <th>Budget</th>
                        <th>Actual</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.violations.map(v => `
                        <tr>
                            <td>${v.type}</td>
                            <td>${v.metric}</td>
                            <td>${v.budget}</td>
                            <td>${v.actual}</td>
                            <td class="status-violation">❌ VIOLATION</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            ${results.warnings.length > 0 ? `
            <h2>⚠️ Budget Warnings</h2>
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Metric</th>
                        <th>Budget</th>
                        <th>Actual</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.warnings.map(w => `
                        <tr>
                            <td>${w.type}</td>
                            <td>${w.metric}</td>
                            <td>${w.budget}</td>
                            <td>${w.actual}</td>
                            <td class="status-warning">⚠️ WARNING</td>
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
    const checker = new PerformanceBudgetChecker();
    const results = await checker.check();

    // Exit with error code if violations detected
    if (results.hasViolations) {
      console.log(`❌ Performance budget violations detected: ${results.violations.length} violations found`);
      process.exit(1);
    }

    console.log('✅ All performance budgets passed');

  } catch (error) {
    console.error('❌ Error checking performance budgets:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceBudgetChecker;
#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  description: string;
  command: string;
  timeout: number;
  critical: boolean;
  category: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
}

interface TestResults {
  timestamp: string;
  summary: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    totalDuration: number;
    overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  };
  suites: {
    [key: string]: {
      status: 'PASS' | 'FAIL' | 'SKIPPED';
      duration: number;
      output: string;
      error?: string;
      metrics?: any;
    };
  };
  coverage: {
    backend: number;
    frontend: number;
    overall: number;
  };
  quality: {
    securityScore: number;
    performanceScore: number;
    reliabilityScore: number;
  };
  recommendations: string[];
  productionReadiness: {
    ready: boolean;
    score: number;
    blockers: string[];
  };
}

class ComprehensiveTestExecutor {
  private results: TestResults;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        totalDuration: 0,
        overallStatus: 'PASS'
      },
      suites: {},
      coverage: {
        backend: 0,
        frontend: 0,
        overall: 0
      },
      quality: {
        securityScore: 0,
        performanceScore: 0,
        reliabilityScore: 0
      },
      recommendations: [],
      productionReadiness: {
        ready: false,
        score: 0,
        blockers: []
      }
    };
  }

  private log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[level];

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  private getTestSuites(): TestSuite[] {
    return [
      // Backend Unit Tests
      {
        name: 'backend-unit',
        description: 'Backend Unit Tests with Coverage',
        command: 'cd backend && npm run test:coverage',
        timeout: 120000,
        critical: true,
        category: 'unit'
      },

      // Frontend Unit Tests
      {
        name: 'frontend-unit',
        description: 'Frontend Unit Tests with Coverage',
        command: 'cd frontend && npm run test:coverage',
        timeout: 120000,
        critical: true,
        category: 'unit'
      },

      // Integration Tests
      {
        name: 'integration',
        description: 'API Integration Tests',
        command: 'cd backend && npm run test:integration',
        timeout: 180000,
        critical: true,
        category: 'integration'
      },

      // Database Tests
      {
        name: 'database',
        description: 'Database Integration Tests',
        command: 'cd backend && npm run test:database',
        timeout: 120000,
        critical: true,
        category: 'integration'
      },

      // E2E Tests
      {
        name: 'e2e-basic',
        description: 'Basic End-to-End Tests',
        command: 'npm run test:e2e:basic',
        timeout: 300000,
        critical: true,
        category: 'e2e'
      },

      {
        name: 'e2e-full',
        description: 'Full Application E2E Tests',
        command: 'npm run test:e2e:full',
        timeout: 600000,
        critical: false,
        category: 'e2e'
      },

      // Performance Tests
      {
        name: 'lighthouse',
        description: 'Lighthouse Performance Audit',
        command: 'npm run test:lighthouse',
        timeout: 180000,
        critical: true,
        category: 'performance'
      },

      {
        name: 'load-testing',
        description: 'API Load Testing',
        command: 'npm run test:api-performance',
        timeout: 240000,
        critical: false,
        category: 'performance'
      },

      // Security Tests
      {
        name: 'security-scan',
        description: 'Security Vulnerability Scan',
        command: 'npx ts-node scripts/security/security-scan.ts',
        timeout: 300000,
        critical: true,
        category: 'security'
      },

      // Code Quality
      {
        name: 'lint-backend',
        description: 'Backend Linting',
        command: 'cd backend && npm run lint',
        timeout: 60000,
        critical: false,
        category: 'unit'
      },

      {
        name: 'lint-frontend',
        description: 'Frontend Linting',
        command: 'cd frontend && npm run lint',
        timeout: 60000,
        critical: false,
        category: 'unit'
      },

      // Type Checking
      {
        name: 'typecheck-backend',
        description: 'Backend Type Checking',
        command: 'cd backend && npm run typecheck',
        timeout: 90000,
        critical: false,
        category: 'unit'
      },

      {
        name: 'typecheck-frontend',
        description: 'Frontend Type Checking',
        command: 'cd frontend && npm run typecheck',
        timeout: 90000,
        critical: false,
        category: 'unit'
      }
    ];
  }

  private async executeTestSuite(suite: TestSuite): Promise<void> {
    const startTime = Date.now();
    this.log(`Starting: ${suite.description}`, 'info');

    try {
      const output = execSync(suite.command, {
        encoding: 'utf8',
        timeout: suite.timeout,
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      const metrics = this.extractMetrics(suite.category, output);

      this.results.suites[suite.name] = {
        status: 'PASS',
        duration,
        output,
        metrics
      };

      this.log(`✅ ${suite.description} completed in ${(duration / 1000).toFixed(2)}s`, 'success');

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const output = error.stdout || error.stderr || error.message;

      this.results.suites[suite.name] = {
        status: 'FAIL',
        duration,
        output,
        error: error.message
      };

      if (suite.critical) {
        this.log(`❌ CRITICAL: ${suite.description} failed: ${error.message}`, 'error');
      } else {
        this.log(`⚠️ ${suite.description} failed: ${error.message}`, 'warn');
      }
    }
  }

  private extractMetrics(category: string, output: string): any {
    const metrics: any = {};

    switch (category) {
      case 'unit':
        // Extract test coverage
        const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
        if (coverageMatch) {
          metrics.coverage = parseFloat(coverageMatch[1]);
        }

        // Extract test counts
        const testMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
        if (testMatch) {
          metrics.passed = parseInt(testMatch[1]);
          metrics.failed = parseInt(testMatch[2]);
        }
        break;

      case 'integration':
        const integrationMatch = output.match(/(\d+)\s+passed,\s+(\d+)\s+failed/);
        if (integrationMatch) {
          metrics.passed = parseInt(integrationMatch[1]);
          metrics.failed = parseInt(integrationMatch[2]);
        }
        break;

      case 'e2e':
        const e2eMatch = output.match(/(\d+)\s+passed,\s+(\d+)\s+failed/);
        if (e2eMatch) {
          metrics.passed = parseInt(e2eMatch[1]);
          metrics.failed = parseInt(e2eMatch[2]);
        }
        break;

      case 'performance':
        // Extract Lighthouse scores
        const performanceMatch = output.match(/Performance:\s*(\d+)/);
        if (performanceMatch) {
          metrics.performanceScore = parseInt(performanceMatch[1]);
        }

        const accessibilityMatch = output.match(/Accessibility:\s*(\d+)/);
        if (accessibilityMatch) {
          metrics.accessibilityScore = parseInt(accessibilityMatch[1]);
        }

        // Load test metrics
        const loadTestMatch = output.match(/(\d+)%.*success/);
        if (loadTestMatch) {
          metrics.successRate = parseInt(loadTestMatch[1]);
        }
        break;

      case 'security':
        // Extract security score
        const securityMatch = output.match(/Security Score:\s*(\d+)/);
        if (securityMatch) {
          metrics.securityScore = parseInt(securityMatch[1]);
        }

        const vulnMatch = output.match(/(\d+)\s+vulnerabilities/);
        if (vulnMatch) {
          metrics.vulnerabilities = parseInt(vulnMatch[1]);
        }
        break;
    }

    return metrics;
  }

  private async extractCoverage(): Promise<void> {
    try {
      // Backend coverage
      const backendCoveragePath = '/Users/arkadiuszfudali/Git/StillOnTime/backend/coverage/coverage-summary.json';
      if (fs.existsSync(backendCoveragePath)) {
        const backendCoverage = JSON.parse(fs.readFileSync(backendCoveragePath, 'utf8'));
        this.results.coverage.backend = Math.round(backendCoverage.total?.lines?.pct || 0);
      }

      // Frontend coverage
      const frontendCoveragePath = '/Users/arkadiuszfudali/Git/StillOnTime/frontend/coverage/coverage-summary.json';
      if (fs.existsSync(frontendCoveragePath)) {
        const frontendCoverage = JSON.parse(fs.readFileSync(frontendCoveragePath, 'utf8'));
        this.results.coverage.frontend = Math.round(frontendCoverage.total?.lines?.pct || 0);
      }

      // Calculate overall coverage
      this.results.coverage.overall = Math.round(
        (this.results.coverage.backend * 0.6) + (this.results.coverage.frontend * 0.4)
      );

    } catch (error) {
      this.log(`Failed to extract coverage: ${error}`, 'warn');
    }
  }

  private calculateQualityScores(): void {
    // Security score from security scan
    const securitySuite = this.results.suites['security-scan'];
    if (securitySuite?.metrics?.securityScore) {
      this.results.quality.securityScore = securitySuite.metrics.securityScore;
    }

    // Performance score from Lighthouse
    const lighthouseSuite = this.results.suites['lighthouse'];
    if (lighthouseSuite?.metrics?.performanceScore) {
      this.results.quality.performanceScore = lighthouseSuite.metrics.performanceScore;
    }

    // Reliability score based on test pass rates
    const totalTests = Object.values(this.results.suites).reduce((sum, suite) => {
      if (suite.metrics?.passed !== undefined) {
        return sum + (suite.metrics.passed + (suite.metrics.failed || 0));
      }
      return sum;
    }, 0);

    const failedTests = Object.values(this.results.suites).reduce((sum, suite) => {
      return sum + (suite.metrics?.failed || 0);
    }, 0);

    this.results.quality.reliabilityScore = totalTests > 0
      ? Math.round(((totalTests - failedTests) / totalTests) * 100)
      : 0;
  }

  private generateRecommendations(): void {
    const recommendations = new Set<string>();

    // Coverage recommendations
    if (this.results.coverage.backend < 90) {
      recommendations.add('Increase backend test coverage to above 90%');
    }

    if (this.results.coverage.frontend < 90) {
      recommendations.add('Increase frontend test coverage to above 90%');
    }

    // Security recommendations
    if (this.results.quality.securityScore < 80) {
      recommendations.add('Address security vulnerabilities to improve security score');
    }

    // Performance recommendations
    if (this.results.quality.performanceScore < 80) {
      recommendations.add('Optimize application performance to achieve Lighthouse score above 80');
    }

    // Failed test recommendations
    Object.entries(this.results.suites).forEach(([name, suite]) => {
      if (suite.status === 'FAIL') {
        recommendations.push(`Fix failing tests in ${name}`);
      }
    });

    this.results.recommendations = Array.from(recommendations);
  }

  private assessProductionReadiness(): void {
    const blockers: string[] = [];
    let score = 100;

    // Critical test failures
    const criticalFailures = Object.entries(this.results.suites)
      .filter(([_, suite]) => suite.status === 'FAIL')
      .filter(([name]) => this.getTestSuites().find(suite => suite.name === name)?.critical);

    if (criticalFailures.length > 0) {
      blockers.push(`${criticalFailures.length} critical test suites failed`);
      score -= 30;
    }

    // Coverage requirements
    if (this.results.coverage.backend < 90) {
      blockers.push('Backend test coverage below 90%');
      score -= 20;
    }

    if (this.results.coverage.frontend < 90) {
      blockers.push('Frontend test coverage below 90%');
      score -= 20;
    }

    // Security requirements
    if (this.results.quality.securityScore < 80) {
      blockers.push('Security score below 80%');
      score -= 25;
    }

    // Performance requirements
    if (this.results.quality.performanceScore < 70) {
      blockers.push('Performance score below 70%');
      score -= 15;
    }

    this.results.productionReadiness = {
      ready: blockers.length === 0 && score >= 80,
      score: Math.max(0, score),
      blockers
    };
  }

  private getTestSuites(): TestSuite[] {
    return [
      {
        name: '',
        description: '',
        command: '',
        timeout: 0,
        critical: false,
        category: 'unit'
      }
    ];
  }

  private async generateReports(): Promise<void> {
    // Generate JSON report
    const jsonPath = '/Users/arkadiuszfudali/Git/StillOnTime/test-reports/comprehensive-test-results.json';
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    const htmlPath = '/Users/arkadiuszfudali/Git/StillOnTime/test-reports/comprehensive-test-results.html';
    const htmlContent = this.generateHTMLReport();
    fs.writeFileSync(htmlPath, htmlContent);

    this.log(`JSON report saved to: ${jsonPath}`, 'info');
    this.log(`HTML report saved to: ${htmlPath}`, 'info');
  }

  private generateHTMLReport(): string {
    const { summary, suites, coverage, quality, productionReadiness } = this.results;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StillOnTime Comprehensive Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .status-${summary.overallStatus.toLowerCase()} {
            background: ${summary.overallStatus === 'PASS' ? '#27ae60' : summary.overallStatus === 'WARNING' ? '#f39c12' : '#e74c3c'};
            padding: 10px 20px;
            border-radius: 20px;
            display: inline-block;
            margin-top: 15px;
        }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .card h3 { margin: 0 0 15px 0; color: #2c3e50; font-size: 1.1em; }
        .card .number { font-size: 2.5em; font-weight: bold; color: #3498db; }
        .card .number.pass { color: #27ae60; }
        .card .number.fail { color: #e74c3c; }
        .section { margin: 30px 0; padding: 25px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section h2 { margin: 0 0 20px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .test-suite { margin: 15px 0; padding: 15px; border-radius: 6px; }
        .test-suite.pass { background: #d5f4e6; border-left: 4px solid #27ae60; }
        .test-suite.fail { background: #fdf2f2; border-left: 4px solid #e74c3c; }
        .test-suite h4 { margin: 0 0 10px 0; color: #2c3e50; }
        .test-suite .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
        .test-suite .status.pass { background: #27ae60; color: white; }
        .test-suite .status.fail { background: #e74c3c; color: white; }
        .coverage-bars { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .coverage-bar { text-align: center; }
        .coverage-bar .bar { background: #ecf0f1; border-radius: 10px; height: 20px; overflow: hidden; margin: 10px 0; }
        .coverage-bar .fill { height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); transition: width 0.3s ease; }
        .quality-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .quality-item { text-align: center; }
        .quality-item .score { font-size: 3em; font-weight: bold; margin: 10px 0; }
        .quality-item .score.high { color: #27ae60; }
        .quality-item .score.medium { color: #f39c12; }
        .quality-item .score.low { color: #e74c3c; }
        .recommendations { background: #e8f5e8; padding: 20px; border-radius: 8px; }
        .recommendations ul { margin: 10px 0; padding-left: 20px; }
        .recommendations li { margin: 8px 0; }
        .production-ready { background: ${productionReadiness.ready ? '#d5f4e6' : '#fdf2f2'}; padding: 20px; border-radius: 8px; text-align: center; }
        .production-ready.ready { border-left: 4px solid #27ae60; }
        .production-ready.not-ready { border-left: 4px solid #e74c3c; }
        .blockers { margin-top: 15px; }
        .blockers ul { list-style: none; padding: 0; }
        .blockers li { background: #e74c3c; color: white; padding: 8px 15px; margin: 5px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 StillOnTime Test Report</h1>
            <p>Comprehensive testing and validation results</p>
            <p>Generated on ${new Date(this.results.timestamp).toLocaleString()}</p>
            <div class="status-${summary.overallStatus.toLowerCase()}">
                ${summary.overallStatus}
            </div>
        </div>

        <div class="summary-cards">
            <div class="card">
                <h3>Total Test Suites</h3>
                <div class="number">${summary.totalSuites}</div>
            </div>
            <div class="card">
                <h3>Passed</h3>
                <div class="number pass">${summary.passedSuites}</div>
            </div>
            <div class="card">
                <h3>Failed</h3>
                <div class="number fail">${summary.failedSuites}</div>
            </div>
            <div class="card">
                <h3>Duration</h3>
                <div class="number">${(summary.totalDuration / 1000).toFixed(1)}s</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 Test Coverage</h2>
            <div class="coverage-bars">
                <div class="coverage-bar">
                    <h4>Backend Coverage</h4>
                    <div class="bar">
                        <div class="fill" style="width: ${coverage.backend}%"></div>
                    </div>
                    <div class="number">${coverage.backend}%</div>
                </div>
                <div class="coverage-bar">
                    <h4>Frontend Coverage</h4>
                    <div class="bar">
                        <div class="fill" style="width: ${coverage.frontend}%"></div>
                    </div>
                    <div class="number">${coverage.frontend}%</div>
                </div>
                <div class="coverage-bar">
                    <h4>Overall Coverage</h4>
                    <div class="bar">
                        <div class="fill" style="width: ${coverage.overall}%"></div>
                    </div>
                    <div class="number">${coverage.overall}%</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🎯 Quality Metrics</h2>
            <div class="quality-grid">
                <div class="quality-item">
                    <h4>Security Score</h4>
                    <div class="score ${quality.securityScore >= 80 ? 'high' : quality.securityScore >= 60 ? 'medium' : 'low'}">
                        ${quality.securityScore}/100
                    </div>
                </div>
                <div class="quality-item">
                    <h4>Performance Score</h4>
                    <div class="score ${quality.performanceScore >= 80 ? 'high' : quality.performanceScore >= 60 ? 'medium' : 'low'}">
                        ${quality.performanceScore}/100
                    </div>
                </div>
                <div class="quality-item">
                    <h4>Reliability Score</h4>
                    <div class="score ${quality.reliabilityScore >= 80 ? 'high' : quality.reliabilityScore >= 60 ? 'medium' : 'low'}">
                        ${quality.reliabilityScore}/100
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📋 Test Suite Results</h2>
            ${Object.entries(suites).map(([name, suite]) => `
            <div class="test-suite ${suite.status.toLowerCase()}">
                <h4>${name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                <span class="status ${suite.status.toLowerCase()}">${suite.status}</span>
                <p>Duration: ${(suite.duration / 1000).toFixed(2)}s</p>
                ${suite.metrics ? `<p>Metrics: ${JSON.stringify(suite.metrics, null, 2)}</p>` : ''}
                ${suite.error ? `<p><strong>Error:</strong> ${suite.error}</p>` : ''}
            </div>
            `).join('')}
        </div>

        ${this.results.recommendations.length > 0 ? `
        <div class="section recommendations">
            <h2>💡 Recommendations</h2>
            <ul>
                ${this.results.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="section production-ready ${productionReadiness.ready ? 'ready' : 'not-ready'}">
            <h2>🚀 Production Readiness</h2>
            <div class="number">${productionReadiness.score}/100</div>
            <p><strong>Status: ${productionReadiness.ready ? '✅ READY' : '❌ NOT READY'}</strong></p>
            ${productionReadiness.blockers.length > 0 ? `
            <div class="blockers">
                <h4>Blocking Issues:</h4>
                <ul>
                    ${productionReadiness.blockers.map(blocker => `<li>${blocker}</li>`).join('')}
                </ul>
            </div>
            ` : '<p>✅ No blocking issues identified. Application is ready for production deployment.</p>'}
        </div>
    </div>
</body>
</html>`;
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Status: ${this.results.summary.overallStatus}`);
    console.log(`Total Suites: ${this.results.summary.totalSuites}`);
    console.log(`Passed: ${this.results.summary.passedSuites}`);
    console.log(`Failed: ${this.results.summary.failedSuites}`);
    console.log(`Duration: ${(this.results.summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`Overall Coverage: ${this.results.coverage.overall}%`);
    console.log(`Production Ready: ${this.results.productionReadiness.ready ? '✅ YES' : '❌ NO'}`);
    console.log(`Production Score: ${this.results.productionReadiness.score}/100`);

    if (this.results.productionReadiness.blockers.length > 0) {
      console.log('\n❌ Blocking Issues:');
      this.results.productionReadiness.blockers.forEach(blocker => {
        console.log(`  - ${blocker}`);
      });
    }

    console.log('\n📊 Quality Scores:');
    console.log(`  Security: ${this.results.quality.securityScore}/100`);
    console.log(`  Performance: ${this.results.quality.performanceScore}/100`);
    console.log(`  Reliability: ${this.results.quality.reliabilityScore}/100`);

    console.log('\n' + '='.repeat(80));
  }

  async execute(): Promise<void> {
    this.log('🚀 Starting Comprehensive Test Execution', 'info');
    this.log('This process will run all test suites and generate detailed reports...', 'warn');

    try {
      const testSuites = this.getTestSuites();
      this.results.summary.totalSuites = testSuites.length;

      // Execute test suites
      for (const suite of testSuites) {
        await this.executeTestSuite(suite);

        // Update summary
        if (this.results.suites[suite.name].status === 'PASS') {
          this.results.summary.passedSuites++;
        } else {
          this.results.summary.failedSuites++;
        }
      }

      // Extract additional metrics
      await this.extractCoverage();
      this.calculateQualityScores();
      this.generateRecommendations();
      this.assessProductionReadiness();

      // Calculate total duration
      this.results.summary.totalDuration = Date.now() - this.startTime;

      // Determine overall status
      const criticalFailures = testSuites
        .filter(suite => suite.critical)
        .filter(suite => this.results.suites[suite.name]?.status === 'FAIL');

      if (criticalFailures.length > 0) {
        this.results.summary.overallStatus = 'FAIL';
      } else if (this.results.summary.failedSuites > 0) {
        this.results.summary.overallStatus = 'WARNING';
      } else {
        this.results.summary.overallStatus = 'PASS';
      }

      // Generate reports
      await this.generateReports();

      // Print summary
      this.printSummary();

      // Final status
      if (this.results.summary.overallStatus === 'FAIL') {
        this.log('❌ Critical tests failed. Please address blocking issues before proceeding.', 'error');
        process.exit(1);
      } else if (this.results.summary.overallStatus === 'WARNING') {
        this.log('⚠️ Some tests failed, but none are critical. Review recommendations.', 'warn');
      } else {
        this.log('🎉 All tests passed successfully!', 'success');
      }

    } catch (error) {
      this.log(`Test execution failed: ${error}`, 'error');
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const executor = new ComprehensiveTestExecutor();
  executor.execute().catch(console.error);
}

export default ComprehensiveTestExecutor;
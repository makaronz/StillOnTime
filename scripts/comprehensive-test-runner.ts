#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestResults {
  unit: {
    backend: { coverage: number; passed: number; failed: number };
    frontend: { coverage: number; passed: number; failed: number };
  };
  integration: {
    services: { passed: number; failed: number };
    database: { passed: number; failed: number };
  };
  e2e: {
    passed: number; failed: number;
  };
  performance: {
    lighthouse: number;
    loadTest: number;
  };
  security: {
    vulnerabilities: number;
    compliance: string;
  };
}

class ComprehensiveTestRunner {
  private results: TestResults = {
    unit: {
      backend: { coverage: 0, passed: 0, failed: 0 },
      frontend: { coverage: 0, passed: 0, failed: 0 }
    },
    integration: {
      services: { passed: 0, failed: 0 },
      database: { passed: 0, failed: 0 }
    },
    e2e: {
      passed: 0, failed: 0
    },
    performance: {
      lighthouse: 0,
      loadTest: 0
    },
    security: {
      vulnerabilities: 0,
      compliance: 'Unknown'
    }
  };

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

  private async executeCommand(command: string, cwd?: string): Promise<{ success: boolean; output: string }> {
    try {
      this.log(`Executing: ${command}`, 'info');
      const output = execSync(command, {
        cwd: cwd || process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return { success: true, output };
    } catch (error: any) {
      this.log(`Command failed: ${error.message}`, 'error');
      return { success: false, output: error.stdout || error.stderr || '' };
    }
  }

  private parseCoverageReport(coveragePath: string): number {
    try {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const totalLines = coverageData.total?.lines?.pct || 0;
      return Math.round(totalLines);
    } catch {
      return 0;
    }
  }

  private parseJestOutput(output: string): { passed: number; failed: number } {
    const match = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
    if (match) {
      return {
        passed: parseInt(match[1]),
        failed: parseInt(match[2])
      };
    }
    return { passed: 0, failed: 0 };
  }

  private parseVitestOutput(output: string): { passed: number; failed: number } {
    const match = output.match(/(\d+)\s+passed\s+(\d+)\s+failed/);
    if (match) {
      return {
        passed: parseInt(match[1]),
        failed: parseInt(match[2])
      };
    }
    return { passed: 0, failed: 0 };
  }

  private parsePlaywrightOutput(output: string): { passed: number; failed: number } {
    const match = output.match(/(\d+)\s+passed\s+(\d+)\s+failed/);
    if (match) {
      return {
        passed: parseInt(match[1]),
        failed: parseInt(match[2])
      };
    }
    return { passed: 0, failed: 0 };
  }

  async runBackendUnitTests(): Promise<void> {
    this.log('Starting Backend Unit Tests', 'info');

    // Clean previous coverage
    await this.executeCommand('rm -rf backend/coverage', '/Users/arkadiuszfudali/Git/StillOnTime');

    // Run tests with coverage
    const result = await this.executeCommand('npm run test:coverage', '/Users/arkadiuszfudali/Git/StillOnTime/backend');

    if (result.success) {
      const testResults = this.parseJestOutput(result.output);
      const coverage = this.parseCoverageReport('/Users/arkadiuszfudali/Git/StillOnTime/backend/coverage/coverage-summary.json');

      this.results.unit.backend = {
        coverage,
        passed: testResults.passed,
        failed: testResults.failed
      };

      this.log(`Backend Unit Tests: ${testResults.passed} passed, ${testResults.failed} failed, ${coverage}% coverage`,
        testResults.failed === 0 ? 'success' : 'error');
    } else {
      this.log('Backend Unit Tests failed to execute', 'error');
      this.results.unit.backend.failed = 1;
    }
  }

  async runFrontendUnitTests(): Promise<void> {
    this.log('Starting Frontend Unit Tests', 'info');

    // Clean previous coverage
    await this.executeCommand('rm -rf frontend/coverage', '/Users/arkadiuszfudali/Git/StillOnTime');

    // Run tests with coverage
    const result = await this.executeCommand('npm run test:coverage', '/Users/arkadiuszfudali/Git/StillOnTime/frontend');

    if (result.success) {
      const testResults = this.parseVitestOutput(result.output);
      const coverage = this.parseCoverageReport('/Users/arkadiuszfudali/Git/StillOnTime/frontend/coverage/coverage-summary.json');

      this.results.unit.frontend = {
        coverage,
        passed: testResults.passed,
        failed: testResults.failed
      };

      this.log(`Frontend Unit Tests: ${testResults.passed} passed, ${testResults.failed} failed, ${coverage}% coverage`,
        testResults.failed === 0 ? 'success' : 'error');
    } else {
      this.log('Frontend Unit Tests failed to execute', 'error');
      this.results.unit.frontend.failed = 1;
    }
  }

  async runIntegrationTests(): Promise<void> {
    this.log('Starting Integration Tests', 'info');

    // Service integration tests
    const serviceResult = await this.executeCommand('npm run test:integration', '/Users/arkadiuszfudali/Git/StillOnTime/backend');
    const serviceTests = this.parseJestOutput(serviceResult.output);

    this.results.integration.services = {
      passed: serviceTests.passed,
      failed: serviceTests.failed
    };

    // Database integration tests
    const dbResult = await this.executeCommand('npm run test:database', '/Users/arkadiuszfudali/Git/StillOnTime/backend');
    const dbTests = this.parseJestOutput(dbResult.output);

    this.results.integration.database = {
      passed: dbTests.passed,
      failed: dbTests.failed
    };

    const totalIntegrationPassed = serviceTests.passed + dbTests.passed;
    const totalIntegrationFailed = serviceTests.failed + dbTests.failed;

    this.log(`Integration Tests: ${totalIntegrationPassed} passed, ${totalIntegrationFailed} failed`,
      totalIntegrationFailed === 0 ? 'success' : 'error');
  }

  async runE2ETests(): Promise<void> {
    this.log('Starting End-to-End Tests', 'info');

    // Install Playwright browsers if needed
    await this.executeCommand('npx playwright install', '/Users/arkadiuszfudali/Git/StillOnTime');

    // Run E2E tests
    const result = await this.executeCommand('npm run test:e2e', '/Users/arkadiuszfudali/Git/StillOnTime');
    const e2eResults = this.parsePlaywrightOutput(result.output);

    this.results.e2e = {
      passed: e2eResults.passed,
      failed: e2eResults.failed
    };

    this.log(`E2E Tests: ${e2eResults.passed} passed, ${e2eResults.failed} failed`,
      e2eResults.failed === 0 ? 'success' : 'error');
  }

  async runPerformanceTests(): Promise<void> {
    this.log('Starting Performance Tests', 'info');

    // Lighthouse CI tests
    const lighthouseResult = await this.executeCommand('npm run test:lighthouse', '/Users/arkadiuszfudali/Git/StillOnTime');
    const lighthouseScore = this.parseLighthouseScore(lighthouseResult.output);
    this.results.performance.lighthouse = lighthouseScore;

    // Load testing with Artillery
    const loadTestResult = await this.executeCommand('npm run test:api-performance', '/Users/arkadiuszfudali/Git/StillOnTime');
    const loadTestScore = this.parseLoadTestScore(loadTestResult.output);
    this.results.performance.loadTest = loadTestScore;

    this.log(`Performance Tests: Lighthouse ${lighthouseScore}, Load Test ${loadTestScore}`,
      lighthouseScore >= 90 && loadTestScore >= 90 ? 'success' : 'warn');
  }

  private parseLighthouseScore(output: string): number {
    const match = output.match(/Performance:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private parseLoadTestScore(output: string): number {
    const match = output.match(/(\d+)%.*requests.*successful/);
    return match ? parseInt(match[1]) : 0;
  }

  async runSecurityTests(): Promise<void> {
    this.log('Starting Security Tests', 'info');

    // Run Snyk security scan
    const snykResult = await this.executeCommand('npx snyk test --json', '/Users/arkadiuszfudali/Git/StillOnTime');
    const vulnerabilities = this.parseSnykResults(snykResult.output);

    this.results.security.vulnerabilities = vulnerabilities;
    this.results.security.compliance = vulnerabilities === 0 ? 'Compliant' : 'Non-Compliant';

    this.log(`Security Tests: ${vulnerabilities} vulnerabilities found`,
      vulnerabilities === 0 ? 'success' : 'error');
  }

  private parseSnykResults(output: string): number {
    try {
      const data = JSON.parse(output);
      return data.vulnerabilities?.length || 0;
    } catch {
      return 0;
    }
  }

  async generateReport(): Promise<void> {
    this.log('Generating Comprehensive Test Report', 'info');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.calculateTotalTests(),
        totalPassed: this.calculateTotalPassed(),
        totalFailed: this.calculateTotalFailed(),
        overallCoverage: this.calculateOverallCoverage(),
        status: this.determineOverallStatus()
      },
      results: this.results,
      recommendations: this.generateRecommendations(),
      productionReadiness: this.assessProductionReadiness()
    };

    // Write report to file
    const reportPath = '/Users/arkadiuszfudali/Git/StillOnTime/test-reports/comprehensive-test-report.json';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    await this.generateHTMLReport(report);

    this.log(`Test report generated: ${reportPath}`, 'success');
    this.printSummary(report);
  }

  private calculateTotalTests(): number {
    return this.results.unit.backend.passed + this.results.unit.backend.failed +
           this.results.unit.frontend.passed + this.results.unit.frontend.failed +
           this.results.integration.services.passed + this.results.integration.services.failed +
           this.results.integration.database.passed + this.results.integration.database.failed +
           this.results.e2e.passed + this.results.e2e.failed;
  }

  private calculateTotalPassed(): number {
    return this.results.unit.backend.passed +
           this.results.unit.frontend.passed +
           this.results.integration.services.passed +
           this.results.integration.database.passed +
           this.results.e2e.passed;
  }

  private calculateTotalFailed(): number {
    return this.results.unit.backend.failed +
           this.results.unit.frontend.failed +
           this.results.integration.services.failed +
           this.results.integration.database.failed +
           this.results.e2e.failed;
  }

  private calculateOverallCoverage(): number {
    const backendWeight = 0.6;
    const frontendWeight = 0.4;
    return Math.round(
      (this.results.unit.backend.coverage * backendWeight) +
      (this.results.unit.frontend.coverage * frontendWeight)
    );
  }

  private determineOverallStatus(): 'PASS' | 'FAIL' | 'WARNING' {
    const totalFailed = this.calculateTotalFailed();
    const overallCoverage = this.calculateOverallCoverage();

    if (totalFailed > 0 || overallCoverage < 80) return 'FAIL';
    if (overallCoverage < 90 || this.results.security.vulnerabilities > 0) return 'WARNING';
    return 'PASS';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.results.unit.backend.coverage < 90) {
      recommendations.push('Increase backend unit test coverage to above 90%');
    }

    if (this.results.unit.frontend.coverage < 90) {
      recommendations.push('Increase frontend unit test coverage to above 90%');
    }

    if (this.results.e2e.failed > 0) {
      recommendations.push('Fix failing end-to-end tests');
    }

    if (this.results.performance.lighthouse < 90) {
      recommendations.push('Optimize performance to achieve Lighthouse score above 90');
    }

    if (this.results.security.vulnerabilities > 0) {
      recommendations.push('Address security vulnerabilities found in scan');
    }

    return recommendations;
  }

  private assessProductionReadiness(): {
    ready: boolean;
    score: number;
    blockingIssues: string[];
  } {
    const blockingIssues: string[] = [];
    let score = 100;

    // Coverage requirements
    if (this.results.unit.backend.coverage < 90) {
      blockingIssues.push('Backend test coverage below 90%');
      score -= 20;
    }

    if (this.results.unit.frontend.coverage < 90) {
      blockingIssues.push('Frontend test coverage below 90%');
      score -= 20;
    }

    // Failed tests
    const totalFailed = this.calculateTotalFailed();
    if (totalFailed > 0) {
      blockingIssues.push(`${totalFailed} tests are failing`);
      score -= 30;
    }

    // Security vulnerabilities
    if (this.results.security.vulnerabilities > 0) {
      blockingIssues.push('Security vulnerabilities detected');
      score -= 25;
    }

    // Performance
    if (this.results.performance.lighthouse < 80) {
      blockingIssues.push('Performance below acceptable threshold');
      score -= 15;
    }

    return {
      ready: blockingIssues.length === 0 && score >= 80,
      score: Math.max(0, score),
      blockingIssues
    };
  }

  private async generateHTMLReport(report: any): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StillOnTime Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .status-${report.summary.status.toLowerCase()} {
            background: ${report.summary.status === 'PASS' ? '#d4edda' : report.summary.status === 'WARNING' ? '#fff3cd' : '#f8d7da'};
        }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .warning { color: #ffc107; }
        ul { list-style-type: none; padding: 0; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header status-${report.summary.status.toLowerCase()}">
        <h1>StillOnTime Test Report</h1>
        <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="${report.summary.status.toLowerCase()}">${report.summary.status}</span></p>
        <p><strong>Overall Score:</strong> ${report.productionReadiness.score}/100</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="metric">Total Tests: ${report.summary.totalTests}</div>
        <div class="metric">Passed: <span class="pass">${report.summary.totalPassed}</span></div>
        <div class="metric">Failed: <span class="fail">${report.summary.totalFailed}</span></div>
        <div class="metric">Coverage: ${report.summary.overallCoverage}%</div>
    </div>

    <div class="section">
        <h2>Production Readiness</h2>
        <p><strong>Ready for Production:</strong> ${report.productionReadiness.ready ? '✅ Yes' : '❌ No'}</p>
        ${report.productionReadiness.blockingIssues.length > 0 ? `
            <h3>Blocking Issues:</h3>
            <ul>
                ${report.productionReadiness.blockingIssues.map(issue => `<li class="fail">❌ ${issue}</li>`).join('')}
            </ul>
        ` : '<p class="pass">No blocking issues identified.</p>'}
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li class="warning">⚠️ ${rec}</li>`).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>Detailed Results</h2>
        <pre>${JSON.stringify(report.results, null, 2)}</pre>
    </div>
</body>
</html>`;

    const htmlPath = '/Users/arkadiuszfudali/Git/StillOnTime/test-reports/comprehensive-test-report.html';
    fs.writeFileSync(htmlPath, htmlContent);
  }

  private printSummary(report: any): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Status: ${report.summary.status}`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.totalPassed}`);
    console.log(`Failed: ${report.summary.totalFailed}`);
    console.log(`Overall Coverage: ${report.summary.overallCoverage}%`);
    console.log(`Production Ready: ${report.productionReadiness.ready ? '✅ YES' : '❌ NO'}`);
    console.log(`Production Score: ${report.productionReadiness.score}/100`);

    if (report.productionReadiness.blockingIssues.length > 0) {
      console.log('\n❌ Blocking Issues:');
      report.productionReadiness.blockingIssues.forEach((issue: string) => {
        console.log(`  - ${issue}`);
      });
    }

    console.log('\n📋 Detailed Results:');
    console.log(`  Backend Unit: ${this.results.unit.backend.passed} passed, ${this.results.unit.backend.failed} failed, ${this.results.unit.backend.coverage}% coverage`);
    console.log(`  Frontend Unit: ${this.results.unit.frontend.passed} passed, ${this.results.unit.frontend.failed} failed, ${this.results.unit.frontend.coverage}% coverage`);
    console.log(`  Integration: ${this.results.integration.services.passed + this.results.integration.database.passed} passed, ${this.results.integration.services.failed + this.results.integration.database.failed} failed`);
    console.log(`  E2E: ${this.results.e2e.passed} passed, ${this.results.e2e.failed} failed`);
    console.log(`  Performance: Lighthouse ${this.results.performance.lighthouse}, Load Test ${this.results.performance.loadTest}`);
    console.log(`  Security: ${this.results.security.vulnerabilities} vulnerabilities`);

    console.log('\n' + '='.repeat(80));
  }

  async runAllTests(): Promise<void> {
    this.log('🚀 Starting Comprehensive Test Execution', 'info');
    this.log('This may take 15-20 minutes to complete...', 'warn');

    try {
      // Sequential test execution
      await this.runBackendUnitTests();
      await this.runFrontendUnitTests();
      await this.runIntegrationTests();
      await this.runE2ETests();
      await this.runPerformanceTests();
      await this.runSecurityTests();

      await this.generateReport();

      this.log('🎉 Comprehensive Test Execution Completed!', 'success');
    } catch (error) {
      this.log(`Test execution failed: ${error}`, 'error');
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests().catch(console.error);
}

export default ComprehensiveTestRunner;
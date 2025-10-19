#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SecurityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
}

interface SecurityReport {
  timestamp: string;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  categories: {
    dependencyVulnerabilities: SecurityIssue[];
    codeSecurityIssues: SecurityIssue[];
    configurationIssues: SecurityIssue[];
    authenticationIssues: SecurityIssue[];
    dataValidationIssues: SecurityIssue[];
  };
  compliance: {
    owaspTop10: string[];
    score: number;
  };
  recommendations: string[];
}

class SecurityScanner {
  private issues: SecurityIssue[] = [];
  private report: SecurityReport;

  constructor() {
    this.report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      },
      categories: {
        dependencyVulnerabilities: [],
        codeSecurityIssues: [],
        configurationIssues: [],
        authenticationIssues: [],
        dataValidationIssues: []
      },
      compliance: {
        owaspTop10: [],
        score: 0
      },
      recommendations: []
    };
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔍',
      warn: '⚠️',
      error: '❌'
    }[level];

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async scanDependencies(): Promise<void> {
    this.log('Scanning dependencies for vulnerabilities...');

    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', {
        encoding: 'utf8',
        cwd: '/Users/arkadiuszfudali/Git/StillOnTime'
      });

      const auditData = JSON.parse(auditOutput);

      if (auditData.vulnerabilities) {
        Object.entries(auditData.vulnerabilities).forEach(([pkgName, vuln]: [string, any]) => {
          this.issues.push({
            type: 'Dependency Vulnerability',
            severity: this.mapSeverity(vuln.severity),
            description: `${pkgName}: ${vuln.title}`,
            recommendation: `Update ${pkgName} to latest version`
          });
        });
      }

      // Run Snyk if available
      try {
        const snykOutput = execSync('npx snyk test --json', {
          encoding: 'utf8',
          cwd: '/Users/arkadiuszfudali/Git/StillOnTime'
        });

        const snykData = JSON.parse(snykOutput);
        if (snykData.vulnerabilities) {
          snykData.vulnerabilities.forEach((vuln: any) => {
            this.issues.push({
              type: 'Dependency Vulnerability (Snyk)',
              severity: this.mapSeverity(vuln.severity),
              description: `${vuln.packageName}: ${vuln.title}`,
              recommendation: vuln.identifiers?.CVE?.[0]
                ? `Address CVE-${vuln.identifiers.CVE[0]}`
                : `Update ${vuln.packageName}`
            });
          });
        }
      } catch (error) {
        this.log('Snyk not available, skipping additional dependency scan', 'warn');
      }

      this.report.categories.dependencyVulnerabilities =
        this.issues.filter(issue => issue.type.includes('Dependency'));
    } catch (error) {
      this.log(`Dependency scan failed: ${error}`, 'error');
    }
  }

  async scanCodeSecurity(): Promise<void> {
    this.log('Scanning code for security issues...');

    // Scan for common security anti-patterns
    const securityPatterns = [
      {
        pattern: /password\s*=\s*['"`][^'"`]{1,10}['"`]/gi,
        type: 'Hardcoded Password',
        severity: 'critical' as const,
        recommendation: 'Use environment variables for secrets'
      },
      {
        pattern: /api_key\s*=\s*['"`][^'"`]+['"`]/gi,
        type: 'Hardcoded API Key',
        severity: 'critical' as const,
        recommendation: 'Use secure credential management'
      },
      {
        pattern: /eval\s*\(/gi,
        type: 'Use of eval()',
        severity: 'high' as const,
        recommendation: 'Avoid eval() - use safer alternatives'
      },
      {
        pattern: /innerHTML\s*=/gi,
        type: 'Potential XSS',
        severity: 'high' as const,
        recommendation: 'Use textContent or proper sanitization'
      },
      {
        pattern: /document\.write\s*\(/gi,
        type: 'document.write Usage',
        severity: 'medium' as const,
        recommendation: 'Use modern DOM manipulation methods'
      },
      {
        pattern: /Math\.random\(\)/gi,
        type: 'Insecure Random',
        severity: 'medium' as const,
        recommendation: 'Use crypto.getRandomValues() for security-critical randomness'
      }
    ];

    const scanDirectory = (dir: string, extensions: string[]) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });

      files.forEach(file => {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
          scanDirectory(fullPath, extensions);
        } else if (file.isFile() && extensions.some(ext => file.name.endsWith(ext))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            securityPatterns.forEach(({ pattern, type, severity, recommendation }) => {
              let match;
              while ((match = pattern.exec(content)) !== null) {
                const lineNumber = lines.findIndex(line => line.includes(match[0])) + 1;
                this.issues.push({
                  type,
                  severity,
                  description: `${type} found in ${file.name}`,
                  file: fullPath,
                  line: lineNumber,
                  recommendation
                });
              }
            });
          } catch (error) {
            // Skip files that can't be read
          }
        }
      });
    };

    // Scan source code
    ['src', 'lib', 'app'].forEach(dir => {
      if (fs.existsSync(dir)) {
        scanDirectory(dir, ['.js', '.ts', '.jsx', '.tsx']);
      }
    });

    this.report.categories.codeSecurityIssues =
      this.issues.filter(issue => issue.type.includes('Hardcoded') ||
                                   issue.type.includes('eval') ||
                                   issue.type.includes('XSS'));
  }

  async scanConfiguration(): Promise<void> {
    this.log('Scanning configuration files...');

    // Check for security headers configuration
    const checkSecurityHeaders = () => {
      const expressConfigFiles = [
        'src/index.ts',
        'src/app.ts',
        'src/server.ts'
      ];

      expressConfigFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');

          const requiredHeaders = ['helmet', 'x-frame-options', 'x-content-type-options'];
          requiredHeaders.forEach(header => {
            if (!content.includes(header)) {
              this.issues.push({
                type: 'Missing Security Header',
                severity: 'medium',
                description: `Missing security header configuration for ${header}`,
                file,
                recommendation: 'Implement security headers using Helmet or manual configuration'
              });
            }
          });
        }
      });
    };

    // Check for HTTPS enforcement
    const checkHTTPS = () => {
      const configFiles = [
        '.env',
        '.env.example',
        'src/config/config.ts'
      ];

      configFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');

          if (!content.includes('HTTPS') && !content.includes('ssl')) {
            this.issues.push({
              type: 'HTTPS Not Enforced',
              severity: 'medium',
              description: 'HTTPS enforcement not configured',
              file,
              recommendation: 'Implement HTTPS redirection and secure cookies'
            });
          }
        }
      });
    };

    // Check for rate limiting
    const checkRateLimiting = () => {
      const serverFiles = [
        'src/index.ts',
        'src/app.ts',
        'src/server.ts'
      ];

      serverFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');

          if (!content.includes('rate-limit') && !content.includes('express-rate-limit')) {
            this.issues.push({
              type: 'Missing Rate Limiting',
              severity: 'high',
              description: 'Rate limiting not implemented',
              file,
              recommendation: 'Implement rate limiting to prevent abuse'
            });
          }
        }
      });
    };

    checkSecurityHeaders();
    checkHTTPS();
    checkRateLimiting();

    this.report.categories.configurationIssues =
      this.issues.filter(issue => issue.type.includes('Security Header') ||
                                   issue.type.includes('HTTPS') ||
                                   issue.type.includes('Rate Limiting'));
  }

  async scanAuthentication(): Promise<void> {
    this.log('Scanning authentication security...');

    // Check for password strength requirements
    const authFiles = [
      'src/services/authService.ts',
      'src/controllers/authController.ts',
      'src/middleware/auth.ts'
    ];

    authFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');

        if (!content.includes('passwordStrength') && !content.includes('minLength')) {
          this.issues.push({
            type: 'Weak Password Policy',
            severity: 'medium',
            description: 'Password strength requirements not implemented',
            file,
            recommendation: 'Implement strong password requirements (length, complexity)'
          });
        }

        if (!content.includes('lockout') && !content.includes('brute')) {
          this.issues.push({
            type: 'Missing Account Lockout',
            severity: 'medium',
            description: 'Account lockout after failed attempts not implemented',
            file,
            recommendation: 'Implement account lockout after multiple failed login attempts'
          });
        }

        if (!content.includes('2FA') && !content.includes('two-factor')) {
          this.issues.push({
            type: 'Missing 2FA',
            severity: 'low',
            description: 'Two-factor authentication not available',
            file,
            recommendation: 'Consider implementing two-factor authentication'
          });
        }
      }
    });

    this.report.categories.authenticationIssues =
      this.issues.filter(issue => issue.type.includes('Password') ||
                                   issue.type.includes('Lockout') ||
                                   issue.type.includes('2FA'));
  }

  async scanDataValidation(): Promise<void> {
    this.log('Scanning data validation...');

    // Check for input validation
    const controllerFiles = this.findFiles('src/controllers', ['.ts', '.js']);

    controllerFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');

      if (!content.includes('validator') && !content.includes('joi') && !content.includes('zod')) {
        this.issues.push({
          type: 'Missing Input Validation',
          severity: 'high',
          description: 'Input validation not implemented in controller',
          file,
          recommendation: 'Implement proper input validation using validator, Joi, or Zod'
        });
      }

      if (content.includes('req.body') && !content.includes('sanitize')) {
        this.issues.push({
          type: 'Unsanitized Input',
          severity: 'high',
          description: 'Request body used without sanitization',
          file,
          recommendation: 'Sanitize all user inputs before processing'
        });
      }
    });

    this.report.categories.dataValidationIssues =
      this.issues.filter(issue => issue.type.includes('Validation') ||
                                   issue.type.includes('Sanitized'));
  }

  private findFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    items.forEach(item => {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        files.push(...this.findFiles(fullPath, extensions));
      } else if (extensions.some(ext => item.name.endsWith(ext))) {
        files.push(fullPath);
      }
    });

    return files;
  }

  private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: { [key: string]: 'low' | 'medium' | 'high' | 'critical' } = {
      'low': 'low',
      'moderate': 'medium',
      'high': 'high',
      'critical': 'critical'
    };

    return severityMap[severity] || 'medium';
  }

  calculateOWASPCompliance(): void {
    const owaspChecks = [
      { id: 'A01', name: 'Broken Access Control', found: false },
      { id: 'A02', name: 'Cryptographic Failures', found: false },
      { id: 'A03', name: 'Injection', found: false },
      { id: 'A04', name: 'Insecure Design', found: false },
      { id: 'A05', name: 'Security Misconfiguration', found: false },
      { id: 'A06', name: 'Vulnerable Components', found: false },
      { id: 'A07', name: 'Authentication Failures', found: false },
      { id: 'A08', name: 'Software/Data Integrity Failures', found: false },
      { id: 'A09', name: 'Security Logging/Monitoring Failures', found: false },
      { id: 'A10', name: 'Server-Side Request Forgery', found: false }
    ];

    // Check for issues related to each OWASP category
    this.issues.forEach(issue => {
      if (issue.type.includes('Access Control') || issue.type.includes('Authorization')) {
        owaspChecks[0].found = true;
      }
      if (issue.type.includes('Crypto') || issue.type.includes('Random')) {
        owaspChecks[1].found = true;
      }
      if (issue.type.includes('Injection') || issue.type.includes('XSS')) {
        owaspChecks[2].found = true;
      }
      if (issue.type.includes('Design') || issue.type.includes('Architecture')) {
        owaspChecks[3].found = true;
      }
      if (issue.type.includes('Configuration') || issue.type.includes('Header')) {
        owaspChecks[4].found = true;
      }
      if (issue.type.includes('Dependency')) {
        owaspChecks[5].found = true;
      }
      if (issue.type.includes('Authentication') || issue.type.includes('Password')) {
        owaspChecks[6].found = true;
      }
    });

    const foundIssues = owaspChecks.filter(check => check.found);
    this.report.compliance.owaspTop10 = foundIssues.map(check => `${check.id}: ${check.name}`);
    this.report.compliance.score = Math.max(0, 100 - (foundIssues.length * 10));
  }

  generateRecommendations(): void {
    const recommendations = new Set<string>();

    this.issues.forEach(issue => {
      recommendations.add(issue.recommendation);
    });

    // Add general security recommendations
    recommendations.add('Regularly update dependencies');
    recommendations.add('Implement security headers');
    recommendations.add('Use HTTPS in production');
    recommendations.add('Implement rate limiting');
    recommendations.add('Validate and sanitize all inputs');
    recommendations.add('Use secure password policies');
    recommendations.add('Implement proper error handling');
    recommendations.add('Add security logging and monitoring');

    this.report.recommendations = Array.from(recommendations);
  }

  calculateSummary(): void {
    this.report.summary.totalIssues = this.issues.length;
    this.report.summary.criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
    this.report.summary.highIssues = this.issues.filter(i => i.severity === 'high').length;
    this.report.summary.mediumIssues = this.issues.filter(i => i.severity === 'medium').length;
    this.report.summary.lowIssues = this.issues.filter(i => i.severity === 'low').length;
  }

  async generateReport(): Promise<void> {
    this.calculateSummary();
    this.calculateOWASPCompliance();
    this.generateRecommendations();

    const reportPath = '/Users/arkadiuszfudali/Git/StillOnTime/security-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlPath = '/Users/arkadiuszfudali/Git/StillOnTime/security-report.html';
    fs.writeFileSync(htmlPath, htmlReport);

    this.log(`Security report generated: ${reportPath}`, 'info');
    this.log(`HTML report generated: ${htmlPath}`, 'info');
  }

  private generateHTMLReport(): string {
    const { summary, categories, compliance, recommendations } = this.report;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StillOnTime Security Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .score { font-size: 48px; font-weight: bold; margin: 10px 0; }
        .score.high { color: #27ae60; }
        .score.medium { color: #f39c12; }
        .score.low { color: #e74c3c; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .issue { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .critical { border-left-color: #e74c3c; background: #fdf2f2; }
        .high { border-left-color: #f39c12; background: #fefcf3; }
        .medium { border-left-color: #3498db; background: #f3f8ff; }
        .low { border-left-color: #95a5a6; background: #f8f9fa; }
        .severity { display: inline-block; padding: 2px 8px; border-radius: 4px; color: white; font-size: 12px; }
        .severity.critical { background: #e74c3c; }
        .severity.high { background: #f39c12; }
        .severity.medium { background: #3498db; }
        .severity.low { background: #95a5a6; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
        .card .number { font-size: 32px; font-weight: bold; color: #3498db; }
        .recommendations { background: #e8f5e8; padding: 15px; border-radius: 8px; }
        .recommendations ul { margin: 10px 0; padding-left: 20px; }
        .recommendations li { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 StillOnTime Security Report</h1>
            <p>Generated on ${new Date(this.report.timestamp).toLocaleString()}</p>
            <div class="score ${compliance.score >= 80 ? 'high' : compliance.score >= 60 ? 'medium' : 'low'}">
                Security Score: ${compliance.score}/100
            </div>
        </div>

        <div class="summary-cards">
            <div class="card">
                <h3>Total Issues</h3>
                <div class="number">${summary.totalIssues}</div>
            </div>
            <div class="card">
                <h3>Critical</h3>
                <div class="number" style="color: #e74c3c;">${summary.criticalIssues}</div>
            </div>
            <div class="card">
                <h3>High</h3>
                <div class="number" style="color: #f39c12;">${summary.highIssues}</div>
            </div>
            <div class="card">
                <h3>Medium</h3>
                <div class="number" style="color: #3498db;">${summary.mediumIssues}</div>
            </div>
            <div class="card">
                <h3>Low</h3>
                <div class="number" style="color: #95a5a6;">${summary.lowIssues}</div>
            </div>
        </div>

        ${compliance.owaspTop10.length > 0 ? `
        <div class="section">
            <h2>🚨 OWASP Top 10 Issues Found</h2>
            <ul>
                ${compliance.owaspTop10.map(issue => `<li><strong>${issue}</strong></li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="section">
            <h2>📋 Security Issues by Category</h2>

            ${categories.dependencyVulnerabilities.length > 0 ? `
            <h3>📦 Dependency Vulnerabilities (${categories.dependencyVulnerabilities.length})</h3>
            ${categories.dependencyVulnerabilities.map(issue => `
            <div class="issue ${issue.severity}">
                <span class="severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
                <strong>${issue.description}</strong>
                <p><em>Recommendation: ${issue.recommendation}</em></p>
            </div>
            `).join('')}
            ` : '<p>✅ No dependency vulnerabilities found</p>'}

            ${categories.codeSecurityIssues.length > 0 ? `
            <h3>💻 Code Security Issues (${categories.codeSecurityIssues.length})</h3>
            ${categories.codeSecurityIssues.map(issue => `
            <div class="issue ${issue.severity}">
                <span class="severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
                <strong>${issue.description}</strong>
                ${issue.file ? `<p><em>File: ${issue.file}${issue.line ? `:${issue.line}` : ''}</em></p>` : ''}
                <p><em>Recommendation: ${issue.recommendation}</em></p>
            </div>
            `).join('')}
            ` : '<p>✅ No code security issues found</p>'}

            ${categories.configurationIssues.length > 0 ? `
            <h3>⚙️ Configuration Issues (${categories.configurationIssues.length})</h3>
            ${categories.configurationIssues.map(issue => `
            <div class="issue ${issue.severity}">
                <span class="severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
                <strong>${issue.description}</strong>
                <p><em>Recommendation: ${issue.recommendation}</em></p>
            </div>
            `).join('')}
            ` : '<p>✅ No configuration issues found</p>'}

            ${categories.authenticationIssues.length > 0 ? `
            <h3>🔐 Authentication Issues (${categories.authenticationIssues.length})</h3>
            ${categories.authenticationIssues.map(issue => `
            <div class="issue ${issue.severity}">
                <span class="severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
                <strong>${issue.description}</strong>
                <p><em>Recommendation: ${issue.recommendation}</em></p>
            </div>
            `).join('')}
            ` : '<p>✅ No authentication issues found</p>'}

            ${categories.dataValidationIssues.length > 0 ? `
            <h3>✅ Data Validation Issues (${categories.dataValidationIssues.length})</h3>
            ${categories.dataValidationIssues.map(issue => `
            <div class="issue ${issue.severity}">
                <span class="severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
                <strong>${issue.description}</strong>
                <p><em>Recommendation: ${issue.recommendation}</em></p>
            </div>
            `).join('')}
            ` : '<p>✅ No data validation issues found</p>'}
        </div>

        <div class="recommendations">
            <h2>🎯 Security Recommendations</h2>
            <ul>
                ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;
  }

  async runFullScan(): Promise<void> {
    this.log('🚀 Starting comprehensive security scan...', 'info');

    try {
      await this.scanDependencies();
      await this.scanCodeSecurity();
      await this.scanConfiguration();
      await this.scanAuthentication();
      await this.scanDataValidation();

      await this.generateReport();

      this.log(`✅ Security scan completed! Found ${this.issues.length} issues.`, 'info');
      this.log(`📊 Security Score: ${this.report.compliance.score}/100`, 'info');

      if (this.report.summary.criticalIssues > 0) {
        this.log(`🚨 ${this.report.summary.criticalIssues} critical issues require immediate attention!`, 'error');
      }

      if (this.report.summary.highIssues > 0) {
        this.log(`⚠️ ${this.report.summary.highIssues} high issues should be addressed soon.`, 'warn');
      }

    } catch (error) {
      this.log(`Security scan failed: ${error}`, 'error');
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const scanner = new SecurityScanner();
  scanner.runFullScan().catch(console.error);
}

export default SecurityScanner;
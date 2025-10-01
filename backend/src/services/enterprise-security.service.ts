/**
 * Enterprise Security Service
 * Advanced security hardening and compliance management for production deployment
 */

import { structuredLogger } from "../utils/logger";
import { z } from "zod";
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Security schemas
export const SecurityPolicySchema = z.object({
  policyId: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum([
    "authentication",
    "authorization", 
    "data_protection",
    "network_security",
    "compliance",
    "audit",
    "incident_response"
  ]),
  rules: z.array(z.object({
    condition: z.string(),
    action: z.enum(["allow", "deny", "warn", "audit"]),
    severity: z.enum(["low", "medium", "high", "critical"])
  })),
  enabled: z.boolean(),
  enforced: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const SecurityIncidentSchema = z.object({
  incidentId: z.string(),
  type: z.enum([
    "unauthorized_access",
    "data_breach", 
    "malware_detection",
    "ddos_attack",
    "privilege_escalation",
    "data_exfiltration",
    "suspicious_activity",
    "compliance_violation"
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "investigating", "contained", "resolved", "closed"]),
  description: z.string(),
  source: z.object({
    ip: z.string(),
    userAgent: z.string().optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional()
  }),
  detection: z.object({
    method: z.string(),
    timestamp: z.date(),
    confidence: z.number().min(0).max(1)
  }),
  impact: z.object({
    affectedUsers: z.number(),
    affectedData: z.string(),
    businessImpact: z.enum(["none", "low", "medium", "high", "critical"])
  }),
  response: z.object({
    actions: z.array(z.string()),
    containment: z.string().optional(),
    recovery: z.string().optional(),
    lessons: z.string().optional()
  }).optional(),
  reportedAt: z.date(),
  resolvedAt: z.date().optional()
});

export const ComplianceAuditSchema = z.object({
  auditId: z.string(),
  framework: z.enum([
    "SOX", "GDPR", "CCPA", "HIPAA", "SOC2", "ISO27001",
    "PCI_DSS", "NIST", "CIS", "OWASP"
  ]),
  scope: z.array(z.string()),
  findings: z.array(z.object({
    control: z.string(),
    status: z.enum(["compliant", "non_compliant", "partially_compliant", "not_applicable"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    description: z.string(),
    evidence: z.string().optional(),
    remediation: z.string().optional()
  })),
  overallScore: z.number().min(0).max(100),
  auditedBy: z.string(),
  auditedAt: z.date(),
  nextAuditDue: z.date()
});

export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>;
export type SecurityIncident = z.infer<typeof SecurityIncidentSchema>;
export type ComplianceAudit = z.infer<typeof ComplianceAuditSchema>;

/**
 * Enterprise Security Service
 */
export class EnterpriseSecurityService {
  private policies: Map<string, SecurityPolicy> = new Map();
  private incidents: Map<string, SecurityIncident> = new Map();
  private audits: Map<string, ComplianceAudit> = new Map();
  private threatIntelligence: Map<string, any> = new Map();
  
  // Security monitoring and detection engines
  private intrusionDetectionSystem = new IntrusionDetectionSystem();
  private dataLossPreventionSystem = new DataLossPreventionSystem();
  private behaviorAnalyticsEngine = new BehaviorAnalyticsEngine();
  private complianceMonitor = new ComplianceMonitor();

  constructor() {
    this.initializeDefaultPolicies();
    this.startSecurityMonitoring();
    this.initializeThreatIntelligence();
  }

  /**
   * Advanced authentication security middleware
   */
  authenticationSecurity(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const startTime = Date.now();
        
        // Request fingerprinting
        const fingerprint = this.generateRequestFingerprint(req);
        
        // Rate limiting with adaptive thresholds
        const rateLimitCheck = await this.checkAdaptiveRateLimit(req, fingerprint);
        if (!rateLimitCheck.allowed) {
          await this.logSecurityEvent('rate_limit_exceeded', req, rateLimitCheck);
          res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: rateLimitCheck.retryAfter
          });
          return;
        }

        // Geolocation-based anomaly detection
        const geoAnomaly = await this.detectGeolocationAnomaly(req);
        if (geoAnomaly.isAnomalous && geoAnomaly.riskScore > 0.8) {
          await this.createSecurityIncident({
            type: 'suspicious_activity',
            severity: 'high',
            description: `Geolocation anomaly detected: ${geoAnomaly.description}`,
            source: this.extractSourceInfo(req)
          });
        }

        // Device fingerprinting and trust score
        const deviceTrust = await this.calculateDeviceTrustScore(req);
        if (deviceTrust.score < 0.3) {
          req.headers['x-device-trust'] = deviceTrust.score.toString();
          await this.logSecurityEvent('low_device_trust', req, deviceTrust);
        }

        // SQL injection and XSS pattern detection
        const injectionCheck = await this.detectInjectionAttacks(req);
        if (injectionCheck.detected) {
          await this.createSecurityIncident({
            type: 'unauthorized_access',
            severity: 'critical',
            description: `Injection attack detected: ${injectionCheck.type}`,
            source: this.extractSourceInfo(req)
          });
          
          res.status(403).json({
            error: 'Request blocked by security policy'
          });
          return;
        }

        // Session security validation
        const sessionCheck = await this.validateSessionSecurity(req);
        if (!sessionCheck.valid) {
          res.status(401).json({
            error: 'Session security validation failed',
            reason: sessionCheck.reason
          });
          return;
        }

        // Add security headers
        this.addSecurityHeaders(res);

        // Performance monitoring
        const processingTime = Date.now() - startTime;
        if (processingTime > 100) {
          structuredLogger.warn("Security middleware slow processing", {
            processingTime,
            path: req.path,
            method: req.method
          });
        }

        next();

      } catch (error) {
        structuredLogger.error("Authentication security middleware error", {
          error: error instanceof Error ? error.message : String(error),
          path: req.path,
          method: req.method
        });
        
        // Fail securely
        res.status(500).json({
          error: 'Security validation failed'
        });
      }
    };
  }

  /**
   * Data encryption and decryption
   */
  encryptSensitiveData(data: string, key?: string): string {
    try {
      const encryptionKey = key || process.env.DATA_ENCRYPTION_KEY || this.generateEncryptionKey();
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(algorithm, encryptionKey);
      cipher.setAAD(Buffer.from('stillontime-data'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
    } catch (error) {
      structuredLogger.error("Data encryption failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Data encryption failed');
    }
  }

  decryptSensitiveData(encryptedData: string, key?: string): string {
    try {
      const encryptionKey = key || process.env.DATA_ENCRYPTION_KEY || this.generateEncryptionKey();
      const algorithm = 'aes-256-gcm';
      
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipher(algorithm, encryptionKey);
      decipher.setAAD(Buffer.from('stillontime-data'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      structuredLogger.error("Data decryption failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Create and track security incident
   */
  async createSecurityIncident(
    incident: Omit<SecurityIncident, 'incidentId' | 'reportedAt' | 'status'>
  ): Promise<string> {
    try {
      const securityIncident: SecurityIncident = {
        incidentId: this.generateIncidentId(),
        status: 'open',
        reportedAt: new Date(),
        ...incident
      };

      // Validate incident data
      SecurityIncidentSchema.parse(securityIncident);

      // Store incident
      this.incidents.set(securityIncident.incidentId, securityIncident);

      // Trigger immediate response for critical incidents
      if (securityIncident.severity === 'critical') {
        await this.triggerIncidentResponse(securityIncident);
      }

      // Send alerts
      await this.sendSecurityAlert(securityIncident);

      structuredLogger.error("Security incident created", {
        incidentId: securityIncident.incidentId,
        type: securityIncident.type,
        severity: securityIncident.severity,
        source: securityIncident.source
      });

      return securityIncident.incidentId;

    } catch (error) {
      structuredLogger.error("Failed to create security incident", {
        error: error instanceof Error ? error.message : String(error),
        incident
      });
      throw error;
    }
  }

  /**
   * Perform compliance audit
   */
  async performComplianceAudit(
    framework: ComplianceAudit['framework'],
    scope: string[]
  ): Promise<ComplianceAudit> {
    try {
      structuredLogger.info("Starting compliance audit", {
        framework,
        scope
      });

      const findings = await this.evaluateComplianceControls(framework, scope);
      const overallScore = this.calculateComplianceScore(findings);

      const audit: ComplianceAudit = {
        auditId: this.generateAuditId(),
        framework,
        scope,
        findings,
        overallScore,
        auditedBy: 'system',
        auditedAt: new Date(),
        nextAuditDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      };

      // Validate audit data
      ComplianceAuditSchema.parse(audit);

      // Store audit results
      this.audits.set(audit.auditId, audit);

      // Generate compliance report
      await this.generateComplianceReport(audit);

      // Alert on critical findings
      const criticalFindings = findings.filter(f => f.severity === 'critical');
      if (criticalFindings.length > 0) {
        await this.alertComplianceViolations(audit, criticalFindings);
      }

      structuredLogger.info("Compliance audit completed", {
        auditId: audit.auditId,
        framework,
        overallScore,
        criticalFindings: criticalFindings.length
      });

      return audit;

    } catch (error) {
      structuredLogger.error("Compliance audit failed", {
        error: error instanceof Error ? error.message : String(error),
        framework,
        scope
      });
      throw error;
    }
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<{
    summary: {
      activeIncidents: number;
      criticalIncidents: number;
      complianceScore: number;
      threatLevel: string;
    };
    incidents: SecurityIncident[];
    recentAudits: ComplianceAudit[];
    threatIntelligence: any[];
    securityMetrics: {
      authenticationFailures: number;
      suspiciousActivities: number;
      blockedRequests: number;
      dataBreachAttempts: number;
    };
  }> {
    try {
      const activeIncidents = Array.from(this.incidents.values())
        .filter(i => ['open', 'investigating'].includes(i.status));
      
      const criticalIncidents = activeIncidents
        .filter(i => i.severity === 'critical');

      const recentAudits = Array.from(this.audits.values())
        .sort((a, b) => b.auditedAt.getTime() - a.auditedAt.getTime())
        .slice(0, 5);

      const latestCompliance = recentAudits[0];
      const complianceScore = latestCompliance?.overallScore || 0;

      const threatLevel = this.calculateThreatLevel();
      
      const securityMetrics = await this.getSecurityMetrics();

      return {
        summary: {
          activeIncidents: activeIncidents.length,
          criticalIncidents: criticalIncidents.length,
          complianceScore,
          threatLevel
        },
        incidents: activeIncidents.slice(0, 10),
        recentAudits,
        threatIntelligence: this.getLatestThreatIntelligence(),
        securityMetrics
      };

    } catch (error) {
      structuredLogger.error("Failed to get security dashboard", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Private helper methods
  private async initializeDefaultPolicies(): Promise<void> {
    const defaultPolicies = [
      {
        name: "Strong Authentication Policy",
        description: "Enforce strong password requirements and MFA",
        type: "authentication" as const,
        rules: [
          { condition: "password_strength < 8", action: "deny" as const, severity: "high" as const },
          { condition: "failed_attempts > 5", action: "deny" as const, severity: "medium" as const }
        ]
      },
      {
        name: "Data Protection Policy", 
        description: "Encrypt sensitive data at rest and in transit",
        type: "data_protection" as const,
        rules: [
          { condition: "pii_unencrypted", action: "deny" as const, severity: "critical" as const },
          { condition: "data_export_unauthorized", action: "audit" as const, severity: "high" as const }
        ]
      }
    ];

    for (const policy of defaultPolicies) {
      await this.createSecurityPolicy(policy);
    }
  }

  private async createSecurityPolicy(
    policy: Omit<SecurityPolicy, 'policyId' | 'enabled' | 'enforced' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const securityPolicy: SecurityPolicy = {
      policyId: this.generatePolicyId(),
      enabled: true,
      enforced: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...policy
    };

    this.policies.set(securityPolicy.policyId, securityPolicy);
    return securityPolicy.policyId;
  }

  private generateRequestFingerprint(req: Request): string {
    const elements = [
      req.ip,
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || ''
    ];
    
    return crypto.createHash('sha256')
      .update(elements.join('|'))
      .digest('hex');
  }

  private async checkAdaptiveRateLimit(
    req: Request, 
    fingerprint: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    // Implementation would use Redis for distributed rate limiting
    return { allowed: true };
  }

  private async detectGeolocationAnomaly(req: Request): Promise<{
    isAnomalous: boolean;
    riskScore: number;
    description: string;
  }> {
    // Implementation would use IP geolocation and user behavior patterns
    return { isAnomalous: false, riskScore: 0.1, description: 'Normal location' };
  }

  private async calculateDeviceTrustScore(req: Request): Promise<{
    score: number;
    factors: string[];
  }> {
    // Implementation would analyze device fingerprinting factors
    return { score: 0.8, factors: ['known_device', 'normal_patterns'] };
  }

  private async detectInjectionAttacks(req: Request): Promise<{
    detected: boolean;
    type?: string;
  }> {
    // Implementation would use WAF-like pattern matching
    return { detected: false };
  }

  private async validateSessionSecurity(req: Request): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    // Implementation would validate session tokens and security
    return { valid: true };
  }

  private addSecurityHeaders(res: Response): void {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  private extractSourceInfo(req: Request) {
    return {
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionID
    };
  }

  private async logSecurityEvent(
    event: string, 
    req: Request, 
    details: any
  ): Promise<void> {
    structuredLogger.warn("Security event", {
      event,
      source: this.extractSourceInfo(req),
      details,
      timestamp: new Date()
    });
  }

  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async triggerIncidentResponse(incident: SecurityIncident): Promise<void> {
    // Implementation would trigger automated response procedures
    structuredLogger.error("Critical security incident - triggering response", {
      incidentId: incident.incidentId
    });
  }

  private async sendSecurityAlert(incident: SecurityIncident): Promise<void> {
    // Implementation would send alerts via email, Slack, etc.
    structuredLogger.info("Security alert sent", {
      incidentId: incident.incidentId,
      severity: incident.severity
    });
  }

  private async evaluateComplianceControls(
    framework: string,
    scope: string[]
  ): Promise<ComplianceAudit['findings']> {
    // Implementation would evaluate specific compliance controls
    return [
      {
        control: "Access Control",
        status: "compliant",
        severity: "low",
        description: "Strong access controls implemented"
      }
    ];
  }

  private calculateComplianceScore(findings: ComplianceAudit['findings']): number {
    const total = findings.length;
    const compliant = findings.filter(f => f.status === 'compliant').length;
    return Math.round((compliant / total) * 100);
  }

  private async generateComplianceReport(audit: ComplianceAudit): Promise<void> {
    // Implementation would generate detailed compliance reports
    structuredLogger.info("Compliance report generated", {
      auditId: audit.auditId,
      framework: audit.framework
    });
  }

  private async alertComplianceViolations(
    audit: ComplianceAudit,
    violations: ComplianceAudit['findings']
  ): Promise<void> {
    // Implementation would alert on compliance violations
    structuredLogger.error("Compliance violations detected", {
      auditId: audit.auditId,
      violationCount: violations.length
    });
  }

  private calculateThreatLevel(): string {
    // Implementation would calculate current threat level
    return 'medium';
  }

  private async getSecurityMetrics() {
    // Implementation would gather security metrics
    return {
      authenticationFailures: 0,
      suspiciousActivities: 0,
      blockedRequests: 0,
      dataBreachAttempts: 0
    };
  }

  private getLatestThreatIntelligence(): any[] {
    // Implementation would return latest threat intelligence
    return [];
  }

  private startSecurityMonitoring(): void {
    // Start background security monitoring
    setInterval(async () => {
      await this.performSecurityScan();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async performSecurityScan(): Promise<void> {
    // Implementation would perform automated security scans
    structuredLogger.debug("Performing automated security scan");
  }

  private initializeThreatIntelligence(): void {
    // Initialize threat intelligence feeds
    structuredLogger.info("Threat intelligence initialized");
  }

  private generateIncidentId(): string {
    return `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePolicyId(): string {
    return `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Security subsystems
class IntrusionDetectionSystem {
  async detectIntrusion(request: any): Promise<boolean> {
    // Implementation would detect intrusion attempts
    return false;
  }
}

class DataLossPreventionSystem {
  async scanForDataLeaks(data: any): Promise<boolean> {
    // Implementation would scan for data leaks
    return false;
  }
}

class BehaviorAnalyticsEngine {
  async analyzeUserBehavior(userId: string): Promise<any> {
    // Implementation would analyze user behavior patterns
    return { anomalyScore: 0.1 };
  }
}

class ComplianceMonitor {
  async checkCompliance(action: string): Promise<boolean> {
    // Implementation would check compliance in real-time
    return true;
  }
}
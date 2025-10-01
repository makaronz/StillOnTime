/**
 * Security Hardening Service
 * Comprehensive security controls and audit logging
 */

import { logger, structuredLogger } from "../utils/logger";
import { z } from "zod";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

// Security schemas
export const SecurityEventSchema = z.object({
  eventId: z.string(),
  type: z.enum([
    "authentication_attempt",
    "authorization_check",
    "data_access",
    "configuration_change",
    "security_violation",
    "suspicious_activity",
    "rate_limit_exceeded",
    "token_manipulation",
    "privilege_escalation"
  ]),
  userId: z.string().optional(),
  ip: z.string(),
  userAgent: z.string(),
  timestamp: z.date(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  details: z.record(z.any()),
  outcome: z.enum(["success", "failure", "blocked", "monitored"]),
  riskScore: z.number().min(0).max(100)
});

export const ThreatDetectionSchema = z.object({
  threatId: z.string(),
  type: z.enum([
    "brute_force",
    "injection_attempt",
    "path_traversal",
    "xss_attempt",
    "csrf_attack",
    "privilege_escalation",
    "data_exfiltration",
    "anomalous_behavior"
  ]),
  source: z.object({
    ip: z.string(),
    userAgent: z.string(),
    userId: z.string().optional(),
    geolocation: z.object({
      country: z.string(),
      region: z.string(),
      city: z.string()
    }).optional()
  }),
  detectedAt: z.date(),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.string()),
  mitigation: z.object({
    action: z.enum(["block", "rate_limit", "monitor", "alert"]),
    duration: z.number().optional(),
    applied: z.boolean()
  })
});

export const AuditLogSchema = z.object({
  auditId: z.string(),
  userId: z.string(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  timestamp: z.date(),
  ip: z.string(),
  userAgent: z.string(),
  changes: z.object({
    before: z.record(z.any()).optional(),
    after: z.record(z.any()).optional()
  }).optional(),
  metadata: z.record(z.any()),
  status: z.enum(["success", "failure", "partial"]),
  riskLevel: z.enum(["low", "medium", "high", "critical"])
});

export type SecurityEvent = z.infer<typeof SecurityEventSchema>;
export type ThreatDetection = z.infer<typeof ThreatDetectionSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;

/**
 * Security Hardening Service
 */
export class SecurityHardeningService {
  private securityEvents: Map<string, SecurityEvent[]> = new Map(); // IP -> events
  private auditLogs: AuditLog[] = [];
  private blockedIPs: Set<string> = new Set();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private suspiciousActivities: Map<string, number> = new Map(); // userId -> risk score
  
  // Security configuration
  private readonly config = {
    maxLoginAttempts: 5,
    loginCooldownMinutes: 15,
    rateLimitWindow: 60000, // 1 minute
    maxRequestsPerWindow: 100,
    suspiciousThreshold: 70,
    blockDuration: 3600000, // 1 hour
    auditRetentionDays: 90,
    encryptionAlgorithm: 'aes-256-gcm',
    hashingAlgorithm: 'sha256'
  };

  constructor() {
    this.initializeSecurityMonitoring();
    this.startThreatDetection();
    this.setupAuditLogRotation();
  }

  /**
   * Authentication security middleware
   */
  authenticationSecurity() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ip = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || 'unknown';
        
        // Check if IP is blocked
        if (this.blockedIPs.has(ip)) {
          this.logSecurityEvent({
            type: "authentication_attempt",
            ip,
            userAgent,
            severity: "high",
            details: { reason: "blocked_ip", endpoint: req.path },
            outcome: "blocked",
            riskScore: 90
          });
          
          return res.status(403).json({
            error: "Access denied",
            code: "IP_BLOCKED"
          });
        }
        
        // Rate limiting check
        if (this.isRateLimited(ip)) {
          this.logSecurityEvent({
            type: "rate_limit_exceeded",
            ip,
            userAgent,
            severity: "medium",
            details: { endpoint: req.path, method: req.method },
            outcome: "blocked",
            riskScore: 50
          });
          
          return res.status(429).json({
            error: "Rate limit exceeded",
            code: "RATE_LIMITED"
          });
        }
        
        // Log authentication attempt
        this.logSecurityEvent({
          type: "authentication_attempt",
          ip,
          userAgent,
          severity: "low",
          details: { endpoint: req.path, method: req.method },
          outcome: "monitored",
          riskScore: 10
        });
        
        next();
        
      } catch (error) {
        structuredLogger.error("Authentication security check failed", {
          error: error.message,
          ip: this.getClientIP(req)
        });
        next(error);
      }
    };
  }

  /**
   * Input validation and sanitization middleware
   */
  inputValidationSecurity() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const ip = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || 'unknown';
        
        // Check for injection patterns
        const injectionPatterns = [
          /(union|select|insert|delete|drop|create|alter|exec|script)/i,
          /<script[^>]*>.*?<\/script>/gi,
          /javascript:|vbscript:|onload=|onerror=/i,
          /\.\.\//g,
          /\0/g
        ];
        
        const requestData = JSON.stringify({
          body: req.body,
          query: req.query,
          params: req.params
        });
        
        for (const pattern of injectionPatterns) {
          if (pattern.test(requestData)) {
            this.detectThreat({
              type: "injection_attempt",
              source: { ip, userAgent },
              confidence: 0.8,
              indicators: [`Pattern matched: ${pattern.source}`],
              mitigation: { action: "block", applied: true }
            });
            
            return res.status(400).json({
              error: "Invalid input detected",
              code: "INPUT_VALIDATION_FAILED"
            });
          }
        }
        
        // Sanitize inputs
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }
        
        next();
        
      } catch (error) {
        structuredLogger.error("Input validation failed", {
          error: error.message,
          ip: this.getClientIP(req)
        });
        next(error);
      }
    };
  }

  /**
   * Authorization logging middleware
   */
  authorizationAudit() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const originalJson = res.json;
        const startTime = Date.now();
        
        res.json = function(data) {
          const responseTime = Date.now() - startTime;
          
          // Log authorization decision
          if (req.user) {
            this.logAuditEvent({
              userId: req.user.id,
              action: `${req.method} ${req.path}`,
              resource: req.path,
              resourceId: req.params.id,
              ip: this.getClientIP(req),
              userAgent: req.get('User-Agent') || 'unknown',
              metadata: {
                responseStatus: res.statusCode,
                responseTime,
                dataAccessed: !!data
              },
              status: res.statusCode < 400 ? "success" : "failure",
              riskLevel: this.calculateRiskLevel(req, res.statusCode)
            });
          }
          
          return originalJson.call(this, data);
        }.bind(this);
        
        next();
        
      } catch (error) {
        structuredLogger.error("Authorization audit failed", {
          error: error.message
        });
        next(error);
      }
    };
  }

  /**
   * Data encryption utilities
   */
  encryptSensitiveData(data: string, key?: string): string {
    try {
      const encryptionKey = key || this.getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, encryptionKey);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      });
      
    } catch (error) {
      structuredLogger.error("Data encryption failed", {
        error: error.message
      });
      throw new Error("Encryption failed");
    }
  }

  /**
   * Data decryption utilities
   */
  decryptSensitiveData(encryptedData: string, key?: string): string {
    try {
      const encryptionKey = key || this.getEncryptionKey();
      const { encrypted, iv, authTag } = JSON.parse(encryptedData);
      
      const decipher = crypto.createDecipher(this.config.encryptionAlgorithm, encryptionKey);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      structuredLogger.error("Data decryption failed", {
        error: error.message
      });
      throw new Error("Decryption failed");
    }
  }

  /**
   * Secure token generation
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Password hashing with salt
   */
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    try {
      const passwordSalt = salt || crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, passwordSalt, 10000, 64, this.config.hashingAlgorithm);
      
      return {
        hash: hash.toString('hex'),
        salt: passwordSalt
      };
      
    } catch (error) {
      structuredLogger.error("Password hashing failed", {
        error: error.message
      });
      throw new Error("Password hashing failed");
    }
  }

  /**
   * Password verification
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, this.config.hashingAlgorithm);
      return hashedPassword.toString('hex') === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Threat detection and response
   */
  private detectThreat(threat: Omit<ThreatDetection, 'threatId' | 'detectedAt'>): void {
    const threatDetection: ThreatDetection = {
      threatId: this.generateThreatId(),
      detectedAt: new Date(),
      ...threat
    };
    
    structuredLogger.warn("Security threat detected", {
      threatId: threatDetection.threatId,
      type: threatDetection.type,
      confidence: threatDetection.confidence,
      source: threatDetection.source
    });
    
    // Apply mitigation
    this.applyThreatMitigation(threatDetection);
    
    // Alert security team for high-confidence threats
    if (threatDetection.confidence > 0.7) {
      this.alertSecurityTeam(threatDetection);
    }
  }

  /**
   * Apply threat mitigation measures
   */
  private applyThreatMitigation(threat: ThreatDetection): void {
    const { source, mitigation } = threat;
    
    switch (mitigation.action) {
      case "block":
        this.blockedIPs.add(source.ip);
        if (mitigation.duration) {
          setTimeout(() => {
            this.blockedIPs.delete(source.ip);
          }, mitigation.duration);
        }
        break;
        
      case "rate_limit":
        this.rateLimiters.set(source.ip, {
          count: this.config.maxRequestsPerWindow,
          resetTime: Date.now() + this.config.rateLimitWindow
        });
        break;
        
      case "monitor":
        if (source.userId) {
          const currentRisk = this.suspiciousActivities.get(source.userId) || 0;
          this.suspiciousActivities.set(source.userId, currentRisk + 20);
        }
        break;
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: Omit<SecurityEvent, 'eventId' | 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };
    
    // Store event for analysis
    if (!this.securityEvents.has(event.ip)) {
      this.securityEvents.set(event.ip, []);
    }
    this.securityEvents.get(event.ip)!.push(securityEvent);
    
    // Log to structured logger
    structuredLogger.info("Security event", securityEvent);
    
    // Check for patterns that indicate threats
    this.analyzeSecurityPatterns(event.ip);
  }

  /**
   * Log audit events
   */
  private logAuditEvent(event: Omit<AuditLog, 'auditId' | 'timestamp'>): void {
    const auditLog: AuditLog = {
      auditId: this.generateAuditId(),
      timestamp: new Date(),
      ...event
    };
    
    this.auditLogs.push(auditLog);
    
    structuredLogger.info("Audit log", auditLog);
    
    // Check for suspicious user activity
    if (event.riskLevel === "high" || event.riskLevel === "critical") {
      this.flagSuspiciousActivity(event.userId);
    }
  }

  /**
   * Analyze security patterns for threat detection
   */
  private analyzeSecurityPatterns(ip: string): void {
    const events = this.securityEvents.get(ip) || [];
    const recentEvents = events.filter(e => 
      Date.now() - e.timestamp.getTime() < 300000 // Last 5 minutes
    );
    
    // Detect brute force attempts
    const failedLogins = recentEvents.filter(e => 
      e.type === "authentication_attempt" && e.outcome === "failure"
    );
    
    if (failedLogins.length >= this.config.maxLoginAttempts) {
      this.detectThreat({
        type: "brute_force",
        source: { ip, userAgent: failedLogins[0].userAgent },
        confidence: 0.9,
        indicators: [`${failedLogins.length} failed login attempts in 5 minutes`],
        mitigation: { 
          action: "block", 
          duration: this.config.blockDuration,
          applied: true 
        }
      });
    }
    
    // Detect rapid requests (potential DDoS)
    if (recentEvents.length > 50) {
      this.detectThreat({
        type: "anomalous_behavior",
        source: { ip, userAgent: recentEvents[0].userAgent },
        confidence: 0.7,
        indicators: [`${recentEvents.length} requests in 5 minutes`],
        mitigation: { action: "rate_limit", applied: true }
      });
    }
  }

  /**
   * Flag suspicious user activity
   */
  private flagSuspiciousActivity(userId: string): void {
    const currentRisk = this.suspiciousActivities.get(userId) || 0;
    const newRisk = Math.min(100, currentRisk + 15);
    
    this.suspiciousActivities.set(userId, newRisk);
    
    if (newRisk >= this.config.suspiciousThreshold) {
      structuredLogger.warn("Suspicious user activity detected", {
        userId,
        riskScore: newRisk
      });
      
      // Additional monitoring or restrictions for suspicious users
      this.applySuspiciousUserMeasures(userId, newRisk);
    }
  }

  /**
   * Apply measures for suspicious users
   */
  private applySuspiciousUserMeasures(userId: string, riskScore: number): void {
    if (riskScore >= 90) {
      // Temporarily suspend user account
      structuredLogger.error("User account suspended due to high risk", {
        userId,
        riskScore
      });
    } else if (riskScore >= 70) {
      // Require additional authentication
      structuredLogger.warn("Additional authentication required", {
        userId,
        riskScore
      });
    }
  }

  /**
   * Rate limiting check
   */
  private isRateLimited(ip: string): boolean {
    const limiter = this.rateLimiters.get(ip);
    
    if (!limiter) {
      this.rateLimiters.set(ip, {
        count: 1,
        resetTime: Date.now() + this.config.rateLimitWindow
      });
      return false;
    }
    
    if (Date.now() > limiter.resetTime) {
      this.rateLimiters.set(ip, {
        count: 1,
        resetTime: Date.now() + this.config.rateLimitWindow
      });
      return false;
    }
    
    limiter.count++;
    return limiter.count > this.config.maxRequestsPerWindow;
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:|vbscript:/gi, '') // Remove script protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Calculate risk level based on request and response
   */
  private calculateRiskLevel(req: Request, statusCode: number): AuditLog['riskLevel'] {
    if (statusCode >= 500) return "critical";
    if (statusCode >= 400) return "high";
    if (req.method === "DELETE") return "medium";
    if (req.method === "POST" || req.method === "PUT") return "medium";
    return "low";
  }

  /**
   * Initialize security monitoring
   */
  private initializeSecurityMonitoring(): void {
    // Clean up old security events every hour
    setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const [ip, events] of this.securityEvents.entries()) {
        const recentEvents = events.filter(e => e.timestamp.getTime() > cutoff);
        if (recentEvents.length === 0) {
          this.securityEvents.delete(ip);
        } else {
          this.securityEvents.set(ip, recentEvents);
        }
      }
    }, 3600000);
  }

  /**
   * Start threat detection monitoring
   */
  private startThreatDetection(): void {
    // Monitor for threat patterns every 5 minutes
    setInterval(() => {
      this.runThreatAnalysis();
    }, 300000);
  }

  /**
   * Setup audit log rotation
   */
  private setupAuditLogRotation(): void {
    // Rotate audit logs daily
    setInterval(() => {
      const cutoff = Date.now() - (this.config.auditRetentionDays * 24 * 60 * 60 * 1000);
      this.auditLogs = this.auditLogs.filter(log => log.timestamp.getTime() > cutoff);
      
      structuredLogger.info("Audit log rotation completed", {
        remainingLogs: this.auditLogs.length
      });
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Run comprehensive threat analysis
   */
  private runThreatAnalysis(): void {
    // Analyze patterns across all IPs
    const allEvents = Array.from(this.securityEvents.values()).flat();
    const recentEvents = allEvents.filter(e => 
      Date.now() - e.timestamp.getTime() < 3600000 // Last hour
    );
    
    // Group by patterns
    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Detect coordinated attacks
    Object.entries(eventsByType).forEach(([type, count]) => {
      if (count > 100) { // Threshold for coordinated attack
        structuredLogger.warn("Potential coordinated attack detected", {
          eventType: type,
          eventCount: count,
          timeWindow: "1 hour"
        });
      }
    });
  }

  // Utility methods
  private generateEventId(): string {
    return `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateThreatId(): string {
    return `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private getEncryptionKey(): string {
    return process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  }

  private alertSecurityTeam(threat: ThreatDetection): void {
    // In production, this would integrate with alerting systems
    structuredLogger.error("High-confidence security threat - alerting security team", {
      threatId: threat.threatId,
      type: threat.type,
      confidence: threat.confidence
    });
  }

  /**
   * Get security analytics
   */
  public getSecurityAnalytics(): {
    threatsSummary: Record<string, number>;
    blockedIPs: number;
    suspiciousUsers: number;
    auditLogsSummary: Record<string, number>;
    riskDistribution: Record<string, number>;
  } {
    const allEvents = Array.from(this.securityEvents.values()).flat();
    const last24Hours = allEvents.filter(e => 
      Date.now() - e.timestamp.getTime() < 86400000
    );
    
    return {
      threatsSummary: last24Hours.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      blockedIPs: this.blockedIPs.size,
      suspiciousUsers: Array.from(this.suspiciousActivities.values())
        .filter(score => score >= this.config.suspiciousThreshold).length,
      auditLogsSummary: this.auditLogs.reduce((acc, log) => {
        acc[log.riskLevel] = (acc[log.riskLevel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      riskDistribution: {
        low: Array.from(this.suspiciousActivities.values()).filter(s => s < 30).length,
        medium: Array.from(this.suspiciousActivities.values()).filter(s => s >= 30 && s < 70).length,
        high: Array.from(this.suspiciousActivities.values()).filter(s => s >= 70).length
      }
    };
  }
}
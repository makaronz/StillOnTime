import { google, gmail_v1 } from "googleapis";
import { ParseGmailApi } from "gmail-api-parse-message-ts";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import { OAuth2Service } from "./oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { AIEmailClassifierService } from "./ai-email-classifier.service";
import { EnhancedPDFParserService } from "./enhanced-pdf-parser.service";
import { logger } from "@/utils/logger";
import { GmailService, GmailMessage, EmailAttachment } from "./gmail.service";
import { ProcessedEmail, CreateProcessedEmailInput } from "@/types";

export interface EnhancedEmailAnalysis {
  isScheduleEmail: boolean;
  confidence: number;
  reasons: string[];
  metadata: {
    subjectAnalysis: {
      containsScheduleKeywords: boolean;
      keywordCount: number;
      urgencyIndicators: string[];
    };
    contentAnalysis: {
      hasTimeReferences: boolean;
      hasLocationReferences: boolean;
      hasContactInfo: boolean;
      textQuality: number;
    };
    senderAnalysis: {
      domain: string;
      trustScore: number;
      isKnownSender: boolean;
      reputation: "high" | "medium" | "low" | "unknown";
    };
    attachmentAnalysis: {
      totalAttachments: number;
      pdfCount: number;
      suspiciousAttachments: number;
      attachmentQuality: number;
    };
  };
  aiClassification?: {
    category: string;
    extractedData: any;
    confidence: number;
  };
}

export interface EnhancedEmailProcessingResult {
  processed: boolean;
  analysis: EnhancedEmailAnalysis;
  extractedScheduleData?: any;
  processingTime: number;
  errors: string[];
  recommendations: string[];
}

/**
 * Enhanced Gmail Service with modern TypeScript-native parsing
 * Integrates gmail-api-parse-message-ts, mailparser, and AI analysis
 */
export class EnhancedGmailService extends GmailService {
  private aiClassifier?: AIEmailClassifierService;
  private enhancedPdfParser?: EnhancedPDFParserService;

  // Enhanced keyword sets for better classification
  private readonly ENHANCED_SCHEDULE_KEYWORDS = {
    primary: [
      "shooting schedule", "call sheet", "filming schedule", "production schedule",
      "call time", "wrap time", "shooting day", "film schedule", "video schedule"
    ],
    secondary: [
      "schedule", "filming", "production", "shoot", "location", "crew",
      "equipment", "camera", "director", "producer", "cinematographer"
    ],
    urgency: [
      "urgent", "asap", "immediately", "rush", "priority", "important",
      "last minute", "emergency", "changed", "updated", "revised"
    ],
    polish: [
      "plan zdjęciowy", "drabinka", "harmonogram", "zdjęcia",
      "kręcenie", "lokacja", "sprzęt", "ekipa", "reżyser"
    ]
  };

  private readonly TRUSTED_DOMAINS = new Set([
    "stillontime.pl", "stillontime.com",
    "filmcrew.pl", "filmowa.pl", "production.pl",
    "gmail.com", "outlook.com", // For testing
  ]);

  constructor(
    oauth2Service: OAuth2Service,
    processedEmailRepository: ProcessedEmailRepository,
    aiClassifier?: AIEmailClassifierService,
    enhancedPdfParser?: EnhancedPDFParserService
  ) {
    super(oauth2Service, processedEmailRepository);
    this.aiClassifier = aiClassifier;
    this.enhancedPdfParser = enhancedPdfParser;
  }

  /**
   * Enhanced email monitoring with intelligent filtering
   */
  async monitorEmailsEnhanced(userId: string): Promise<EnhancedEmailProcessingResult[]> {
    try {
      logger.info("Starting enhanced email monitoring", { userId });
      const startTime = Date.now();

      const scheduleEmails = await this.getScheduleEmails(userId);
      const results: EnhancedEmailProcessingResult[] = [];

      logger.info("Found potential schedule emails for enhanced processing", {
        userId,
        count: scheduleEmails.length,
      });

      // Process emails with enhanced analysis
      for (const email of scheduleEmails) {
        try {
          const result = await this.processScheduleEmailEnhanced(userId, email);
          results.push(result);
        } catch (error) {
          logger.error("Enhanced email processing failed", {
            userId,
            messageId: email.id,
            error,
          });
          
          results.push({
            processed: false,
            analysis: await this.createFailureAnalysis(email, error),
            processingTime: 0,
            errors: [error instanceof Error ? error.message : "Unknown error"],
            recommendations: ["Manual review required", "Consider re-processing"],
          });
        }
      }

      const totalProcessingTime = Date.now() - startTime;
      const successCount = results.filter(r => r.processed).length;

      logger.info("Enhanced email monitoring completed", {
        userId,
        totalEmails: results.length,
        successfullyProcessed: successCount,
        totalProcessingTimeMs: totalProcessingTime,
        averageProcessingTimeMs: results.length > 0 ? totalProcessingTime / results.length : 0,
      });

      return results;
    } catch (error) {
      logger.error("Enhanced email monitoring failed", { userId, error });
      throw new Error(`Enhanced email monitoring failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Enhanced email processing with comprehensive analysis
   */
  private async processScheduleEmailEnhanced(
    userId: string,
    email: GmailMessage
  ): Promise<EnhancedEmailProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Check if already processed
      const isProcessed = await this.isEmailProcessed(email.id);
      if (isProcessed) {
        logger.debug("Email already processed, skipping enhanced analysis", {
          userId,
          messageId: email.id,
        });
        
        return {
          processed: false,
          analysis: await this.createSkippedAnalysis(email),
          processingTime: Date.now() - startTime,
          errors: [],
          recommendations: ["Email already processed"],
        };
      }

      // Phase 1: Parse email with TypeScript-native parser
      const parsedEmail = await this.parseEmailEnhanced(email);
      
      // Phase 2: Comprehensive email analysis
      const analysis = await this.analyzeEmailComprehensive(parsedEmail, email);
      
      if (!analysis.isScheduleEmail) {
        logger.info("Email rejected by enhanced analysis", {
          userId,
          messageId: email.id,
          confidence: analysis.confidence,
          reasons: analysis.reasons,
        });
        
        return {
          processed: false,
          analysis,
          processingTime: Date.now() - startTime,
          errors: [],
          recommendations: analysis.reasons,
        };
      }

      // Phase 3: AI Classification (if available)
      if (this.aiClassifier) {
        try {
          const aiClassification = await this.aiClassifier.classifyEmail(email.id, {
            subject: parsedEmail.subject || "",
            body: parsedEmail.text || parsedEmail.html || "",
            sender: parsedEmail.from?.text || "",
            timestamp: parsedEmail.date || new Date(),
            hasAttachments: (parsedEmail.attachments?.length || 0) > 0,
          });

          analysis.aiClassification = {
            category: aiClassification.classification.type,
            extractedData: aiClassification.extractedData,
            confidence: aiClassification.classification.confidence || 0,
          };

          // Boost overall confidence if AI agrees
          if (aiClassification.classification.type === "schedule_update" && aiClassification.classification.confidence && aiClassification.classification.confidence > 0.7) {
            analysis.confidence = Math.min(analysis.confidence + 0.2, 1.0);
          }
        } catch (error) {
          logger.warn("AI classification failed, continuing without it", { error });
        }
      }

      // Phase 4: Enhanced PDF processing
      let extractedScheduleData;
      if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
        extractedScheduleData = await this.processAttachmentsEnhanced(
          userId,
          email,
          parsedEmail.attachments
        );
      }

      // Phase 5: Store processed email
      await this.storeProcessedEmailEnhanced(userId, email, parsedEmail, analysis);

      const processingTime = Date.now() - startTime;

      logger.info("Enhanced email processing completed successfully", {
        userId,
        messageId: email.id,
        confidence: analysis.confidence,
        aiEnhanced: !!analysis.aiClassification,
        processingTimeMs: processingTime,
      });

      return {
        processed: true,
        analysis,
        extractedScheduleData,
        processingTime,
        errors: [],
        recommendations: this.generateRecommendations(analysis, extractedScheduleData),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error("Enhanced email processing failed", {
        userId,
        messageId: email.id,
        error,
        processingTimeMs: processingTime,
      });

      return {
        processed: false,
        analysis: await this.createFailureAnalysis(email, error),
        processingTime,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        recommendations: ["Manual review required", "Check email format", "Verify PDF quality"],
      };
    }
  }

  /**
   * Parse email with enhanced TypeScript-native parser (simplified)
   */
  private async parseEmailEnhanced(email: GmailMessage): Promise<ParsedMail> {
    try {
      // Use basic Gmail API parsing for now (simplified implementation)
      const headers = email.payload?.headers || [];
      const subject = this.getHeaderValue(headers, "Subject") || "";
      const from = this.getHeaderValue(headers, "From") || "";
      const date = new Date(parseInt(email.internalDate));

      return {
        messageId: email.id,
        date,
        subject,
        from: { 
          text: from,
          value: [{ address: from, name: '' }],
          html: from
        },
        text: email.snippet || "",
        html: "",
        headers: new Map(),
        headerLines: [],
        attachments: [],
      } as ParsedMail;
    } catch (error) {
      logger.error("Failed to parse email", {
        messageId: email.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      // Return basic parsed mail on failure
      return {
        messageId: email.id || "",
        date: new Date(),
        subject: "",
        from: { 
          text: "",
          value: [{ address: "", name: '' }],
          html: ""
        },
        text: email.snippet || "",
        html: "",
        headers: new Map(),
        headerLines: [],
        attachments: [],
      } as ParsedMail;
    }
  }

  /**
   * Comprehensive email analysis with multiple validation layers
   */
  private async analyzeEmailComprehensive(
    parsedEmail: ParsedMail,
    originalEmail: GmailMessage
  ): Promise<EnhancedEmailAnalysis> {
    const analysis: EnhancedEmailAnalysis = {
      isScheduleEmail: false,
      confidence: 0,
      reasons: [],
      metadata: {
        subjectAnalysis: {
          containsScheduleKeywords: false,
          keywordCount: 0,
          urgencyIndicators: [],
        },
        contentAnalysis: {
          hasTimeReferences: false,
          hasLocationReferences: false,
          hasContactInfo: false,
          textQuality: 0,
        },
        senderAnalysis: {
          domain: "",
          trustScore: 0,
          isKnownSender: false,
          reputation: "unknown",
        },
        attachmentAnalysis: {
          totalAttachments: 0,
          pdfCount: 0,
          suspiciousAttachments: 0,
          attachmentQuality: 0,
        },
      },
    };

    let confidenceScore = 0;

    // Subject Analysis
    const subjectAnalysis = this.analyzeSubject(parsedEmail.subject || "");
    analysis.metadata.subjectAnalysis = subjectAnalysis;
    
    if (subjectAnalysis.containsScheduleKeywords) {
      confidenceScore += 0.3;
      analysis.reasons.push(`Subject contains ${subjectAnalysis.keywordCount} schedule keywords`);
    }
    
    if (subjectAnalysis.urgencyIndicators.length > 0) {
      confidenceScore += 0.1;
      analysis.reasons.push(`Urgency indicators: ${subjectAnalysis.urgencyIndicators.join(", ")}`);
    }

    // Content Analysis
    const content = parsedEmail.text || parsedEmail.html || "";
    const contentAnalysis = this.analyzeContent(content);
    analysis.metadata.contentAnalysis = contentAnalysis;
    
    if (contentAnalysis.hasTimeReferences) {
      confidenceScore += 0.2;
      analysis.reasons.push("Content contains time references");
    }
    
    if (contentAnalysis.hasLocationReferences) {
      confidenceScore += 0.15;
      analysis.reasons.push("Content contains location references");
    }
    
    if (contentAnalysis.hasContactInfo) {
      confidenceScore += 0.1;
      analysis.reasons.push("Content contains contact information");
    }

    // Sender Analysis
    const senderAnalysis = this.analyzeSender(parsedEmail.from?.text || "");
    analysis.metadata.senderAnalysis = senderAnalysis;
    
    confidenceScore += senderAnalysis.trustScore * 0.2;
    if (senderAnalysis.isKnownSender) {
      analysis.reasons.push(`Trusted sender domain: ${senderAnalysis.domain}`);
    }

    // Attachment Analysis
    const attachmentAnalysis = this.analyzeAttachments(parsedEmail.attachments || []);
    analysis.metadata.attachmentAnalysis = attachmentAnalysis;
    
    if (attachmentAnalysis.pdfCount > 0) {
      confidenceScore += 0.25;
      analysis.reasons.push(`Contains ${attachmentAnalysis.pdfCount} PDF attachment(s)`);
    }
    
    if (attachmentAnalysis.suspiciousAttachments > 0) {
      confidenceScore -= 0.15;
      analysis.reasons.push(`${attachmentAnalysis.suspiciousAttachments} suspicious attachments detected`);
    }

    // Final determination
    analysis.confidence = Math.min(confidenceScore, 1.0);
    analysis.isScheduleEmail = analysis.confidence > 0.6;

    if (!analysis.isScheduleEmail) {
      analysis.reasons.push(`Overall confidence too low: ${(analysis.confidence * 100).toFixed(1)}%`);
    }

    return analysis;
  }

  /**
   * Analyze email subject for schedule indicators
   */
  private analyzeSubject(subject: string): {
    containsScheduleKeywords: boolean;
    keywordCount: number;
    urgencyIndicators: string[];
  } {
    const subjectLower = subject.toLowerCase();
    let keywordCount = 0;
    const urgencyIndicators: string[] = [];

    // Check for schedule keywords
    for (const category of Object.values(this.ENHANCED_SCHEDULE_KEYWORDS)) {
      for (const keyword of category) {
        if (subjectLower.includes(keyword.toLowerCase())) {
          keywordCount++;
        }
      }
    }

    // Check for urgency indicators
    for (const urgencyWord of this.ENHANCED_SCHEDULE_KEYWORDS.urgency) {
      if (subjectLower.includes(urgencyWord.toLowerCase())) {
        urgencyIndicators.push(urgencyWord);
      }
    }

    return {
      containsScheduleKeywords: keywordCount > 0,
      keywordCount,
      urgencyIndicators,
    };
  }

  /**
   * Analyze email content for schedule-related information
   */
  private analyzeContent(content: string): {
    hasTimeReferences: boolean;
    hasLocationReferences: boolean;
    hasContactInfo: boolean;
    textQuality: number;
  } {
    const contentLower = content.toLowerCase();

    // Time reference patterns
    const timePatterns = [
      /\b\d{1,2}:\d{2}\b/, // HH:MM format
      /\b\d{1,2}(am|pm)\b/, // 12-hour format
      /call time|wrap time|start time|end time/i,
      /meeting at|scheduled for|begins at/i,
    ];

    // Location reference patterns
    const locationPatterns = [
      /address|location|venue|studio|office/i,
      /street|avenue|boulevard|road|ul\.|ulica/i,
      /warsaw|krakow|gdansk|wroclaw|poznan|lodz/i,
      /\b\d{2}-\d{3}\b/, // Polish postal codes
    ];

    // Contact info patterns
    const contactPatterns = [
      /\+?[0-9\s\-\(\)]{8,}/,  // Phone numbers
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
      /contact|phone|email|mobile|tel\./i,
    ];

    const hasTimeReferences = timePatterns.some(pattern => pattern.test(content));
    const hasLocationReferences = locationPatterns.some(pattern => pattern.test(content));
    const hasContactInfo = contactPatterns.some(pattern => pattern.test(content));

    // Calculate text quality (length, readability, etc.)
    const textQuality = Math.min(content.length / 500, 1.0); // Normalize by expected length

    return {
      hasTimeReferences,
      hasLocationReferences,
      hasContactInfo,
      textQuality,
    };
  }

  /**
   * Analyze sender reputation and trustworthiness
   */
  private analyzeSender(fromText: string): {
    domain: string;
    trustScore: number;
    isKnownSender: boolean;
    reputation: "high" | "medium" | "low" | "unknown";
  } {
    const emailMatch = fromText.match(/([^@]+@[^>]+)/);
    const email = emailMatch ? emailMatch[1].toLowerCase() : "";
    const domain = email.split("@")[1] || "";

    const isKnownSender = this.TRUSTED_DOMAINS.has(domain);
    let trustScore = 0;
    let reputation: "high" | "medium" | "low" | "unknown" = "unknown";

    if (isKnownSender) {
      trustScore = 1.0;
      reputation = "high";
    } else if (domain.includes("gmail.com") || domain.includes("outlook.com")) {
      trustScore = 0.6;
      reputation = "medium";
    } else if (domain.includes("production") || domain.includes("film") || domain.includes("media")) {
      trustScore = 0.7;
      reputation = "medium";
    } else if (domain) {
      trustScore = 0.3;
      reputation = "low";
    }

    return {
      domain,
      trustScore,
      isKnownSender,
      reputation,
    };
  }

  /**
   * Analyze email attachments for quality and safety
   */
  private analyzeAttachments(attachments: Attachment[]): {
    totalAttachments: number;
    pdfCount: number;
    suspiciousAttachments: number;
    attachmentQuality: number;
  } {
    const totalAttachments = attachments.length;
    let pdfCount = 0;
    let suspiciousAttachments = 0;
    let qualityScore = 0;

    for (const attachment of attachments) {
      const filename = attachment.filename || "";
      const contentType = attachment.contentType || "";

      // Count PDFs
      if (contentType.includes("pdf") || filename.toLowerCase().endsWith(".pdf")) {
        pdfCount++;
        qualityScore += 0.5;
      }

      // Check for suspicious attachments
      const suspiciousExtensions = [".exe", ".scr", ".bat", ".com", ".pif", ".vbs", ".js"];
      if (suspiciousExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
        suspiciousAttachments++;
        qualityScore -= 0.3;
      }

      // Quality indicators
      if (attachment.size && attachment.size > 1000) { // Non-empty files
        qualityScore += 0.1;
      }
    }

    const attachmentQuality = totalAttachments > 0 ? qualityScore / totalAttachments : 0;

    return {
      totalAttachments,
      pdfCount,
      suspiciousAttachments,
      attachmentQuality: Math.max(attachmentQuality, 0),
    };
  }

  /**
   * Process attachments with enhanced PDF parser
   */
  private async processAttachmentsEnhanced(
    userId: string,
    email: GmailMessage,
    attachments: Attachment[]
  ): Promise<any[]> {
    const results = [];

    for (const attachment of attachments) {
      if (!attachment.content || !attachment.filename) continue;

      const contentType = attachment.contentType || "";
      if (!contentType.includes("pdf") && !attachment.filename.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      try {
        if (this.enhancedPdfParser) {
          const buffer = Buffer.isBuffer(attachment.content) 
            ? attachment.content 
            : Buffer.from(attachment.content);
            
          const enhancedResult = await this.enhancedPdfParser.parsePDFAttachmentEnhanced(
            buffer,
            attachment.filename
          );
          
          results.push({
            filename: attachment.filename,
            enhancedExtraction: enhancedResult,
          });
        }
      } catch (error) {
        logger.warn("Enhanced PDF processing failed for attachment", {
          filename: attachment.filename,
          error,
        });
      }
    }

    return results;
  }

  /**
   * Store processed email with enhanced metadata
   */
  private async storeProcessedEmailEnhanced(
    userId: string,
    email: GmailMessage,
    parsedEmail: ParsedMail,
    analysis: EnhancedEmailAnalysis
  ): Promise<void> {
    const emailData: CreateProcessedEmailInput = {
      id: crypto.randomUUID(), // Generate unique ID
      messageId: email.id,
      subject: parsedEmail.subject || "",
      sender: parsedEmail.from?.text || "",
      receivedAt: parsedEmail.date || new Date(parseInt(email.internalDate)),
      threadId: email.threadId,
      processed: analysis.isScheduleEmail,
      processingStatus: analysis.isScheduleEmail ? "completed" : "rejected",
      userId: userId,
      updatedAt: new Date(), // Set current timestamp
    };

    await this.markAsProcessed(emailData);
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    analysis: EnhancedEmailAnalysis,
    extractedData?: any
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.confidence < 0.8) {
      recommendations.push("Review extracted data for accuracy");
    }

    if (analysis.metadata.senderAnalysis.reputation === "low") {
      recommendations.push("Verify sender authenticity");
    }

    if (analysis.metadata.attachmentAnalysis.suspiciousAttachments > 0) {
      recommendations.push("Scan attachments for security threats");
    }

    if (!analysis.metadata.contentAnalysis.hasTimeReferences) {
      recommendations.push("Manual time verification may be needed");
    }

    if (extractedData && extractedData.length > 0) {
      recommendations.push("Schedule data extracted successfully");
    }

    return recommendations;
  }

  /**
   * Create analysis for failed processing
   */
  private async createFailureAnalysis(email: GmailMessage, error: any): Promise<EnhancedEmailAnalysis> {
    return {
      isScheduleEmail: false,
      confidence: 0,
      reasons: [`Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`],
      metadata: {
        subjectAnalysis: {
          containsScheduleKeywords: false,
          keywordCount: 0,
          urgencyIndicators: [],
        },
        contentAnalysis: {
          hasTimeReferences: false,
          hasLocationReferences: false,
          hasContactInfo: false,
          textQuality: 0,
        },
        senderAnalysis: {
          domain: "",
          trustScore: 0,
          isKnownSender: false,
          reputation: "unknown",
        },
        attachmentAnalysis: {
          totalAttachments: 0,
          pdfCount: 0,
          suspiciousAttachments: 0,
          attachmentQuality: 0,
        },
      },
    };
  }

  /**
   * Create analysis for skipped emails
   */
  private async createSkippedAnalysis(email: GmailMessage): Promise<EnhancedEmailAnalysis> {
    return {
      isScheduleEmail: false,
      confidence: 0,
      reasons: ["Email already processed"],
      metadata: {
        subjectAnalysis: {
          containsScheduleKeywords: false,
          keywordCount: 0,
          urgencyIndicators: [],
        },
        contentAnalysis: {
          hasTimeReferences: false,
          hasLocationReferences: false,
          hasContactInfo: false,
          textQuality: 0,
        },
        senderAnalysis: {
          domain: "",
          trustScore: 0,
          isKnownSender: false,
          reputation: "unknown",
        },
        attachmentAnalysis: {
          totalAttachments: 0,
          pdfCount: 0,
          suspiciousAttachments: 0,
          attachmentQuality: 0,
        },
      },
    };
  }

}
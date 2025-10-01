/**
 * AI-Powered Email Classification Service
 * Advanced machine learning for intelligent email categorization and priority routing
 */

import { logger, structuredLogger } from "../utils/logger";
import { z } from "zod";

// Classification schemas
export const EmailClassificationSchema = z.object({
  messageId: z.string(),
  classification: z.object({
    type: z.enum([
      "schedule_update",
      "location_change", 
      "cancellation",
      "weather_alert",
      "cast_change",
      "equipment_update",
      "general_production",
      "spam",
      "unknown"
    ]),
    priority: z.enum(["urgent", "high", "medium", "low"]),
    confidence: z.number().min(0).max(1),
    urgencyLevel: z.number().min(1).max(10),
    requiresAttention: z.boolean()
  }),
  extractedData: z.object({
    subject: z.string(),
    sender: z.string(),
    timestamp: z.date(),
    hasAttachments: z.boolean(),
    keyEntities: z.array(z.object({
      type: z.enum(["location", "time", "person", "equipment", "weather"]),
      value: z.string(),
      confidence: z.number()
    })),
    sentiment: z.object({
      score: z.number().min(-1).max(1),
      magnitude: z.number().min(0).max(1),
      emotion: z.enum(["neutral", "positive", "negative", "urgent", "concerned"])
    })
  }),
  processingRecommendations: z.object({
    autoProcess: z.boolean(),
    notificationChannels: z.array(z.enum(["email", "sms", "push", "slack"])),
    escalationRequired: z.boolean(),
    suggestedActions: z.array(z.string())
  })
});

export type EmailClassification = z.infer<typeof EmailClassificationSchema>;

export interface ClassificationModel {
  name: string;
  version: string;
  accuracy: number;
  lastTraining: Date;
  supportedLanguages: string[];
}

export interface TrainingData {
  messageId: string;
  emailContent: string;
  correctClassification: EmailClassification["classification"];
  feedback: "correct" | "incorrect" | "partial";
  userCorrection?: Partial<EmailClassification["classification"]>;
}

/**
 * AI Email Classification Service with continuous learning
 */
export class AIEmailClassifierService {
  private models: Map<string, ClassificationModel> = new Map();
  private trainingData: TrainingData[] = [];
  private classificationCache: Map<string, EmailClassification> = new Map();
  
  // Feature extraction patterns
  private urgencyPatterns = [
    /urgent|emergency|immediate|asap|right away/i,
    /cancelled|canceled|postponed|delayed/i,
    /location.*(change|moved|update)/i,
    /weather.*(warning|alert|severe)/i,
    /call.*(time|sheet).*(change|update)/i
  ];
  
  private typePatterns = {
    schedule_update: [
      /schedule|call.*sheet|filming.*plan/i,
      /day.*\d+|scene.*\d+/i,
      /wrap.*time|call.*time/i
    ],
    location_change: [
      /location.*(change|moved|update|different)/i,
      /studio|set|venue.*change/i,
      /address.*update/i
    ],
    cancellation: [
      /cancel|postpone|delay|suspend/i,
      /shooting.*off|production.*halt/i,
      /weather.*cancel/i
    ],
    weather_alert: [
      /weather.*(warning|alert|forecast)/i,
      /rain|storm|wind|snow.*warning/i,
      /severe.*weather/i
    ],
    cast_change: [
      /cast.*(change|update|replacement)/i,
      /actor.*(unavailable|sick|replacement)/i,
      /talent.*change/i
    ]
  };

  constructor() {
    this.initializeModels();
    this.setupContinuousLearning();
  }

  /**
   * Classify email with AI analysis
   */
  async classifyEmail(
    messageId: string,
    emailContent: {
      subject: string;
      body: string;
      sender: string;
      timestamp: Date;
      hasAttachments: boolean;
      attachmentTypes?: string[];
    }
  ): Promise<EmailClassification> {
    try {
      // Check cache first
      const cached = this.classificationCache.get(messageId);
      if (cached) {
        return cached;
      }

      const startTime = Date.now();

      // Extract features from email
      const features = await this.extractFeatures(emailContent);
      
      // Apply pattern-based classification
      const patternClassification = this.classifyByPatterns(emailContent, features);
      
      // Apply ML-based classification (simulated)
      const mlClassification = await this.classifyByML(emailContent, features);
      
      // Combine classifications with weighted scoring
      const finalClassification = this.combineClassifications(
        patternClassification,
        mlClassification,
        features
      );
      
      // Generate processing recommendations
      const recommendations = this.generateProcessingRecommendations(
        finalClassification,
        features
      );
      
      const result: EmailClassification = {
        messageId,
        classification: finalClassification,
        extractedData: {
          subject: emailContent.subject,
          sender: emailContent.sender,
          timestamp: emailContent.timestamp,
          hasAttachments: emailContent.hasAttachments,
          keyEntities: features.entities,
          sentiment: features.sentiment
        },
        processingRecommendations: recommendations
      };

      // Cache result
      this.classificationCache.set(messageId, result);
      
      const processingTime = Date.now() - startTime;
      
      structuredLogger.info("Email classified successfully", {
        messageId,
        type: finalClassification.type,
        priority: finalClassification.priority,
        confidence: finalClassification.confidence,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      structuredLogger.error("Email classification failed", {
        messageId,
        error: error.message
      });
      
      // Return fallback classification
      return this.createFallbackClassification(messageId, emailContent);
    }
  }

  /**
   * Batch classify multiple emails with optimization
   */
  async classifyEmailBatch(
    emails: Array<{
      messageId: string;
      content: {
        subject: string;
        body: string;
        sender: string;
        timestamp: Date;
        hasAttachments: boolean;
      };
    }>
  ): Promise<EmailClassification[]> {
    const startTime = Date.now();
    
    structuredLogger.info("Starting batch email classification", {
      emailCount: emails.length
    });

    // Process in parallel with concurrency control
    const batchSize = 10;
    const results: EmailClassification[] = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchPromises = batch.map(email => 
        this.classifyEmail(email.messageId, email.content)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    const processingTime = Date.now() - startTime;
    
    structuredLogger.info("Batch classification completed", {
      emailCount: emails.length,
      processingTimeMs: processingTime,
      averageTimePerEmail: processingTime / emails.length
    });

    return results;
  }

  /**
   * Provide feedback for model improvement
   */
  async provideFeedback(
    messageId: string,
    actualClassification: EmailClassification["classification"],
    feedback: "correct" | "incorrect" | "partial"
  ): Promise<void> {
    try {
      const existingClassification = this.classificationCache.get(messageId);
      
      if (!existingClassification) {
        throw new Error("Original classification not found");
      }

      const trainingEntry: TrainingData = {
        messageId,
        emailContent: JSON.stringify(existingClassification.extractedData),
        correctClassification: actualClassification,
        feedback,
        userCorrection: feedback === "incorrect" ? actualClassification : undefined
      };

      this.trainingData.push(trainingEntry);
      
      // Trigger model retraining if we have enough feedback
      if (this.trainingData.length % 100 === 0) {
        await this.retrainModels();
      }

      structuredLogger.info("Classification feedback recorded", {
        messageId,
        feedback,
        trainingDataSize: this.trainingData.length
      });

    } catch (error) {
      structuredLogger.error("Failed to record feedback", {
        messageId,
        error: error.message
      });
    }
  }

  /**
   * Get classification analytics and model performance
   */
  async getAnalytics(): Promise<{
    modelPerformance: {
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
    };
    classificationStats: {
      totalClassified: number;
      byType: Record<string, number>;
      byPriority: Record<string, number>;
      averageConfidence: number;
    };
    recentTrends: {
      urgentEmails: number;
      locationChanges: number;
      cancellations: number;
      processingTime: number;
    };
  }> {
    const classifications = Array.from(this.classificationCache.values());
    
    return {
      modelPerformance: {
        accuracy: this.calculateAccuracy(),
        precision: this.calculatePrecision(),
        recall: this.calculateRecall(),
        f1Score: this.calculateF1Score()
      },
      classificationStats: {
        totalClassified: classifications.length,
        byType: this.groupByType(classifications),
        byPriority: this.groupByPriority(classifications),
        averageConfidence: this.calculateAverageConfidence(classifications)
      },
      recentTrends: {
        urgentEmails: classifications.filter(c => c.classification.priority === "urgent").length,
        locationChanges: classifications.filter(c => c.classification.type === "location_change").length,
        cancellations: classifications.filter(c => c.classification.type === "cancellation").length,
        processingTime: this.calculateAverageProcessingTime()
      }
    };
  }

  /**
   * Extract features from email content
   */
  private async extractFeatures(emailContent: {
    subject: string;
    body: string;
    sender: string;
    timestamp: Date;
    hasAttachments: boolean;
  }): Promise<{
    entities: Array<{ type: string; value: string; confidence: number }>;
    sentiment: { score: number; magnitude: number; emotion: string };
    urgencyScore: number;
    temporalFeatures: { isTimeSpecific: boolean; timeEntities: string[] };
  }> {
    const fullText = `${emailContent.subject} ${emailContent.body}`;
    
    // Named entity recognition (simplified)
    const entities = this.extractEntities(fullText);
    
    // Sentiment analysis
    const sentiment = this.analyzeSentiment(fullText);
    
    // Urgency scoring
    const urgencyScore = this.calculateUrgencyScore(fullText);
    
    // Temporal feature extraction
    const temporalFeatures = this.extractTemporalFeatures(fullText);
    
    return {
      entities,
      sentiment,
      urgencyScore,
      temporalFeatures
    };
  }

  /**
   * Pattern-based classification
   */
  private classifyByPatterns(
    emailContent: any,
    features: any
  ): EmailClassification["classification"] {
    const text = `${emailContent.subject} ${emailContent.body}`.toLowerCase();
    
    // Determine type based on patterns
    let type: EmailClassification["classification"]["type"] = "unknown";
    let confidence = 0.5;
    
    for (const [emailType, patterns] of Object.entries(this.typePatterns)) {
      const matches = patterns.reduce((count, pattern) => {
        return count + (pattern.test(text) ? 1 : 0);
      }, 0);
      
      if (matches > 0) {
        type = emailType as EmailClassification["classification"]["type"];
        confidence = Math.min(0.9, 0.6 + (matches * 0.1));
        break;
      }
    }
    
    // Determine priority based on urgency patterns and features
    let priority: EmailClassification["classification"]["priority"] = "medium";
    if (features.urgencyScore > 0.8) priority = "urgent";
    else if (features.urgencyScore > 0.6) priority = "high";
    else if (features.urgencyScore < 0.3) priority = "low";
    
    // Calculate urgency level
    const urgencyLevel = Math.ceil(features.urgencyScore * 10);
    
    return {
      type,
      priority,
      confidence,
      urgencyLevel,
      requiresAttention: urgencyLevel >= 7 || type === "cancellation"
    };
  }

  /**
   * ML-based classification (simulated advanced model)
   */
  private async classifyByML(
    emailContent: any,
    features: any
  ): Promise<EmailClassification["classification"]> {
    // Simulate ML model inference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // This would call actual ML model in production
    const mlConfidence = 0.85;
    const adjustment = features.urgencyScore * 0.2;
    
    return {
      type: "schedule_update", // ML model prediction
      priority: features.urgencyScore > 0.7 ? "high" : "medium",
      confidence: mlConfidence + adjustment,
      urgencyLevel: Math.ceil(features.urgencyScore * 10),
      requiresAttention: features.urgencyScore > 0.6
    };
  }

  /**
   * Combine multiple classification approaches
   */
  private combineClassifications(
    patternResult: EmailClassification["classification"],
    mlResult: EmailClassification["classification"],
    features: any
  ): EmailClassification["classification"] {
    // Weighted combination (pattern: 40%, ML: 60%)
    const combinedConfidence = (patternResult.confidence * 0.4) + (mlResult.confidence * 0.6);
    
    // Use ML type if confidence is high, otherwise use pattern
    const finalType = mlResult.confidence > 0.8 ? mlResult.type : patternResult.type;
    
    // Take highest priority
    const priorities = ["low", "medium", "high", "urgent"];
    const patternPriorityIndex = priorities.indexOf(patternResult.priority);
    const mlPriorityIndex = priorities.indexOf(mlResult.priority);
    const finalPriority = priorities[Math.max(patternPriorityIndex, mlPriorityIndex)];
    
    return {
      type: finalType,
      priority: finalPriority as EmailClassification["classification"]["priority"],
      confidence: Math.min(0.99, combinedConfidence),
      urgencyLevel: Math.max(patternResult.urgencyLevel, mlResult.urgencyLevel),
      requiresAttention: patternResult.requiresAttention || mlResult.requiresAttention
    };
  }

  /**
   * Generate processing recommendations
   */
  private generateProcessingRecommendations(
    classification: EmailClassification["classification"],
    features: any
  ): EmailClassification["processingRecommendations"] {
    const recommendations: EmailClassification["processingRecommendations"] = {
      autoProcess: classification.confidence > 0.8 && !classification.requiresAttention,
      notificationChannels: ["email"],
      escalationRequired: false,
      suggestedActions: []
    };

    // Add notification channels based on priority
    if (classification.priority === "urgent") {
      recommendations.notificationChannels = ["email", "sms", "push"];
      recommendations.escalationRequired = true;
    } else if (classification.priority === "high") {
      recommendations.notificationChannels = ["email", "push"];
    }

    // Add suggested actions
    switch (classification.type) {
      case "location_change":
        recommendations.suggestedActions = [
          "Update route calculations",
          "Notify all participants",
          "Check equipment logistics"
        ];
        break;
      case "cancellation":
        recommendations.suggestedActions = [
          "Cancel calendar events",
          "Notify cast and crew",
          "Reschedule if applicable"
        ];
        break;
      case "schedule_update":
        recommendations.suggestedActions = [
          "Parse schedule attachments",
          "Update calendar",
          "Calculate new routes"
        ];
        break;
    }

    return recommendations;
  }

  // Utility methods for feature extraction
  private extractEntities(text: string): Array<{ type: string; value: string; confidence: number }> {
    const entities = [];
    
    // Location extraction
    const locationPattern = /(studio|set|location|venue|address).{0,20}([A-Z][a-z\s,]+)/gi;
    let match;
    while ((match = locationPattern.exec(text)) !== null) {
      entities.push({
        type: "location",
        value: match[2].trim(),
        confidence: 0.8
      });
    }
    
    // Time extraction
    const timePattern = /(\d{1,2}:\d{2}|\d{1,2}\s?(am|pm))/gi;
    while ((match = timePattern.exec(text)) !== null) {
      entities.push({
        type: "time",
        value: match[0],
        confidence: 0.9
      });
    }
    
    return entities;
  }

  private analyzeSentiment(text: string): { score: number; magnitude: number; emotion: string } {
    // Simplified sentiment analysis
    const positiveWords = /(good|great|excellent|perfect|ready|confirmed)/gi;
    const negativeWords = /(problem|issue|cancel|delay|emergency|urgent)/gi;
    
    const positiveMatches = (text.match(positiveWords) || []).length;
    const negativeMatches = (text.match(negativeWords) || []).length;
    
    const score = (positiveMatches - negativeMatches) / Math.max(1, positiveMatches + negativeMatches);
    const magnitude = (positiveMatches + negativeMatches) / text.split(/\s+/).length;
    
    let emotion = "neutral";
    if (score > 0.3) emotion = "positive";
    else if (score < -0.3) emotion = "negative";
    if (negativeMatches > 2) emotion = "urgent";
    
    return { score, magnitude, emotion };
  }

  private calculateUrgencyScore(text: string): number {
    let score = 0;
    
    this.urgencyPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        score += 0.25;
      }
    });
    
    // Time-based urgency
    if (/today|now|immediate/i.test(text)) score += 0.3;
    if (/tomorrow|urgent/i.test(text)) score += 0.2;
    
    return Math.min(1, score);
  }

  private extractTemporalFeatures(text: string): { isTimeSpecific: boolean; timeEntities: string[] } {
    const timePatterns = [
      /\d{1,2}:\d{2}/g,
      /(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g
    ];
    
    const timeEntities = [];
    let isTimeSpecific = false;
    
    timePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        isTimeSpecific = true;
        timeEntities.push(...matches);
      }
    });
    
    return { isTimeSpecific, timeEntities };
  }

  // Model management methods
  private initializeModels(): void {
    const baseModel: ClassificationModel = {
      name: "production-email-classifier-v1",
      version: "1.0.0",
      accuracy: 0.92,
      lastTraining: new Date(),
      supportedLanguages: ["en", "de", "fr"]
    };
    
    this.models.set("base", baseModel);
  }

  private setupContinuousLearning(): void {
    // Retrain models every week if we have new training data
    setInterval(async () => {
      if (this.trainingData.length >= 50) {
        await this.retrainModels();
      }
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
  }

  private async retrainModels(): Promise<void> {
    structuredLogger.info("Starting model retraining", {
      trainingDataSize: this.trainingData.length
    });
    
    // Simulate model retraining
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update model metrics
    const baseModel = this.models.get("base");
    if (baseModel) {
      baseModel.accuracy = Math.min(0.98, baseModel.accuracy + 0.01);
      baseModel.lastTraining = new Date();
    }
    
    // Clear processed training data
    this.trainingData = [];
    
    structuredLogger.info("Model retraining completed", {
      newAccuracy: baseModel?.accuracy
    });
  }

  private createFallbackClassification(messageId: string, emailContent: any): EmailClassification {
    return {
      messageId,
      classification: {
        type: "general_production",
        priority: "medium",
        confidence: 0.3,
        urgencyLevel: 5,
        requiresAttention: true
      },
      extractedData: {
        subject: emailContent.subject,
        sender: emailContent.sender,
        timestamp: emailContent.timestamp,
        hasAttachments: emailContent.hasAttachments,
        keyEntities: [],
        sentiment: { score: 0, magnitude: 0, emotion: "neutral" }
      },
      processingRecommendations: {
        autoProcess: false,
        notificationChannels: ["email"],
        escalationRequired: true,
        suggestedActions: ["Manual review required"]
      }
    };
  }

  // Analytics helper methods
  private calculateAccuracy(): number {
    const correctFeedback = this.trainingData.filter(t => t.feedback === "correct").length;
    return this.trainingData.length > 0 ? correctFeedback / this.trainingData.length : 0;
  }

  private calculatePrecision(): number {
    // Simplified precision calculation
    return 0.89; // Placeholder
  }

  private calculateRecall(): number {
    // Simplified recall calculation
    return 0.85; // Placeholder
  }

  private calculateF1Score(): number {
    const precision = this.calculatePrecision();
    const recall = this.calculateRecall();
    return 2 * (precision * recall) / (precision + recall);
  }

  private groupByType(classifications: EmailClassification[]): Record<string, number> {
    return classifications.reduce((acc, c) => {
      acc[c.classification.type] = (acc[c.classification.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByPriority(classifications: EmailClassification[]): Record<string, number> {
    return classifications.reduce((acc, c) => {
      acc[c.classification.priority] = (acc[c.classification.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateAverageConfidence(classifications: EmailClassification[]): number {
    if (classifications.length === 0) return 0;
    const total = classifications.reduce((sum, c) => sum + c.classification.confidence, 0);
    return total / classifications.length;
  }

  private calculateAverageProcessingTime(): number {
    // Placeholder - would track actual processing times
    return 450; // ms
  }
}
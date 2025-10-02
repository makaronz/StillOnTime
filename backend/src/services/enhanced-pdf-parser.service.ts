import pdf from "pdf-parse";
import Tesseract from "tesseract.js";
import pdf2pic from "pdf2pic";
import { logger } from "@/utils/logger";
import { PDFParserService, ParsedScheduleData, OCRResult } from "./pdf-parser.service";
import { ScheduleData, ValidationResult, ContactInfo } from "@/types";
import { AIEmailClassifierService } from "./ai-email-classifier.service";
import fs from "fs/promises";
import path from "path";
import os from "os";

export interface EnhancedPDFMetadata {
  pages: number;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  title?: string;
  subject?: string;
  keywords?: string[];
  textLength: number;
  extractionMethod: "text" | "ocr" | "hybrid";
  processingTimeMs: number;
}

export interface EnhancedExtractionResult {
  scheduleData: ParsedScheduleData;
  metadata: EnhancedPDFMetadata;
  aiEnhanced: boolean;
  qualityScore: number;
  extractionDetails: {
    textExtracted: boolean;
    ocrUsed: boolean;
    aiPostProcessed: boolean;
    confidenceBoost: number;
  };
}

/**
 * Enhanced PDF Parser Service with modern 2024 packages
 * Combines pdf-parse, tesseract.js OCR, and AI enhancement
 */
export class EnhancedPDFParserService extends PDFParserService {
  private aiClassifier?: AIEmailClassifierService;
  private tempDir: string;

  constructor(aiClassifier?: AIEmailClassifierService) {
    super();
    this.aiClassifier = aiClassifier;
    this.tempDir = path.join(os.tmpdir(), "stillontime-pdf");
  }

  /**
   * Enhanced PDF parsing with multiple extraction methods
   */
  async parsePDFAttachmentEnhanced(
    pdfBuffer: Buffer,
    filename?: string
  ): Promise<EnhancedExtractionResult> {
    const startTime = Date.now();
    
    try {
      logger.info("Starting enhanced PDF parsing", {
        filename,
        size: pdfBuffer.length,
      });

      // Initialize temp directory
      await this.ensureTempDirectory();

      // Phase 1: Try direct text extraction
      const textExtractionResult = await this.extractTextWithMetadata(pdfBuffer);
      
      let extractedText = textExtractionResult.text;
      let extractionMethod: "text" | "ocr" | "hybrid" = "text";
      let ocrUsed = false;

      // Phase 2: Fallback to OCR if text extraction insufficient
      if (!extractedText || extractedText.trim().length < 100) {
        logger.info("Text extraction insufficient, attempting OCR", {
          textLength: extractedText?.length || 0,
          filename
        });

        const ocrResult = await this.performEnhancedOCR(pdfBuffer, filename);
        
        if (ocrResult.text && ocrResult.confidence > 0.5) {
          extractedText = ocrResult.text;
          extractionMethod = textExtractionResult.text ? "hybrid" : "ocr";
          ocrUsed = true;
          
          logger.info("OCR extraction successful", {
            ocrConfidence: ocrResult.confidence,
            ocrTextLength: ocrResult.text.length,
            filename
          });
        }
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("No text could be extracted from PDF using any method");
      }

      // Phase 3: Parse schedule data
      let scheduleData = this.parseScheduleData(extractedText);
      let aiEnhanced = false;
      let confidenceBoost = 0;

      // Phase 4: AI enhancement if confidence is low
      if (scheduleData.confidence < 0.7 && this.aiClassifier) {
        logger.info("Applying AI enhancement to improve extraction", {
          originalConfidence: scheduleData.confidence,
          filename
        });

        const aiEnhancedData = await this.enhanceWithAI(extractedText, scheduleData);
        if (aiEnhancedData.confidence > scheduleData.confidence) {
          confidenceBoost = aiEnhancedData.confidence - scheduleData.confidence;
          scheduleData = aiEnhancedData;
          aiEnhanced = true;
        }
      }

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(
        scheduleData,
        textExtractionResult.metadata,
        ocrUsed,
        aiEnhanced
      );

      const processingTime = Date.now() - startTime;

      const result: EnhancedExtractionResult = {
        scheduleData,
        metadata: {
          ...textExtractionResult.metadata,
          extractionMethod,
          processingTimeMs: processingTime,
        },
        aiEnhanced,
        qualityScore,
        extractionDetails: {
          textExtracted: !!textExtractionResult.text,
          ocrUsed,
          aiPostProcessed: aiEnhanced,
          confidenceBoost,
        },
      };

      logger.info("Enhanced PDF parsing completed successfully", {
        filename,
        extractionMethod,
        finalConfidence: scheduleData.confidence,
        qualityScore,
        processingTimeMs: processingTime,
        aiEnhanced,
      });

      // Cleanup temp files
      await this.cleanupTempFiles();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Enhanced PDF parsing failed", {
        filename,
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      });
      
      // Cleanup on error
      await this.cleanupTempFiles();
      
      throw new Error(`Enhanced PDF parsing failed: ${errorMessage}`);
    }
  }

  /**
   * Extract text with comprehensive metadata using pdf-parse
   */
  private async extractTextWithMetadata(pdfBuffer: Buffer): Promise<{
    text: string;
    metadata: Omit<EnhancedPDFMetadata, "extractionMethod" | "processingTimeMs">;
  }> {
    try {
      const data = await pdf(pdfBuffer, {
        // PDF parsing options
        max: 0, // Parse all pages
        version: "v1.10.100",
      });

      // Extract and clean metadata
      const metadata = data.metadata || {};
      
      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          creator: metadata.Creator,
          producer: metadata.Producer,
          creationDate: metadata.CreationDate ? new Date(metadata.CreationDate) : undefined,
          title: metadata.Title,
          subject: metadata.Subject,
          keywords: metadata.Keywords ? metadata.Keywords.split(/[,;]/).map((k: string) => k.trim()) : undefined,
          textLength: data.text.length,
        },
      };
    } catch (error) {
      logger.error("PDF text extraction failed", { error });
      return {
        text: "",
        metadata: {
          pages: 0,
          textLength: 0,
        },
      };
    }
  }

  /**
   * Enhanced OCR with tesseract.js and pdf2pic
   */
  private async performEnhancedOCR(pdfBuffer: Buffer, filename?: string): Promise<OCRResult> {
    try {
      logger.info("Starting enhanced OCR processing", { filename });

      // Convert PDF to high-quality images
      const pdfPath = path.join(this.tempDir, `${Date.now()}-${filename || 'document'}.pdf`);
      await fs.writeFile(pdfPath, pdfBuffer);

      const convert = pdf2pic.fromPath(pdfPath, {
        density: 300, // High DPI for better OCR
        saveFilename: "page",
        savePath: this.tempDir,
        format: "png",
        width: 2000,
        height: 2000,
      });

      // Convert all pages to images
      const pageImages = await convert.bulk(-1, { responseType: "image" });
      
      if (pageImages.length === 0) {
        throw new Error("No pages could be converted to images");
      }

      let fullText = "";
      let totalConfidence = 0;
      let processedPages = 0;

      // OCR each page with parallel processing (max 3 concurrent)
      const ocrPromises = pageImages.slice(0, 10).map(async (page, index) => { // Limit to first 10 pages
        try {
          logger.debug("Processing OCR for page", { page: index + 1, filename });

          const { data } = await Tesseract.recognize(page.path, 'pol+eng', {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                logger.debug(`OCR progress page ${index + 1}`, { 
                  progress: Math.round(m.progress * 100),
                  filename 
                });
              }
            },
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          });

          return {
            text: data.text,
            confidence: data.confidence,
            pageNumber: index + 1,
          };
        } catch (error) {
          logger.warn(`OCR failed for page ${index + 1}`, { error, filename });
          return {
            text: "",
            confidence: 0,
            pageNumber: index + 1,
          };
        }
      });

      // Process OCR results
      const ocrResults = await Promise.all(ocrPromises);
      
      for (const result of ocrResults) {
        if (result.text.trim()) {
          fullText += `\n--- Page ${result.pageNumber} ---\n${result.text}\n`;
          totalConfidence += result.confidence;
          processedPages++;
        }
      }

      const averageConfidence = processedPages > 0 ? totalConfidence / processedPages / 100 : 0;

      logger.info("Enhanced OCR completed", {
        filename,
        pagesProcessed: processedPages,
        totalPages: pageImages.length,
        textLength: fullText.length,
        averageConfidence: averageConfidence.toFixed(3),
      });

      return {
        text: fullText,
        confidence: averageConfidence,
      };
    } catch (error) {
      logger.error("Enhanced OCR failed", { error, filename });
      return {
        text: "",
        confidence: 0.0,
      };
    }
  }

  /**
   * AI-enhanced data extraction and correction
   */
  private async enhanceWithAI(
    extractedText: string,
    originalData: ParsedScheduleData
  ): Promise<ParsedScheduleData> {
    if (!this.aiClassifier) {
      return originalData;
    }

    try {
      logger.info("Applying AI enhancement to schedule data");

      // Use AI classifier to extract structured data
      const aiClassification = await this.aiClassifier.classifyEmail("", {
        subject: "Enhanced PDF Extraction",
        body: extractedText,
        sender: "pdf-parser",
        timestamp: new Date(),
        hasAttachments: true,
      });

      // Merge AI results with original extraction
      const enhancedData: ParsedScheduleData = {
        ...originalData,
        confidence: Math.max(originalData.confidence, aiClassification.confidence || 0),
      };

      // Apply AI corrections for specific fields
      if (aiClassification.extractedData) {
        const aiData = aiClassification.extractedData as any;
        
        if (aiData.shootingDate && !originalData.shootingDate) {
          enhancedData.shootingDate = new Date(aiData.shootingDate);
        }
        
        if (aiData.callTime && !originalData.callTime) {
          enhancedData.callTime = aiData.callTime;
        }
        
        if (aiData.location && !originalData.location) {
          enhancedData.location = aiData.location;
        }
      }

      logger.info("AI enhancement completed", {
        originalConfidence: originalData.confidence,
        enhancedConfidence: enhancedData.confidence,
        improvementPercent: ((enhancedData.confidence - originalData.confidence) * 100).toFixed(1),
      });

      return enhancedData;
    } catch (error) {
      logger.warn("AI enhancement failed, using original data", { error });
      return originalData;
    }
  }

  /**
   * Calculate overall quality score for extraction
   */
  private calculateQualityScore(
    scheduleData: ParsedScheduleData,
    metadata: Partial<EnhancedPDFMetadata>,
    ocrUsed: boolean,
    aiEnhanced: boolean
  ): number {
    let score = scheduleData.confidence * 0.6; // Base confidence (60% weight)

    // Metadata quality bonus
    if (metadata.textLength && metadata.textLength > 500) score += 0.1;
    if (metadata.pages && metadata.pages <= 5) score += 0.05; // Shorter docs are typically cleaner
    if (metadata.creator || metadata.producer) score += 0.05;

    // Extraction method penalties/bonuses
    if (!ocrUsed) score += 0.1; // Text extraction is more reliable
    if (ocrUsed) score -= 0.05; // OCR introduces uncertainty
    if (aiEnhanced) score += 0.1; // AI enhancement improves quality

    // Data completeness bonus
    const hasRequiredFields = !!(scheduleData.shootingDate && scheduleData.callTime && scheduleData.location);
    if (hasRequiredFields) score += 0.1;

    return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.warn("Failed to create temp directory", { error, tempDir: this.tempDir });
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => 
          fs.unlink(path.join(this.tempDir, file)).catch(err => 
            logger.debug("Failed to delete temp file", { file, error: err })
          )
        )
      );
    } catch (error) {
      logger.debug("Temp directory cleanup failed", { error, tempDir: this.tempDir });
    }
  }

  /**
   * Validate extracted data with enhanced checks
   */
  validateExtractedData(data: ParsedScheduleData): ValidationResult & {
    enhancedMetrics: {
      dataCompleteness: number;
      confidenceLevel: "low" | "medium" | "high";
      recommendedAction: string;
    };
  } {
    const baseValidation = super.validateExtractedData(data);
    
    // Calculate data completeness
    const fields = [
      data.shootingDate,
      data.callTime,
      data.location,
      data.scenes?.length,
      data.contacts?.length,
    ];
    const completeness = fields.filter(Boolean).length / fields.length;
    
    // Determine confidence level
    let confidenceLevel: "low" | "medium" | "high";
    if (data.confidence < 0.5) confidenceLevel = "low";
    else if (data.confidence < 0.8) confidenceLevel = "medium";
    else confidenceLevel = "high";
    
    // Recommend action
    let recommendedAction: string;
    if (confidenceLevel === "low") {
      recommendedAction = "Manual review required - consider re-uploading a higher quality PDF";
    } else if (confidenceLevel === "medium") {
      recommendedAction = "Review and verify extracted data before processing";
    } else {
      recommendedAction = "Data quality is good - safe to proceed with automatic processing";
    }

    return {
      ...baseValidation,
      enhancedMetrics: {
        dataCompleteness: completeness,
        confidenceLevel,
        recommendedAction,
      },
    };
  }
}
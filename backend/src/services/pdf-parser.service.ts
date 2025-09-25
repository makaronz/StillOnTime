import { PDFDocument } from "pdf-lib";
import { logger } from "@/utils/logger";
import { ScheduleData, ValidationResult, ContactInfo } from "@/types";

export interface ParsedScheduleData {
  shootingDate?: Date;
  callTime?: string;
  location?: string;
  baseLocation?: string;
  sceneType?: "INT" | "EXT";
  scenes?: string[];
  safetyNotes?: string;
  equipment?: string[];
  contacts?: ContactInfo[];
  notes?: string;
  confidence: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
}

/**
 * PDF Parser Service
 * Extracts schedule data from PDF shooting schedules using text extraction and regex patterns
 */
export class PDFParserService {
  // Regex patterns for extracting schedule data
  private readonly DATE_PATTERNS = [
    /(?:data|date|dzień|shooting date)[\s:]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/gi,
    /(?:data|date|dzień|shooting date)[\s:]*(\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2})/gi,
    /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/g,
    /(\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2})/g,
  ];

  private readonly TIME_PATTERNS = [
    /(?:call time|czas zbiórki|zbiórka)[\s:]*(\d{1,2}:\d{2})/gi,
    /(?:start|początek)[\s:]*(\d{1,2}:\d{2})/gi,
    /(\d{1,2}:\d{2})/g,
  ];

  private readonly LOCATION_PATTERNS = [
    /(?:lokacja|location|miejsce|adres)[\s:]*([^\n\r]+)/gi,
    /(?:ul\.|ulica|street|st\.)[\s]*([^\n\r]+)/gi,
    /(?:warszawa|kraków|gdańsk|wrocław|poznań|łódź)[\s]*[,]?[\s]*([^\n\r]+)/gi,
  ];

  private readonly SCENE_PATTERNS = [
    /(?:scena|scene|sc\.)[\s]*(\d+[a-z]?)/gi,
    /(?:int\.|ext\.)[\s]*([^\n\r]+)/gi,
    /(int|ext)[\s]*[-.][\s]*([^\n\r]+)/gi,
  ];

  private readonly CONTACT_PATTERNS = [
    /(?:reżyser|director)[\s:]*([^\n\r]+?)(?:\s+)(\+?\d{2,3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3})/gi,
    /(?:producent|producer)[\s:]*([^\n\r]+?)(?:\s+)(\+?\d{2,3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3})/gi,
    /(?:operator|dop)[\s:]*([^\n\r]+?)(?:\s+)(\+?\d{2,3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3})/gi,
    /([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)[\s]*[-:]?[\s]*(\+?\d{2,3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3})/gi,
  ];

  private readonly EQUIPMENT_PATTERNS = [
    /(?:sprzęt|equipment|kamera|camera)[\s:]*([^\n\r]+)/gi,
    /(?:obiektyw|lens|światło|light)[\s:]*([^\n\r]+)/gi,
  ];

  private readonly SAFETY_PATTERNS = [
    /(?:bezpieczeństwo|safety|uwagi|notes|ważne|important)[\s:]*([^\n\r]+)/gi,
    /(?:bhp|ohs)[\s:]*([^\n\r]+)/gi,
  ];

  /**
   * Parse PDF attachment and extract schedule data
   */
  async parsePDFAttachment(
    pdfBuffer: Buffer,
    filename?: string
  ): Promise<ParsedScheduleData> {
    try {
      logger.info("Starting PDF parsing", {
        filename,
        size: pdfBuffer.length,
      });

      // Extract text from PDF
      const pdfText = await this.extractTextFromPDF(pdfBuffer);

      if (!pdfText || pdfText.trim().length === 0) {
        logger.warn("No text extracted from PDF, attempting OCR fallback", {
          filename,
        });

        // Attempt OCR fallback (placeholder for now)
        const ocrResult = await this.performOCRFallback(pdfBuffer);
        if (ocrResult.text) {
          return this.parseScheduleData(ocrResult.text, ocrResult.confidence);
        }

        throw new Error("No text could be extracted from PDF");
      }

      // Parse extracted text
      const scheduleData = this.parseScheduleData(pdfText);

      logger.info("Successfully parsed PDF", {
        filename,
        confidence: scheduleData.confidence,
        hasDate: !!scheduleData.shootingDate,
        hasTime: !!scheduleData.callTime,
        hasLocation: !!scheduleData.location,
      });

      return scheduleData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error("Failed to parse PDF attachment", {
        filename,
        error: errorMessage,
        stack: errorStack,
      });
      throw new Error(`PDF parsing failed: ${errorMessage}`);
    }
  }

  /**
   * Extract text content from PDF using pdf-lib
   */
  async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      let extractedText = "";

      // Note: pdf-lib doesn't have built-in text extraction
      // This is a placeholder - in production, you'd use pdf2pic + tesseract or pdf-parse
      // For now, we'll simulate text extraction
      logger.warn(
        "PDF text extraction using pdf-lib is limited. Consider using pdf-parse or OCR solution."
      );

      // Placeholder: return empty string to trigger OCR fallback
      return extractedText;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to extract text from PDF", { error: errorMessage });
      throw new Error(`Text extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Parse schedule data from extracted text using regex patterns
   */
  parseScheduleData(
    pdfText: string,
    baseConfidence: number = 1.0
  ): ParsedScheduleData {
    try {
      logger.debug("Parsing schedule data from text", {
        textLength: pdfText.length,
        baseConfidence,
      });

      const scheduleData: ParsedScheduleData = {
        confidence: 0,
      };

      let confidenceScore = 0;
      let totalChecks = 0;

      // Extract shooting date
      const dateResult = this.extractDate(pdfText);
      if (dateResult.value) {
        scheduleData.shootingDate = dateResult.value;
        confidenceScore += dateResult.confidence;
      }
      totalChecks++;

      // Extract call time
      const timeResult = this.extractCallTime(pdfText);
      if (timeResult.value) {
        scheduleData.callTime = timeResult.value;
        confidenceScore += timeResult.confidence;
      }
      totalChecks++;

      // Extract location
      const locationResult = this.extractLocation(pdfText);
      if (locationResult.value) {
        scheduleData.location = locationResult.value;
        confidenceScore += locationResult.confidence;
      }
      totalChecks++;

      // Extract scene information
      const sceneResult = this.extractSceneInfo(pdfText);
      if (sceneResult.scenes.length > 0) {
        scheduleData.scenes = sceneResult.scenes;
        scheduleData.sceneType = sceneResult.type;
        confidenceScore += sceneResult.confidence;
      }
      totalChecks++;

      // Extract contacts
      const contactsResult = this.extractContacts(pdfText);
      if (contactsResult.length > 0) {
        scheduleData.contacts = contactsResult;
        confidenceScore += 0.5; // Lower weight for contacts
      }

      // Extract equipment
      const equipmentResult = this.extractEquipment(pdfText);
      if (equipmentResult.length > 0) {
        scheduleData.equipment = equipmentResult;
        confidenceScore += 0.3; // Lower weight for equipment
      }

      // Extract safety notes
      const safetyResult = this.extractSafetyNotes(pdfText);
      if (safetyResult) {
        scheduleData.safetyNotes = safetyResult;
        confidenceScore += 0.2; // Lower weight for safety notes
      }

      // Calculate final confidence score
      scheduleData.confidence = Math.min(
        (confidenceScore / totalChecks) * baseConfidence,
        1.0
      );

      logger.info("Parsed schedule data", {
        confidence: scheduleData.confidence,
        extractedFields: {
          date: !!scheduleData.shootingDate,
          time: !!scheduleData.callTime,
          location: !!scheduleData.location,
          scenes: scheduleData.scenes?.length || 0,
          contacts: scheduleData.contacts?.length || 0,
        },
      });

      return scheduleData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to parse schedule data", { error: errorMessage });
      throw new Error(`Schedule data parsing failed: ${errorMessage}`);
    }
  }

  /**
   * Validate extracted schedule data
   */
  validateExtractedData(data: ParsedScheduleData): ValidationResult {
    const errors: string[] = [];
    let isValid = true;

    // Check required fields
    if (!data.shootingDate) {
      errors.push("Shooting date is required");
      isValid = false;
    }

    if (!data.callTime) {
      errors.push("Call time is required");
      isValid = false;
    }

    if (!data.location) {
      errors.push("Location is required");
      isValid = false;
    }

    // Validate date format
    if (data.shootingDate) {
      const now = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(now.getFullYear() + 1);

      if (data.shootingDate < now || data.shootingDate > oneYearFromNow) {
        errors.push("Shooting date must be between now and one year from now");
        isValid = false;
      }
    }

    // Validate time format
    if (data.callTime && !/^\d{1,2}:\d{2}$/.test(data.callTime)) {
      errors.push("Call time must be in HH:MM format");
      isValid = false;
    }

    // Check confidence threshold
    if (data.confidence < 0.5) {
      errors.push("Extraction confidence is too low");
      isValid = false;
    }

    return {
      isValid,
      errors,
      confidence: data.confidence,
    };
  }

  /**
   * OCR fallback for scanned PDFs (placeholder implementation)
   */
  private async performOCRFallback(pdfBuffer: Buffer): Promise<OCRResult> {
    try {
      logger.info("Performing OCR fallback for scanned PDF");

      // Placeholder for OCR implementation
      // In production, you would use:
      // - pdf2pic to convert PDF to images
      // - tesseract.js or Google Vision API for OCR
      // - Return extracted text with confidence score

      return {
        text: "",
        confidence: 0.0,
      };
    } catch (error) {
      logger.error("OCR fallback failed", { error });
      return {
        text: "",
        confidence: 0.0,
      };
    }
  }

  /**
   * Extract shooting date from text
   */
  private extractDate(text: string): { value?: Date; confidence: number } {
    for (const pattern of this.DATE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const date = this.parseDate(match);
          if (date) {
            return { value: date, confidence: 1.0 };
          }
        }
      }
    }
    return { confidence: 0 };
  }

  /**
   * Extract call time from text
   */
  private extractCallTime(text: string): {
    value?: string;
    confidence: number;
  } {
    for (const pattern of this.TIME_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const time = this.parseTime(match);
          if (time) {
            return { value: time, confidence: 1.0 };
          }
        }
      }
    }
    return { confidence: 0 };
  }

  /**
   * Extract location from text
   */
  private extractLocation(text: string): {
    value?: string;
    confidence: number;
  } {
    for (const pattern of this.LOCATION_PATTERNS) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const location = match[1].trim();
        if (location.length > 5) {
          return { value: location, confidence: 0.8 };
        }
      }
    }
    return { confidence: 0 };
  }

  /**
   * Extract scene information from text
   */
  private extractSceneInfo(text: string): {
    scenes: string[];
    type?: "INT" | "EXT";
    confidence: number;
  } {
    const scenes: string[] = [];
    let sceneType: "INT" | "EXT" | undefined;

    // Check for INT/EXT designation
    if (/\bint\b/gi.test(text)) {
      sceneType = "INT";
    } else if (/\bext\b/gi.test(text)) {
      sceneType = "EXT";
    }

    // Extract scene numbers
    for (const pattern of this.SCENE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        scenes.push(...matches.map((m) => m.trim()));
      }
    }

    const confidence = scenes.length > 0 || sceneType ? 0.7 : 0;

    return {
      scenes: [...new Set(scenes)], // Remove duplicates
      type: sceneType,
      confidence,
    };
  }

  /**
   * Extract contact information from text
   */
  private extractContacts(text: string): ContactInfo[] {
    const contacts: ContactInfo[] = [];

    for (const pattern of this.CONTACT_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[2]) {
          contacts.push({
            name: match[1].trim(),
            phone: match[2].trim(),
          });
        }
      }
    }

    return contacts;
  }

  /**
   * Extract equipment list from text
   */
  private extractEquipment(text: string): string[] {
    const equipment: string[] = [];

    for (const pattern of this.EQUIPMENT_PATTERNS) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        equipment.push(match[1].trim());
      }
    }

    return equipment;
  }

  /**
   * Extract safety notes from text
   */
  private extractSafetyNotes(text: string): string | undefined {
    for (const pattern of this.SAFETY_PATTERNS) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * Parse date string into Date object
   */
  private parseDate(dateString: string): Date | null {
    try {
      // Remove common prefixes
      const cleanDate = dateString
        .replace(/^(data|date|dzień|shooting date)[\s:]*/gi, "")
        .trim();

      // Try different date formats
      const formats = [
        /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/, // DD/MM/YYYY or DD-MM-YYYY
        /^(\d{2,4})[-/.](\d{1,2})[-/.](\d{1,2})$/, // YYYY/MM/DD or YYYY-MM-DD
      ];

      for (const format of formats) {
        const match = cleanDate.match(format);
        if (match) {
          let day, month, year;

          if (match[3].length === 4) {
            // DD/MM/YYYY format
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1; // Month is 0-indexed
            year = parseInt(match[3]);
          } else {
            // YYYY/MM/DD format
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          }

          const date = new Date(year, month, day);

          // Validate the date
          if (
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
          ) {
            return date;
          }
        }
      }

      // Fallback to native Date parsing
      const fallbackDate = new Date(cleanDate);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate;
      }

      return null;
    } catch (error) {
      logger.debug("Failed to parse date", { dateString, error });
      return null;
    }
  }

  /**
   * Parse time string into HH:MM format
   */
  private parseTime(timeString: string): string | null {
    try {
      // Remove common prefixes
      const cleanTime = timeString
        .replace(/^(call time|czas zbiórki|zbiórka|start|początek)[\s:]*/gi, "")
        .trim();

      const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);

        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          return `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}`;
        }
      }

      return null;
    } catch (error) {
      logger.debug("Failed to parse time", { timeString, error });
      return null;
    }
  }

  /**
   * Create manual correction interface data structure
   */
  createManualCorrectionInterface(
    originalData: ParsedScheduleData,
    validationResult: ValidationResult
  ): {
    originalData: ParsedScheduleData;
    validationErrors: string[];
    suggestedCorrections: Record<string, any>;
    requiredFields: string[];
  } {
    const suggestedCorrections: Record<string, any> = {};
    const requiredFields: string[] = [];

    // Suggest corrections based on validation errors
    if (!originalData.shootingDate) {
      requiredFields.push("shootingDate");
      suggestedCorrections.shootingDate = new Date();
    }

    if (!originalData.callTime) {
      requiredFields.push("callTime");
      suggestedCorrections.callTime = "08:00";
    }

    if (!originalData.location) {
      requiredFields.push("location");
      suggestedCorrections.location = "";
    }

    return {
      originalData,
      validationErrors: validationResult.errors,
      suggestedCorrections,
      requiredFields,
    };
  }
}

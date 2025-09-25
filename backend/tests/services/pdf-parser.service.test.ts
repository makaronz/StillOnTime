import {
  PDFParserService,
  ParsedScheduleData,
} from "@/services/pdf-parser.service";
import { logger } from "@/utils/logger";

// Mock dependencies
jest.mock("@/utils/logger");
jest.mock("pdf-lib", () => ({
  PDFDocument: {
    load: jest.fn(),
  },
}));

describe("PDFParserService", () => {
  let pdfParserService: PDFParserService;
  const mockPdfBuffer = Buffer.from("mock pdf content");

  beforeEach(() => {
    jest.clearAllMocks();
    pdfParserService = new PDFParserService();
  });

  describe("parseScheduleData", () => {
    it("should parse complete schedule data from text", () => {
      const sampleText = `
        Plan zdjęciowy
        Data: 15/12/2024
        Call time: 08:30
        Lokacja: ul. Marszałkowska 1, Warszawa
        EXT. ULICA - DZIEŃ
        Scena 15A, 16, 17
        Reżyser: Jan Kowalski +48 123 456 789
        Producent: Anna Nowak +48 987 654 321
        Sprzęt: Kamera RED, Obiektyw 50mm
        Bezpieczeństwo: Uwaga na ruch uliczny
      `;

      const result = pdfParserService.parseScheduleData(sampleText);

      expect(result.shootingDate).toEqual(new Date(2024, 11, 15)); // Month is 0-indexed
      expect(result.callTime).toBe("08:30");
      expect(result.location).toContain("Marszałkowska");
      expect(result.sceneType).toBe("EXT");
      expect(result.scenes).toContain("15A");
      expect(result.contacts).toHaveLength(2);
      expect(result.contacts![0].name).toBe("Jan Kowalski");
      expect(result.contacts![0].phone).toBe("+48 123 456 789");
      expect(result.equipment).toContain("Kamera RED");
      expect(result.safetyNotes).toContain("ruch uliczny");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should handle partial data extraction", () => {
      const partialText = `
        Shooting Schedule
        Date: 20-01-2024
        Location: Studio A, Film City
      `;

      const result = pdfParserService.parseScheduleData(partialText);

      expect(result.shootingDate).toEqual(new Date(2024, 0, 20));
      expect(result.callTime).toBeUndefined();
      expect(result.location).toContain("Studio A");
      expect(result.confidence).toBeLessThan(1.0);
    });

    it("should handle different date formats", () => {
      const testCases = [
        { text: "Data: 15/12/2024", expected: new Date(2024, 11, 15) },
        { text: "Date: 2024-12-15", expected: new Date(2024, 11, 15) },
        {
          text: "Dzień zdjęciowy: 15.12.2024",
          expected: new Date(2024, 11, 15),
        },
        { text: "Shooting date: 12/15/2024", expected: new Date(2024, 11, 15) },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = pdfParserService.parseScheduleData(text);
        expect(result.shootingDate).toEqual(expected);
      });
    });

    it("should handle different time formats", () => {
      const testCases = [
        { text: "Call time: 08:30", expected: "08:30" },
        { text: "Zbiórka: 7:45", expected: "07:45" },
        { text: "Start: 09:00", expected: "09:00" },
        { text: "Początek: 10:15", expected: "10:15" },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = pdfParserService.parseScheduleData(text);
        expect(result.callTime).toBe(expected);
      });
    });

    it("should detect INT/EXT scene types", () => {
      const intText = "INT. MIESZKANIE - DZIEŃ";
      const extText = "EXT. ULICA - NOC";

      const intResult = pdfParserService.parseScheduleData(intText);
      const extResult = pdfParserService.parseScheduleData(extText);

      expect(intResult.sceneType).toBe("INT");
      expect(extResult.sceneType).toBe("EXT");
    });

    it("should extract multiple contacts", () => {
      const text = `
        Reżyser: Jan Kowalski +48 123 456 789
        Producent: Anna Nowak +48 987 654 321
        Operator: Piotr Wiśniewski +48 555 666 777
        Marek Zieliński: +48 111 222 333
      `;

      const result = pdfParserService.parseScheduleData(text);

      expect(result.contacts).toHaveLength(4);
      expect(result.contacts![0]).toEqual({
        name: "Jan Kowalski",
        phone: "+48 123 456 789",
      });
      expect(result.contacts![3]).toEqual({
        name: "Marek Zieliński",
        phone: "+48 111 222 333",
      });
    });

    it("should handle empty or invalid text", () => {
      const emptyResult = pdfParserService.parseScheduleData("");
      const invalidResult = pdfParserService.parseScheduleData(
        "Random text without schedule data"
      );

      expect(emptyResult.confidence).toBe(0);
      expect(invalidResult.confidence).toBeLessThan(0.5);
    });
  });

  describe("validateExtractedData", () => {
    it("should validate complete and correct data", () => {
      const validData: ParsedScheduleData = {
        shootingDate: new Date(2024, 11, 15),
        callTime: "08:30",
        location: "Studio A, Warsaw",
        sceneType: "INT",
        confidence: 0.9,
      };

      const result = pdfParserService.validateExtractedData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.confidence).toBe(0.9);
    });

    it("should reject data with missing required fields", () => {
      const incompleteData: ParsedScheduleData = {
        shootingDate: new Date(2024, 11, 15),
        // Missing callTime and location
        confidence: 0.8,
      };

      const result = pdfParserService.validateExtractedData(incompleteData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Call time is required");
      expect(result.errors).toContain("Location is required");
    });

    it("should reject data with invalid date range", () => {
      const pastDate: ParsedScheduleData = {
        shootingDate: new Date(2020, 0, 1), // Past date
        callTime: "08:30",
        location: "Studio A",
        confidence: 0.8,
      };

      const futureDate: ParsedScheduleData = {
        shootingDate: new Date(2030, 0, 1), // Too far in future
        callTime: "08:30",
        location: "Studio A",
        confidence: 0.8,
      };

      const pastResult = pdfParserService.validateExtractedData(pastDate);
      const futureResult = pdfParserService.validateExtractedData(futureDate);

      expect(pastResult.isValid).toBe(false);
      expect(futureResult.isValid).toBe(false);
      expect(pastResult.errors[0]).toContain("between now and one year");
    });

    it("should reject data with invalid time format", () => {
      const invalidTimeData: ParsedScheduleData = {
        shootingDate: new Date(2024, 11, 15),
        callTime: "25:70", // Invalid time
        location: "Studio A",
        confidence: 0.8,
      };

      const result = pdfParserService.validateExtractedData(invalidTimeData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Call time must be in HH:MM format");
    });

    it("should reject data with low confidence", () => {
      const lowConfidenceData: ParsedScheduleData = {
        shootingDate: new Date(2024, 11, 15),
        callTime: "08:30",
        location: "Studio A",
        confidence: 0.3, // Below threshold
      };

      const result = pdfParserService.validateExtractedData(lowConfidenceData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Extraction confidence is too low");
    });
  });

  describe("createManualCorrectionInterface", () => {
    it("should create correction interface for incomplete data", () => {
      const incompleteData: ParsedScheduleData = {
        shootingDate: new Date(2024, 11, 15),
        // Missing callTime and location
        confidence: 0.3,
      };

      const validationResult =
        pdfParserService.validateExtractedData(incompleteData);
      const correctionInterface =
        pdfParserService.createManualCorrectionInterface(
          incompleteData,
          validationResult
        );

      expect(correctionInterface.originalData).toBe(incompleteData);
      expect(correctionInterface.validationErrors).toHaveLength(3); // callTime, location, confidence
      expect(correctionInterface.requiredFields).toContain("callTime");
      expect(correctionInterface.requiredFields).toContain("location");
      expect(correctionInterface.suggestedCorrections.callTime).toBe("08:00");
      expect(correctionInterface.suggestedCorrections.location).toBe("");
    });

    it("should provide suggested corrections for missing fields", () => {
      const emptyData: ParsedScheduleData = {
        confidence: 0.1,
      };

      const validationResult =
        pdfParserService.validateExtractedData(emptyData);
      const correctionInterface =
        pdfParserService.createManualCorrectionInterface(
          emptyData,
          validationResult
        );

      expect(correctionInterface.requiredFields).toHaveLength(3);
      expect(
        correctionInterface.suggestedCorrections.shootingDate
      ).toBeInstanceOf(Date);
      expect(correctionInterface.suggestedCorrections.callTime).toBe("08:00");
      expect(correctionInterface.suggestedCorrections.location).toBe("");
    });
  });

  describe("parsePDFAttachment", () => {
    it("should handle PDF parsing errors gracefully", async () => {
      const invalidBuffer = Buffer.from("invalid pdf content");

      await expect(
        pdfParserService.parsePDFAttachment(invalidBuffer, "test.pdf")
      ).rejects.toThrow("PDF parsing failed");
    });

    it("should attempt OCR fallback when text extraction fails", async () => {
      // Mock PDF loading to succeed but return no text
      const mockPDFDoc = {
        getPages: jest.fn().mockReturnValue([]),
      };

      const { PDFDocument } = require("pdf-lib");
      PDFDocument.load.mockResolvedValue(mockPDFDoc);

      await expect(
        pdfParserService.parsePDFAttachment(mockPdfBuffer, "scanned.pdf")
      ).rejects.toThrow("No text could be extracted from PDF");
    });
  });

  describe("private parsing methods", () => {
    describe("parseDate", () => {
      it("should parse various date formats correctly", () => {
        const service = pdfParserService as any;

        const testCases = [
          { input: "15/12/2024", expected: new Date(2024, 11, 15) },
          { input: "2024-12-15", expected: new Date(2024, 11, 15) },
          { input: "15.12.2024", expected: new Date(2024, 11, 15) },
          { input: "Data: 15/12/2024", expected: new Date(2024, 11, 15) },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = service.parseDate(input);
          expect(result).toEqual(expected);
        });
      });

      it("should return null for invalid dates", () => {
        const service = pdfParserService as any;

        const invalidDates = [
          "invalid date",
          "32/13/2024", // Invalid day/month
          "2024/13/32", // Invalid month/day
          "",
        ];

        invalidDates.forEach((invalidDate) => {
          const result = service.parseDate(invalidDate);
          expect(result).toBeNull();
        });
      });
    });

    describe("parseTime", () => {
      it("should parse various time formats correctly", () => {
        const service = pdfParserService as any;

        const testCases = [
          { input: "8:30", expected: "08:30" },
          { input: "08:30", expected: "08:30" },
          { input: "Call time: 8:30", expected: "08:30" },
          { input: "Zbiórka: 07:45", expected: "07:45" },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = service.parseTime(input);
          expect(result).toBe(expected);
        });
      });

      it("should return null for invalid times", () => {
        const service = pdfParserService as any;

        const invalidTimes = [
          "25:30", // Invalid hour
          "08:70", // Invalid minute
          "invalid time",
          "",
        ];

        invalidTimes.forEach((invalidTime) => {
          const result = service.parseTime(invalidTime);
          expect(result).toBeNull();
        });
      });
    });
  });

  describe("regex pattern matching", () => {
    it("should extract locations with various patterns", () => {
      const service = pdfParserService as any;

      const testTexts = [
        "Lokacja: ul. Marszałkowska 1, Warszawa",
        "Location: Studio A, Film City",
        "Miejsce: Plac Zamkowy, Kraków",
        "Adres: ul. Nowy Świat 15",
      ];

      testTexts.forEach((text) => {
        const result = service.extractLocation(text);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.value).toBeDefined();
      });
    });

    it("should extract scene information correctly", () => {
      const service = pdfParserService as any;

      const testTexts = [
        "Scena 15A, 16, 17",
        "Scene 1, 2A, 3",
        "INT. MIESZKANIE - DZIEŃ",
        "EXT. ULICA - NOC",
      ];

      testTexts.forEach((text) => {
        const result = service.extractSceneInfo(text);
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it("should extract equipment information", () => {
      const service = pdfParserService as any;

      const testTexts = [
        "Sprzęt: Kamera RED, Obiektyw 50mm",
        "Equipment: Camera A7S, Lens 24-70mm",
        "Kamera: Sony FX6",
        "Światło: LED Panel 1000W",
      ];

      testTexts.forEach((text) => {
        const result = service.extractEquipment(text);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it("should extract safety notes", () => {
      const service = pdfParserService as any;

      const testTexts = [
        "Bezpieczeństwo: Uwaga na ruch uliczny",
        "Safety: Wear protective equipment",
        "Uwagi: Teren budowy - kaski obowiązkowe",
        "Important: High voltage area",
      ];

      testTexts.forEach((text) => {
        const result = service.extractSafetyNotes(text);
        expect(result).toBeDefined();
        expect(result!.length).toBeGreaterThan(0);
      });
    });
  });
});

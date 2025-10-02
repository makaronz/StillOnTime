import { Router } from "express";
import multer from "multer";
import { EnhancedController } from "@/controllers/enhanced.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validateRequest } from "@/middleware/validation";
import { z } from "zod";

const router = Router();

// Configure multer for PDF uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Validation schemas
const processPDFSchema = {
  body: z.object({
    userId: z.string().uuid(),
    filename: z.string().optional(),
  }),
};

const monitorEmailsSchema = {
  params: z.object({
    userId: z.string().uuid(),
  }),
};

const calculateRouteSchema = {
  body: z.object({
    scheduleData: z.object({
      id: z.string(),
      shootingDate: z.string().transform(str => new Date(str)),
      callTime: z.string(),
      location: z.string(),
      sceneType: z.string().optional(),
      scenes: z.array(z.string()).optional(),
      contacts: z.array(z.any()).optional(),
      equipment: z.array(z.string()).optional(),
    }),
    userId: z.string().uuid(),
    options: z.object({
      includeAlternatives: z.boolean().optional(),
      optimizeForTraffic: z.boolean().optional(),
      considerWeather: z.boolean().optional(),
      maxAlternatives: z.number().min(1).max(5).optional(),
      preferFastestRoute: z.boolean().optional(),
      avoidTolls: z.boolean().optional(),
      avoidHighways: z.boolean().optional(),
    }).optional(),
  }),
};

const optimizeMultiDestinationSchema = {
  body: z.object({
    schedules: z.array(z.object({
      id: z.string(),
      shootingDate: z.string().transform(str => new Date(str)),
      callTime: z.string(),
      location: z.string(),
    })).min(2),
    userId: z.string().uuid(),
    options: z.object({
      includeAlternatives: z.boolean().optional(),
      optimizeForTraffic: z.boolean().optional(),
      maxAlternatives: z.number().min(1).max(5).optional(),
    }).optional(),
  }),
};

const createCalendarEventSchema = {
  body: z.object({
    scheduleData: z.object({
      id: z.string(),
      shootingDate: z.string().transform(str => new Date(str)),
      callTime: z.string(),
      location: z.string(),
      sceneType: z.string().optional(),
      scenes: z.array(z.string()).optional(),
      contacts: z.array(z.any()).optional(),
      equipment: z.array(z.string()).optional(),
      notes: z.string().optional(),
      safetyNotes: z.string().optional(),
    }),
    routePlan: z.object({
      wakeUpTime: z.string().transform(str => new Date(str)),
      departureTime: z.string().transform(str => new Date(str)),
      arrivalTime: z.string().transform(str => new Date(str)),
      totalTravelMinutes: z.number(),
    }),
    weather: z.object({
      temperature: z.number().nullable(),
      description: z.string().optional(),
      windSpeed: z.number().nullable(),
      precipitation: z.number().nullable(),
      warnings: z.array(z.string()).optional(),
    }),
    userId: z.string().uuid(),
    options: z.object({
      generateICSFile: z.boolean().optional(),
      includeCrewInvites: z.boolean().optional(),
      enableTimezoneIntelligence: z.boolean().optional(),
      optimizeScheduleTiming: z.boolean().optional(),
      addWeatherAlerts: z.boolean().optional(),
      includeRouteInstructions: z.boolean().optional(),
    }).optional(),
  }),
};

const validatePDFExtractionSchema = {
  body: z.object({
    extractedData: z.object({
      id: z.string(),
      shootingDate: z.string().transform(str => new Date(str)).optional(),
      callTime: z.string().optional(),
      location: z.string().optional(),
      confidence: z.number().min(0).max(1),
      scenes: z.array(z.string()).optional(),
      contacts: z.array(z.any()).optional(),
    }),
  }),
};

/**
 * Enhanced Services Routes
 */

// PDF Processing
router.post(
  "/pdf/process",
  authMiddleware,
  upload.single("pdf"),
  validateRequest(processPDFSchema),
  EnhancedController.processPDFEnhanced
);

router.post(
  "/pdf/validate",
  authMiddleware,
  validateRequest(validatePDFExtractionSchema),
  EnhancedController.validatePDFExtraction
);

// Email Processing
router.post(
  "/emails/:userId/monitor",
  authMiddleware,
  validateRequest(monitorEmailsSchema),
  EnhancedController.monitorEmailsEnhanced
);

// Route Planning
router.post(
  "/routes/calculate",
  authMiddleware,
  validateRequest(calculateRouteSchema),
  EnhancedController.calculateRouteEnhanced
);

router.post(
  "/routes/optimize-multi",
  authMiddleware,
  validateRequest(optimizeMultiDestinationSchema),
  EnhancedController.optimizeMultiDestinationRoute
);

// Calendar Integration
router.post(
  "/calendar/create-enhanced",
  authMiddleware,
  validateRequest(createCalendarEventSchema),
  EnhancedController.createCalendarEventEnhanced
);

// Service Management
router.get(
  "/health",
  authMiddleware,
  EnhancedController.getEnhancedServicesHealth
);

router.get(
  "/config",
  authMiddleware,
  EnhancedController.getEnhancedServicesConfig
);

export default router;
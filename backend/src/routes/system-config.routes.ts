import { Router } from "express";
import { systemConfigController } from "@/controllers/system-config.controller";
import { authenticateToken } from "@/middleware/auth.middleware";

const router = Router();

/**
 * System Configuration Routes
 * All routes require authentication
 * Prefix: /api/config
 */

// Get LLM configuration
router.get("/llm", authenticateToken, (req, res) =>
  systemConfigController.getLLMConfig(req, res)
);

// Update LLM configuration
router.put("/llm", authenticateToken, (req, res) =>
  systemConfigController.updateLLMConfig(req, res)
);

// Get mail parsing configuration
router.get("/mail-parsing", authenticateToken, (req, res) =>
  systemConfigController.getMailParsingConfig(req, res)
);

// Update mail parsing configuration
router.put("/mail-parsing", authenticateToken, (req, res) =>
  systemConfigController.updateMailParsingConfig(req, res)
);

// Get system status
router.get("/status", authenticateToken, (req, res) =>
  systemConfigController.getSystemStatus(req, res)
);

// Test API connections
router.post("/test-connections", authenticateToken, (req, res) =>
  systemConfigController.testConnections(req, res)
);

export { router as systemConfigRoutes };

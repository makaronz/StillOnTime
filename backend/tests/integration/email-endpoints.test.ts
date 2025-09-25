/**
 * Integration test for email processing endpoints
 * This test verifies that all required endpoints are implemented and accessible
 */

import request from "supertest";
import express from "express";
import { emailRoutes } from "@/routes/email.routes";

// Mock the services and middleware for integration testing
jest.mock("@/services", () => ({
  services: {
    jobProcessor: {
      addEmailProcessingJob: jest.fn().mockResolvedValue({ id: "job-123" }),
      getJobStats: jest.fn().mockResolvedValue({
        emailProcessing: { waiting: 0, active: 0, completed: 5, failed: 1 },
      }),
      schedulePeriodicEmailCheck: jest
        .fn()
        .mockResolvedValue({ id: "periodic-job" }),
      cancelPeriodicEmailCheck: jest.fn().mockResolvedValue(undefined),
    },
    gmail: {
      getEmailStats: jest.fn().mockResolvedValue({
        totalEmails: 10,
        processedEmails: 8,
        pendingEmails: 1,
        failedEmails: 1,
        lastCheck: new Date(),
      }),
    },
  },
}));

jest.mock("@/middleware/auth.middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: "test-user", email: "test@example.com" };
    next();
  },
  requireValidOAuth: (req: any, res: any, next: any) => next(),
}));

jest.mock("@/controllers/email.controller", () => ({
  emailController: {
    triggerProcessing: jest.fn().mockImplementation(async (req, res) => {
      res.json({
        success: true,
        job: { id: "job-123", status: "queued" },
        message: "Email processing queued",
      });
    }),
    getProcessingStatus: jest.fn().mockImplementation(async (req, res) => {
      res.json({
        success: true,
        statistics: { totalEmails: 10, processedEmails: 8 },
        recentEmails: [],
      });
    }),
    getProcessingHistory: jest.fn().mockImplementation(async (req, res) => {
      res.json({
        success: true,
        pagination: { page: 1, total: 0 },
        emails: [],
      });
    }),
    retryProcessing: jest.fn().mockImplementation(async (req, res) => {
      res.json({
        success: true,
        job: { id: "retry-job", status: "queued" },
        message: "Email processing retry queued",
      });
    }),
    getStatistics: jest.fn().mockImplementation(async (req, res) => {
      res.json({
        success: true,
        period: "30d",
        overall: { total: 10, processed: 8 },
        chartData: [],
      });
    }),
    toggleMonitoring: jest.fn().mockImplementation(async (req, res) => {
      res.json({
        success: true,
        monitoring: { enabled: req.body.enabled },
        message: "Monitoring updated",
      });
    }),
    getEmailDetails: jest.fn().mockImplementation(async (req, res) => {
      res.json({
        success: true,
        email: { id: req.params.emailId, subject: "Test Email" },
      });
    }),
  },
}));

describe("Email Processing Endpoints Integration", () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/email", emailRoutes);
  });

  describe("Task 9.2 Requirements", () => {
    it("should have manual email processing trigger endpoint", async () => {
      const response = await request(app)
        .post("/api/email/process")
        .send({ messageId: "test-message" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
    });

    it("should have email processing status endpoint", async () => {
      const response = await request(app).get("/api/email/status");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toBeDefined();
    });

    it("should have email processing history endpoint", async () => {
      const response = await request(app).get("/api/email/history");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.emails).toBeDefined();
    });

    it("should have email reprocessing functionality", async () => {
      const response = await request(app).post(
        "/api/email/test-email-id/retry"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
    });

    it("should have processing statistics endpoint", async () => {
      const response = await request(app).get("/api/email/statistics");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.overall).toBeDefined();
    });

    it("should have monitoring toggle endpoint", async () => {
      const response = await request(app)
        .post("/api/email/monitoring")
        .send({ enabled: true, intervalMinutes: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.monitoring).toBeDefined();
    });

    it("should have email details endpoint", async () => {
      const response = await request(app).get("/api/email/test-email-id");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.email).toBeDefined();
    });

    it("should have health check endpoint", async () => {
      const response = await request(app).get("/api/email/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("healthy");
      expect(response.body.service).toBe("email-processing");
    });
  });

  describe("Endpoint Validation", () => {
    it("should validate request parameters for processing trigger", async () => {
      const response = await request(app)
        .post("/api/email/process")
        .send({ priority: 15 }); // Invalid priority

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Bad Request");
    });

    it("should validate query parameters for history", async () => {
      const response = await request(app)
        .get("/api/email/history")
        .query({ page: 0 }); // Invalid page

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Bad Request");
    });

    it("should validate monitoring toggle parameters", async () => {
      const response = await request(app)
        .post("/api/email/monitoring")
        .send({ enabled: "invalid" }); // Should be boolean

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Bad Request");
    });
  });
});

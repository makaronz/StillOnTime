/**
 * Tests for MonitoringMiddleware
 * Testing request tracking, error monitoring, and security monitoring
 */

import { Request, Response, NextFunction } from "express";
import {
  MonitoringMiddleware,
  MonitoringRequest,
} from "../../src/middleware/monitoring.middleware";
import { MonitoringService } from "../../src/services/monitoring.service";
import { structuredLogger } from "../../src/utils/logger";

// Mock dependencies
jest.mock("../../src/services/monitoring.service");
jest.mock("../../src/utils/logger");

describe("MonitoringMiddleware", () => {
  let monitoringMiddleware: MonitoringMiddleware;
  let mockMonitoringService: jest.Mocked<MonitoringService>;
  let mockRequest: Partial<MonitoringRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock monitoring service
    mockMonitoringService = {
      recordRequest: jest.fn(),
    } as any;

    // Create middleware instance
    monitoringMiddleware = new MonitoringMiddleware(mockMonitoringService);

    // Create mock request and response
    mockRequest = {
      method: "GET",
      url: "/api/test",
      path: "/api/test",
      ip: "127.0.0.1",
      get: jest.fn(),
      body: {},
      query: {},
      route: { path: "/api/test" },
    };

    mockResponse = {
      statusCode: 200,
      end: jest.fn(),
      on: jest.fn(),
      get: jest.fn(),
    };

    mockNext = jest.fn();

    // Mock structured logger
    (structuredLogger.setRequestId as jest.Mock) = jest.fn();
    (structuredLogger.clearRequestId as jest.Mock) = jest.fn();
    (structuredLogger.http as jest.Mock) = jest.fn();
    (structuredLogger.error as jest.Mock) = jest.fn();
    (structuredLogger.performance as jest.Mock) = jest.fn();
    (structuredLogger.debug as jest.Mock) = jest.fn();
    (structuredLogger.warn as jest.Mock) = jest.fn();
    (structuredLogger.security as jest.Mock) = jest.fn();
  });

  describe("Request Tracking", () => {
    it("should track successful requests", () => {
      const middleware = monitoringMiddleware.trackRequest();

      // Mock User-Agent header
      (mockRequest.get as jest.Mock).mockReturnValue("Mozilla/5.0");

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      // Verify request ID is set
      expect(mockRequest.requestId).toBeDefined();
      expect(structuredLogger.setRequestId).toHaveBeenCalledWith(
        mockRequest.requestId
      );

      // Verify request start is logged
      expect(structuredLogger.http).toHaveBeenCalledWith(
        "Request started",
        expect.objectContaining({
          method: "GET",
          url: "/api/test",
          userAgent: "Mozilla/5.0",
          ip: "127.0.0.1",
          requestId: mockRequest.requestId,
        })
      );

      // Verify next is called
      expect(mockNext).toHaveBeenCalled();

      // Simulate response end
      const originalEnd = mockResponse.end as jest.Mock;
      expect(originalEnd).toBeDefined();

      // Call the overridden end method
      if (mockResponse.end) {
        (mockResponse.end as any)();
      }

      // Verify metrics are recorded
      expect(mockMonitoringService.recordRequest).toHaveBeenCalledWith(
        "GET /api/test",
        expect.any(Number),
        false
      );

      // Verify request completion is logged
      expect(structuredLogger.http).toHaveBeenCalledWith(
        "Request completed",
        expect.objectContaining({
          method: "GET",
          url: "/api/test",
          statusCode: 200,
          responseTime: expect.any(Number),
          requestId: mockRequest.requestId,
          isError: false,
        })
      );

      // Verify request ID is cleared
      expect(structuredLogger.clearRequestId).toHaveBeenCalled();
    });

    it("should track error requests", () => {
      const middleware = monitoringMiddleware.trackRequest();

      mockResponse.statusCode = 500;
      (mockRequest.get as jest.Mock).mockReturnValue("curl/7.68.0");

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      // Simulate response end with error status
      if (mockResponse.end) {
        (mockResponse.end as any)();
      }

      // Verify error metrics are recorded
      expect(mockMonitoringService.recordRequest).toHaveBeenCalledWith(
        "GET /api/test",
        expect.any(Number),
        true
      );

      // Verify error is logged
      expect(structuredLogger.http).toHaveBeenCalledWith(
        "Request completed",
        expect.objectContaining({
          statusCode: 500,
          isError: true,
        })
      );
    });

    it("should handle requests without route", () => {
      const middleware = monitoringMiddleware.trackRequest();

      delete mockRequest.route;
      (mockRequest.get as jest.Mock).mockReturnValue("test-agent");

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      if (mockResponse.end) {
        (mockResponse.end as any)();
      }

      // Should use path instead of route.path
      expect(mockMonitoringService.recordRequest).toHaveBeenCalledWith(
        "GET /api/test",
        expect.any(Number),
        false
      );
    });
  });

  describe("Error Tracking", () => {
    it("should track middleware errors", () => {
      const middleware = monitoringMiddleware.trackErrors();
      const testError = new Error("Test error");

      mockRequest.startTime = Date.now() - 1000; // 1 second ago

      middleware(
        testError,
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      // Verify error metrics are recorded
      expect(mockMonitoringService.recordRequest).toHaveBeenCalledWith(
        "GET /api/test",
        expect.any(Number),
        true
      );

      // Verify error is logged
      expect(structuredLogger.error).toHaveBeenCalledWith(
        "Request error",
        expect.objectContaining({
          method: "GET",
          url: "/api/test",
          responseTime: expect.any(Number),
          requestId: mockRequest.requestId,
          error: expect.objectContaining({
            name: "Error",
            message: "Test error",
          }),
        }),
        testError
      );

      // Verify next is called with error
      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it("should handle errors without start time", () => {
      const middleware = monitoringMiddleware.trackErrors();
      const testError = new Error("Test error");

      middleware(
        testError,
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      // Should still record metrics with 0 response time
      expect(mockMonitoringService.recordRequest).toHaveBeenCalledWith(
        "GET /api/test",
        0,
        true
      );
    });
  });

  describe("Operation Tracking", () => {
    it("should track specific operations", () => {
      const operationName = "email_processing";
      const middleware = monitoringMiddleware.trackOperation(operationName);

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      // Simulate response end
      if (mockResponse.end) {
        (mockResponse.end as any)();
      }

      // Verify operation performance is logged
      expect(structuredLogger.performance).toHaveBeenCalledWith(
        operationName,
        expect.any(Number),
        expect.objectContaining({
          method: "GET",
          url: "/api/test",
          statusCode: 200,
          requestId: mockRequest.requestId,
          isError: false,
        })
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should track operation errors", () => {
      const operationName = "pdf_processing";
      const middleware = monitoringMiddleware.trackOperation(operationName);

      mockResponse.statusCode = 422;

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      if (mockResponse.end) {
        (mockResponse.end as any)();
      }

      expect(structuredLogger.performance).toHaveBeenCalledWith(
        operationName,
        expect.any(Number),
        expect.objectContaining({
          isError: true,
          statusCode: 422,
        })
      );
    });
  });

  describe("Rate Limit Tracking", () => {
    it("should track rate limit headers", () => {
      const middleware = monitoringMiddleware.trackRateLimit();

      // Mock rate limit headers
      (mockResponse.get as jest.Mock).mockImplementation((header: string) => {
        switch (header) {
          case "X-RateLimit-Remaining":
            return "50";
          case "X-RateLimit-Limit":
            return "100";
          case "X-RateLimit-Reset":
            return "1640995200";
          default:
            return undefined;
        }
      });

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      // Simulate response finish event
      const finishCallback = (mockResponse.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "finish"
      )?.[1];

      if (finishCallback) {
        finishCallback();
      }

      // Verify rate limit is logged
      expect(structuredLogger.debug).toHaveBeenCalledWith(
        "Rate limit status",
        expect.objectContaining({
          endpoint: "GET /api/test",
          remaining: 50,
          limit: 100,
          usagePercent: 50,
        })
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should warn on high rate limit usage", () => {
      const middleware = monitoringMiddleware.trackRateLimit();

      // Mock high usage rate limit headers
      (mockResponse.get as jest.Mock).mockImplementation((header: string) => {
        switch (header) {
          case "X-RateLimit-Remaining":
            return "5";
          case "X-RateLimit-Limit":
            return "100";
          case "X-RateLimit-Reset":
            return "1640995200";
          default:
            return undefined;
        }
      });

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      const finishCallback = (mockResponse.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "finish"
      )?.[1];

      if (finishCallback) {
        finishCallback();
      }

      // Verify warning is logged for high usage
      expect(structuredLogger.warn).toHaveBeenCalledWith(
        "High rate limit usage",
        expect.objectContaining({
          usagePercent: 95,
        })
      );
    });

    it("should handle missing rate limit headers", () => {
      const middleware = monitoringMiddleware.trackRateLimit();

      (mockResponse.get as jest.Mock).mockReturnValue(undefined);

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      const finishCallback = (mockResponse.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "finish"
      )?.[1];

      if (finishCallback) {
        finishCallback();
      }

      // Should not log anything for missing headers
      expect(structuredLogger.debug).not.toHaveBeenCalledWith(
        "Rate limit status",
        expect.anything()
      );
    });
  });

  describe("Security Monitoring", () => {
    it("should detect directory traversal attempts", () => {
      const middleware = monitoringMiddleware.trackSecurity();

      mockRequest.url = "/api/files/../../../etc/passwd";

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      expect(structuredLogger.security).toHaveBeenCalledWith(
        "Suspicious request pattern detected",
        expect.objectContaining({
          pattern: "\\.\\.",
          url: "/api/files/../../../etc/passwd",
        })
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should detect XSS attempts", () => {
      const middleware = monitoringMiddleware.trackSecurity();

      mockRequest.body = { content: "<script>alert('xss')</script>" };

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      expect(structuredLogger.security).toHaveBeenCalledWith(
        "Suspicious request pattern detected",
        expect.objectContaining({
          pattern: "<script",
        })
      );
    });

    it("should detect SQL injection attempts", () => {
      const middleware = monitoringMiddleware.trackSecurity();

      mockRequest.query = { search: "'; DROP TABLE users; --" };

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      expect(structuredLogger.security).toHaveBeenCalledWith(
        "Suspicious request pattern detected",
        expect.objectContaining({
          pattern: "union.*select",
        })
      );
    });

    it("should detect large requests", () => {
      const middleware = monitoringMiddleware.trackSecurity();

      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === "Content-Length") return "20971520"; // 20MB
        return undefined;
      });

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      expect(structuredLogger.security).toHaveBeenCalledWith(
        "Large request detected",
        expect.objectContaining({
          contentLength: 20971520,
        })
      );
    });

    it("should detect suspicious user agents", () => {
      const middleware = monitoringMiddleware.trackSecurity();

      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === "User-Agent") return "curl/7.68.0";
        return undefined;
      });

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      expect(structuredLogger.security).toHaveBeenCalledWith(
        "Suspicious user agent detected",
        expect.objectContaining({
          userAgent: "curl/7.68.0",
        })
      );
    });

    it("should handle requests without suspicious patterns", () => {
      const middleware = monitoringMiddleware.trackSecurity();

      mockRequest.url = "/api/schedule";
      mockRequest.body = { location: "Studio A" };
      mockRequest.query = { date: "2024-01-01" };

      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === "User-Agent")
          return "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
        if (header === "Content-Length") return "100";
        return undefined;
      });

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      // Should not log any security warnings
      expect(structuredLogger.security).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("Request ID Generation", () => {
    it("should generate unique request IDs", () => {
      const middleware = monitoringMiddleware.trackRequest();

      // Call middleware multiple times
      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );
      const firstRequestId = mockRequest.requestId;

      const mockRequest2 = { ...mockRequest };
      middleware(
        mockRequest2 as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );
      const secondRequestId = mockRequest2.requestId;

      expect(firstRequestId).toBeDefined();
      expect(secondRequestId).toBeDefined();
      expect(firstRequestId).not.toBe(secondRequestId);
    });

    it("should generate request IDs with correct format", () => {
      const middleware = monitoringMiddleware.trackRequest();

      middleware(
        mockRequest as MonitoringRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.requestId).toMatch(/^req_\d+_[a-z0-9]{9}$/);
    });
  });
});

import { config } from "@/config/config";

// Set test environment
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://test_user:test_password@localhost:5432/stillontime_test";
process.env.JWT_SECRET = "t3st-r4nd0m-1gn1tur3-k3y-f0r-t3st1ng-3nv1r0nm3nt-must-b3-l0ng-3n0ugh";
process.env.JWT_REFRESH_SECRET = "t3st-r3fr3sh-r4nd0m-k3y-f0r-t3st1ng-3nv1r0nm3nt-must-b3-l0ng-3n0ugh";
process.env.REDIS_URL = "redis://localhost:6379/1";

// Mock external APIs for testing
jest.mock("googleapis");
jest.mock("nodemailer");
jest.mock("pdf-lib");

// Mock Prisma client for testing
jest.mock("@/config/database", () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    processedEmail: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    scheduleData: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    routePlan: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    weatherData: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    calendarEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    userConfig: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
  },
  checkDatabaseConnection: jest.fn(),
  initializeDatabase: jest.fn(),
}));

// Global test setup
beforeAll(async () => {
  // Setup test database, Redis, etc.
});

afterAll(async () => {
  // Cleanup test resources
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

import express from "express";
import { apiRoutes } from "@/routes";
import { errorHandler } from "@/middleware/errorHandler";

/**
 * Create test Express app
 */
export function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Add test middleware to mock authentication
  app.use((req, res, next) => {
    req.user = {
      userId: "test-user-id",
      email: "test@example.com",
    };
    next();
  });

  app.use("/api", apiRoutes);
  app.use(errorHandler);

  return app;
}

export {};

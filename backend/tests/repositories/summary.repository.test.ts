import { SummaryRepository } from "../../src/repositories/summary.repository";
import { prisma } from "../../src/config/database";
import {
  Summary,
  CreateSummaryInput,
  UpdateSummaryInput,
} from "../../src/types";

// Mock Prisma
jest.mock("../../src/config/database", () => ({
  prisma: {
    summary: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("SummaryRepository", () => {
  let summaryRepository: SummaryRepository;
  let mockSummary: Summary;

  beforeEach(() => {
    jest.clearAllMocks();
    summaryRepository = new SummaryRepository();

    mockSummary = {
      id: "summary-1",
      userId: "user-1",
      scheduleId: "schedule-1",
      language: "pl",
      content: "Test content",
      htmlContent: "<div>Test HTML</div>",
      timeline: [
        {
          time: new Date("2024-01-15T05:00:00"),
          event: "Wake up",
          type: "wake_up",
        },
      ],
      weatherSummary: "15°C, sunny",
      warnings: ["Test warning"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("create", () => {
    it("should create a new summary", async () => {
      // Arrange
      const createData: CreateSummaryInput = {
        user: { connect: { id: "user-1" } },
        schedule: { connect: { id: "schedule-1" } },
        language: "pl",
        content: "Test content",
        htmlContent: "<div>Test HTML</div>",
        timeline: [
          {
            time: new Date("2024-01-15T05:00:00"),
            event: "Wake up",
            type: "wake_up",
          },
        ],
        weatherSummary: "15°C, sunny",
        warnings: ["Test warning"],
      };

      mockPrisma.summary.create.mockResolvedValue(mockSummary);

      // Act
      const result = await summaryRepository.create(createData);

      // Assert
      expect(result).toEqual(mockSummary);
      expect(mockPrisma.summary.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  describe("findById", () => {
    it("should find summary by ID", async () => {
      // Arrange
      mockPrisma.summary.findUnique.mockResolvedValue(mockSummary);

      // Act
      const result = await summaryRepository.findById("summary-1");

      // Assert
      expect(result).toEqual(mockSummary);
      expect(mockPrisma.summary.findUnique).toHaveBeenCalledWith({
        where: { id: "summary-1" },
      });
    });

    it("should return null if summary not found", async () => {
      // Arrange
      mockPrisma.summary.findUnique.mockResolvedValue(null);

      // Act
      const result = await summaryRepository.findById("non-existent");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findByScheduleId", () => {
    it("should find summary by schedule ID", async () => {
      // Arrange
      mockPrisma.summary.findUnique.mockResolvedValue(mockSummary);

      // Act
      const result = await summaryRepository.findByScheduleId("schedule-1");

      // Assert
      expect(result).toEqual(mockSummary);
      expect(mockPrisma.summary.findUnique).toHaveBeenCalledWith({
        where: { scheduleId: "schedule-1" },
      });
    });
  });

  describe("findByUserId", () => {
    it("should find summaries by user ID", async () => {
      // Arrange
      const summaries = [mockSummary];
      mockPrisma.summary.findMany.mockResolvedValue(summaries);

      // Act
      const result = await summaryRepository.findByUserId("user-1");

      // Assert
      expect(result).toEqual(summaries);
      expect(mockPrisma.summary.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: undefined,
        skip: undefined,
      });
    });

    it("should apply filters and pagination", async () => {
      // Arrange
      const summaries = [mockSummary];
      mockPrisma.summary.findMany.mockResolvedValue(summaries);

      const options = {
        limit: 10,
        offset: 5,
        language: "pl",
      };

      // Act
      const result = await summaryRepository.findByUserId("user-1", options);

      // Assert
      expect(result).toEqual(summaries);
      expect(mockPrisma.summary.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          language: "pl",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 5,
      });
    });
  });

  describe("findWithSchedule", () => {
    it("should find summaries with schedule data", async () => {
      // Arrange
      const summariesWithSchedule = [
        {
          ...mockSummary,
          schedule: {
            id: "schedule-1",
            shootingDate: new Date("2024-01-15"),
            location: "Test Location",
            routePlan: null,
            weatherData: null,
            calendarEvent: null,
          },
        },
      ];
      mockPrisma.summary.findMany.mockResolvedValue(summariesWithSchedule);

      // Act
      const result = await summaryRepository.findWithSchedule("user-1");

      // Assert
      expect(result).toEqual(summariesWithSchedule);
      expect(mockPrisma.summary.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        include: {
          schedule: {
            include: {
              routePlan: true,
              weatherData: true,
              calendarEvent: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: undefined,
        skip: undefined,
      });
    });

    it("should apply date filters", async () => {
      // Arrange
      const summariesWithSchedule = [mockSummary];
      mockPrisma.summary.findMany.mockResolvedValue(summariesWithSchedule);

      const options = {
        fromDate: new Date("2024-01-01"),
        toDate: new Date("2024-01-31"),
      };

      // Act
      const result = await summaryRepository.findWithSchedule(
        "user-1",
        options
      );

      // Assert
      expect(mockPrisma.summary.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          schedule: {
            shootingDate: {
              gte: options.fromDate,
              lte: options.toDate,
            },
          },
        },
        include: {
          schedule: {
            include: {
              routePlan: true,
              weatherData: true,
              calendarEvent: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: undefined,
        skip: undefined,
      });
    });
  });

  describe("update", () => {
    it("should update summary", async () => {
      // Arrange
      const updatedSummary = {
        ...mockSummary,
        content: "Updated content",
      };
      mockPrisma.summary.update.mockResolvedValue(updatedSummary);

      const updateData: UpdateSummaryInput = {
        content: "Updated content",
      };

      // Act
      const result = await summaryRepository.update("summary-1", updateData);

      // Assert
      expect(result).toEqual(updatedSummary);
      expect(mockPrisma.summary.update).toHaveBeenCalledWith({
        where: { id: "summary-1" },
        data: updateData,
      });
    });
  });

  describe("upsertByScheduleId", () => {
    it("should upsert summary by schedule ID", async () => {
      // Arrange
      const createData: CreateSummaryInput = {
        user: { connect: { id: "user-1" } },
        schedule: { connect: { id: "schedule-1" } },
        language: "pl",
        content: "Test content",
        htmlContent: "<div>Test HTML</div>",
        timeline: [],
        weatherSummary: "15°C",
        warnings: [],
      };

      const updateData: UpdateSummaryInput = {
        content: "Updated content",
      };

      mockPrisma.summary.upsert.mockResolvedValue(mockSummary);

      // Act
      const result = await summaryRepository.upsertByScheduleId(
        "schedule-1",
        createData,
        updateData
      );

      // Assert
      expect(result).toEqual(mockSummary);
      expect(mockPrisma.summary.upsert).toHaveBeenCalledWith({
        where: { scheduleId: "schedule-1" },
        create: createData,
        update: updateData,
      });
    });
  });

  describe("delete", () => {
    it("should delete summary", async () => {
      // Arrange
      mockPrisma.summary.delete.mockResolvedValue(mockSummary);

      // Act
      const result = await summaryRepository.delete("summary-1");

      // Assert
      expect(result).toEqual(mockSummary);
      expect(mockPrisma.summary.delete).toHaveBeenCalledWith({
        where: { id: "summary-1" },
      });
    });
  });

  describe("deleteOlderThan", () => {
    it("should delete old summaries", async () => {
      // Arrange
      const deleteResult = { count: 3 };
      mockPrisma.summary.deleteMany.mockResolvedValue(deleteResult);

      const cutoffDate = new Date("2024-01-01");

      // Act
      const result = await summaryRepository.deleteOlderThan(cutoffDate);

      // Assert
      expect(result).toBe(3);
      expect(mockPrisma.summary.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
    });
  });

  describe("getStatistics", () => {
    it("should return summary statistics", async () => {
      // Arrange
      mockPrisma.summary.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(10); // recent

      mockPrisma.summary.groupBy.mockResolvedValueOnce([
        { language: "pl", _count: { language: 30 } },
        { language: "en", _count: { language: 20 } },
      ]);

      // Act
      const result = await summaryRepository.getStatistics("user-1");

      // Assert
      expect(result).toEqual({
        total: 50,
        byLanguage: {
          pl: 30,
          en: 20,
        },
        recentCount: 10,
      });
    });

    it("should apply date filters", async () => {
      // Arrange
      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-01-31");

      mockPrisma.summary.count.mockResolvedValue(25);
      mockPrisma.summary.groupBy.mockResolvedValue([]);

      // Act
      await summaryRepository.getStatistics("user-1", fromDate, toDate);

      // Assert
      expect(mockPrisma.summary.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
      });
    });
  });
});

import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { prisma } from "@/config/database";
import { ScheduleData, ScheduleDataWithRelations } from "@/types";

// Mock the database module
jest.mock("@/config/database");

describe("ScheduleDataRepository", () => {
  let scheduleDataRepository: ScheduleDataRepository;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    scheduleDataRepository = new ScheduleDataRepository();
    jest.clearAllMocks();
  });

  describe("findByEmailId", () => {
    it("should find schedule by email ID", async () => {
      const mockSchedule: ScheduleData = {
        id: "schedule-1",
        shootingDate: new Date("2024-12-01"),
        callTime: "08:00",
        location: "Test Location",
        baseLocation: "Base Location",
        sceneType: "EXT",
        scenes: ["Scene 1", "Scene 2"],
        safetyNotes: "Safety notes",
        equipment: ["Camera", "Lights"],
        contacts: [{ name: "John Doe", phone: "123-456-7890" }],
        notes: "Additional notes",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
        emailId: "email-1",
      };

      mockPrisma.scheduleData.findUnique.mockResolvedValue(mockSchedule);

      const result = await scheduleDataRepository.findByEmailId("email-1");

      expect(mockPrisma.scheduleData.findUnique).toHaveBeenCalledWith({
        where: { emailId: "email-1" },
      });
      expect(result).toEqual(mockSchedule);
    });
  });

  describe("findUpcomingSchedules", () => {
    it("should find upcoming schedules for user", async () => {
      const mockSchedules: ScheduleDataWithRelations[] = [
        {
          id: "schedule-1",
          shootingDate: new Date("2024-12-01"),
          callTime: "08:00",
          location: "Test Location",
          baseLocation: "Base Location",
          sceneType: "EXT",
          scenes: null,
          safetyNotes: null,
          equipment: null,
          contacts: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          emailId: "email-1",
          user: {
            id: "user-1",
            email: "test@example.com",
            name: "Test User",
            googleId: "google-123",
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          email: {
            id: "email-1",
            messageId: "msg-123",
            subject: "Test Schedule",
            sender: "sender@example.com",
            receivedAt: new Date(),
            threadId: null,
            processed: true,
            processingStatus: "completed",
            pdfHash: null,
            error: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: "user-1",
          },
          routePlan: null,
          weatherData: null,
          calendarEvent: null,
          summary: null,
        },
      ];

      mockPrisma.scheduleData.findMany.mockResolvedValue(mockSchedules);

      const result = await scheduleDataRepository.findUpcomingSchedules(
        "user-1",
        5
      );

      expect(mockPrisma.scheduleData.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          shootingDate: {
            gte: expect.any(Date),
          },
        },
        include: {
          user: true,
          email: true,
          routePlan: true,
          weatherData: true,
          calendarEvent: true,
        },
        orderBy: { shootingDate: "asc" },
        take: 5,
      });
      expect(result).toEqual(mockSchedules);
    });
  });

  describe("findSchedulesByDateRange", () => {
    it("should find schedules within date range", async () => {
      const startDate = new Date("2024-12-01");
      const endDate = new Date("2024-12-31");
      const mockSchedules: ScheduleDataWithRelations[] = [];

      mockPrisma.scheduleData.findMany.mockResolvedValue(mockSchedules);

      const result = await scheduleDataRepository.findSchedulesByDateRange(
        "user-1",
        startDate,
        endDate
      );

      expect(mockPrisma.scheduleData.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          shootingDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          user: true,
          email: true,
          routePlan: true,
          weatherData: true,
          calendarEvent: true,
        },
        orderBy: { shootingDate: "asc" },
      });
      expect(result).toEqual(mockSchedules);
    });
  });

  describe("getScheduleStats", () => {
    it("should return schedule statistics", async () => {
      const mockSchedules = [
        {
          sceneType: "EXT",
          shootingDate: new Date("2024-12-01"),
        },
        {
          sceneType: "INT",
          shootingDate: new Date("2024-12-15"),
        },
        {
          sceneType: "EXT",
          shootingDate: new Date("2024-11-20"),
        },
      ];

      mockPrisma.scheduleData.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2) // upcoming
        .mockResolvedValueOnce(1); // past

      mockPrisma.scheduleData.findMany.mockResolvedValue(mockSchedules);

      const result = await scheduleDataRepository.getScheduleStats("user-1");

      expect(result).toEqual({
        total: 3,
        upcoming: 2,
        past: 1,
        bySceneType: { INT: 1, EXT: 2 },
        byMonth: {
          "2024-12": 2,
          "2024-11": 1,
        },
      });
    });
  });

  describe("createWithValidation", () => {
    it("should create schedule with valid data", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const scheduleData = {
        shootingDate: tomorrow,
        callTime: "08:00",
        location: "Test Location",
        sceneType: "EXT",
        user: { connect: { id: "user-1" } },
        email: { connect: { id: "email-1" } },
      };

      const mockSchedule: ScheduleData = {
        id: "schedule-1",
        shootingDate: tomorrow,
        callTime: "08:00",
        location: "Test Location",
        sceneType: "EXT",
        userId: "user-1",
        emailId: "email-1",
        baseLocation: null,
        scenes: null,
        safetyNotes: null,
        equipment: null,
        contacts: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.scheduleData.create.mockResolvedValue(mockSchedule);

      const result = await scheduleDataRepository.createWithValidation(
        scheduleData
      );

      expect(mockPrisma.scheduleData.create).toHaveBeenCalledWith({
        data: scheduleData,
      });
      expect(result).toEqual(mockSchedule);
    });

    it("should throw error for invalid call time format", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const scheduleData = {
        shootingDate: tomorrow,
        callTime: "25:00", // Invalid time
        location: "Test Location",
        sceneType: "EXT",
        user: { connect: { id: "user-1" } },
        email: { connect: { id: "email-1" } },
      };

      await expect(
        scheduleDataRepository.createWithValidation(scheduleData)
      ).rejects.toThrow("Call time must be in HH:MM format");
    });

    it("should throw error for invalid scene type", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const scheduleData = {
        shootingDate: tomorrow,
        callTime: "08:00",
        location: "Test Location",
        sceneType: "INVALID", // Invalid scene type
        user: { connect: { id: "user-1" } },
        email: { connect: { id: "email-1" } },
      };

      await expect(
        scheduleDataRepository.createWithValidation(scheduleData)
      ).rejects.toThrow("Scene type must be either INT or EXT");
    });

    it("should throw error for shooting date too far in past", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2); // 2 days ago

      const scheduleData = {
        shootingDate: pastDate,
        callTime: "08:00",
        location: "Test Location",
        sceneType: "EXT",
        user: { connect: { id: "user-1" } },
        email: { connect: { id: "email-1" } },
      };

      await expect(
        scheduleDataRepository.createWithValidation(scheduleData)
      ).rejects.toThrow("Shooting date cannot be more than 1 day in the past");
    });
  });

  describe("findConflictingSchedules", () => {
    it("should find schedules on same date", async () => {
      const shootingDate = new Date("2024-12-01");
      const mockConflictingSchedules: ScheduleData[] = [
        {
          id: "schedule-2",
          shootingDate: new Date("2024-12-01"),
          callTime: "10:00",
          location: "Another Location",
          baseLocation: null,
          sceneType: "INT",
          scenes: null,
          safetyNotes: null,
          equipment: null,
          contacts: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          emailId: "email-2",
        },
      ];

      mockPrisma.scheduleData.findMany.mockResolvedValue(
        mockConflictingSchedules
      );

      const result = await scheduleDataRepository.findConflictingSchedules(
        "user-1",
        shootingDate,
        "08:00"
      );

      expect(mockPrisma.scheduleData.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          shootingDate: {
            gte: expect.any(Date), // Start of day
            lt: expect.any(Date), // End of day
          },
        },
      });
      expect(result).toEqual(mockConflictingSchedules);
    });
  });
});

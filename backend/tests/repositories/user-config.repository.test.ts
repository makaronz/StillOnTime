import { UserConfigRepository } from "@/repositories/user-config.repository";
import { prisma } from "@/config/database";
import { UserConfig } from "@/types";

// Mock the database module
jest.mock("@/config/database");

describe("UserConfigRepository", () => {
  let userConfigRepository: UserConfigRepository;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    userConfigRepository = new UserConfigRepository();
    jest.clearAllMocks();
  });

  describe("findByUserId", () => {
    it("should find user config by user ID", async () => {
      const mockUserConfig: UserConfig = {
        id: "config-1",
        homeAddress: "123 Main St, Warsaw",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
        userId: "user-1",
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(mockUserConfig);

      const result = await userConfigRepository.findByUserId("user-1");

      expect(mockPrisma.userConfig.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(result).toEqual(mockUserConfig);
    });

    it("should return null if user config not found", async () => {
      mockPrisma.userConfig.findUnique.mockResolvedValue(null);

      const result = await userConfigRepository.findByUserId("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("createOrUpdateForUser", () => {
    it("should update existing user config", async () => {
      const existingConfig: UserConfig = {
        id: "config-1",
        homeAddress: "123 Main St, Warsaw",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
        userId: "user-1",
      };

      const updatedConfig = {
        ...existingConfig,
        homeAddress: "456 New St, Warsaw",
        bufferTraffic: 30,
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(existingConfig);
      mockPrisma.userConfig.update.mockResolvedValue(updatedConfig);

      const result = await userConfigRepository.createOrUpdateForUser(
        "user-1",
        {
          homeAddress: "456 New St, Warsaw",
          bufferTraffic: 30,
        }
      );

      expect(mockPrisma.userConfig.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: {
          homeAddress: "456 New St, Warsaw",
          bufferTraffic: 30,
        },
      });
      expect(result).toEqual(updatedConfig);
    });

    it("should create new user config if not exists", async () => {
      const newConfig: UserConfig = {
        id: "config-1",
        homeAddress: "123 Main St, Warsaw",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
        userId: "user-1",
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(null);
      mockPrisma.userConfig.create.mockResolvedValue(newConfig);

      const result = await userConfigRepository.createOrUpdateForUser(
        "user-1",
        {
          homeAddress: "123 Main St, Warsaw",
        }
      );

      expect(mockPrisma.userConfig.create).toHaveBeenCalledWith({
        data: {
          homeAddress: "123 Main St, Warsaw",
          panavisionAddress:
            "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
          bufferCarChange: 15,
          bufferParking: 10,
          bufferEntry: 10,
          bufferTraffic: 20,
          bufferMorningRoutine: 45,
          notificationEmail: true,
          notificationSMS: false,
          notificationPush: true,
          user: { connect: { id: "user-1" } },
        },
      });
      expect(result).toEqual(newConfig);
    });
  });

  describe("validateConfig", () => {
    it("should validate valid config", () => {
      const validConfig = {
        homeAddress: "123 Main St, Warsaw",
        bufferCarChange: 15,
        notificationEmail: true,
      };

      const result = userConfigRepository.validateConfig(validConfig);

      expect(result).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it("should return errors for invalid config", () => {
      const invalidConfig = {
        homeAddress: "123", // Too short
        bufferCarChange: -5, // Negative
        bufferTraffic: 150, // Too large
        notificationEmail: "yes" as any, // Wrong type
      };

      const result = userConfigRepository.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Home address must be at least 5 characters long"
      );
      expect(result.errors).toContain(
        "bufferCarChange must be an integer between 0 and 120 minutes"
      );
      expect(result.errors).toContain(
        "bufferTraffic must be an integer between 0 and 120 minutes"
      );
      expect(result.errors).toContain(
        "notificationEmail must be a boolean value"
      );
    });

    it("should require at least one notification method", () => {
      const configWithNoNotifications = {
        notificationEmail: false,
        notificationSMS: false,
        notificationPush: false,
      };

      const result = userConfigRepository.validateConfig(
        configWithNoNotifications
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "At least one notification method must be enabled"
      );
    });
  });

  describe("getConfigWithDefaults", () => {
    it("should return user config if exists", async () => {
      const mockUserConfig: UserConfig = {
        id: "config-1",
        homeAddress: "123 Main St, Warsaw",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
        userId: "user-1",
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(mockUserConfig);

      const result = await userConfigRepository.getConfigWithDefaults("user-1");

      expect(result).toEqual(mockUserConfig);
    });

    it("should return default config if user config not exists", async () => {
      mockPrisma.userConfig.findUnique.mockResolvedValue(null);

      const result = await userConfigRepository.getConfigWithDefaults("user-1");

      expect(result.userId).toBe("user-1");
      expect(result.bufferCarChange).toBe(15);
      expect(result.notificationEmail).toBe(true);
    });
  });

  describe("updateNotificationPreferences", () => {
    it("should update notification preferences", async () => {
      const updatedConfig: UserConfig = {
        id: "config-1",
        homeAddress: "123 Main St, Warsaw",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: false,
        notificationSMS: true,
        notificationPush: true,
        userId: "user-1",
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(null);
      mockPrisma.userConfig.create.mockResolvedValue(updatedConfig);

      const result = await userConfigRepository.updateNotificationPreferences(
        "user-1",
        {
          notificationEmail: false,
          notificationSMS: true,
        }
      );

      expect(result).toEqual(updatedConfig);
    });

    it("should throw error for invalid notification preferences", async () => {
      await expect(
        userConfigRepository.updateNotificationPreferences("user-1", {
          notificationEmail: false,
          notificationSMS: false,
          notificationPush: false,
        })
      ).rejects.toThrow(
        "Invalid notification preferences: At least one notification method must be enabled"
      );
    });
  });

  describe("getTotalBufferTime", () => {
    it("should calculate total buffer time", async () => {
      const mockUserConfig: UserConfig = {
        id: "config-1",
        homeAddress: "123 Main St, Warsaw",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
        userId: "user-1",
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(mockUserConfig);

      const result = await userConfigRepository.getTotalBufferTime("user-1");

      expect(result).toBe(100); // 15 + 10 + 10 + 20 + 45 = 100
    });

    it("should use default values if config not found", async () => {
      mockPrisma.userConfig.findUnique.mockResolvedValue(null);

      const result = await userConfigRepository.getTotalBufferTime("user-1");

      expect(result).toBe(100); // Default buffer times sum
    });
  });

  describe("resetToDefaults", () => {
    it("should reset existing config to defaults", async () => {
      const existingConfig: UserConfig = {
        id: "config-1",
        homeAddress: "Custom Address",
        panavisionAddress: "Custom Panavision",
        bufferCarChange: 30,
        bufferParking: 20,
        bufferEntry: 15,
        bufferTraffic: 40,
        bufferMorningRoutine: 60,
        notificationEmail: false,
        notificationSMS: true,
        notificationPush: false,
        userId: "user-1",
      };

      const resetConfig: UserConfig = {
        ...existingConfig,
        homeAddress: "",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(existingConfig);
      mockPrisma.userConfig.update.mockResolvedValue(resetConfig);

      const result = await userConfigRepository.resetToDefaults("user-1");

      expect(mockPrisma.userConfig.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: {
          homeAddress: "",
          panavisionAddress:
            "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
          bufferCarChange: 15,
          bufferParking: 10,
          bufferEntry: 10,
          bufferTraffic: 20,
          bufferMorningRoutine: 45,
          notificationEmail: true,
          notificationSMS: false,
          notificationPush: true,
        },
      });
      expect(result).toEqual(resetConfig);
    });

    it("should create default config if not exists", async () => {
      const defaultConfig: UserConfig = {
        id: "config-1",
        homeAddress: "",
        panavisionAddress:
          "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
        userId: "user-1",
      };

      mockPrisma.userConfig.findUnique.mockResolvedValue(null);
      mockPrisma.userConfig.create.mockResolvedValue(defaultConfig);

      const result = await userConfigRepository.resetToDefaults("user-1");

      expect(mockPrisma.userConfig.create).toHaveBeenCalledWith({
        data: {
          homeAddress: "",
          panavisionAddress:
            "Panavision Warszawa, ul. Przykładowa 1, 00-001 Warszawa",
          bufferCarChange: 15,
          bufferParking: 10,
          bufferEntry: 10,
          bufferTraffic: 20,
          bufferMorningRoutine: 45,
          notificationEmail: true,
          notificationSMS: false,
          notificationPush: true,
          user: { connect: { id: "user-1" } },
        },
      });
      expect(result).toEqual(defaultConfig);
    });
  });
});

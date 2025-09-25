import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/config/database";
import { User } from "@/types";

// Mock the database module
jest.mock("@/config/database");

describe("UserRepository", () => {
  let userRepository: UserRepository;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    userRepository = new UserRepository();
    jest.clearAllMocks();
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      const mockUser: User = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-123",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenExpiry: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail("test@example.com");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findByEmail(
        "nonexistent@example.com"
      );

      expect(result).toBeNull();
    });
  });

  describe("findByGoogleId", () => {
    it("should find user by Google ID", async () => {
      const mockUser: User = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-123",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenExpiry: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findByGoogleId("google-123");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: "google-123" },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("updateTokens", () => {
    it("should update user tokens", async () => {
      const mockUser: User = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-123",
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        tokenExpiry: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(mockUser);

      const expiresAt = new Date();
      const result = await userRepository.updateTokens(
        "user-1",
        "new-access-token",
        "new-refresh-token",
        expiresAt
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          tokenExpiry: expiresAt,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("clearTokens", () => {
    it("should clear user tokens", async () => {
      const mockUser: User = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        googleId: "google-123",
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await userRepository.clearTokens("user-1");

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("createOrUpdateFromOAuth", () => {
    it("should create new user if not exists", async () => {
      const oauthData = {
        googleId: "google-123",
        email: "test@example.com",
        name: "Test User",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenExpiry: new Date(),
      };

      const mockUser: User = {
        id: "user-1",
        ...oauthData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await userRepository.createOrUpdateFromOAuth(oauthData);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ googleId: "google-123" }, { email: "test@example.com" }],
        },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: oauthData,
      });
      expect(result).toEqual(mockUser);
    });

    it("should update existing user if found", async () => {
      const oauthData = {
        googleId: "google-123",
        email: "test@example.com",
        name: "Test User",
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        tokenExpiry: new Date(),
      };

      const existingUser: User = {
        id: "user-1",
        email: "test@example.com",
        name: "Old Name",
        googleId: "google-123",
        accessToken: "old-access-token",
        refreshToken: "old-refresh-token",
        tokenExpiry: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser: User = {
        ...existingUser,
        ...oauthData,
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.createOrUpdateFromOAuth(oauthData);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          googleId: "google-123",
          email: "test@example.com",
          name: "Test User",
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          tokenExpiry: oauthData.tokenExpiry,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe("findUsersWithExpiredTokens", () => {
    it("should find users with expired tokens", async () => {
      const mockUsers: User[] = [
        {
          id: "user-1",
          email: "test1@example.com",
          name: "Test User 1",
          googleId: "google-123",
          accessToken: "expired-token",
          refreshToken: "refresh-token",
          tokenExpiry: new Date(Date.now() - 1000), // Expired
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await userRepository.findUsersWithExpiredTokens();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          tokenExpiry: {
            lt: expect.any(Date),
          },
          accessToken: {
            not: null,
          },
        },
      });
      expect(result).toEqual(mockUsers);
    });
  });
});

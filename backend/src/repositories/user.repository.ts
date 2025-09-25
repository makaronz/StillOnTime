import { prisma } from "@/config/database";
import {
  User,
  UserConfig,
  CreateUserInput,
  UpdateUserInput,
  UserWithRelations,
} from "@/types";
import { AbstractBaseRepository, FindManyOptions } from "./base.repository";

/**
 * User Repository Interface
 * Extends base repository with user-specific operations
 */
export interface IUserRepository {
  // Base CRUD operations
  create(data: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  update(id: string, data: UpdateUserInput): Promise<User>;
  delete(id: string): Promise<User>;

  // User-specific operations
  findWithRelations(id: string): Promise<UserWithRelations | null>;
  updateTokens(
    id: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<User>;
  clearTokens(id: string): Promise<User>;
  findUsersWithExpiredTokens(): Promise<User[]>;

  // OAuth-specific operations
  createOrUpdateFromOAuth(oauthData: {
    googleId: string;
    email: string;
    name?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
  }): Promise<User>;
}

/**
 * User Repository Implementation
 */
export class UserRepository
  extends AbstractBaseRepository<User, CreateUserInput, UpdateUserInput>
  implements IUserRepository
{
  protected model = prisma.user;

  /**
   * Find user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.model.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return await this.model.findUnique({
      where: { googleId },
    });
  }

  /**
   * Find user with all related data
   */
  async findWithRelations(id: string): Promise<UserWithRelations | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        processedEmails: {
          orderBy: { createdAt: "desc" },
          take: 10, // Limit to recent emails
        },
        schedules: {
          orderBy: { shootingDate: "desc" },
          include: {
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
          },
        },
        routePlans: {
          orderBy: { calculatedAt: "desc" },
        },
        weatherData: {
          orderBy: { fetchedAt: "desc" },
        },
        calendarEvents: {
          orderBy: { createdAt: "desc" },
        },
        userConfig: true,
      },
    });
  }

  /**
   * Update user's OAuth tokens
   */
  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        accessToken,
        refreshToken: refreshToken || undefined,
        tokenExpiry: expiresAt,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Clear user's OAuth tokens (logout)
   */
  async clearTokens(id: string): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find users with expired tokens for cleanup/refresh
   */
  async findUsersWithExpiredTokens(): Promise<User[]> {
    return await this.model.findMany({
      where: {
        tokenExpiry: {
          lt: new Date(),
        },
        accessToken: {
          not: null,
        },
      },
    });
  }

  /**
   * Create or update user from OAuth data
   * Used during OAuth authentication flow
   */
  async createOrUpdateFromOAuth(oauthData: {
    googleId: string;
    email: string;
    name?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
  }): Promise<User> {
    const { googleId, email, name, accessToken, refreshToken, tokenExpiry } =
      oauthData;

    // Try to find existing user by Google ID or email
    const existingUser = await this.model.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (existingUser) {
      // Update existing user
      return await this.model.update({
        where: { id: existingUser.id },
        data: {
          googleId,
          email,
          name: name || existingUser.name,
          accessToken,
          refreshToken: refreshToken || existingUser.refreshToken,
          tokenExpiry,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new user
      return await this.model.create({
        data: {
          googleId,
          email,
          name,
          accessToken,
          refreshToken,
          tokenExpiry,
        },
      });
    }
  }

  /**
   * Find user by ID with user config
   */
  async findByIdWithConfig(
    id: string
  ): Promise<(User & { userConfig: UserConfig | null }) | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        userConfig: true,
      },
    });
  }

  /**
   * Update or create user configuration
   */
  async updateUserConfig(
    userId: string,
    configData: Partial<{
      homeAddress: string;
      panavisionAddress: string;
      bufferCarChange: number;
      bufferParking: number;
      bufferEntry: number;
      bufferTraffic: number;
      bufferMorningRoutine: number;
      notificationEmail: boolean;
      notificationSMS: boolean;
      notificationPush: boolean;
      smsNumber: string | null;
      smsVerified: boolean;
      smsVerificationCode: string | null;
      smsVerificationExpiry: Date | null;
      pushToken: string | null;
      pushTokenVerified: boolean;
    }>
  ): Promise<UserConfig> {
    return await prisma.userConfig.upsert({
      where: { userId },
      update: {
        ...configData,
      },
      create: {
        userId,
        homeAddress: configData.homeAddress || "",
        panavisionAddress: configData.panavisionAddress || "",
        bufferCarChange: configData.bufferCarChange || 15,
        bufferParking: configData.bufferParking || 10,
        bufferEntry: configData.bufferEntry || 10,
        bufferTraffic: configData.bufferTraffic || 20,
        bufferMorningRoutine: configData.bufferMorningRoutine || 45,
        notificationEmail: configData.notificationEmail ?? true,
        notificationSMS: configData.notificationSMS ?? false,
        notificationPush: configData.notificationPush ?? true,
        smsNumber: configData.smsNumber,
        smsVerified: configData.smsVerified ?? false,
        smsVerificationCode: configData.smsVerificationCode,
        smsVerificationExpiry: configData.smsVerificationExpiry,
        pushToken: configData.pushToken,
        pushTokenVerified: configData.pushTokenVerified ?? false,
      },
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    totalEmails: number;
    processedEmails: number;
    totalSchedules: number;
    upcomingSchedules: number;
  }> {
    const [totalEmails, processedEmails, totalSchedules, upcomingSchedules] =
      await Promise.all([
        prisma.processedEmail.count({ where: { userId } }),
        prisma.processedEmail.count({ where: { userId, processed: true } }),
        prisma.scheduleData.count({ where: { userId } }),
        prisma.scheduleData.count({
          where: {
            userId,
            shootingDate: { gte: new Date() },
          },
        }),
      ]);

    return {
      totalEmails,
      processedEmails,
      totalSchedules,
      upcomingSchedules,
    };
  }
}

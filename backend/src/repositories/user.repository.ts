import { db } from "@/config/database";
import {
  User,
  NewUser,
  UserUpdate,
  UserConfig,
  NewUserConfig,
  UserConfigUpdate,
} from "@/config/database-types";
import { sql } from "kysely";

/**
 * User Repository with Kysely
 */
export class UserRepository {
  /**
   * Find user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    return user || null;
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("googleId", "=", googleId)
      .executeTakeFirst();

    return user || null;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return user || null;
  }

  /**
   * Find user with all related data (alias for findByIdWithConfig)
   */
  async findWithRelations(id: string): Promise<any | null> {
    return await this.findByIdWithConfig(id);
  }

  /**
   * Find user by ID with user config
   */
  async findByIdWithConfig(
    id: string
  ): Promise<(User & { userConfig: UserConfig | null }) | null> {
    const user = await db
      .selectFrom("users")
      .leftJoin("user_configs", "users.id", "user_configs.userId")
      .selectAll("users")
      .select([
        "user_configs.id as userConfigId",
        "user_configs.homeAddress",
        "user_configs.panavisionAddress",
        "user_configs.bufferCarChange",
        "user_configs.bufferParking",
        "user_configs.bufferEntry",
        "user_configs.bufferTraffic",
        "user_configs.bufferMorningRoutine",
        "user_configs.notificationEmail",
        "user_configs.notificationSMS",
        "user_configs.notificationPush",
        "user_configs.smsNumber",
        "user_configs.smsVerified",
        "user_configs.smsVerificationCode",
        "user_configs.smsVerificationExpiry",
        "user_configs.pushToken",
        "user_configs.pushTokenVerified",
        "user_configs.userId as userConfigUserId",
      ])
      .where("users.id", "=", id)
      .executeTakeFirst();

    if (!user) return null;

    const userConfig = user.userConfigId
      ? ({
          id: user.userConfigId,
          homeAddress: user.homeAddress!,
          panavisionAddress: user.panavisionAddress!,
          bufferCarChange: user.bufferCarChange!,
          bufferParking: user.bufferParking!,
          bufferEntry: user.bufferEntry!,
          bufferTraffic: user.bufferTraffic!,
          bufferMorningRoutine: user.bufferMorningRoutine!,
          notificationEmail: user.notificationEmail!,
          notificationSMS: user.notificationSMS!,
          notificationPush: user.notificationPush!,
          smsNumber: user.smsNumber!,
          smsVerified: user.smsVerified!,
          smsVerificationCode: user.smsVerificationCode!,
          smsVerificationExpiry: user.smsVerificationExpiry!,
          pushToken: user.pushToken!,
          pushTokenVerified: user.pushTokenVerified!,
          userId: user.userConfigUserId!,
        } as UserConfig)
      : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      googleId: user.googleId,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      tokenExpiry: user.tokenExpiry,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userConfig,
    };
  }

  /**
   * Create user
   */
  async create(data: {
    email: string;
    googleId: string;
    name?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
  }): Promise<User> {
    const id = this.generateCuid();

    const user = await db
      .insertInto("users")
      .values({
        id,
        email: data.email,
        googleId: data.googleId,
        name: data.name || null,
        accessToken: data.accessToken || null,
        refreshToken: data.refreshToken || null,
        tokenExpiry: data.tokenExpiry || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
  }

  /**
   * Update user
   */
  async update(id: string, data: UserUpdate): Promise<User> {
    const user = await db
      .updateTable("users")
      .set({ ...data, updatedAt: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
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
    const user = await db
      .updateTable("users")
      .set({
        accessToken,
        refreshToken: refreshToken || null,
        tokenExpiry: expiresAt || null,
        updatedAt: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
  }

  /**
   * Clear user's OAuth tokens (logout)
   */
  async clearTokens(id: string): Promise<User> {
    const user = await db
      .updateTable("users")
      .set({
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        updatedAt: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
  }

  /**
   * Find users with expired tokens for cleanup/refresh
   */
  async findUsersWithExpiredTokens(): Promise<User[]> {
    const users = await db
      .selectFrom("users")
      .selectAll()
      .where("tokenExpiry", "<", new Date())
      .where("accessToken", "is not", null)
      .execute();

    return users;
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

    // Check if user exists
    const existingUser = await this.findByGoogleId(googleId);

    if (existingUser) {
      // Update existing user
      return await this.update(existingUser.id, {
        email,
        name: name || null,
        accessToken,
        refreshToken: refreshToken || null,
        tokenExpiry: tokenExpiry || null,
      });
    } else {
      // Create new user
      return await this.create({
        googleId,
        email,
        name,
        accessToken,
        refreshToken,
        tokenExpiry,
      });
    }
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
    // Check if config exists
    const existingConfig = await db
      .selectFrom("user_configs")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (existingConfig) {
      // Update existing config
      const config = await db
        .updateTable("user_configs")
        .set(configData)
        .where("userId", "=", userId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return config;
    } else {
      // Create new config
      const id = this.generateCuid();

      const config = await db
        .insertInto("user_configs")
        .values({
          id,
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
          smsNumber: configData.smsNumber || null,
          smsVerified: configData.smsVerified ?? false,
          smsVerificationCode: configData.smsVerificationCode || null,
          smsVerificationExpiry: configData.smsVerificationExpiry || null,
          pushToken: configData.pushToken || null,
          pushTokenVerified: configData.pushTokenVerified ?? false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return config;
    }
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
    const stats = await db
      .selectFrom("users")
      .select([
        (eb) =>
          eb
            .selectFrom("processed_emails")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .whereRef("processed_emails.userId", "=", "users.id")
            .as("totalEmails"),
        (eb) =>
          eb
            .selectFrom("processed_emails")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .whereRef("processed_emails.userId", "=", "users.id")
            .where("processed_emails.processed", "=", true)
            .as("processedEmails"),
        (eb) =>
          eb
            .selectFrom("schedule_data")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .whereRef("schedule_data.userId", "=", "users.id")
            .as("totalSchedules"),
        (eb) =>
          eb
            .selectFrom("schedule_data")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .whereRef("schedule_data.userId", "=", "users.id")
            .where("schedule_data.shootingDate", ">=", new Date())
            .as("upcomingSchedules"),
      ])
      .where("users.id", "=", userId)
      .executeTakeFirstOrThrow();

    return {
      totalEmails: Number(stats.totalEmails),
      processedEmails: Number(stats.processedEmails),
      totalSchedules: Number(stats.totalSchedules),
      upcomingSchedules: Number(stats.upcomingSchedules),
    };
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<User> {
    const user = await db
      .deleteFrom("users")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
  }

  /**
   * Find all users
   */
  async findAll(): Promise<User[]> {
    const users = await db
      .selectFrom("users")
      .selectAll()
      .orderBy("createdAt", "desc")
      .execute();

    return users;
  }

  /**
   * Generate CUID for primary keys
   * Simple implementation - replace with proper cuid library if needed
   */
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }
}

// Export a ready-to-use singleton instance
export const userRepository = new UserRepository();

// Also export as default for flexibility
export default UserRepository;

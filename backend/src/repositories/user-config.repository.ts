import { db } from "@/config/database";
import {
  UserConfig,
  NewUserConfig,
  UserConfigUpdate,
} from "@/config/database-types";

/**
 * UserConfig Repository Interface
 */
export interface IUserConfigRepository {
  // Base CRUD operations
  create(data: Partial<NewUserConfig>): Promise<UserConfig>;
  findById(id: string): Promise<UserConfig | null>;
  update(id: string, data: UserConfigUpdate): Promise<UserConfig>;
  delete(id: string): Promise<UserConfig>;

  // UserConfig-specific operations
  findByUserId(userId: string): Promise<UserConfig | null>;
  createOrUpdateForUser(
    userId: string,
    configData: Partial<UserConfig>
  ): Promise<UserConfig>;
  getDefaultConfig(): UserConfig;
  validateConfig(config: Partial<UserConfig>): {
    isValid: boolean;
    errors: string[];
  };
}

/**
 * UserConfig Repository Implementation with Kysely
 */
export class UserConfigRepository implements IUserConfigRepository {
  /**
   * Create user configuration
   */
  async create(data: Partial<NewUserConfig>): Promise<UserConfig> {
    const id = this.generateCuid();

    const config = await db
      .insertInto("user_configs")
      .values({
        id,
        userId: data.userId!,
        homeAddress: data.homeAddress || "",
        panavisionAddress:
          data.panavisionAddress ||
          "Panavision Office, 123 Example St, Los Angeles, CA 90028",
        bufferCarChange: data.bufferCarChange ?? 15,
        bufferParking: data.bufferParking ?? 10,
        bufferEntry: data.bufferEntry ?? 10,
        bufferTraffic: data.bufferTraffic ?? 20,
        bufferMorningRoutine: data.bufferMorningRoutine ?? 45,
        notificationEmail: data.notificationEmail ?? true,
        notificationSMS: data.notificationSMS ?? false,
        notificationPush: data.notificationPush ?? true,
        smsNumber: data.smsNumber || null,
        smsVerified: data.smsVerified ?? false,
        smsVerificationCode: data.smsVerificationCode || null,
        smsVerificationExpiry: data.smsVerificationExpiry || null,
        pushToken: data.pushToken || null,
        pushTokenVerified: data.pushTokenVerified ?? false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return config;
  }

  /**
   * Find user configuration by ID
   */
  async findById(id: string): Promise<UserConfig | null> {
    const config = await db
      .selectFrom("user_configs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return config || null;
  }

  /**
   * Update user configuration
   */
  async update(id: string, data: UserConfigUpdate): Promise<UserConfig> {
    const config = await db
      .updateTable("user_configs")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return config;
  }

  /**
   * Delete user configuration
   */
  async delete(id: string): Promise<UserConfig> {
    const config = await db
      .deleteFrom("user_configs")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return config;
  }

  /**
   * Find user configuration by user ID
   */
  async findByUserId(userId: string): Promise<UserConfig | null> {
    const config = await db
      .selectFrom("user_configs")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst();

    return config || null;
  }

  /**
   * Create or update user configuration
   */
  async createOrUpdateForUser(
    userId: string,
    configData: Partial<UserConfig>
  ): Promise<UserConfig> {
    const existingConfig = await this.findByUserId(userId);

    if (existingConfig) {
      return await db
        .updateTable("user_configs")
        .set(configData)
        .where("userId", "=", userId)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      const id = this.generateCuid();

      return await db
        .insertInto("user_configs")
        .values({
          id,
          userId,
          ...this.getDefaultConfigData(),
          ...configData,
        } as NewUserConfig)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  }

  /**
   * Get default configuration values
   */
  getDefaultConfig(): UserConfig {
    return {
      id: "",
      homeAddress: "",
      panavisionAddress:
        "Panavision Office, 123 Example St, Los Angeles, CA 90028",
      bufferCarChange: 15,
      bufferParking: 10,
      bufferEntry: 10,
      bufferTraffic: 20,
      bufferMorningRoutine: 45,
      notificationEmail: true,
      notificationSMS: false,
      notificationPush: true,
      smsNumber: null,
      smsVerified: false,
      smsVerificationCode: null,
      smsVerificationExpiry: null,
      pushToken: null,
      pushTokenVerified: false,
      userId: "",
    };
  }

  /**
   * Get default configuration data for creation
   */
  private getDefaultConfigData() {
    return {
      homeAddress: "",
      panavisionAddress:
        "Panavision Office, 123 Example St, Los Angeles, CA 90028",
      bufferCarChange: 15,
      bufferParking: 10,
      bufferEntry: 10,
      bufferTraffic: 20,
      bufferMorningRoutine: 45,
      notificationEmail: true,
      notificationSMS: false,
      notificationPush: true,
      smsNumber: null,
      smsVerified: false,
      smsVerificationCode: null,
      smsVerificationExpiry: null,
      pushToken: null,
      pushTokenVerified: false,
    };
  }

  /**
   * Validate user configuration
   */
  validateConfig(config: Partial<UserConfig>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate addresses
    if (
      config.homeAddress !== undefined &&
      config.homeAddress.trim().length < 5
    ) {
      errors.push("Home address must be at least 5 characters long");
    }

    if (
      config.panavisionAddress !== undefined &&
      config.panavisionAddress.trim().length < 5
    ) {
      errors.push("Panavision address must be at least 5 characters long");
    }

    // Validate buffer times (must be positive integers)
    const bufferFields = [
      "bufferCarChange",
      "bufferParking",
      "bufferEntry",
      "bufferTraffic",
      "bufferMorningRoutine",
    ] as const;

    bufferFields.forEach((field) => {
      const value = config[field];
      if (value !== undefined) {
        if (!Number.isInteger(value) || value < 0 || value > 120) {
          errors.push(`${field} must be an integer between 0 and 120 minutes`);
        }
      }
    });

    // Validate notification preferences (must be boolean)
    const notificationFields = [
      "notificationEmail",
      "notificationSMS",
      "notificationPush",
    ] as const;

    notificationFields.forEach((field) => {
      const value = config[field];
      if (value !== undefined && typeof value !== "boolean") {
        errors.push(`${field} must be a boolean value`);
      }
    });

    // Ensure at least one notification method is enabled
    if (
      config.notificationEmail === false &&
      config.notificationSMS === false &&
      config.notificationPush === false
    ) {
      errors.push("At least one notification method must be enabled");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get user configuration with defaults
   * Returns user config if exists, otherwise returns default config
   */
  async getConfigWithDefaults(userId: string): Promise<UserConfig> {
    const userConfig = await this.findByUserId(userId);

    if (userConfig) {
      return userConfig;
    }

    // Return default config with user ID
    return {
      ...this.getDefaultConfig(),
      userId,
    };
  }

  /**
   * Update specific buffer settings
   */
  async updateBuffers(
    userId: string,
    buffers: {
      bufferCarChange?: number;
      bufferParking?: number;
      bufferEntry?: number;
      bufferTraffic?: number;
      bufferMorningRoutine?: number;
    }
  ): Promise<UserConfig> {
    return await this.createOrUpdateForUser(userId, buffers);
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      notificationEmail?: boolean;
      notificationSMS?: boolean;
      notificationPush?: boolean;
    }
  ): Promise<UserConfig> {
    const validation = this.validateConfig(preferences);
    if (!validation.isValid) {
      throw new Error(
        `Invalid notification preferences: ${validation.errors.join(", ")}`
      );
    }

    return await this.createOrUpdateForUser(userId, preferences);
  }

  /**
   * Update addresses
   */
  async updateAddresses(
    userId: string,
    addresses: {
      homeAddress?: string;
      panavisionAddress?: string;
    }
  ): Promise<UserConfig> {
    const validation = this.validateConfig(addresses);
    if (!validation.isValid) {
      throw new Error(`Invalid addresses: ${validation.errors.join(", ")}`);
    }

    return await this.createOrUpdateForUser(userId, addresses);
  }

  /**
   * Get total buffer time for a user
   */
  async getTotalBufferTime(userId: string): Promise<number> {
    const config = await this.getConfigWithDefaults(userId);

    return (
      config.bufferCarChange +
      config.bufferParking +
      config.bufferEntry +
      config.bufferTraffic +
      config.bufferMorningRoutine
    );
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(userId: string): Promise<UserConfig> {
    const existingConfig = await this.findByUserId(userId);

    if (existingConfig) {
      return await db
        .updateTable("user_configs")
        .set(this.getDefaultConfigData())
        .where("userId", "=", userId)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      const id = this.generateCuid();

      return await db
        .insertInto("user_configs")
        .values({
          id,
          userId,
          ...this.getDefaultConfigData(),
        } as NewUserConfig)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  }

  /**
   * Generate CUID for primary keys
   */
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }
}

// Export a ready-to-use singleton instance
export const userConfigRepository = new UserConfigRepository();

// Also export as default for flexibility
export default UserConfigRepository;

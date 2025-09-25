import { prisma } from "@/config/database";
import {
  UserConfig,
  CreateUserConfigInput,
  UpdateUserConfigInput,
} from "@/types";
import { AbstractBaseRepository } from "./base.repository";

/**
 * UserConfig Repository Interface
 */
export interface IUserConfigRepository {
  // Base CRUD operations
  create(data: CreateUserConfigInput): Promise<UserConfig>;
  findById(id: string): Promise<UserConfig | null>;
  update(id: string, data: UpdateUserConfigInput): Promise<UserConfig>;
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
 * UserConfig Repository Implementation
 */
export class UserConfigRepository
  extends AbstractBaseRepository<
    UserConfig,
    CreateUserConfigInput,
    UpdateUserConfigInput
  >
  implements IUserConfigRepository
{
  protected model = prisma.userConfig;

  /**
   * Find user configuration by user ID
   */
  async findByUserId(userId: string): Promise<UserConfig | null> {
    return await this.model.findUnique({
      where: { userId },
    });
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
      return await this.model.update({
        where: { userId },
        data: configData,
      });
    } else {
      return await this.model.create({
        data: {
          ...this.getDefaultConfigData(),
          ...configData,
          user: { connect: { id: userId } },
        } as any,
      });
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
      return await this.model.update({
        where: { userId },
        data: this.getDefaultConfigData(),
      });
    } else {
      return await this.model.create({
        data: {
          ...this.getDefaultConfigData(),
          user: { connect: { id: userId } },
        } as any,
      });
    }
  }
}

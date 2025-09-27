import { Request, Response } from "express";
import { UserRepository } from "@/repositories/user.repository";
import { UserConfigRepository } from "@/repositories/user-config.repository";
import { logger } from "@/utils/logger";
import { services } from "@/services";

/**
 * User Controller
 * Handles user profile and configuration management
 */
export class UserController {
  private userRepository: UserRepository;
  private userConfigRepository: UserConfigRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.userConfigRepository = new UserConfigRepository();
  }

  /**
   * Get user profile with statistics
   * GET /api/user/profile
   * @param req Express Request object
   * @param res Express Response object
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const user = await this.userRepository.findWithRelations(req.user.userId);

      if (!user) {
        res.status(404).json({
          error: "Not Found",
          message: "User profile not found",
          code: "PROFILE_NOT_FOUND",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Get user statistics
      const stats = await this.userRepository.getUserStats(req.user.userId);

      // Get OAuth status
      const oauthStatus = await services.oauth2.getOAuthStatus(req.user.userId);

      res.json({
        success: true,
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        statistics: stats,
        oauth: oauthStatus,
        recentActivity: {
          emails: user.processedEmails.slice(0, 5).map((email) => ({
            id: email.id,
            subject: email.subject,
            sender: email.sender,
            receivedAt: email.receivedAt,
            processed: email.processed,
            processingStatus: email.processingStatus,
          })),
          schedules: user.schedules.slice(0, 5).map((schedule) => ({
            id: schedule.id,
            shootingDate: schedule.shootingDate,
            callTime: schedule.callTime,
            location: schedule.location,
            sceneType: schedule.sceneType,
          })),
        },
      });
    } catch (error) {
      logger.error("Failed to get user profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get user profile",
        code: "PROFILE_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Update user profile information
   * PUT /api/user/profile
   * @param req Express Request object
   * @param res Express Response object
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({
          error: "Bad Request",
          message: "Name is required and must be a non-empty string",
          code: "INVALID_NAME",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const updatedUser = await this.userRepository.update(req.user.userId, {
        name: name.trim(),
      });

      logger.info("User profile updated", {
        userId: req.user.userId,
        email: req.user.email,
      });

      res.json({
        success: true,
        profile: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          updatedAt: updatedUser.updatedAt,
        },
        message: "Profile updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update user profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update profile",
        code: "PROFILE_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Get user configuration
   * GET /api/user/config
   * @param req Express Request object
   * @param res Express Response object
   */
  async getConfiguration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const config = await this.userConfigRepository.getConfigWithDefaults(
        req.user.userId
      );

      res.json({
        success: true,
        configuration: config,
      });
    } catch (error) {
      logger.error("Failed to get user configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to get configuration",
        code: "CONFIG_FETCH_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Update user configuration
   * PUT /api/user/config
   * @param req Express Request object
   * @param res Express Response object
   */
  async updateConfiguration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const configData = req.body;

      // Validate configuration
      const validation = this.userConfigRepository.validateConfig(configData);
      if (!validation.isValid) {
        res.status(400).json({
          error: "Bad Request",
          message: "Invalid configuration data",
          code: "INVALID_CONFIG",
          timestamp: new Date().toISOString(),
          path: req.path,
          details: validation.errors,
        });
        return;
      }

      const updatedConfig =
        await this.userConfigRepository.upsert(req.user.userId, configData);

      logger.info("User configuration updated", {
        userId: req.user.userId,
        email: req.user.email,
        updatedFields: Object.keys(configData),
      });

      res.json({
        success: true,
        configuration: updatedConfig,
        message: "Configuration updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update user configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update configuration",
        code: "CONFIG_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Update user addresses
   * PUT /api/user/config/addresses
   * @param req Express Request object
   * @param res Express Response object
   */
  async updateAddresses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { homeAddress, panavisionAddress } = req.body;

      const addresses: any = {};
      if (homeAddress !== undefined) addresses.homeAddress = homeAddress;
      if (panavisionAddress !== undefined)
        addresses.panavisionAddress = panavisionAddress;

      if (Object.keys(addresses).length === 0) {
        res.status(400).json({
          error: "Bad Request",
          message: "At least one address field is required",
          code: "NO_ADDRESS_DATA",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Validate addresses using Google Maps if available
      if (homeAddress && services.googleMaps) {
        try {
          await services.googleMaps.geocodeAddress(homeAddress);
        } catch (error) {
          res.status(400).json({
            error: "Bad Request",
            message: "Home address could not be validated",
            code: "INVALID_HOME_ADDRESS",
            timestamp: new Date().toISOString(),
            path: req.path,
          });
          return;
        }
      }

      if (panavisionAddress && services.googleMaps) {
        try {
          await services.googleMaps.geocodeAddress(panavisionAddress);
        } catch (error) {
          res.status(400).json({
            error: "Bad Request",
            message: "Panavision address could not be validated",
            code: "INVALID_PANAVISION_ADDRESS",
            timestamp: new Date().toISOString(),
            path: req.path,
          });
          return;
        }
      }

      const updatedConfig = await this.userConfigRepository.updateAddresses(
        req.user.userId,
        addresses
      );

      logger.info("User addresses updated", {
        userId: req.user.userId,
        email: req.user.email,
        updatedAddresses: Object.keys(addresses),
      });

      res.json({
        success: true,
        configuration: updatedConfig,
        message: "Addresses updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update user addresses", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update addresses",
        code: "ADDRESS_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Update time buffers
   * PUT /api/user/config/buffers
   * @param req Express Request object
   * @param res Express Response object
   */
  async updateBuffers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const {
        preparationTime,
        bufferCarChange,
        bufferParking,
        bufferEntry,
        bufferTraffic,
        bufferMorningRoutine,
      } = req.body;

      const buffers: any = {};
      if (bufferCarChange !== undefined)
        buffers.bufferCarChange = bufferCarChange;
      if (bufferParking !== undefined) buffers.bufferParking = bufferParking;
      if (bufferEntry !== undefined) buffers.bufferEntry = bufferEntry;
      if (bufferTraffic !== undefined) buffers.bufferTraffic = bufferTraffic;
      if (bufferMorningRoutine !== undefined)
        buffers.bufferMorningRoutine = bufferMorningRoutine;

      if (Object.keys(buffers).length === 0) {
        res.status(400).json({
          error: "Bad Request",
          message: "At least one buffer field is required",
          code: "NO_BUFFER_DATA",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const updatedConfig = await this.userConfigRepository.updateBuffers(
        req.user.userId,
        buffers
      );

      logger.info("User buffers updated", {
        userId: req.user.userId,
        email: req.user.email,
        updatedBuffers: Object.keys(buffers),
      });

      res.json({
        success: true,
        configuration: updatedConfig,
        message: "Time buffers updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update user buffers", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update time buffers",
        code: "BUFFER_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Update notification preferences
   * PUT /api/user/config/notifications
   * @param req Express Request object
   * @param res Express Response object
   */
  async updateNotificationPreferences(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { notificationEmail, notificationSMS, notificationPush } = req.body;

      const preferences: any = {};
      if (notificationEmail !== undefined)
        preferences.notificationEmail = notificationEmail;
      if (notificationSMS !== undefined)
        preferences.notificationSMS = notificationSMS;
      if (notificationPush !== undefined)
        preferences.notificationPush = notificationPush;

      if (Object.keys(preferences).length === 0) {
        res.status(400).json({
          error: "Bad Request",
          message: "At least one notification preference is required",
          code: "NO_NOTIFICATION_DATA",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const updatedConfig =
        await this.userConfigRepository.updateNotificationPreferences(
          req.user.userId,
          preferences
        );

      logger.info("User notification preferences updated", {
        userId: req.user.userId,
        email: req.user.email,
        updatedPreferences: Object.keys(preferences),
      });

      res.json({
        success: true,
        configuration: updatedConfig,
        message: "Notification preferences updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update notification preferences", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update notification preferences",
        code: "NOTIFICATION_UPDATE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Reset configuration to defaults
   * POST /api/user/config/reset
   * @param req Express Request object
   * @param res Express Response object
   */
  async resetConfiguration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const defaultConfig = await this.userConfigRepository.resetToDefaults(
        req.user.userId
      );

      logger.info("User configuration reset to defaults", {
        userId: req.user.userId,
        email:	req.user.email,
      });

      res.json({
        success: true,
        configuration: defaultConfig,
        message: "Configuration reset to defaults successfully",
      });
    } catch (error) {
      logger.error("Failed to reset user configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to reset configuration",
        code: "CONFIG_RESET_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }

  /**
   * Delete user account and all associated data
   * DELETE /api/user/account
   * @param req Express Request object
   * @param res Express Response object
   */
  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { confirmEmail } = req.body;

      if (confirmEmail !== req.user.email) {
        res.status(400).json({
          error: "Bad Request",
          message: "Email confirmation does not match",
          code: "EMAIL_MISMATCH",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Revoke OAuth tokens first
      try {
        await services.oauth2.revokeTokens(req.user.userId);
      } catch (error) {
        logger.warn("Failed to revoke OAuth tokens during account deletion", {
          error: error instanceof Error ? error.message : "Unknown error",
          userId: req.user.userId,
        });
      }

      // Delete user account (cascade will handle related data)
      await this.userRepository.delete(req.user.userId);

      logger.info("User account deleted", {
        userId: req.user.userId,
        email: req.user.email,
      });

      res.json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      logger.error("Failed to delete user account", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user ? req.user.userId : undefined,
      });

      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete account",
        code: "ACCOUNT_DELETE_FAILED",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }
}

// Export singleton instance
export const userController = new UserController();

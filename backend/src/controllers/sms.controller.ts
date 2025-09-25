import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { NotificationService } from "../services/notification.service";
import { UserRepository } from "../repositories/user.repository";
import { logger } from "../utils/logger";

export class SMSController {
  constructor(
    private notificationService: NotificationService,
    private userRepository: UserRepository
  ) {}

  /**
   * Validation rules for SMS configuration
   */
  static validateSMSConfig = [
    body("smsNumber")
      .notEmpty()
      .withMessage("SMS number is required")
      .matches(/^(\+\d{1,3}[- ]?)?\d{8,15}$/)
      .withMessage("Invalid phone number format"),
    body("enabled").isBoolean().withMessage("Enabled must be a boolean"),
  ];

  /**
   * Configure SMS settings for user
   */
  configureSMS = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: "Validation failed",
          message: "Invalid SMS configuration data",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
          details: errors.array(),
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: "Unauthorized",
          message: "User not authenticated",
          code: "AUTH_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const { smsNumber, enabled } = req.body;

      // Validate SMS service configuration
      const serviceTest = await this.notificationService.testSMSService();
      if (!serviceTest.isConfigured) {
        res.status(503).json({
          error: "Service unavailable",
          message: "SMS service is not configured",
          code: "SMS_SERVICE_NOT_CONFIGURED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Update user configuration
      await this.userRepository.updateUserConfig(userId, {
        smsNumber: enabled ? smsNumber : null,
        notificationSMS: enabled,
        smsVerified: false, // Reset verification when number changes
        smsVerificationCode: null,
        smsVerificationExpiry: null,
      });

      // If enabling SMS, send verification code
      let verificationSent = false;
      if (enabled && smsNumber) {
        try {
          await this.sendVerificationCode(userId, smsNumber);
          verificationSent = true;
        } catch (error) {
          logger.error("Failed to send SMS verification code", {
            userId,
            error: error.message,
            functionName: "SMSController.configureSMS",
          });
        }
      }

      logger.info("SMS configuration updated", {
        userId,
        enabled,
        verificationSent,
        functionName: "SMSController.configureSMS",
      });

      res.status(200).json({
        success: true,
        message: enabled
          ? "SMS configuration updated. Verification code sent."
          : "SMS notifications disabled",
        verificationRequired: enabled && !verificationSent ? false : enabled,
        verificationSent,
      });
    } catch (error) {
      logger.error("Failed to configure SMS", {
        userId: req.user?.id,
        error: error.message,
        functionName: "SMSController.configureSMS",
      });

      res.status(500).json({
        error: "Internal server error",
        message: "Failed to configure SMS settings",
        code: "SMS_CONFIG_ERROR",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  };

  /**
   * Send SMS verification code
   */
  sendVerificationCode = async (
    userId: string,
    phoneNumber: string
  ): Promise<void> => {
    // Generate 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification code in database
    await this.userRepository.updateUserConfig(userId, {
      smsVerificationCode: verificationCode,
      smsVerificationExpiry: expiryTime,
    });

    // Send SMS with verification code
    const message = `StillOnTime: Twój kod weryfikacyjny to ${verificationCode}. Kod wygasa za 10 minut.`;

    const result = await this.notificationService.sendNotification(
      userId,
      "system_alert",
      { message },
      ["sms"]
    );

    if (!result || result.length === 0) {
      throw new Error("Failed to send verification SMS");
    }
  };

  /**
   * Verify SMS code
   */
  verifySMS = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: "Unauthorized",
          message: "User not authenticated",
          code: "AUTH_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      if (!code || code.length !== 6) {
        res.status(400).json({
          error: "Validation failed",
          message: "Verification code must be 6 digits",
          code: "INVALID_CODE",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const userWithConfig = await this.userRepository.findByIdWithConfig(
        userId
      );
      const userConfig = userWithConfig?.userConfig;

      if (
        !userConfig?.smsVerificationCode ||
        !userConfig?.smsVerificationExpiry
      ) {
        res.status(400).json({
          error: "Verification failed",
          message: "No verification code found. Please request a new code.",
          code: "NO_VERIFICATION_CODE",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Check if code has expired
      if (new Date() > userConfig.smsVerificationExpiry) {
        res.status(400).json({
          error: "Verification failed",
          message: "Verification code has expired. Please request a new code.",
          code: "CODE_EXPIRED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Verify code
      if (userConfig.smsVerificationCode !== code) {
        res.status(400).json({
          error: "Verification failed",
          message: "Invalid verification code",
          code: "INVALID_CODE",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Mark SMS as verified
      await this.userRepository.updateUserConfig(userId, {
        smsVerified: true,
        smsVerificationCode: null,
        smsVerificationExpiry: null,
      });

      logger.info("SMS verification successful", {
        userId,
        functionName: "SMSController.verifySMS",
      });

      res.status(200).json({
        success: true,
        message: "SMS number verified successfully",
        verified: true,
      });
    } catch (error) {
      logger.error("Failed to verify SMS", {
        userId: req.user?.id,
        error: error.message,
        functionName: "SMSController.verifySMS",
      });

      res.status(500).json({
        error: "Internal server error",
        message: "Failed to verify SMS code",
        code: "SMS_VERIFICATION_ERROR",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  };

  /**
   * Resend verification code
   */
  resendVerificationCode = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: "Unauthorized",
          message: "User not authenticated",
          code: "AUTH_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const userWithConfig = await this.userRepository.findByIdWithConfig(
        userId
      );
      const smsNumber = userWithConfig?.userConfig?.smsNumber;

      if (!smsNumber) {
        res.status(400).json({
          error: "Configuration error",
          message: "No SMS number configured",
          code: "NO_SMS_NUMBER",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      await this.sendVerificationCode(userId, smsNumber);

      logger.info("SMS verification code resent", {
        userId,
        functionName: "SMSController.resendVerificationCode",
      });

      res.status(200).json({
        success: true,
        message: "Verification code sent",
      });
    } catch (error) {
      logger.error("Failed to resend verification code", {
        userId: req.user?.id,
        error: error.message,
        functionName: "SMSController.resendVerificationCode",
      });

      res.status(500).json({
        error: "Internal server error",
        message: "Failed to resend verification code",
        code: "SMS_RESEND_ERROR",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  };

  /**
   * Get SMS configuration status
   */
  getSMSStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: "Unauthorized",
          message: "User not authenticated",
          code: "AUTH_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const [validation, serviceTest, userWithConfig] = await Promise.all([
        this.notificationService.validateSMSConfiguration(userId),
        this.notificationService.testSMSService(),
        this.userRepository.findByIdWithConfig(userId),
      ]);

      const userConfig = userWithConfig?.userConfig;

      res.status(200).json({
        enabled: userConfig?.notificationSMS || false,
        configured: validation.isValid,
        verified: userConfig?.smsVerified || false,
        hasPhoneNumber: validation.hasPhoneNumber,
        phoneNumber: userConfig?.smsNumber
          ? userConfig.smsNumber.replace(/\d(?=\d{4})/g, "*")
          : null,
        serviceConfigured: serviceTest.isConfigured,
        pendingVerification: !!(
          userConfig?.smsVerificationCode && userConfig?.smsVerificationExpiry
        ),
        accountInfo: serviceTest.accountInfo,
      });
    } catch (error) {
      logger.error("Failed to get SMS status", {
        userId: req.user?.id,
        error: error.message,
        functionName: "SMSController.getSMSStatus",
      });

      res.status(500).json({
        error: "Internal server error",
        message: "Failed to get SMS status",
        code: "SMS_STATUS_ERROR",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  };

  /**
   * Test SMS delivery
   */
  testSMS = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: "Unauthorized",
          message: "User not authenticated",
          code: "AUTH_ERROR",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      const validation =
        await this.notificationService.validateSMSConfiguration(userId);
      if (!validation.isValid) {
        res.status(400).json({
          error: "Configuration error",
          message: "SMS not properly configured or verified",
          code: "SMS_NOT_CONFIGURED",
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      // Send test notification
      const testMessage =
        "StillOnTime: Test wiadomości SMS. Twoja konfiguracja działa poprawnie!";
      const result = await this.notificationService.sendNotification(
        userId,
        "system_alert",
        { message: testMessage },
        ["sms"]
      );

      logger.info("Test SMS sent", {
        userId,
        notificationIds: result,
        functionName: "SMSController.testSMS",
      });

      res.status(200).json({
        success: true,
        message: "Test SMS sent successfully",
        notificationIds: result,
      });
    } catch (error) {
      logger.error("Failed to send test SMS", {
        userId: req.user?.id,
        error: error.message,
        functionName: "SMSController.testSMS",
      });

      res.status(500).json({
        error: "Internal server error",
        message: "Failed to send test SMS",
        code: "SMS_TEST_ERROR",
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  };

  /**
   * Handle Twilio webhook for delivery status updates
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

      if (!MessageSid || !MessageStatus) {
        res.status(400).json({
          error: "Invalid webhook data",
          message: "Missing required fields",
        });
        return;
      }

      // Find notification by message ID
      const notification =
        await this.notificationService.notificationRepository.findByMessageId(
          MessageSid
        );

      if (notification) {
        let status: "sent" | "delivered" | "failed";

        switch (MessageStatus) {
          case "delivered":
            status = "delivered";
            break;
          case "sent":
          case "queued":
            status = "sent";
            break;
          case "failed":
          case "undelivered":
            status = "failed";
            break;
          default:
            status = "sent";
        }

        await this.notificationService.updateDeliveryStatus(
          notification.id,
          status,
          ErrorMessage
        );

        logger.info("SMS delivery status updated via webhook", {
          messageId: MessageSid,
          status: MessageStatus,
          notificationId: notification.id,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Failed to handle SMS webhook", {
        error: error.message,
        functionName: "SMSController.handleWebhook",
      });

      res.status(500).json({
        error: "Webhook processing failed",
        message: error.message,
      });
    }
  };
}

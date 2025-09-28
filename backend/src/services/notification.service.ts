import nodemailer from "nodemailer";
import {
  Notification,
  NotificationChannel,
  NotificationTemplate,
  NotificationTemplateData,
  NotificationDeliveryResult,
  NotificationPreferences,
  User,
  UserConfig,
  NestedValue,
  SMSAccountInfo,
} from "../types";
import { NotificationRepository } from "../repositories/notification.repository";
import { UserRepository } from "../repositories/user.repository";
import { SMSService } from "./sms.service";
import { PushNotificationService } from "./push-notification.service";
import { logger } from "../utils/logger";

export class NotificationService {
  private emailTransporter!: nodemailer.Transporter;
  private smsService!: SMSService;
  private pushService!: PushNotificationService;
  private templates!: Map<NotificationTemplate, NotificationTemplateConfig>;

  constructor(
    private notificationRepository: NotificationRepository,
    private userRepository: UserRepository
  ) {
    this.initializeEmailTransporter();
    this.initializeSMSService();
    this.initializePushService();
    this.initializeTemplates();
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter(): void {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Initialize SMS service
   */
  private initializeSMSService(): void {
    this.smsService = new SMSService();
  }

  /**
   * Initialize push notification service
   */
  private initializePushService(): void {
    this.pushService = new PushNotificationService();
  }

  /**
   * Initialize notification templates
   */
  private initializeTemplates(): void {
    this.templates = new Map([
      [
        "schedule_processed",
        {
          subject: "✅ Shooting Schedule Processed - {{location}}",
          emailTemplate: this.getScheduleProcessedEmailTemplate(),
          smsTemplate:
            "StillOnTime: Schedule for {{date}} processed. Wake up: {{wakeUpTime}}. Departure: {{departureTime}}.",
          pushTemplate: {
            title: "Shooting Schedule Ready",
            body: "{{location}} - {{date}}. Wake up: {{wakeUpTime}}",
          },
        },
      ],
      [
        "schedule_updated",
        {
          subject: "🔄 Shooting Schedule Updated - {{location}}",
          emailTemplate: this.getScheduleUpdatedEmailTemplate(),
          smsTemplate:
            "StillOnTime: Schedule for {{date}} updated. New wake up time: {{wakeUpTime}}.",
          pushTemplate: {
            title: "Schedule Updated",
            body: "{{location}} - new times",
          },
        },
      ],
      [
        "weather_warning",
        {
          subject: "⚠️ Weather Warning - {{location}}",
          emailTemplate: this.getWeatherWarningEmailTemplate(),
          smsTemplate:
            "StillOnTime: Weather warning for {{date}} at {{location}}: {{warnings}}",
          pushTemplate: {
            title: "Weather Warning",
            body: "{{location}} - {{warnings}}",
          },
        },
      ],
      [
        "processing_error",
        {
          subject: "❌ Schedule Processing Error",
          emailTemplate: this.getProcessingErrorEmailTemplate(),
          smsTemplate:
            "StillOnTime: Schedule processing error. Check dashboard.",
          pushTemplate: {
            title: "Processing Error",
            body: "User intervention required",
          },
        },
      ],
      [
        "wake_up_reminder",
        {
          subject: "⏰ Time to Wake Up! - {{location}}",
          emailTemplate: this.getWakeUpReminderEmailTemplate(),
          smsTemplate:
            "StillOnTime: WAKE UP! Schedule for {{date}} at {{location}}. Departure in {{timeToDepart}}.",
          pushTemplate: {
            title: "Time to Wake Up!",
            body: "{{location}} - departure in {{timeToDepart}}",
          },
        },
      ],
      [
        "departure_reminder",
        {
          subject: "🚗 Time to Leave! - {{location}}",
          emailTemplate: this.getDepartureReminderEmailTemplate(),
          smsTemplate:
            "StillOnTime: DEPARTURE! To {{location}}. Arrival at {{arrivalTime}}.",
          pushTemplate: {
            title: "Time to Leave!",
            body: "To {{location}} - arrival {{arrivalTime}}",
          },
        },
      ],
      [
        "system_alert",
        {
          subject: "🔧 StillOnTime System Alert",
          emailTemplate: this.getSystemAlertEmailTemplate(),
          smsTemplate: "StillOnTime: {{message}}",
          pushTemplate: {
            title: "System Alert",
            body: "{{message}}",
          },
        },
      ],
    ]);
  }

  /**
   * Send notification to user
   */
  async sendNotification(
    userId: string,
    template: NotificationTemplate,
    data: NotificationTemplateData,
    channels?: NotificationChannel[],
    scheduledFor?: Date
  ): Promise<string[]> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const userWithConfig = await this.userRepository.findByIdWithConfig(
        userId
      );
      const preferences = this.getUserNotificationPreferences(
        userWithConfig?.userConfig
      );

      // Determine which channels to use
      const targetChannels = channels || this.getEnabledChannels(preferences);

      const notificationIds: string[] = [];

      for (const channel of targetChannels) {
        const notification = await this.createNotification(
          userId,
          channel,
          template,
          data,
          scheduledFor
        );

        notificationIds.push(notification.id);

        // Send immediately if not scheduled
        if (!scheduledFor) {
          await this.deliverNotification(notification, user, preferences);
        }
      }

      return notificationIds;
    } catch (error) {
      logger.error("Failed to send notification", {
        userId,
        template,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.sendNotification",
      });
      throw error;
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications(): Promise<void> {
    try {
      const pendingNotifications =
        await this.notificationRepository.findPendingScheduled();

      logger.info(
        `Processing ${pendingNotifications.length} scheduled notifications`
      );

      for (const notification of pendingNotifications) {
        try {
          const user = await this.userRepository.findById(notification.userId);
          if (!user) {
            await this.notificationRepository.markAsFailed(
              notification.id,
              "User not found"
            );
            continue;
          }

          const userWithConfig = await this.userRepository.findByIdWithConfig(
            notification.userId
          );
          const preferences = this.getUserNotificationPreferences(
            userWithConfig?.userConfig
          );

          await this.deliverNotification(notification, user, preferences);
        } catch (error) {
          logger.error("Failed to process scheduled notification", {
            notificationId: notification.id,
            error: error instanceof Error ? error.message : String(error),
            functionName: "NotificationService.processScheduledNotifications",
          });

          await this.notificationRepository.markAsFailed(
            notification.id,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    } catch (error) {
      logger.error("Failed to process scheduled notifications", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.processScheduledNotifications",
      });
    }
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(): Promise<void> {
    try {
      const failedNotifications =
        await this.notificationRepository.findRetryable();

      logger.info(
        `Retrying ${failedNotifications.length} failed notifications`
      );

      for (const notification of failedNotifications) {
        try {
          const user = await this.userRepository.findById(notification.userId);
          if (!user) {
            continue;
          }

          const userWithConfig = await this.userRepository.findByIdWithConfig(
            notification.userId
          );
          const preferences = this.getUserNotificationPreferences(
            userWithConfig?.userConfig
          );

          await this.deliverNotification(notification, user, preferences);
        } catch (error) {
          await this.notificationRepository.markAsFailed(
            notification.id,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    } catch (error) {
      logger.error("Failed to retry failed notifications", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.retryFailedNotifications",
      });
    }
  }

  /**
   * Create notification record
   */
  private async createNotification(
    userId: string,
    channel: NotificationChannel,
    template: NotificationTemplate,
    data: NotificationTemplateData,
    scheduledFor?: Date
  ): Promise<Notification> {
    const templateConfig = this.templates.get(template);
    if (!templateConfig) {
      throw new Error(`Template not found: ${template}`);
    }

    const { subject, message } = this.renderTemplate(
      templateConfig,
      channel,
      data
    );

    return this.notificationRepository.create({
      user: { connect: { id: userId } },
      channel,
      template,
      subject,
      message,
      data: data as any,
      scheduledFor,
      status: "pending",
      retryCount: 0,
    });
  }

  /**
   * Deliver notification through specified channel
   */
  private async deliverNotification(
    notification: Notification,
    user: User,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      let result: NotificationDeliveryResult;

      switch (notification.channel as NotificationChannel) {
        case "email":
          result = await this.sendEmail(notification, user);
          break;
        case "sms":
          result = await this.sendSMS(notification, preferences.smsNumber);
          break;
        case "push":
          result = await this.sendPushNotification(
            notification,
            preferences.pushToken
          );
          break;
        default:
          throw new Error(`Unsupported channel: ${notification.channel}`);
      }

      if (result.success) {
        await this.notificationRepository.markAsSent(
          notification.id,
          result.messageId
        );
        logger.info("Notification delivered successfully", {
          notificationId: notification.id,
          channel: notification.channel,
          userId: user.id,
        });
      } else {
        throw new Error(result.error || "Delivery failed");
      }
    } catch (error) {
      await this.notificationRepository.markAsFailed(
        notification.id,
        error instanceof Error ? error.message : String(error)
      );
      logger.error("Failed to deliver notification", {
        notificationId: notification.id,
        channel: notification.channel,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.deliverNotification",
      });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    notification: Notification,
    user: User
  ): Promise<NotificationDeliveryResult> {
    try {
      const result = await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || "StillOnTime <noreply@stillontime.app>",
        to: user.email,
        subject: notification.subject,
        html: notification.message,
      });

      return {
        success: true,
        messageId: result.messageId,
        deliveredAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        deliveredAt: new Date(),
      };
    }
  }

  /**
   * Send SMS notification via Twilio
   */
  private async sendSMS(
    notification: Notification,
    phoneNumber?: string
  ): Promise<NotificationDeliveryResult> {
    if (!phoneNumber) {
      return {
        success: false,
        error: "Phone number not configured",
        deliveredAt: new Date(),
      };
    }

    if (!this.smsService.isServiceConfigured()) {
      return {
        success: false,
        error: "SMS service not configured - missing Twilio credentials",
        deliveredAt: new Date(),
      };
    }

    try {
      const result = await this.smsService.sendSMS(
        phoneNumber,
        notification.message
      );

      if (result.success) {
        logger.info("SMS notification sent successfully", {
          notificationId: notification.id,
          messageId: result.messageId,
          phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
        });
      } else {
        logger.error("SMS notification failed", {
          notificationId: notification.id,
          error: result.error,
          phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*"),
        });
      }

      return result;
    } catch (error) {
      logger.error("SMS notification error", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*"),
        functionName: "NotificationService.sendSMS",
      });

      return {
        success: false,
        error: `SMS delivery failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        deliveredAt: new Date(),
      };
    }
  }

  /**
   * Send push notification via Firebase Cloud Messaging
   */
  private async sendPushNotification(
    notification: Notification,
    pushToken?: string
  ): Promise<NotificationDeliveryResult> {
    if (!pushToken) {
      return {
        success: false,
        error: "Push token not configured",
        deliveredAt: new Date(),
      };
    }

    if (!this.pushService.isServiceConfigured()) {
      return {
        success: false,
        error:
          "Push notification service not configured - missing Firebase credentials",
        deliveredAt: new Date(),
      };
    }

    try {
      const pushMessage = {
        title: notification.subject,
        body: notification.message,
        icon: "/icon-192x192.png",
        badge: "1",
        data: {
          notificationId: notification.id,
          template: notification.template,
          timestamp: new Date().toISOString(),
        },
      };

      const result = await this.pushService.sendToToken(
        pushToken,
        pushMessage,
        {
          priority: "high",
          timeToLive: 3600, // 1 hour
        }
      );

      if (result.success) {
        logger.info("Push notification sent successfully", {
          notificationId: notification.id,
          messageId: result.messageId,
          pushToken: pushToken.slice(0, 8) + "...", // Mask token
        });
      } else {
        logger.error("Push notification failed", {
          notificationId: notification.id,
          error: result.error,
          pushToken: pushToken.slice(0, 8) + "...",
        });
      }

      return result;
    } catch (error) {
      logger.error("Push notification error", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
        pushToken: pushToken.slice(0, 8) + "...",
        functionName: "NotificationService.sendPushNotification",
      });

      return {
        success: false,
        error: `Push notification delivery failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        deliveredAt: new Date(),
      };
    }
  }

  /**
   * Get user notification preferences
   */
  private getUserNotificationPreferences(
    userConfig?: UserConfig | null
  ): NotificationPreferences {
    return {
      email: userConfig?.notificationEmail ?? true,
      sms: userConfig?.notificationSMS ?? false,
      push: userConfig?.notificationPush ?? true,
      smsNumber: userConfig?.smsNumber || undefined,
      pushToken: userConfig?.pushToken || undefined,
    };
  }

  /**
   * Get enabled notification channels based on preferences
   */
  private getEnabledChannels(
    preferences: NotificationPreferences
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    if (preferences.email) channels.push("email");
    if (preferences.sms && preferences.smsNumber) channels.push("sms");
    if (preferences.push && preferences.pushToken) channels.push("push");

    return channels;
  }

  /**
   * Render notification template
   */
  private renderTemplate(
    templateConfig: NotificationTemplateConfig,
    channel: NotificationChannel,
    data: NotificationTemplateData
  ): { subject: string; message: string } {
    let template: string;
    let subject = templateConfig.subject;

    switch (channel) {
      case "email":
        template = templateConfig.emailTemplate;
        break;
      case "sms":
        template = templateConfig.smsTemplate;
        subject = ""; // SMS doesn't have subject
        break;
      case "push":
        template = templateConfig.pushTemplate.body;
        subject = templateConfig.pushTemplate.title;
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }

    // Simple template rendering - replace {{variable}} with data values
    const rendered = this.interpolateTemplate(template, data);
    const renderedSubject = this.interpolateTemplate(subject, data);

    return {
      subject: renderedSubject,
      message: rendered,
    };
  }

  /**
   * Simple template interpolation
   */
  private interpolateTemplate(
    template: string,
    data: NotificationTemplateData
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue<T extends Record<string, unknown>>(
    obj: T,
    path: string
  ): unknown {
    return path.split(".").reduce((current: unknown, key: string) => {
      if (current && typeof current === "object" && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  // Template methods (simplified versions - can be expanded)
  private getScheduleProcessedEmailTemplate(): string {
    return `
      <h2>✅ Shooting Schedule Processed</h2>
      <p><strong>Location:</strong> {{scheduleData.location}}</p>
      <p><strong>Date:</strong> {{scheduleData.shootingDate}}</p>
      <p><strong>Call time:</strong> {{scheduleData.callTime}}</p>
      <p><strong>Wake up:</strong> {{routePlan.wakeUpTime}}</p>
      <p><strong>Departure:</strong> {{routePlan.departureTime}}</p>
      <p><strong>Arrival:</strong> {{routePlan.arrivalTime}}</p>
      {{#if weatherData.warnings}}
      <h3>⚠️ Weather Warnings:</h3>
      <ul>{{#each weatherData.warnings}}<li>{{this}}</li>{{/each}}</ul>
      {{/if}}
    `;
  }

  private getScheduleUpdatedEmailTemplate(): string {
    return `
      <h2>🔄 Shooting Schedule Updated</h2>
      <p>Your schedule for {{scheduleData.shootingDate}} has been updated.</p>
      <p><strong>New times:</strong></p>
      <ul>
        <li>Wake up: {{routePlan.wakeUpTime}}</li>
        <li>Departure: {{routePlan.departureTime}}</li>
        <li>Arrival: {{routePlan.arrivalTime}}</li>
      </ul>
    `;
  }

  private getWeatherWarningEmailTemplate(): string {
    return `
      <h2>⚠️ Weather Warning</h2>
      <p><strong>Location:</strong> {{scheduleData.location}}</p>
      <p><strong>Date:</strong> {{scheduleData.shootingDate}}</p>
      <h3>Warnings:</h3>
      <ul>{{#each weatherData.warnings}}<li>{{this}}</li>{{/each}}</ul>
      <p>Please prepare appropriately for the weather conditions.</p>
    `;
  }

  private getProcessingErrorEmailTemplate(): string {
    return `
      <h2>❌ Processing Error</h2>
      <p>An error occurred while processing the shooting schedule.</p>
      <p><strong>Error:</strong> {{error}}</p>
      <p>Please check the dashboard and try again.</p>
    `;
  }

  private getWakeUpReminderEmailTemplate(): string {
    return `
      <h2>⏰ Time to Wake Up!</h2>
      <p>Today you have a shooting schedule at {{scheduleData.location}}</p>
      <p><strong>Departure in:</strong> {{timeToDepart}}</p>
      <p><strong>Call time:</strong> {{scheduleData.callTime}}</p>
    `;
  }

  private getDepartureReminderEmailTemplate(): string {
    return `
      <h2>🚗 Time to Leave!</h2>
      <p><strong>Destination:</strong> {{scheduleData.location}}</p>
      <p><strong>Expected arrival:</strong> {{routePlan.arrivalTime}}</p>
      <p>Have a great shooting day!</p>
    `;
  }

  private getSystemAlertEmailTemplate(): string {
    return `
      <h2>🔧 System Alert</h2>
      <p>{{message}}</p>
    `;
  }

  /**
   * Validate SMS configuration for a user
   */
  async validateSMSConfiguration(userId: string): Promise<{
    isValid: boolean;
    hasPhoneNumber: boolean;
    isServiceConfigured: boolean;
    phoneNumberValid?: boolean;
    error?: string;
  }> {
    try {
      const userWithConfig = await this.userRepository.findByIdWithConfig(
        userId
      );
      const phoneNumber = userWithConfig?.userConfig?.smsNumber;

      const hasPhoneNumber = !!phoneNumber;
      const isServiceConfigured = this.smsService.isServiceConfigured();

      let phoneNumberValid = false;
      if (phoneNumber) {
        // Use the SMS service's validation logic
        const cleaned = phoneNumber.replace(/[^\d+]/g, "");
        phoneNumberValid =
          cleaned.length >= 8 &&
          (cleaned.startsWith("+") || /^[45678]/.test(cleaned));
      }

      return {
        isValid: hasPhoneNumber && isServiceConfigured && phoneNumberValid,
        hasPhoneNumber,
        isServiceConfigured,
        phoneNumberValid: hasPhoneNumber ? phoneNumberValid : undefined,
      };
    } catch (error) {
      logger.error("Failed to validate SMS configuration", {
        userId,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.validateSMSConfiguration",
      });

      return {
        isValid: false,
        hasPhoneNumber: false,
        isServiceConfigured: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test SMS service configuration
   */
  async testSMSService(): Promise<{
    isConfigured: boolean;
    accountInfo?: SMSAccountInfo;
    error?: string;
  }> {
    return this.smsService.testConfiguration();
  }

  /**
   * Get SMS delivery status for a notification
   */
  async getSMSDeliveryStatus(messageId: string): Promise<{
    messageId: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
    deliveredAt?: Date;
  } | null> {
    try {
      if (!this.smsService.isServiceConfigured()) {
        return null;
      }

      const status = await this.smsService.getDeliveryStatus(messageId);
      return status;
    } catch (error) {
      logger.error("Failed to get SMS delivery status", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.getSMSDeliveryStatus",
      });
      return null;
    }
  }

  /**
   * Update notification delivery status from webhook
   */
  async updateDeliveryStatus(
    notificationId: string,
    status: "sent" | "delivered" | "failed",
    error?: string
  ): Promise<void> {
    try {
      if (status === "delivered" || status === "sent") {
        await this.notificationRepository.markAsSent(notificationId);
      } else if (status === "failed") {
        await this.notificationRepository.markAsFailed(
          notificationId,
          error || "Delivery failed"
        );
      }

      logger.info("Notification delivery status updated", {
        notificationId,
        status,
        error,
      });
    } catch (error) {
      logger.error("Failed to update notification delivery status", {
        notificationId,
        status,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.updateDeliveryStatus",
      });
    }
  }

  /**
   * Find notification by external message ID (e.g., Twilio message SID)
   */
  async findNotificationByMessageId(messageId: string): Promise<Notification | null> {
    try {
      return await this.notificationRepository.findByMessageId(messageId);
    } catch (error) {
      logger.error("Failed to find notification by message ID", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.findNotificationByMessageId",
      });
      return null;
    }
  }

  /**
   * Get SMS account usage and limits
   */
  async getSMSAccountUsage(): Promise<{
    balance?: string;
    currency?: string;
    usage?: Array<{
      category: string;
      count: number;
      price: string;
    }>;
    error?: string;
  }> {
    const result = await this.smsService.getAccountUsage();

    // Transform the usage data to match expected format
    if (result.usage) {
      return {
        balance: result.balance,
        currency: result.currency,
        usage: result.usage.map((item) => ({
          category: item.category,
          count: item.count,
          price: item.price,
        })),
        error: result.error,
      };
    }

    return {
      balance: result.balance,
      currency: result.currency,
      error: result.error,
    };
  }

  /**
   * Validate push notification configuration for a user
   */
  async validatePushConfiguration(userId: string): Promise<{
    isValid: boolean;
    hasPushToken: boolean;
    isServiceConfigured: boolean;
    pushTokenValid?: boolean;
    error?: string;
  }> {
    try {
      const userWithConfig = await this.userRepository.findByIdWithConfig(
        userId
      );
      const pushToken = userWithConfig?.userConfig?.pushToken;

      const hasPushToken = !!pushToken;
      const isServiceConfigured = this.pushService.isServiceConfigured();

      let pushTokenValid = false;
      if (pushToken) {
        const validation = this.pushService.validateToken(pushToken);
        pushTokenValid = validation.isValid;
      }

      return {
        isValid: hasPushToken && isServiceConfigured && pushTokenValid,
        hasPushToken,
        isServiceConfigured,
        pushTokenValid: hasPushToken ? pushTokenValid : undefined,
      };
    } catch (error) {
      logger.error("Failed to validate push notification configuration", {
        userId,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.validatePushConfiguration",
      });

      return {
        isValid: false,
        hasPushToken: false,
        isServiceConfigured: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test push notification service configuration
   */
  async testPushService(): Promise<{
    isConfigured: boolean;
    projectInfo?: {
      projectId: string;
      hasVapidKey: boolean;
    };
    error?: string;
  }> {
    return this.pushService.testConfiguration();
  }

  /**
   * Send system alert notification
   */
  async sendSystemAlert(alertData: {
    type: string;
    serviceName: string;
    errorCode: string;
    impact: "low" | "medium" | "high" | "critical";
    affectedOperations: string[];
    estimatedRecoveryTime?: number;
    timestamp: Date;
  }): Promise<void> {
    try {
      // Get admin users (simplified - would need proper admin user management)
      const adminUsers = await this.getAdminUsers();

      const templateData = {
        alertType: alertData.type,
        serviceName: alertData.serviceName,
        errorCode: alertData.errorCode,
        impact: alertData.impact,
        affectedOperations: alertData.affectedOperations.join(", "),
        estimatedRecoveryTime: alertData.estimatedRecoveryTime
          ? `${Math.round(alertData.estimatedRecoveryTime / 60)} minutes`
          : "Unknown",
        timestamp: alertData.timestamp.toISOString(),
        message: this.formatSystemAlertMessage(alertData),
      };

      // Send to all admin users
      for (const adminUser of adminUsers) {
        await this.sendNotification(
          adminUser.id,
          "system_alert",
          templateData,
          ["email"] // Only email for system alerts
        );
      }

      logger.info("System alert sent", {
        alertType: alertData.type,
        serviceName: alertData.serviceName,
        impact: alertData.impact,
        adminUserCount: adminUsers.length,
      });
    } catch (error) {
      logger.error("Failed to send system alert", {
        alertData,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.sendSystemAlert",
      });
    }
  }

  /**
   * Send monitoring alert notification
   */
  async sendAlert(alertData: {
    id: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    timestamp: Date;
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      // Get admin users for alerts
      const adminUsers = await this.getAdminUsers();

      const templateData = {
        alertId: alertData.id,
        severity: alertData.severity,
        title: alertData.title,
        message: alertData.message,
        timestamp: alertData.timestamp.toISOString(),
        metadata: JSON.stringify(alertData.metadata, null, 2),
      };

      // Determine notification channels based on severity
      const channels: NotificationChannel[] = ["email"];
      if (alertData.severity === "critical" || alertData.severity === "high") {
        channels.push("sms"); // Also send SMS for high/critical alerts
      }

      // Send to all admin users
      for (const adminUser of adminUsers) {
        await this.sendNotification(
          adminUser.id,
          "system_alert",
          templateData,
          channels
        );
      }

      logger.info("Monitoring alert sent", {
        alertId: alertData.id,
        severity: alertData.severity,
        title: alertData.title,
        adminUserCount: adminUsers.length,
        channels,
      });
    } catch (error) {
      logger.error("Failed to send monitoring alert", {
        alertData,
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.sendAlert",
      });
    }
  }

  /**
   * Format system alert message
   */
  private formatSystemAlertMessage(alertData: {
    type: string;
    serviceName: string;
    errorCode: string;
    impact: "low" | "medium" | "high" | "critical";
    affectedOperations: string[];
    estimatedRecoveryTime?: number;
    timestamp: Date;
  }): string {
    const impactEmoji = {
      low: "🟡",
      medium: "🟠",
      high: "🔴",
      critical: "🚨",
    };

    const recoveryTime = alertData.estimatedRecoveryTime
      ? `${Math.round(alertData.estimatedRecoveryTime / 60)} minutes`
      : "Unknown";

    return `${
      impactEmoji[alertData.impact]
    } ${alertData.impact.toUpperCase()} IMPACT ALERT

Service: ${alertData.serviceName}
Error: ${alertData.errorCode}
Type: ${alertData.type}
Time: ${alertData.timestamp.toLocaleString()}

Affected Operations:
${alertData.affectedOperations.map((op) => `• ${op}`).join("\n")}

Estimated Recovery: ${recoveryTime}

Please check the monitoring dashboard for more details.`;
  }

  /**
   * Get admin users (simplified implementation)
   */
  private async getAdminUsers(): Promise<User[]> {
    try {
      // This is a simplified implementation
      // In a real system, you'd have proper role-based access control
      const users = await this.userRepository.findAll();

      // For now, return all users as potential admins
      // In production, filter by admin role
      return users.slice(0, 5); // Limit to first 5 users to avoid spam
    } catch (error) {
      logger.error("Failed to get admin users", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "NotificationService.getAdminUsers",
      });
      return [];
    }
  }
}

interface NotificationTemplateConfig {
  subject: string;
  emailTemplate: string;
  smsTemplate: string;
  pushTemplate: {
    title: string;
    body: string;
  };
}

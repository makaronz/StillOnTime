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
          subject: "✅ Plan zdjęciowy przetworzony - {{location}}",
          emailTemplate: this.getScheduleProcessedEmailTemplate(),
          smsTemplate:
            "StillOnTime: Plan na {{date}} przetworzony. Pobudka: {{wakeUpTime}}. Wyjazd: {{departureTime}}.",
          pushTemplate: {
            title: "Plan zdjęciowy gotowy",
            body: "{{location}} - {{date}}. Pobudka: {{wakeUpTime}}",
          },
        },
      ],
      [
        "schedule_updated",
        {
          subject: "🔄 Aktualizacja planu zdjęciowego - {{location}}",
          emailTemplate: this.getScheduleUpdatedEmailTemplate(),
          smsTemplate:
            "StillOnTime: Plan na {{date}} zaktualizowany. Nowa pobudka: {{wakeUpTime}}.",
          pushTemplate: {
            title: "Plan zaktualizowany",
            body: "{{location}} - nowe czasy",
          },
        },
      ],
      [
        "weather_warning",
        {
          subject: "⚠️ Ostrzeżenie pogodowe - {{location}}",
          emailTemplate: this.getWeatherWarningEmailTemplate(),
          smsTemplate:
            "StillOnTime: Ostrzeżenie pogodowe na {{date}} w {{location}}: {{warnings}}",
          pushTemplate: {
            title: "Ostrzeżenie pogodowe",
            body: "{{location}} - {{warnings}}",
          },
        },
      ],
      [
        "processing_error",
        {
          subject: "❌ Błąd przetwarzania planu zdjęciowego",
          emailTemplate: this.getProcessingErrorEmailTemplate(),
          smsTemplate:
            "StillOnTime: Błąd przetwarzania planu. Sprawdź dashboard.",
          pushTemplate: {
            title: "Błąd przetwarzania",
            body: "Wymagana interwencja użytkownika",
          },
        },
      ],
      [
        "wake_up_reminder",
        {
          subject: "⏰ Czas wstawać! - {{location}}",
          emailTemplate: this.getWakeUpReminderEmailTemplate(),
          smsTemplate:
            "StillOnTime: POBUDKA! Plan na {{date}} w {{location}}. Wyjazd za {{timeToDepart}}.",
          pushTemplate: {
            title: "Czas wstawać!",
            body: "{{location}} - wyjazd za {{timeToDepart}}",
          },
        },
      ],
      [
        "departure_reminder",
        {
          subject: "🚗 Czas wyjeżdżać! - {{location}}",
          emailTemplate: this.getDepartureReminderEmailTemplate(),
          smsTemplate:
            "StillOnTime: WYJAZD! Do {{location}}. Przyjazd o {{arrivalTime}}.",
          pushTemplate: {
            title: "Czas wyjeżdżać!",
            body: "Do {{location}} - przyjazd {{arrivalTime}}",
          },
        },
      ],
      [
        "system_alert",
        {
          subject: "🔧 Alert systemowy StillOnTime",
          emailTemplate: this.getSystemAlertEmailTemplate(),
          smsTemplate: "StillOnTime: {{message}}",
          pushTemplate: {
            title: "Alert systemowy",
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
        error: error.message,
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
            error: error.message,
            functionName: "NotificationService.processScheduledNotifications",
          });

          await this.notificationRepository.markAsFailed(
            notification.id,
            error.message
          );
        }
      }
    } catch (error) {
      logger.error("Failed to process scheduled notifications", {
        error: error.message,
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
            error.message
          );
        }
      }
    } catch (error) {
      logger.error("Failed to retry failed notifications", {
        error: error.message,
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
        error.message
      );
      logger.error("Failed to deliver notification", {
        notificationId: notification.id,
        channel: notification.channel,
        error: error.message,
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
        error: error.message,
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
        error: error.message,
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*"),
        functionName: "NotificationService.sendSMS",
      });

      return {
        success: false,
        error: `SMS delivery failed: ${error.message}`,
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
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  // Template methods (simplified versions - can be expanded)
  private getScheduleProcessedEmailTemplate(): string {
    return `
      <h2>✅ Plan zdjęciowy przetworzony</h2>
      <p><strong>Lokacja:</strong> {{scheduleData.location}}</p>
      <p><strong>Data:</strong> {{scheduleData.shootingDate}}</p>
      <p><strong>Call time:</strong> {{scheduleData.callTime}}</p>
      <p><strong>Pobudka:</strong> {{routePlan.wakeUpTime}}</p>
      <p><strong>Wyjazd:</strong> {{routePlan.departureTime}}</p>
      <p><strong>Przyjazd:</strong> {{routePlan.arrivalTime}}</p>
      {{#if weatherData.warnings}}
      <h3>⚠️ Ostrzeżenia pogodowe:</h3>
      <ul>{{#each weatherData.warnings}}<li>{{this}}</li>{{/each}}</ul>
      {{/if}}
    `;
  }

  private getScheduleUpdatedEmailTemplate(): string {
    return `
      <h2>🔄 Plan zdjęciowy zaktualizowany</h2>
      <p>Twój plan na {{scheduleData.shootingDate}} został zaktualizowany.</p>
      <p><strong>Nowe czasy:</strong></p>
      <ul>
        <li>Pobudka: {{routePlan.wakeUpTime}}</li>
        <li>Wyjazd: {{routePlan.departureTime}}</li>
        <li>Przyjazd: {{routePlan.arrivalTime}}</li>
      </ul>
    `;
  }

  private getWeatherWarningEmailTemplate(): string {
    return `
      <h2>⚠️ Ostrzeżenie pogodowe</h2>
      <p><strong>Lokacja:</strong> {{scheduleData.location}}</p>
      <p><strong>Data:</strong> {{scheduleData.shootingDate}}</p>
      <h3>Ostrzeżenia:</h3>
      <ul>{{#each weatherData.warnings}}<li>{{this}}</li>{{/each}}</ul>
      <p>Przygotuj się odpowiednio na warunki pogodowe.</p>
    `;
  }

  private getProcessingErrorEmailTemplate(): string {
    return `
      <h2>❌ Błąd przetwarzania</h2>
      <p>Wystąpił błąd podczas przetwarzania planu zdjęciowego.</p>
      <p><strong>Błąd:</strong> {{error}}</p>
      <p>Sprawdź dashboard i spróbuj ponownie.</p>
    `;
  }

  private getWakeUpReminderEmailTemplate(): string {
    return `
      <h2>⏰ Czas wstawać!</h2>
      <p>Dzisiaj masz plan zdjęciowy w {{scheduleData.location}}</p>
      <p><strong>Wyjazd za:</strong> {{timeToDepart}}</p>
      <p><strong>Call time:</strong> {{scheduleData.callTime}}</p>
    `;
  }

  private getDepartureReminderEmailTemplate(): string {
    return `
      <h2>🚗 Czas wyjeżdżać!</h2>
      <p><strong>Cel:</strong> {{scheduleData.location}}</p>
      <p><strong>Przewidywany przyjazd:</strong> {{routePlan.arrivalTime}}</p>
      <p>Miłego dnia zdjęciowego!</p>
    `;
  }

  private getSystemAlertEmailTemplate(): string {
    return `
      <h2>🔧 Alert systemowy</h2>
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
        error: error.message,
        functionName: "NotificationService.validateSMSConfiguration",
      });

      return {
        isValid: false,
        hasPhoneNumber: false,
        isServiceConfigured: false,
        error: error.message,
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
        error: error.message,
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
        error: error.message,
        functionName: "NotificationService.updateDeliveryStatus",
      });
    }
  }

  /**
   * Get SMS account usage and limits
   */
  async getSMSAccountUsage(): Promise<{
    balance?: string;
    currency?: string;
    usage?: any[];
    error?: string;
  }> {
    return this.smsService.getAccountUsage();
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

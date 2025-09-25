import { Twilio } from "twilio";
import { logger } from "../utils/logger";
import {
  NotificationDeliveryResult,
  SMSDeliveryStatus,
  SMSAccountInfo,
} from "../types";

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// SMSDeliveryStatus interface moved to types/index.ts

export class SMSService {
  private twilioClient!: Twilio;
  private fromNumber!: string;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTwilio();
  }

  /**
   * Initialize Twilio client with configuration
   */
  private initializeTwilio(): void {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        logger.warn(
          "Twilio SMS service not configured - missing environment variables",
          {
            hasAccountSid: !!accountSid,
            hasAuthToken: !!authToken,
            hasFromNumber: !!fromNumber,
            functionName: "SMSService.initializeTwilio",
          }
        );
        return;
      }

      this.twilioClient = new Twilio(accountSid, authToken);
      this.fromNumber = fromNumber;
      this.isConfigured = true;

      logger.info("Twilio SMS service initialized successfully", {
        fromNumber: this.fromNumber,
        functionName: "SMSService.initializeTwilio",
      });
    } catch (error) {
      logger.error("Failed to initialize Twilio SMS service", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "SMSService.initializeTwilio",
      });
    }
  }

  /**
   * Check if SMS service is properly configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Send SMS message
   */
  async sendSMS(
    toNumber: string,
    message: string,
    options?: {
      statusCallback?: string;
      maxPrice?: string;
      validityPeriod?: number;
    }
  ): Promise<NotificationDeliveryResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: "SMS service not configured - missing Twilio credentials",
        deliveredAt: new Date(),
      };
    }

    try {
      // Validate phone number format
      const validatedNumber = this.validatePhoneNumber(toNumber);
      if (!validatedNumber.isValid) {
        return {
          success: false,
          error: `Invalid phone number: ${validatedNumber.error}`,
          deliveredAt: new Date(),
        };
      }

      // Validate message length (SMS limit is 1600 characters for concatenated messages)
      if (message.length > 1600) {
        logger.warn("SMS message truncated due to length limit", {
          originalLength: message.length,
          truncatedLength: 1600,
          toNumber: this.maskPhoneNumber(toNumber),
        });
        message = message.substring(0, 1597) + "...";
      }

      logger.info("Sending SMS message", {
        toNumber: this.maskPhoneNumber(toNumber),
        messageLength: message.length,
        functionName: "SMSService.sendSMS",
      });

      const twilioMessage = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: validatedNumber.formatted!,
        statusCallback: options?.statusCallback,
        maxPrice: options?.maxPrice ? parseFloat(options.maxPrice) : undefined,
        validityPeriod: options?.validityPeriod,
      });

      logger.info("SMS sent successfully", {
        messageId: twilioMessage.sid,
        status: twilioMessage.status,
        toNumber: this.maskPhoneNumber(toNumber),
        functionName: "SMSService.sendSMS",
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to send SMS", {
        error: error instanceof Error ? error.message : String(error),
        errorCode: (error as any)?.code,
        toNumber: this.maskPhoneNumber(toNumber),
        functionName: "SMSService.sendSMS",
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
   * Get delivery status for a message
   */
  async getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus> {
    if (!this.isConfigured) {
      throw new Error("SMS service not configured");
    }

    try {
      const message = await this.twilioClient.messages(messageId).fetch();

      return {
        messageId: message.sid,
        status: message.status as
          | "queued"
          | "sent"
          | "delivered"
          | "failed"
          | "undelivered",
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
        timestamp: message.dateUpdated || new Date(),
      };
    } catch (error) {
      logger.error("Failed to fetch SMS delivery status", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
        functionName: "SMSService.getDeliveryStatus",
      });
      throw error;
    }
  }

  /**
   * Validate phone number format
   */
  private validatePhoneNumber(phoneNumber: string): {
    isValid: boolean;
    formatted?: string;
    error?: string;
  } {
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, "");

    // Check if it's empty
    if (!cleaned) {
      return {
        isValid: false,
        error: "Phone number is empty",
      };
    }

    // Check for international format (+country code)
    if (cleaned.startsWith("+")) {
      // International format validation
      if (cleaned.length < 8 || cleaned.length > 15) {
        return {
          isValid: false,
          error: "International phone number must be 8-15 digits",
        };
      }
      return {
        isValid: true,
        formatted: cleaned,
      };
    }

    // Check for Polish mobile number (9 digits starting with 4, 5, 6, 7, 8)
    if (cleaned.length === 9 && /^[45678]/.test(cleaned)) {
      return {
        isValid: true,
        formatted: `+48${cleaned}`,
      };
    }

    // Check for Polish mobile with country code (11 digits: 48 + 9 digits)
    if (
      cleaned.length === 11 &&
      cleaned.startsWith("48") &&
      /^48[45678]/.test(cleaned)
    ) {
      return {
        isValid: true,
        formatted: `+${cleaned}`,
      };
    }

    // Check for US/Canada format (10 digits)
    if (cleaned.length === 10 && /^[2-9]/.test(cleaned)) {
      return {
        isValid: true,
        formatted: `+1${cleaned}`,
      };
    }

    // Check for US/Canada with country code (11 digits starting with 1)
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return {
        isValid: true,
        formatted: `+${cleaned}`,
      };
    }

    return {
      isValid: false,
      error:
        "Invalid phone number format. Use international format (+country code) or local format",
    };
  }

  /**
   * Mask phone number for logging (show only last 4 digits)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return "****";
    }
    return "*".repeat(phoneNumber.length - 4) + phoneNumber.slice(-4);
  }

  /**
   * Test SMS service configuration
   */
  async testConfiguration(): Promise<{
    isConfigured: boolean;
    accountInfo?: {
      accountSid: string;
      friendlyName: string;
      status: string;
    };
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        isConfigured: false,
        error: "SMS service not configured - missing Twilio credentials",
      };
    }

    try {
      const account = await this.twilioClient.api
        .accounts(process.env.TWILIO_ACCOUNT_SID!)
        .fetch();

      return {
        isConfigured: true,
        accountInfo: {
          accountSid: account.sid,
          friendlyName: account.friendlyName,
          status: account.status,
        },
      };
    } catch (error) {
      logger.error("Failed to test SMS service configuration", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "SMSService.testConfiguration",
      });

      return {
        isConfigured: false,
        error: `Configuration test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Get account usage and limits
   */
  async getAccountUsage(): Promise<{
    balance?: string;
    currency?: string;
    usage?: {
      category: string;
      count: number;
      price: string;
    }[];
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        error: "SMS service not configured",
      };
    }

    try {
      const [balance, usage] = await Promise.all([
        this.twilioClient.api
          .accounts(process.env.TWILIO_ACCOUNT_SID!)
          .balance.fetch(),
        this.twilioClient.api
          .accounts(process.env.TWILIO_ACCOUNT_SID!)
          .usage.records.list({
            category: "sms",
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          }),
      ]);

      return {
        balance: balance.balance,
        currency: balance.currency,
        usage: usage.map((record) => ({
          category: record.category,
          count: parseInt(record.count),
          price: record.price.toString(),
        })),
      };
    } catch (error) {
      logger.error("Failed to fetch account usage", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "SMSService.getAccountUsage",
      });

      return {
        error: `Failed to fetch usage: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Handle Twilio webhook for delivery status updates
   */
  handleDeliveryStatusWebhook(webhookData: {
    MessageSid: string;
    MessageStatus: string;
    ErrorCode?: string;
    ErrorMessage?: string;
  }): SMSDeliveryStatus {
    return {
      messageId: webhookData.MessageSid,
      status: webhookData.MessageStatus as
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "undelivered",
      errorCode: webhookData.ErrorCode,
      errorMessage: webhookData.ErrorMessage,
      timestamp: new Date(),
    };
  }
}

import { logger } from "../utils/logger";
import { NotificationDeliveryResult } from "../types";

export interface PushNotificationConfig {
  serverKey: string;
  projectId: string;
  vapidKey?: string;
}

export interface PushMessage {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushNotificationService {
  private serverKey!: string;
  private projectId!: string;
  private vapidKey?: string;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize push notification service with Firebase Cloud Messaging
   */
  private initializeService(): void {
    try {
      const serverKey = process.env.FCM_SERVER_KEY;
      const projectId = process.env.FCM_PROJECT_ID;
      const vapidKey = process.env.FCM_VAPID_KEY;

      if (!serverKey || !projectId) {
        logger.warn(
          "Push notification service not configured - missing Firebase credentials",
          {
            hasServerKey: !!serverKey,
            hasProjectId: !!projectId,
            hasVapidKey: !!vapidKey,
            functionName: "PushNotificationService.initializeService",
          }
        );
        return;
      }

      this.serverKey = serverKey;
      this.projectId = projectId;
      this.vapidKey = vapidKey;
      this.isConfigured = true;

      logger.info("Push notification service initialized successfully", {
        projectId: this.projectId,
        hasVapidKey: !!this.vapidKey,
        functionName: "PushNotificationService.initializeService",
      });
    } catch (error) {
      logger.error("Failed to initialize push notification service", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "PushNotificationService.initializeService",
      });
    }
  }

  /**
   * Check if push notification service is properly configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Send push notification to a single device token
   */
  async sendToToken(
    token: string,
    message: PushMessage,
    options?: {
      priority?: "high" | "normal";
      timeToLive?: number;
      collapseKey?: string;
    }
  ): Promise<NotificationDeliveryResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error:
          "Push notification service not configured - missing Firebase credentials",
        deliveredAt: new Date(),
      };
    }

    try {
      const payload = {
        to: token,
        notification: {
          title: message.title,
          body: message.body,
          icon: message.icon || "/icon-192x192.png",
          badge: message.badge,
          image: message.image,
        },
        data: message.data || {},
        android: {
          priority: options?.priority || "high",
          ttl: options?.timeToLive ? `${options.timeToLive}s` : "3600s",
          collapse_key: options?.collapseKey,
          notification: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            sound: "default",
          },
        },
        apns: {
          headers: {
            "apns-priority": options?.priority === "high" ? "10" : "5",
            "apns-expiration": options?.timeToLive
              ? String(Math.floor(Date.now() / 1000) + options.timeToLive)
              : String(Math.floor(Date.now() / 1000) + 3600),
          },
          payload: {
            aps: {
              alert: {
                title: message.title,
                body: message.body,
              },
              badge: message.badge ? parseInt(message.badge) : undefined,
              sound: "default",
            },
          },
        },
        webpush: {
          headers: {
            TTL: options?.timeToLive ? String(options.timeToLive) : "3600",
          },
          notification: {
            title: message.title,
            body: message.body,
            icon: message.icon || "/icon-192x192.png",
            badge: message.badge,
            image: message.image,
            actions: message.actions,
            data: message.data,
          },
        },
      };

      logger.info("Sending push notification", {
        tokenPreview: this.maskToken(token),
        title: message.title,
        bodyLength: message.body.length,
        functionName: "PushNotificationService.sendToToken",
      });

      const response = await this.sendFCMRequest(payload);

      if (response.success === 1) {
        logger.info("Push notification sent successfully", {
          messageId: response.results?.[0]?.message_id,
          tokenPreview: this.maskToken(token),
          functionName: "PushNotificationService.sendToToken",
        });

        return {
          success: true,
          messageId: response.results?.[0]?.message_id || `push_${Date.now()}`,
          deliveredAt: new Date(),
        };
      } else {
        const error = response.results?.[0]?.error || "Unknown error";
        logger.error("Push notification failed", {
          error,
          tokenPreview: this.maskToken(token),
          functionName: "PushNotificationService.sendToToken",
        });

        return {
          success: false,
          error: `Push notification failed: ${error}`,
          deliveredAt: new Date(),
        };
      }
    } catch (error) {
      logger.error("Failed to send push notification", {
        error: error instanceof Error ? error.message : String(error),
        tokenPreview: this.maskToken(token),
        functionName: "PushNotificationService.sendToToken",
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
   * Send push notification to multiple device tokens
   */
  async sendToMultipleTokens(
    tokens: string[],
    message: PushMessage,
    options?: {
      priority?: "high" | "normal";
      timeToLive?: number;
      collapseKey?: string;
    }
  ): Promise<{
    successCount: number;
    failureCount: number;
    results: NotificationDeliveryResult[];
  }> {
    if (!this.isConfigured) {
      const failedResult: NotificationDeliveryResult = {
        success: false,
        error: "Push notification service not configured",
        deliveredAt: new Date(),
      };

      return {
        successCount: 0,
        failureCount: tokens.length,
        results: tokens.map(() => failedResult),
      };
    }

    logger.info("Sending push notifications to multiple tokens", {
      tokenCount: tokens.length,
      title: message.title,
      functionName: "PushNotificationService.sendToMultipleTokens",
    });

    const results = await Promise.allSettled(
      tokens.map((token) => this.sendToToken(token, message, options))
    );

    const deliveryResults: NotificationDeliveryResult[] = results.map(
      (result) => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          return {
            success: false,
            error: result.reason?.message || "Unknown error",
            deliveredAt: new Date(),
          };
        }
      }
    );

    const successCount = deliveryResults.filter((r) => r.success).length;
    const failureCount = deliveryResults.filter((r) => !r.success).length;

    logger.info("Bulk push notification completed", {
      totalTokens: tokens.length,
      successCount,
      failureCount,
      functionName: "PushNotificationService.sendToMultipleTokens",
    });

    return {
      successCount,
      failureCount,
      results: deliveryResults,
    };
  }

  /**
   * Send push notification to a topic
   */
  async sendToTopic(
    topic: string,
    message: PushMessage,
    options?: {
      priority?: "high" | "normal";
      timeToLive?: number;
      condition?: string;
    }
  ): Promise<NotificationDeliveryResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: "Push notification service not configured",
        deliveredAt: new Date(),
      };
    }

    try {
      const payload = {
        to: `/topics/${topic}`,
        condition: options?.condition,
        notification: {
          title: message.title,
          body: message.body,
          icon: message.icon || "/icon-192x192.png",
          badge: message.badge,
          image: message.image,
        },
        data: message.data || {},
        android: {
          priority: options?.priority || "high",
          ttl: options?.timeToLive ? `${options.timeToLive}s` : "3600s",
        },
        apns: {
          headers: {
            "apns-priority": options?.priority === "high" ? "10" : "5",
            "apns-expiration": options?.timeToLive
              ? String(Math.floor(Date.now() / 1000) + options.timeToLive)
              : String(Math.floor(Date.now() / 1000) + 3600),
          },
        },
      };

      logger.info("Sending push notification to topic", {
        topic,
        title: message.title,
        condition: options?.condition,
        functionName: "PushNotificationService.sendToTopic",
      });

      const response = await this.sendFCMRequest(payload);

      if (response.message_id) {
        logger.info("Topic push notification sent successfully", {
          messageId: response.message_id,
          topic,
          functionName: "PushNotificationService.sendToTopic",
        });

        return {
          success: true,
          messageId: response.message_id,
          deliveredAt: new Date(),
        };
      } else {
        const error = response.error || "Unknown error";
        logger.error("Topic push notification failed", {
          error,
          topic,
          functionName: "PushNotificationService.sendToTopic",
        });

        return {
          success: false,
          error: `Topic push notification failed: ${error}`,
          deliveredAt: new Date(),
        };
      }
    } catch (error) {
      logger.error("Failed to send topic push notification", {
        error: error instanceof Error ? error.message : String(error),
        topic,
        functionName: "PushNotificationService.sendToTopic",
      });

      return {
        success: false,
        error: `Topic push notification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        deliveredAt: new Date(),
      };
    }
  }

  /**
   * Validate push token format
   */
  validateToken(token: string): {
    isValid: boolean;
    platform?: "android" | "ios" | "web";
    error?: string;
  } {
    if (!token || typeof token !== "string") {
      return {
        isValid: false,
        error: "Token is empty or not a string",
      };
    }

    // FCM token validation patterns
    const patterns = {
      android: /^[a-zA-Z0-9_-]{140,}$/,
      ios: /^[a-fA-F0-9]{64}$/,
      web: /^[a-zA-Z0-9_-]{140,}$/,
    };

    // Try to detect platform based on token format
    if (patterns.ios.test(token)) {
      return { isValid: true, platform: "ios" };
    } else if (patterns.android.test(token) || patterns.web.test(token)) {
      // Android and Web tokens have similar format
      return { isValid: true, platform: "android" };
    }

    return {
      isValid: false,
      error: "Invalid token format",
    };
  }

  /**
   * Test push notification service configuration
   */
  async testConfiguration(): Promise<{
    isConfigured: boolean;
    projectInfo?: {
      projectId: string;
      hasVapidKey: boolean;
    };
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        isConfigured: false,
        error:
          "Push notification service not configured - missing Firebase credentials",
      };
    }

    try {
      // Test with a dry run to validate configuration
      const testPayload = {
        to: "test_token",
        dry_run: true,
        notification: {
          title: "Test",
          body: "Configuration test",
        },
      };

      await this.sendFCMRequest(testPayload);

      return {
        isConfigured: true,
        projectInfo: {
          projectId: this.projectId,
          hasVapidKey: !!this.vapidKey,
        },
      };
    } catch (error) {
      logger.error("Failed to test push notification configuration", {
        error: error instanceof Error ? error.message : String(error),
        functionName: "PushNotificationService.testConfiguration",
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
   * Subscribe token to topic
   */
  async subscribeToTopic(
    tokens: string | string[],
    topic: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: "Push notification service not configured",
      };
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      const url = `https://iid.googleapis.com/iid/v1:batchAdd`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${this.serverKey}`,
        },
        body: JSON.stringify({
          to: `/topics/${topic}`,
          registration_tokens: tokenArray,
        }),
      });

      if (response.ok) {
        logger.info("Tokens subscribed to topic successfully", {
          topic,
          tokenCount: tokenArray.length,
          functionName: "PushNotificationService.subscribeToTopic",
        });

        return { success: true };
      } else {
        const errorData = await response.text();
        logger.error("Failed to subscribe tokens to topic", {
          topic,
          status: response.status,
          error: errorData,
          functionName: "PushNotificationService.subscribeToTopic",
        });

        return {
          success: false,
          error: `Subscription failed: ${errorData}`,
        };
      }
    } catch (error) {
      logger.error("Error subscribing tokens to topic", {
        topic,
        error: error instanceof Error ? error.message : String(error),
        functionName: "PushNotificationService.subscribeToTopic",
      });

      return {
        success: false,
        error: `Subscription error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Unsubscribe token from topic
   */
  async unsubscribeFromTopic(
    tokens: string | string[],
    topic: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: "Push notification service not configured",
      };
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      const url = `https://iid.googleapis.com/iid/v1:batchRemove`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${this.serverKey}`,
        },
        body: JSON.stringify({
          to: `/topics/${topic}`,
          registration_tokens: tokenArray,
        }),
      });

      if (response.ok) {
        logger.info("Tokens unsubscribed from topic successfully", {
          topic,
          tokenCount: tokenArray.length,
          functionName: "PushNotificationService.unsubscribeFromTopic",
        });

        return { success: true };
      } else {
        const errorData = await response.text();
        logger.error("Failed to unsubscribe tokens from topic", {
          topic,
          status: response.status,
          error: errorData,
          functionName: "PushNotificationService.unsubscribeFromTopic",
        });

        return {
          success: false,
          error: `Unsubscription failed: ${errorData}`,
        };
      }
    } catch (error) {
      logger.error("Error unsubscribing tokens from topic", {
        topic,
        error: error instanceof Error ? error.message : String(error),
        functionName: "PushNotificationService.unsubscribeFromTopic",
      });

      return {
        success: false,
        error: `Unsubscription error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Send FCM request
   */
  private async sendFCMRequest(payload: any): Promise<any> {
    const url = `https://fcm.googleapis.com/fcm/send`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${this.serverKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FCM request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Mask token for logging (show only first and last 4 characters)
   */
  private maskToken(token: string): string {
    if (token.length <= 8) {
      return "****";
    }
    return token.slice(0, 4) + "*".repeat(token.length - 8) + token.slice(-4);
  }
}

import { google, gmail_v1 } from "googleapis";
import { OAuth2Service } from "./oauth2.service";
import { ProcessedEmailRepository } from "@/repositories/processed-email.repository";
import { logger } from "@/utils/logger";
import { ProcessedEmail, CreateProcessedEmailInput } from "@/types";
import crypto from "crypto";

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: gmail_v1.Schema$MessagePart;
  internalDate: string;
  historyId: string;
  sizeEstimate: number;
}

export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: Buffer;
}

export interface EmailFilterCriteria {
  keywords: string[];
  senderDomains?: string[];
  hasAttachment: boolean;
  attachmentTypes?: string[];
}

/**
 * Gmail API Integration Service
 * Handles email monitoring, filtering, and attachment processing for StillOnTime schedules
 */
export class GmailService {
  private oauth2Service: OAuth2Service;
  private processedEmailRepository: ProcessedEmailRepository;

  // StillOnTime email filtering criteria
  private readonly SCHEDULE_KEYWORDS = [
    "shooting schedule",
    "call sheet",
    "schedule",
    "filming",
    // Polish keywords for backward compatibility
    "plan zdjęciowy",
    "drabinka",
    "harmonogram",
    "zdjęcia",
    "call time",
    "shooting schedule",
    "film schedule",
    "production schedule",
    "stillontime",
  ];

  private readonly TRUSTED_SENDER_DOMAINS = [
    "stillontime.pl",
    "gmail.com", // For testing - remove in production
    // Add more trusted domains as needed
  ];

  private readonly PDF_MIME_TYPES = ["application/pdf", "application/x-pdf"];

  constructor(
    oauth2Service: OAuth2Service,
    processedEmailRepository: ProcessedEmailRepository
  ) {
    this.oauth2Service = oauth2Service;
    this.processedEmailRepository = processedEmailRepository;
  }

  /**
   * Monitor Gmail for new schedule emails
   */
  async monitorEmails(userId: string): Promise<void> {
    try {
      logger.info("Starting email monitoring for user", { userId });

      const scheduleEmails = await this.getScheduleEmails(userId);

      logger.info("Found schedule emails", {
        userId,
        count: scheduleEmails.length,
      });

      for (const email of scheduleEmails) {
        try {
          await this.processScheduleEmail(userId, email);
        } catch (error) {
          logger.error("Failed to process individual email", {
            userId,
            messageId: email.id,
            error,
          });
        }
      }

      logger.info("Completed email monitoring for user", { userId });
    } catch (error) {
      logger.error("Failed to monitor emails", { userId, error });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Email monitoring failed: ${errorMessage}`);
    }
  }

  /**
   * Get emails matching StillOnTime schedule criteria
   */
  async getScheduleEmails(userId: string): Promise<GmailMessage[]> {
    try {
      const oauth2Client = await this.oauth2Service.getGoogleClient(userId);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // Build search query for schedule emails
      const query = this.buildScheduleSearchQuery();

      logger.debug("Searching for schedule emails", { userId, query });

      const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 50, // Limit to prevent overwhelming processing
      });

      if (!response.data.messages) {
        logger.info("No schedule emails found", { userId });
        return [];
      }

      // Get full message details for each email
      const messages: GmailMessage[] = [];

      for (const message of response.data.messages) {
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: "me",
            id: message.id!,
            format: "full",
          });

          if (fullMessage.data) {
            messages.push(fullMessage.data as GmailMessage);
          }
        } catch (error) {
          logger.warn("Failed to get full message details", {
            userId,
            messageId: message.id,
            error,
          });
        }
      }

      // Filter messages that match our criteria
      const filteredMessages = messages.filter((message) =>
        this.validateScheduleEmail(message)
      );

      logger.info("Filtered schedule emails", {
        userId,
        total: messages.length,
        filtered: filteredMessages.length,
      });

      return filteredMessages;
    } catch (error) {
      logger.error("Failed to get schedule emails", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
        requiresReauth: error instanceof Error && error.message.includes("re-authenticate")
      });

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Provide specific error messages for auth failures
      if (errorMessage.includes("re-authenticate")) {
        throw new Error("Gmail authentication expired - please re-authenticate");
      }

      throw new Error(`Failed to retrieve schedule emails: ${errorMessage}`);
    }
  }

  /**
   * Check if email has already been processed
   */
  async isEmailProcessed(messageId: string): Promise<boolean> {
    try {
      const existingEmail = await this.processedEmailRepository.findByMessageId(
        messageId
      );
      return existingEmail !== null;
    } catch (error) {
      logger.error("Failed to check if email is processed", {
        messageId,
        error,
      });
      return false; // Assume not processed on error to avoid missing emails
    }
  }

  /**
   * Mark email as processed in database
   */
  async markAsProcessed(
    emailData: CreateProcessedEmailInput
  ): Promise<ProcessedEmail> {
    try {
      return await this.processedEmailRepository.create(emailData);
    } catch (error) {
      logger.error("Failed to mark email as processed", {
        messageId: emailData.messageId,
        error,
      });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to mark email as processed: ${errorMessage}`);
    }
  }

  /**
   * Validate if email matches StillOnTime schedule criteria
   */
  validateScheduleEmail(email: GmailMessage): boolean {
    try {
      // Extract email headers
      const headers = email.payload?.headers || [];
      const subject = this.getHeaderValue(headers, "Subject") || "";
      const from = this.getHeaderValue(headers, "From") || "";

      // Check subject contains schedule keywords
      const hasScheduleKeywords = this.SCHEDULE_KEYWORDS.some((keyword) =>
        subject.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasScheduleKeywords) {
        logger.debug("Email rejected: no schedule keywords in subject", {
          messageId: email.id,
          subject,
        });
        return false;
      }

      // Check sender domain (optional - can be disabled for testing)
      const senderDomain = this.extractDomainFromEmail(from);
      const isTrustedSender = this.TRUSTED_SENDER_DOMAINS.some((domain) =>
        senderDomain.includes(domain)
      );

      if (!isTrustedSender) {
        logger.debug("Email rejected: untrusted sender domain", {
          messageId: email.id,
          from,
          senderDomain,
        });
        // For now, we'll allow all senders but log the warning
        // return false;
      }

      // Check for PDF attachments
      const hasPdfAttachment = this.hasPdfAttachment(email.payload);

      if (!hasPdfAttachment) {
        logger.debug("Email rejected: no PDF attachment", {
          messageId: email.id,
          subject,
        });
        return false;
      }

      logger.debug("Email validated successfully", {
        messageId: email.id,
        subject,
        from,
      });

      return true;
    } catch (error) {
      logger.error("Failed to validate schedule email", {
        messageId: email.id,
        error,
      });
      return false;
    }
  }

  /**
   * Download email attachment by attachment ID
   */
  async downloadAttachment(
    userId: string,
    messageId: string,
    attachmentId: string
  ): Promise<Buffer> {
    try {
      const oauth2Client = await this.oauth2Service.getGoogleClient(userId);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      logger.debug("Downloading email attachment", {
        userId,
        messageId,
        attachmentId,
      });

      const response = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
      });

      if (!response.data.data) {
        throw new Error("No attachment data received");
      }

      // Decode base64url data
      const attachmentData = Buffer.from(response.data.data, "base64url");

      logger.info("Successfully downloaded attachment", {
        userId,
        messageId,
        attachmentId,
        size: attachmentData.length,
      });

      return attachmentData;
    } catch (error) {
      logger.error("Failed to download attachment", {
        userId,
        messageId,
        attachmentId,
        error: error instanceof Error ? error.message : "Unknown error",
        requiresReauth: error instanceof Error && error.message.includes("re-authenticate")
      });

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Provide specific error messages for auth failures
      if (errorMessage.includes("re-authenticate")) {
        throw new Error("Gmail authentication expired - please re-authenticate");
      }

      throw new Error(`Failed to download attachment: ${errorMessage}`);
    }
  }

  /**
   * Get all PDF attachments from an email
   */
  async getEmailAttachments(
    userId: string,
    email: GmailMessage
  ): Promise<EmailAttachment[]> {
    try {
      const attachments: EmailAttachment[] = [];

      const extractAttachments = (part: gmail_v1.Schema$MessagePart) => {
        if (part.body?.attachmentId && part.filename) {
          // Check if it's a PDF
          if (
            part.mimeType &&
            this.PDF_MIME_TYPES.includes(part.mimeType.toLowerCase())
          ) {
            attachments.push({
              attachmentId: part.body.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size || 0,
            });
          }
        }

        // Recursively check parts
        if (part.parts) {
          part.parts.forEach(extractAttachments);
        }
      };

      if (email.payload) {
        extractAttachments(email.payload);
      }

      // Download attachment data
      for (const attachment of attachments) {
        try {
          attachment.data = await this.downloadAttachment(
            userId,
            email.id,
            attachment.attachmentId
          );
        } catch (error) {
          logger.warn("Failed to download attachment data", {
            userId,
            messageId: email.id,
            attachmentId: attachment.attachmentId,
            error,
          });
        }
      }

      logger.info("Retrieved email attachments", {
        userId,
        messageId: email.id,
        attachmentCount: attachments.length,
      });

      return attachments;
    } catch (error) {
      logger.error("Failed to get email attachments", {
        userId,
        messageId: email.id,
        error,
      });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get email attachments: ${errorMessage}`);
    }
  }

  /**
   * Process a single schedule email
   */
  private async processScheduleEmail(
    userId: string,
    email: GmailMessage
  ): Promise<void> {
    try {
      // Check if already processed
      const isProcessed = await this.isEmailProcessed(email.id);
      if (isProcessed) {
        logger.debug("Email already processed, skipping", {
          userId,
          messageId: email.id,
        });
        return;
      }

      // Extract email metadata
      const headers = email.payload?.headers || [];
      const subject = this.getHeaderValue(headers, "Subject") || "";
      const from = this.getHeaderValue(headers, "From") || "";
      const receivedAt = new Date(parseInt(email.internalDate));

      // Get PDF attachments
      const attachments = await this.getEmailAttachments(userId, email);

      if (attachments.length === 0) {
        logger.warn("No PDF attachments found in schedule email", {
          userId,
          messageId: email.id,
          subject,
        });
        return;
      }

      // Generate PDF hash for duplicate detection
      const pdfHash = attachments[0].data
        ? this.processedEmailRepository.generatePdfHash(attachments[0].data)
        : undefined;

      // Check for PDF duplicate
      if (pdfHash) {
        const isDuplicate = await this.processedEmailRepository.isDuplicate(
          email.id,
          pdfHash
        );

        if (isDuplicate) {
          logger.info("Email contains duplicate PDF, skipping", {
            userId,
            messageId: email.id,
            pdfHash,
          });
          return;
        }
      }

      // Create processed email record
      const emailData: CreateProcessedEmailInput = {
        messageId: email.id,
        subject,
        sender: from,
        receivedAt,
        threadId: email.threadId,
        processed: false,
        processingStatus: "pending",
        pdfHash,
        user: {
          connect: { id: userId },
        },
      };

      await this.markAsProcessed(emailData);

      logger.info("Successfully processed schedule email", {
        userId,
        messageId: email.id,
        subject,
        attachmentCount: attachments.length,
      });
    } catch (error) {
      logger.error("Failed to process schedule email", {
        userId,
        messageId: email.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Build Gmail search query for schedule emails
   */
  private buildScheduleSearchQuery(): string {
    const keywordQuery = this.SCHEDULE_KEYWORDS.map(
      (keyword) => `"${keyword}"`
    ).join(" OR ");

    return `(${keywordQuery}) has:attachment filename:pdf`;
  }

  /**
   * Extract header value from Gmail message headers
   */
  protected getHeaderValue(
    headers: gmail_v1.Schema$MessagePartHeader[],
    name: string
  ): string | undefined {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || undefined;
  }

  /**
   * Extract domain from email address
   */
  private extractDomainFromEmail(email: string): string {
    const match = email.match(/@([^>]+)/);
    return match ? match[1].toLowerCase() : "";
  }

  /**
   * Check if email has PDF attachment
   */
  private hasPdfAttachment(payload?: gmail_v1.Schema$MessagePart): boolean {
    if (!payload) return false;

    const checkPart = (part: gmail_v1.Schema$MessagePart): boolean => {
      // Check if this part is a PDF attachment
      if (
        part.body?.attachmentId &&
        part.mimeType &&
        this.PDF_MIME_TYPES.includes(part.mimeType.toLowerCase())
      ) {
        return true;
      }

      // Recursively check sub-parts
      if (part.parts) {
        return part.parts.some(checkPart);
      }

      return false;
    };

    return checkPart(payload);
  }

  /**
   * Get email processing statistics for monitoring
   */
  async getEmailStats(userId: string): Promise<{
    totalEmails: number;
    processedEmails: number;
    pendingEmails: number;
    failedEmails: number;
    lastCheck: Date;
  }> {
    try {
      const stats = await this.processedEmailRepository.getProcessingStats(
        userId
      );

      return {
        totalEmails: stats.total,
        processedEmails: stats.processed,
        pendingEmails: stats.pending,
        failedEmails: stats.failed,
        lastCheck: new Date(),
      };
    } catch (error) {
      logger.error("Failed to get email stats", { userId, error });
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get email statistics: ${errorMessage}`);
    }
  }

  /**
   * Manually trigger email processing for a specific message
   */
  async processSpecificEmail(userId: string, messageId: string): Promise<void> {
    try {
      logger.info("Manually processing specific email", { userId, messageId });

      const oauth2Client = await this.oauth2Service.getGoogleClient(userId);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // Get the specific message
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      if (!response.data) {
        throw new Error("Email not found");
      }

      const email = response.data as GmailMessage;

      // Validate and process the email
      if (this.validateScheduleEmail(email)) {
        await this.processScheduleEmail(userId, email);
        logger.info("Successfully processed specific email", {
          userId,
          messageId,
        });
      } else {
        throw new Error("Email does not match schedule criteria");
      }
    } catch (error) {
      logger.error("Failed to process specific email", {
        userId,
        messageId,
        error: error instanceof Error ? error.message : "Unknown error",
        requiresReauth: error instanceof Error && error.message.includes("re-authenticate")
      });

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Provide specific error messages for auth failures
      if (errorMessage.includes("re-authenticate")) {
        throw new Error("Gmail authentication expired - please re-authenticate");
      }

      throw new Error(`Failed to process email: ${errorMessage}`);
    }
  }
}

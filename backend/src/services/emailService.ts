import { GmailService } from './gmailService';
import { PDFService } from './pdfService';
import { ProcessedEmailService } from './processedEmailService';
import { ScheduleExtractionService } from './scheduleExtractionService';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { createHash } from 'crypto';
import { Queue } from 'bull';
import Redis from 'redis';

// Types
interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: Date;
  hasAttachments: boolean;
  snippet?: string;
  body?: string;
}

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface ProcessedEmailResult {
  emailId: string;
  success: boolean;
  scheduleData?: any;
  error?: string;
  pdfHash?: string;
}

interface ScheduleData {
  shootingDate: Date;
  callTime: string;
  location: string;
  baseLocation?: string;
  sceneType: string;
  scenes?: any[];
  safetyNotes?: string;
  equipment?: any[];
  contacts?: any;
  notes?: string;
}

export class EmailService {
  private gmailService: GmailService;
  private pdfService: PDFService;
  private processedEmailService: ProcessedEmailService;
  private scheduleExtractionService: ScheduleExtractionService;
  private emailQueue: Queue;
  private redisClient: Redis.RedisClientType;

  constructor() {
    this.gmailService = new GmailService();
    this.pdfService = new PDFService();
    this.processedEmailService = new ProcessedEmailService();
    this.scheduleExtractionService = new ScheduleExtractionService();

    // Initialize Redis for queue
    this.redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    // Initialize email processing queue
    this.emailQueue = new Queue('email processing', {
      redis: {
        port: 6379,
        host: 'localhost',
        ...(process.env.REDIS_URL && { url: process.env.REDIS_URL })
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupQueueProcessors();
  }

  /**
   * Setup queue processors for email processing
   */
  private setupQueueProcessors() {
    this.emailQueue.process('fetch-emails', 5, async (job) => {
      const { userId } = job.data;
      return await this.fetchUnprocessedEmails(userId);
    });

    this.emailQueue.process('process-email', 10, async (job) => {
      const { userId, messageId } = job.data;
      return await this.processSingleEmail(userId, messageId);
    });

    this.emailQueue.process('extract-schedule', 5, async (job) => {
      const { userId, emailId, attachmentId } = job.data;
      return await this.extractScheduleFromAttachment(userId, emailId, attachmentId);
    });

    // Error handling
    this.emailQueue.on('failed', (job, err) => {
      logger.error('Email processing job failed', {
        jobId: job.id,
        jobType: job.name,
        error: err.message,
        data: job.data
      });
    });

    this.emailQueue.on('completed', (job, result) => {
      logger.info('Email processing job completed', {
        jobId: job.id,
        jobType: job.name,
        result
      });
    });
  }

  /**
   * Fetch unprocessed emails from Gmail
   */
  async fetchUnprocessedEmails(userId: string): Promise<EmailMessage[]> {
    try {
      logger.info('Fetching unprocessed emails', { userId });

      // Get recent emails from Gmail
      const emails = await this.gmailService.fetchUnprocessedEmails(userId);

      // Filter out already processed emails
      const unprocessedEmails = await this.deduplicateEmails(emails);

      logger.info(`Found ${unprocessedEmails.length} unprocessed emails`, {
        userId,
        totalFetched: emails.length,
        unprocessed: unprocessedEmails.length
      });

      return unprocessedEmails;
    } catch (error: any) {
      logger.error('Failed to fetch emails from Gmail', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Process a single email message
   */
  async processSingleEmail(userId: string, messageId: string): Promise<ProcessedEmailResult> {
    try {
      logger.info('Processing email', { userId, messageId });

      // Get full email details
      const email = await this.gmailService.getEmailDetails(userId, messageId);

      // Store in database
      const storedEmail = await this.processedEmailService.storeEmail({
        messageId: email.id,
        threadId: email.threadId,
        subject: email.subject,
        sender: email.from,
        receivedAt: email.date,
        userId,
        processed: false,
        processingStatus: 'processing'
      });

      // Check for PDF attachments
      const attachments = await this.gmailService.getEmailAttachments(userId, messageId);
      const pdfAttachments = attachments.filter(att =>
        att.mimeType === 'application/pdf' &&
        att.filename.toLowerCase().includes('.pdf')
      );

      if (pdfAttachments.length === 0) {
        await this.processedEmailService.updateStatus(storedEmail.id, 'no-pdf');
        return {
          emailId: storedEmail.id,
          success: false,
          error: 'No PDF attachments found'
        };
      }

      // Process PDF attachments
      const pdfResult = await this.processEmailAttachments(
        userId,
        messageId,
        pdfAttachments
      );

      if (!pdfResult.success) {
        await this.processedEmailService.updateStatus(storedEmail.id, 'pdf-error');
        return {
          emailId: storedEmail.id,
          success: false,
          error: pdfResult.error
        };
      }

      // Extract and store schedule data
      const schedule = await this.storeScheduleData(
        userId,
        storedEmail.id,
        pdfResult.scheduleData
      );

      // Update email status
      await this.processedEmailService.updateStatus(storedEmail.id, 'completed');

      // Store PDF hash for deduplication
      if (pdfResult.pdfHash) {
        await this.processedEmailService.updatePdfHash(storedEmail.id, pdfResult.pdfHash);
      }

      logger.info('Email processed successfully', {
        userId,
        messageId,
        emailId: storedEmail.id,
        scheduleId: schedule.id
      });

      return {
        emailId: storedEmail.id,
        success: true,
        scheduleData: pdfResult.scheduleData,
        pdfHash: pdfResult.pdfHash
      };

    } catch (error: any) {
      logger.error('Failed to process email', {
        userId,
        messageId,
        error: error.message,
        stack: error.stack
      });

      // Update email status to failed
      try {
        const email = await this.processedEmailService.findByMessageId(messageId);
        if (email) {
          await this.processedEmailService.updateStatus(email.id, 'failed', error.message);
        }
      } catch (updateError) {
        logger.error('Failed to update email status', { messageId, error: updateError });
      }

      return {
        emailId: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process PDF attachments from email
   */
  async processEmailAttachments(
    userId: string,
    messageId: string,
    attachments: EmailAttachment[]
  ): Promise<{ success: boolean; scheduleData?: any; error?: string; pdfHash?: string }> {
    try {
      const pdfAttachments = attachments.filter(att => att.mimeType === 'application/pdf');

      if (pdfAttachments.length === 0) {
        return {
          success: false,
          error: 'No PDF attachments found'
        };
      }

      // Process the first PDF attachment (most schedules have one PDF)
      const attachment = pdfAttachments[0];

      // Download PDF
      const pdfBuffer = await this.gmailService.downloadAttachment(
        userId,
        messageId,
        attachment.id
      );

      // Create hash for deduplication
      const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex');

      // Check if we've already processed this PDF
      const existingEmail = await this.processedEmailService.findByPdfHash(pdfHash);
      if (existingEmail) {
        logger.info('PDF already processed', { pdfHash, existingEmailId: existingEmail.id });
        return {
          success: false,
          error: 'PDF already processed',
          pdfHash
        };
      }

      // Extract schedule data from PDF
      const scheduleData = await this.pdfService.extractScheduleData(pdfBuffer);

      if (!scheduleData) {
        return {
          success: false,
          error: 'Could not extract schedule data from PDF',
          pdfHash
        };
      }

      // Validate extracted data
      const validationResult = await this.validateScheduleData(scheduleData);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid schedule data: ${validationResult.errors.join(', ')}`,
          pdfHash
        };
      }

      return {
        success: true,
        scheduleData,
        pdfHash
      };

    } catch (error: any) {
      logger.warn('Failed to extract schedule data from PDF', {
        userId,
        messageId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Store schedule data in database
   */
  private async storeScheduleData(
    userId: string,
    emailId: string,
    scheduleData: any
  ): Promise<any> {
    try {
      const schedule = await prisma.scheduleData.create({
        data: {
          shootingDate: scheduleData.shootingDate,
          callTime: scheduleData.callTime,
          location: scheduleData.location,
          baseLocation: scheduleData.baseLocation,
          sceneType: scheduleData.sceneType,
          scenes: scheduleData.scenes || {},
          safetyNotes: scheduleData.safetyNotes,
          equipment: scheduleData.equipment || {},
          contacts: scheduleData.contacts || {},
          notes: scheduleData.notes,
          userId,
          emailId
        }
      });

      logger.info('Schedule data stored', {
        userId,
        emailId,
        scheduleId: schedule.id,
        shootingDate: scheduleData.shootingDate
      });

      return schedule;
    } catch (error: any) {
      logger.error('Failed to store schedule data', {
        userId,
        emailId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process multiple emails in queue
   */
  async processEmailQueue(userId: string): Promise<ProcessedEmailResult[]> {
    try {
      // Fetch unprocessed emails
      const emails = await this.fetchUnprocessedEmails(userId);

      if (emails.length === 0) {
        logger.info('No unprocessed emails found', { userId });
        return [];
      }

      // Add emails to processing queue
      const jobs = emails.map(email => ({
        name: 'process-email',
        data: { userId, messageId: email.id }
      }));

      const batch = await this.emailQueue.addBulk(jobs);

      // Wait for all jobs to complete
      const results = await Promise.all(
        batch.map(job => job.finished())
      );

      return results;
    } catch (error: any) {
      logger.error('Failed to process email queue', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Filter out already processed emails
   */
  private async deduplicateEmails(emails: EmailMessage[]): Promise<EmailMessage[]> {
    try {
      const messageIds = emails.map(e => e.id);
      const processedEmails = await prisma.processedEmail.findMany({
        where: {
          messageId: {
            in: messageIds
          }
        },
        select: { messageId: true }
      });

      const processedIds = new Set(processedEmails.map(e => e.messageId));
      return emails.filter(email => !processedIds.has(email.id));
    } catch (error: any) {
      logger.error('Failed to deduplicate emails', { error: error.message });
      // If deduplication fails, return all emails
      return emails;
    }
  }

  /**
   * Validate extracted schedule data
   */
  private async validateScheduleData(data: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Required fields
    if (!data.shootingDate) {
      errors.push('Shooting date is required');
    }
    if (!data.callTime) {
      errors.push('Call time is required');
    }
    if (!data.location) {
      errors.push('Location is required');
    }
    if (!data.sceneType) {
      errors.push('Scene type is required');
    }

    // Validate date
    if (data.shootingDate) {
      const date = new Date(data.shootingDate);
      if (isNaN(date.getTime())) {
        errors.push('Invalid shooting date format');
      } else if (date < new Date()) {
        errors.push('Shooting date cannot be in the past');
      }
    }

    // Validate call time format
    if (data.callTime && !/^\d{2}:\d{2}$/.test(data.callTime)) {
      errors.push('Call time must be in HH:MM format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract schedule from specific attachment
   */
  private async extractScheduleFromAttachment(
    userId: string,
    emailId: string,
    attachmentId: string
  ): Promise<any> {
    try {
      const email = await this.processedEmailService.findById(emailId);
      if (!email) {
        throw new Error('Email not found');
      }

      const attachments = await this.gmailService.getEmailAttachments(userId, email.messageId);
      const attachment = attachments.find(a => a.id === attachmentId);

      if (!attachment) {
        throw new Error('Attachment not found');
      }

      const result = await this.processEmailAttachments(
        userId,
        email.messageId,
        [attachment]
      );

      if (result.success && result.scheduleData) {
        await this.storeScheduleData(userId, emailId, result.scheduleData);
        await this.processedEmailService.updateStatus(emailId, 'completed');
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to extract schedule from attachment', {
        userId,
        emailId,
        attachmentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(userId: string): Promise<any> {
    try {
      const [total, processed, failed, pending] = await Promise.all([
        prisma.processedEmail.count({ where: { userId } }),
        prisma.processedEmail.count({
          where: { userId, processingStatus: 'completed' }
        }),
        prisma.processedEmail.count({
          where: { userId, processingStatus: 'failed' }
        }),
        prisma.processedEmail.count({
          where: { userId, processingStatus: 'pending' }
        })
      ]);

      const queueStats = await this.emailQueue.getJobCounts();

      return {
        total,
        processed,
        failed,
        pending,
        queue: queueStats,
        successRate: total > 0 ? (processed / total) * 100 : 0
      };
    } catch (error: any) {
      logger.error('Failed to get processing stats', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cleanup old processed emails
   */
  async cleanupOldEmails(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.processedEmail.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          processingStatus: 'completed'
        }
      });

      logger.info('Cleaned up old emails', {
        daysOld,
        deletedCount: result.count
      });

      return result.count;
    } catch (error: any) {
      logger.error('Failed to cleanup old emails', {
        daysOld,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retry failed emails
   */
  async retryFailedEmails(userId: string): Promise<number> {
    try {
      const failedEmails = await prisma.processedEmail.findMany({
        where: {
          userId,
          processingStatus: 'failed'
        }
      });

      let retriedCount = 0;

      for (const email of failedEmails) {
        // Reset status to pending
        await this.processedEmailService.updateStatus(email.id, 'pending');

        // Add to queue
        await this.emailQueue.add('process-email', {
          userId,
          messageId: email.messageId
        });

        retriedCount++;
      }

      logger.info('Retried failed emails', {
        userId,
        retriedCount
      });

      return retriedCount;
    } catch (error: any) {
      logger.error('Failed to retry emails', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}
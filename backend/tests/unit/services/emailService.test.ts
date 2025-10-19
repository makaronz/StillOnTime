import { EmailService } from '@/services/emailService';
import { ProcessedEmailService } from '@/services/processedEmailService';
import { PDFService } from '@/services/pdfService';
import { GmailService } from '@/services/gmailService';
import { ScheduleExtractionService } from '@/services/scheduleExtractionService';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/config/database');
jest.mock('@/utils/logger');
jest.mock('@/services/pdfService');
jest.mock('@/services/gmailService');
jest.mock('@/services/scheduleExtractionService');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const MockPDFService = PDFService as jest.MockedClass<typeof PDFService>;
const MockGmailService = GmailService as jest.MockedClass<typeof GmailService>;
const MockScheduleExtractionService = ScheduleExtractionService as jest.MockedClass<typeof ScheduleExtractionService>;

describe('EmailService', () => {
  let emailService: EmailService;
  let mockGmail: jest.Mocked<GmailService>;
  let mockPDF: jest.Mocked<PDFService>;
  let mockScheduleExtraction: jest.Mocked<ScheduleExtractionService>;

  beforeEach(() => {
    jest.clearAllMocks();

    emailService = new EmailService();
    mockGmail = new MockGmailService() as jest.Mocked<GmailService>;
    mockPDF = new MockPDFService() as jest.Mocked<PDFService>;
    mockScheduleExtraction = new MockScheduleExtractionService() as jest.Mocked<ScheduleExtractionService>;
  });

  describe('fetchUnprocessedEmails', () => {
    it('should fetch unprocessed emails from Gmail', async () => {
      // Arrange
      const mockEmails = [
        {
          id: 'msg1',
          threadId: 'thread1',
          subject: 'Tomorrow Shoot Schedule',
          from: 'production@studio.com',
          date: new Date(),
          hasAttachments: true
        },
        {
          id: 'msg2',
          threadId: 'thread2',
          subject: 'Schedule Update',
          from: 'producer@studio.com',
          date: new Date(),
          hasAttachments: false
        }
      ];

      mockGmail.fetchUnprocessedEmails.mockResolvedValue(mockEmails);

      // Act
      const emails = await emailService.fetchUnprocessedEmails('user123');

      // Assert
      expect(mockGmail.fetchUnprocessedEmails).toHaveBeenCalledWith('user123');
      expect(emails).toHaveLength(2);
      expect(emails[0].subject).toBe('Tomorrow Shoot Schedule');
    });

    it('should handle Gmail API errors gracefully', async () => {
      // Arrange
      mockGmail.fetchUnprocessedEmails.mockRejectedValue(new Error('Gmail API error'));

      // Act & Assert
      await expect(emailService.fetchUnprocessedEmails('user123'))
        .rejects.toThrow('Gmail API error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch emails from Gmail',
        expect.any(Object)
      );
    });
  });

  describe('processEmailAttachments', () => {
    it('should process PDF attachments and extract schedule data', async () => {
      // Arrange
      const mockAttachment = {
        id: 'att1',
        filename: 'schedule.pdf',
        mimeType: 'application/pdf',
        size: 1024000
      };

      const mockPDFBuffer = Buffer.from('mock pdf content');
      const mockExtractedData = {
        shootingDate: new Date('2024-01-15'),
        callTime: '08:00',
        location: 'Studio A',
        scenes: [
          { sceneNumber: '1', description: 'Opening scene', location: 'Studio A' },
          { sceneNumber: '2', description: 'Car chase', location: 'Backlot' }
        ],
        contacts: {
          director: 'John Doe',
          cinematographer: 'Jane Smith'
        }
      };

      mockGmail.downloadAttachment.mockResolvedValue(mockPDFBuffer);
      mockPDF.extractScheduleData.mockResolvedValue(mockExtractedData);

      // Act
      const result = await emailService.processEmailAttachments(
        'user123',
        'msg1',
        [mockAttachment]
      );

      // Assert
      expect(mockGmail.downloadAttachment).toHaveBeenCalledWith('user123', 'msg1', 'att1');
      expect(mockPDF.extractScheduleData).toHaveBeenCalledWith(mockPDFBuffer);
      expect(result).toEqual({
        success: true,
        scheduleData: mockExtractedData,
        pdfHash: expect.any(String)
      });
    });

    it('should handle non-PDF attachments', async () => {
      // Arrange
      const mockAttachment = {
        id: 'att2',
        filename: 'image.jpg',
        mimeType: 'image/jpeg',
        size: 512000
      };

      // Act
      const result = await emailService.processEmailAttachments(
        'user123',
        'msg1',
        [mockAttachment]
      );

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Attachment is not a PDF'
      });
      expect(mockGmail.downloadAttachment).not.toHaveBeenCalled();
    });

    it('should handle corrupted PDF files', async () => {
      // Arrange
      const mockAttachment = {
        id: 'att3',
        filename: 'corrupted.pdf',
        mimeType: 'application/pdf',
        size: 1024
      };

      mockGmail.downloadAttachment.mockResolvedValue(Buffer.from('corrupted content'));
      mockPDF.extractScheduleData.mockRejectedValue(new Error('Invalid PDF format'));

      // Act
      const result = await emailService.processEmailAttachments(
        'user123',
        'msg1',
        [mockAttachment]
      );

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid PDF format'
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to extract schedule data from PDF',
        expect.any(Object)
      );
    });
  });

  describe('storeProcessedEmail', () => {
    it('should store processed email in database', async () => {
      // Arrange
      const emailData = {
        messageId: 'msg1',
        threadId: 'thread1',
        subject: 'Schedule',
        sender: 'studio@example.com',
        receivedAt: new Date(),
        userId: 'user123',
        processed: true,
        processingStatus: 'completed'
      };

      const mockStoredEmail = {
        id: 'email1',
        ...emailData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.processedEmail.create.mockResolvedValue(mockStoredEmail as any);

      // Act
      const result = await emailService.storeProcessedEmail(emailData);

      // Assert
      expect(mockPrisma.processedEmail.create).toHaveBeenCalledWith({
        data: emailData
      });
      expect(result).toEqual(mockStoredEmail);
    });

    it('should handle database errors when storing email', async () => {
      // Arrange
      const emailData = {
        messageId: 'msg1',
        subject: 'Schedule',
        sender: 'studio@example.com',
        receivedAt: new Date(),
        userId: 'user123'
      };

      mockPrisma.processedEmail.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(emailService.storeProcessedEmail(emailData))
        .rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store processed email',
        expect.any(Object)
      );
    });
  });

  describe('processEmailQueue', () => {
    it('should process multiple emails in batch', async () => {
      // Arrange
      const mockEmails = [
        {
          id: 'msg1',
          threadId: 'thread1',
          subject: 'Schedule 1',
          from: 'studio@example.com',
          date: new Date(),
          hasAttachments: true
        },
        {
          id: 'msg2',
          threadId: 'thread2',
          subject: 'Schedule 2',
          from: 'producer@example.com',
          date: new Date(),
          hasAttachments: true
        }
      ];

      const mockAttachments = [
        {
          id: 'att1',
          filename: 'schedule1.pdf',
          mimeType: 'application/pdf',
          size: 1024000
        }
      ];

      const mockExtractedData = {
        shootingDate: new Date('2024-01-15'),
        callTime: '08:00',
        location: 'Studio A'
      };

      mockGmail.fetchUnprocessedEmails.mockResolvedValue(mockEmails);
      mockGmail.getEmailAttachments.mockResolvedValue(mockAttachments);
      mockGmail.downloadAttachment.mockResolvedValue(Buffer.from('pdf content'));
      mockPDF.extractScheduleData.mockResolvedValue(mockExtractedData);

      mockPrisma.processedEmail.create.mockResolvedValue({
        id: 'email1',
        messageId: 'msg1',
        processingStatus: 'completed'
      } as any);

      mockPrisma.scheduleData.create.mockResolvedValue({
        id: 'schedule1',
        shootingDate: mockExtractedData.shootingDate
      } as any);

      // Act
      const results = await emailService.processEmailQueue('user123');

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(mockPrisma.processedEmail.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.scheduleData.create).toHaveBeenCalledTimes(2);
    });

    it('should continue processing other emails if one fails', async () => {
      // Arrange
      const mockEmails = [
        {
          id: 'msg1',
          threadId: 'thread1',
          subject: 'Valid Schedule',
          from: 'studio@example.com',
          date: new Date(),
          hasAttachments: true
        },
        {
          id: 'msg2',
          threadId: 'thread2',
          subject: 'Invalid Email',
          from: 'spam@example.com',
          date: new Date(),
          hasAttachments: false
        }
      ];

      mockGmail.fetchUnprocessedEmails.mockResolvedValue(mockEmails);
      mockGmail.getEmailAttachments.mockResolvedValue([]);

      // Mock successful processing for first email
      mockPrisma.processedEmail.create.mockResolvedValueOnce({
        id: 'email1',
        messageId: 'msg1',
        processingStatus: 'completed'
      } as any);

      // Mock failure for second email
      mockPrisma.processedEmail.create.mockRejectedValueOnce(new Error('Processing failed'));

      // Act
      const results = await emailService.processEmailQueue('user123');

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Processing failed');
    });
  });

  describe('deduplicateEmails', () => {
    it('should filter out already processed emails', async () => {
      // Arrange
      const emails = [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' },
        { id: 'msg3', threadId: 'thread3' }
      ];

      mockPrisma.processedEmail.findMany.mockResolvedValue([
        { messageId: 'msg1' },
        { messageId: 'msg3' }
      ] as any);

      // Act
      const unprocessed = await emailService.deduplicateEmails(emails);

      // Assert
      expect(unprocessed).toHaveLength(1);
      expect(unprocessed[0].id).toBe('msg2');
    });

    it('should return all emails if none are processed', async () => {
      // Arrange
      const emails = [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' }
      ];

      mockPrisma.processedEmail.findMany.mockResolvedValue([]);

      // Act
      const unprocessed = await emailService.deduplicateEmails(emails);

      // Assert
      expect(unprocessed).toHaveLength(2);
    });
  });

  describe('markEmailAsProcessed', () => {
    it('should update email processing status', async () => {
      // Arrange
      const messageId = 'msg1';
      const status = 'completed';

      mockPrisma.processedEmail.update.mockResolvedValue({
        id: 'email1',
        messageId,
        processingStatus: status
      } as any);

      // Act
      await emailService.markEmailAsProcessed(messageId, status);

      // Assert
      expect(mockPrisma.processedEmail.update).toHaveBeenCalledWith({
        where: { messageId },
        data: {
          processed: true,
          processingStatus: status,
          updatedAt: expect.any(Date)
        }
      });
    });
  });
});
const { parentPort } = require("worker_threads");
const { db } = require("../config/database");
const { gmailService } = require("../services/gmail.service");
const { pdfParserService } = require("../services/pdf-parser.service");
const { scheduleExtractorService } = require("../services/schedule-extractor.service");
const { logger } = require("../utils/logger");

/**
 * Email Worker Thread
 * Handles individual email processing in parallel
 */

class EmailWorker {
  constructor() {
    this.setupMessageHandlers();
    this.sendReadyMessage();
  }

  setupMessageHandlers() {
    if (parentPort) {
      parentPort.on("message", (message) => {
        this.handleMessage(message);
      });
    }
  }

  async handleMessage(message) {
    const { type, data } = message;

    try {
      switch (type) {
        case "process_email":
          await this.processEmail(data);
          break;

        case "shutdown":
          this.shutdown();
          break;

        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      logger.error("Worker message handling error", { type, error: error.message });
      this.sendErrorMessage(data.jobId, error);
    }
  }

  async processEmail(jobData) {
    const startTime = Date.now();
    const { jobId, messageId, userId, subject, sender, threadId, pdfHash } = jobData;

    try {
      this.sendProgressMessage(jobId, 10, "Starting email processing");

      // Step 1: Fetch email content from Gmail
      this.sendProgressMessage(jobId, 20, "Fetching email content");
      const emailContent = await this.fetchEmailContent(messageId, userId);

      // Step 2: Extract PDF attachments if present
      this.sendProgressMessage(jobId, 30, "Processing email attachments");
      const pdfAttachments = await this.extractPDFAttachments(emailContent, userId);

      // Step 3: Parse PDF content if available
      let scheduleData = null;
      if (pdfAttachments.length > 0) {
        this.sendProgressMessage(jobId, 50, "Parsing PDF content");
        const pdfContent = await this.parsePDFContent(pdfAttachments[0]);
        scheduleData = await this.extractScheduleData(pdfContent, subject, sender);
      } else {
        // Try to extract schedule from email body
        this.sendProgressMessage(jobId, 50, "Extracting schedule from email body");
        scheduleData = await this.extractScheduleFromEmail(emailContent, subject, sender);
      }

      // Step 4: Save schedule data to database
      if (scheduleData) {
        this.sendProgressMessage(jobId, 70, "Saving schedule data");
        await this.saveScheduleData(scheduleData, jobId, userId);

        // Step 5: Generate route plan
        this.sendProgressMessage(jobId, 80, "Calculating route plan");
        await this.generateRoutePlan(scheduleData, userId);

        // Step 6: Fetch weather data
        this.sendProgressMessage(jobId, 90, "Fetching weather data");
        await this.fetchWeatherData(scheduleData, userId);

        // Step 7: Create calendar events
        this.sendProgressMessage(jobId, 95, "Creating calendar events");
        await this.createCalendarEvents(scheduleData, userId);
      }

      // Step 8: Mark email as processed
      this.sendProgressMessage(jobId, 100, "Email processing completed");

      const processingTime = Date.now() - startTime;
      this.sendSuccessMessage(jobId, {
        scheduleData,
        processingTime,
        pdfAttachments: pdfAttachments.length,
      });

    } catch (error) {
      logger.error("Email processing failed", {
        jobId,
        messageId,
        error: error.message,
        stack: error.stack,
      });

      const processingTime = Date.now() - startTime;
      this.sendErrorMessage(jobId, error, processingTime);
    }
  }

  async fetchEmailContent(messageId, userId) {
    try {
      // Get user's Gmail access token
      const user = await db
        .selectFrom("users")
        .select(["accessToken", "refreshToken"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user || !user.accessToken) {
        throw new Error("User Gmail access token not found");
      }

      // Fetch email from Gmail API
      const email = await gmailService.getEmail(messageId, user.accessToken);
      return email;
    } catch (error) {
      throw new Error(`Failed to fetch email content: ${error.message}`);
    }
  }

  async extractPDFAttachments(emailContent, userId) {
    try {
      const attachments = [];

      if (emailContent.payload && emailContent.payload.parts) {
        for (const part of emailContent.payload.parts) {
          if (part.mimeType === "application/pdf" && part.body.attachmentId) {
            const attachmentData = await gmailService.getAttachment(
              emailContent.id,
              part.body.attachmentId,
              emailContent.userId
            );

            attachments.push({
              id: part.body.attachmentId,
              filename: part.filename,
              data: attachmentData,
              size: part.body.size,
            });
          }
        }
      }

      return attachments;
    } catch (error) {
      logger.warn("Failed to extract PDF attachments", { error: error.message });
      return [];
    }
  }

  async parsePDFContent(pdfAttachment) {
    try {
      const buffer = Buffer.from(pdfAttachment.data, "base64");
      const pdfContent = await pdfParserService.parsePDF(buffer);
      return pdfContent;
    } catch (error) {
      throw new Error(`Failed to parse PDF content: ${error.message}`);
    }
  }

  async extractScheduleData(pdfContent, subject, sender) {
    try {
      const scheduleData = await scheduleExtractorService.extractSchedule({
        content: pdfContent.text,
        subject,
        sender,
        images: pdfContent.images,
      });

      if (!scheduleData) {
        throw new Error("No schedule data found in content");
      }

      return scheduleData;
    } catch (error) {
      throw new Error(`Failed to extract schedule data: ${error.message}`);
    }
  }

  async extractScheduleFromEmail(emailContent, subject, sender) {
    try {
      // Extract text content from email body
      let emailText = "";

      if (emailContent.payload && emailContent.payload.body && emailContent.payload.body.data) {
        emailText = Buffer.from(emailContent.payload.body.data, "base64").toString("utf-8");
      } else if (emailContent.payload && emailContent.payload.parts) {
        // Handle multipart emails
        for (const part of emailContent.payload.parts) {
          if (part.mimeType === "text/plain" && part.body.data) {
            emailText += Buffer.from(part.body.data, "base64").toString("utf-8");
          }
        }
      }

      const scheduleData = await scheduleExtractorService.extractSchedule({
        content: emailText,
        subject,
        sender,
      });

      return scheduleData;
    } catch (error) {
      logger.warn("Failed to extract schedule from email body", { error: error.message });
      return null;
    }
  }

  async saveScheduleData(scheduleData, emailId, userId) {
    try {
      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db
        .insertInto("schedule_data")
        .values({
          id: scheduleId,
          shootingDate: scheduleData.shootingDate,
          callTime: scheduleData.callTime,
          location: scheduleData.location,
          baseLocation: scheduleData.baseLocation,
          sceneType: scheduleData.sceneType,
          scenes: JSON.stringify(scheduleData.scenes || []),
          safetyNotes: scheduleData.safetyNotes,
          equipment: JSON.stringify(scheduleData.equipment || []),
          contacts: JSON.stringify(scheduleData.contacts || []),
          notes: scheduleData.notes,
          userId,
          emailId,
        })
        .execute();

      return scheduleId;
    } catch (error) {
      throw new Error(`Failed to save schedule data: ${error.message}`);
    }
  }

  async generateRoutePlan(scheduleData, userId) {
    try {
      // This would integrate with the route planning service
      // For now, we'll create a placeholder route plan
      const routePlanId = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get user configuration for base location
      const userConfig = await db
        .selectFrom("user_configs")
        .select(["homeAddress"])
        .where("userId", "=", userId)
        .executeTakeFirst();

      const baseLocation = userConfig?.homeAddress || scheduleData.baseLocation;

      // Calculate travel times (placeholder logic)
      const departureTime = new Date(scheduleData.shootingDate);
      departureTime.setHours(departureTime.getHours() - 2); // 2 hours before call time

      const arrivalTime = new Date(departureTime);
      arrivalTime.setMinutes(arrivalTime.getMinutes() + 30); // 30 minutes travel time

      await db
        .insertInto("route_plans")
        .values({
          id: routePlanId,
          wakeUpTime: new Date(departureTime.getTime() - 45 * 60000), // 45 minutes before departure
          departureTime,
          arrivalTime,
          totalTravelMinutes: 30,
          routeSegments: JSON.stringify([
            {
              from: baseLocation,
              to: scheduleData.location,
              distance: "15.2 miles",
              duration: "30 mins",
              instructions: "Take I-405 N to exit 12B for Sunset Blvd",
            },
          ]),
          buffers: JSON.stringify({
            parking: 10,
            traffic: 20,
            entry: 10,
          }),
          userId,
          scheduleId: `schedule_${emailId}`, // This would be the actual schedule ID
        })
        .execute();

      return routePlanId;
    } catch (error) {
      logger.warn("Failed to generate route plan", { error: error.message });
      return null;
    }
  }

  async fetchWeatherData(scheduleData, userId) {
    try {
      // This would integrate with the weather service
      // For now, we'll create placeholder weather data
      const weatherId = `weather_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db
        .insertInto("weather_data")
        .values({
          id: weatherId,
          forecastDate: scheduleData.shootingDate,
          temperature: 72.5,
          description: "Partly cloudy",
          windSpeed: 8.2,
          precipitation: 0.1,
          humidity: 65,
          warnings: JSON.stringify([]),
          userId,
          scheduleId: `schedule_${emailId}`, // This would be the actual schedule ID
        })
        .execute();

      return weatherId;
    } catch (error) {
      logger.warn("Failed to fetch weather data", { error: error.message });
      return null;
    }
  }

  async createCalendarEvents(scheduleData, userId) {
    try {
      // This would integrate with the Google Calendar service
      // For now, we'll create placeholder calendar events
      const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const shootingStartTime = new Date(scheduleData.shootingDate);
      const [callTimeHours, callTimeMinutes] = scheduleData.callTime.split(":");
      shootingStartTime.setHours(parseInt(callTimeHours), parseInt(callTimeMinutes));

      const shootingEndTime = new Date(shootingStartTime);
      shootingEndTime.setHours(shootingEndTime.getHours() + 12); // 12-hour shooting day

      await db
        .insertInto("calendar_events")
        .values({
          id: eventId,
          calendarEventId: `cal_${eventId}`,
          title: `Film Shoot - ${scheduleData.sceneType}`,
          startTime: shootingStartTime,
          endTime: shootingEndTime,
          description: `Location: ${scheduleData.location}\nScenes: ${scheduleData.scenes.map(s => s.number).join(", ")}`,
          location: scheduleData.location,
          userId,
          scheduleId: `schedule_${emailId}`, // This would be the actual schedule ID
        })
        .execute();

      return eventId;
    } catch (error) {
      logger.warn("Failed to create calendar events", { error: error.message });
      return null;
    }
  }

  sendReadyMessage() {
    this.sendMessage("worker_ready", {});
  }

  sendProgressMessage(jobId, progress, message) {
    this.sendMessage("job_progress", { jobId, progress, message });
  }

  sendSuccessMessage(jobId, result) {
    this.sendMessage("job_complete", { jobId, result });
  }

  sendErrorMessage(jobId, error, processingTime) {
    this.sendMessage("job_error", {
      jobId,
      error: {
        message: error.message,
        stack: error.stack,
      },
      processingTime,
    });
  }

  sendMessage(type, data) {
    if (parentPort) {
      parentPort.postMessage({ type, data });
    }
  }

  shutdown() {
    logger.info("Email worker shutting down");
    if (parentPort) {
      parentPort.close();
    }
    process.exit(0);
  }
}

// Initialize worker
new EmailWorker();
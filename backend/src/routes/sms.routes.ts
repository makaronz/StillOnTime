import { Router } from "express";
import { SMSController } from "../controllers/sms.controller";
import { NotificationService } from "../services/notification.service";
import { UserRepository } from "../repositories/user.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// Initialize dependencies
const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();
const notificationService = new NotificationService(
  notificationRepository,
  userRepository
);
const smsController = new SMSController(notificationService, userRepository);

/**
 * @route   POST /api/sms/configure
 * @desc    Configure SMS settings for user
 * @access  Private
 */
router.post(
  "/configure",
  authenticateToken,
  SMSController.validateSMSConfig,
  smsController.configureSMS
);

/**
 * @route   POST /api/sms/verify
 * @desc    Verify SMS number with code
 * @access  Private
 */
router.post("/verify", authenticateToken, smsController.verifySMS);

/**
 * @route   POST /api/sms/resend-code
 * @desc    Resend SMS verification code
 * @access  Private
 */
router.post(
  "/resend-code",
  authenticateToken,
  smsController.resendVerificationCode
);

/**
 * @route   GET /api/sms/status
 * @desc    Get SMS configuration status
 * @access  Private
 */
router.get("/status", authenticateToken, smsController.getSMSStatus);

/**
 * @route   POST /api/sms/test
 * @desc    Send test SMS
 * @access  Private
 */
router.post("/test", authenticateToken, smsController.testSMS);

/**
 * @route   POST /api/sms/webhook
 * @desc    Handle Twilio delivery status webhook
 * @access  Public (but should be secured with Twilio signature validation in production)
 */
router.post("/webhook", smsController.handleWebhook);

export default router;

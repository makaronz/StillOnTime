import { Router, Request, Response } from "express";
import { authenticateToken } from "@/middleware/auth.middleware";

const router = Router();
router.use((req, res, next) => {
  void authenticateToken(req, res, next);
});

interface NotificationItem {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// GET /api/notifications
router.get("/", (_req: Request, res: Response): void => {
  // Minimal placeholder response to keep the client stable.
  const notifications: NotificationItem[] = [];
  res.json({ data: notifications });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({
    success: true,
    message: `Notification ${id} marked as read`,
  });
});

// PATCH /api/notifications/read-all
router.patch("/read-all", (_req: Request, res: Response): void => {
  res.json({
    success: true,
    message: "All notifications marked as read",
  });
});

// DELETE /api/notifications/:id
router.delete("/:id", (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({
    success: true,
    message: `Notification ${id} deleted`,
  });
});

// GET /api/notifications/health
router.get("/health", (_req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "notifications",
    timestamp: new Date().toISOString(),
  });
});

export { router as notificationsRoutes };

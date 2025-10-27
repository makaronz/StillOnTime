import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app: express.Application = express();
const PORT = parseInt(process.env.PORT || "8001", 10);

// Middleware
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "https://fast-deployment.preview.emergentagent.com",
      "http://localhost:3000",
      /\.emergentagent\.com$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// Simple auth routes for frontend compatibility
app.get("/api/auth/login", (req, res) => {
  // Determine redirect URI based on the request origin or host
  const origin = req.get('origin') || req.get('referer') || 'http://localhost:3000';
  let redirectUri = 'http://localhost:3000/auth/callback';
  
  // If accessed from preview domain, use that
  if (origin.includes('preview.emergentagent.com')) {
    redirectUri = 'https://fast-deployment.preview.emergentagent.com/auth/callback';
  }
  
  const clientId = process.env.GOOGLE_CLIENT_ID || 'demo';
  const scopes = encodeURIComponent('openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar');
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`;
  
  res.json({
    success: true,
    authUrl,
    message: "Google OAuth authentication",
  });
});

app.post("/api/auth/callback", (req, res) => {
  const { code, state } = req.body;

  // Mock successful authentication
  res.json({
    success: true,
    user: {
      id: "demo-user-123",
      email: "demo@stillontime.com",
      name: "Demo User",
    },
    token: "demo-jwt-token-replace-with-real-jwt",
    message: "Demo authentication successful",
  });
});

app.get("/api/auth/status", (req, res) => {
  res.json({
    isAuthenticated: false,
    user: null,
    oauth: {
      isAuthenticated: false,
      scopes: [],
      needsReauth: true,
    },
  });
});

app.post("/api/auth/refresh", (req, res) => {
  res.json({
    success: true,
    token: "refreshed-demo-jwt-token",
    user: {
      id: "demo-user-123",
      email: "demo@stillontime.com",
      name: "Demo User",
    },
    message: "Token refreshed successfully",
  });
});

app.post("/api/auth/logout", (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

app.get("/api/auth/profile", (req, res) => {
  res.json({
    success: true,
    profile: {
      id: "demo-user-123",
      email: "demo@stillontime.com",
      name: "Demo User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "stillontime-backend-demo",
    timestamp: new Date().toISOString(),
    version: "1.0.0-demo",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "api",
    timestamp: new Date().toISOString(),
    version: "1.0.0-demo",
    routes: {
      auth: "/api/auth",
      user: "/api/user",
      email: "/api/email",
      schedule: "/api/schedule",
      calendar: "/api/calendar",
      routePlanning: "/api/route-planning",
      sms: "/api/sms",
      monitoring: "/api/monitoring",
    },
  });
});

// Mock dashboard data endpoints
app.get("/api/dashboard/system-status", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      services: {
        database: "healthy",
        redis: "healthy",
        gmail: "healthy",
        calendar: "healthy",
        weather: "healthy",
        maps: "healthy",
      },
      lastCheck: new Date().toISOString(),
    },
  });
});

app.get("/api/dashboard/recent-activity", (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: "1",
        type: "email_processed",
        message: "Schedule email processed successfully",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        status: "success",
      },
      {
        id: "2",
        type: "calendar_created",
        message: "Calendar event created for tomorrow's shoot",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        status: "success",
      },
    ],
  });
});

app.get("/api/dashboard/upcoming-schedules", (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: "1",
        shootingDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        callTime: "07:00",
        location: "Studio Panavision, Warszawa",
        sceneType: "INT",
        status: "confirmed",
      },
    ],
  });
});

app.get("/api/dashboard/processing-stats", (req, res) => {
  res.json({
    success: true,
    data: {
      totalEmails: 45,
      processedToday: 3,
      pendingProcessing: 0,
      lastProcessed: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      successRate: 98.5,
    },
  });
});

// Catch all for unimplemented routes
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not implemented in demo version`,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong in demo backend",
      timestamp: new Date().toISOString(),
    });
  }
);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 StillOnTime Demo Backend running on port ${PORT}`);
  console.log(
    `📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API health: http://localhost:${PORT}/api/health`);
  console.log("");
  console.log("⚠️  This is a DEMO backend with mock data");
  console.log("   Replace with full implementation for production");
});

export default app;

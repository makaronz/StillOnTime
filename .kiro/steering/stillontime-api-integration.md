---
inclusion: fileMatch
fileMatchPattern: "*api*"
---

# StillOnTime API Integration Guidelines

## Google APIs Integration

### OAuth 2.0 Configuration

```typescript
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Required scopes for StillOnTime system
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.file",
];
```

### Gmail API Best Practices

- Use batch requests for multiple operations
- Implement proper pagination for large result sets
- Cache message IDs to avoid duplicate processing
- Use partial responses to reduce bandwidth
- Implement proper error handling for quota limits

### Calendar API Best Practices

- Use batch requests for creating multiple events
- Implement conflict detection before creating events
- Use proper timezone handling (Europe/Warsaw for StillOnTime)
- Implement retry logic for calendar conflicts
- Cache calendar IDs for performance

### Maps API Best Practices

- Use traffic model 'best_guess' for route calculations
- Implement caching for common routes
- Use waypoints for multi-stop routes (Dom→Panavision→Location)
- Handle API quota limits gracefully
- Provide fallback distance-based calculations

## External API Integration

### OpenWeatherMap API

```typescript
interface WeatherAPIResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      humidity: number;
    };
    weather: Array<{
      main: string;
      description: string;
    }>;
    wind: {
      speed: number;
    };
    rain?: {
      "3h": number;
    };
  }>;
}
```

### API Error Handling Patterns

```typescript
class APIError extends Error {
  constructor(
    public apiName: string,
    public statusCode: number,
    public response: any,
    message: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = backoffMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}
```

## Rate Limiting and Quotas

### Google APIs Quotas

- Gmail API: 1 billion requests/day
- Calendar API: 1 million requests/day
- Drive API: 1 billion requests/day
- Maps Directions API: 40,000 requests/month (free tier)

### Rate Limiting Implementation

```typescript
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // limit each IP to 5 requests per windowMs for sensitive operations
});
```

## API Response Caching

### Cache Strategy

```typescript
interface CacheConfig {
  ttl: number; // Time to live in seconds
  key: string;
  tags?: string[];
}

const CACHE_CONFIGS = {
  weather: { ttl: 24 * 60 * 60, key: "weather:{location}:{date}" }, // 24 hours
  routes: { ttl: 60 * 60, key: "route:{origin}:{destination}" }, // 1 hour
  geocoding: { ttl: 7 * 24 * 60 * 60, key: "geocode:{address}" }, // 7 days
};
```

## API Security

### Request Signing

```typescript
import crypto from "crypto";

function signRequest(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = signRequest(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}
```

### API Key Management

- Store API keys in environment variables
- Rotate API keys regularly
- Use different keys for different environments
- Monitor API key usage and quotas
- Implement key rotation without downtime

## Error Response Standards

### Standard Error Format

```typescript
interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

// Example usage
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  const errorResponse: APIErrorResponse = {
    error: {
      code: error.name || "INTERNAL_ERROR",
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"] as string,
    },
  };

  if (error instanceof APIError) {
    errorResponse.error.details = error.response;
    res.status(error.statusCode);
  } else {
    res.status(500);
  }

  res.json(errorResponse);
});
```

## API Documentation

### OpenAPI/Swagger Configuration

```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "StillOnTime Automation API",
      version: "1.0.0",
      description: "API for StillOnTime Film Schedule Automation System",
    },
    servers: [
      {
        url: process.env.API_BASE_URL || "http://localhost:3001",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/controllers/*.ts"],
};

const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
```

## Testing API Integrations

### Mock API Responses

```typescript
// Jest mock for Google APIs
jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        getAccessToken: jest.fn().mockResolvedValue({ token: "mock-token" }),
      })),
    },
    gmail: jest.fn().mockReturnValue({
      users: {
        messages: {
          list: jest.fn().mockResolvedValue({
            data: { messages: [{ id: "mock-message-id" }] },
          }),
        },
      },
    }),
  },
}));
```

### Integration Test Examples

```typescript
describe("Gmail API Integration", () => {
  it("should fetch schedule emails successfully", async () => {
    const mockEmails = [
      { id: "msg1", threadId: "thread1" },
      { id: "msg2", threadId: "thread2" },
    ];

    // Mock Gmail API response
    jest.spyOn(gmailService, "getScheduleEmails").mockResolvedValue(mockEmails);

    const result = await emailMonitor.getScheduleEmails("user123");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("msg1");
  });
});
```

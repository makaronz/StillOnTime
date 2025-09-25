import dotenv from "dotenv";
import { validateSecurityConfig } from "./security";

dotenv.config();

interface Config {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  apis: {
    openWeatherApiKey: string;
    googleMapsApiKey: string;
  };
}

// Helper function to get required environment variable
function getRequiredEnvVar(name: string, fallbackForDev?: string): string {
  const value = process.env[name];

  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    if (fallbackForDev) {
      return fallbackForDev;
    }

    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config: Config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  databaseUrl: getRequiredEnvVar(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/stillontime_automation"
  ),
  redisUrl: getRequiredEnvVar("REDIS_URL", "redis://localhost:6379"),
  jwtSecret: getRequiredEnvVar("JWT_SECRET"),
  google: {
    clientId: getRequiredEnvVar("GOOGLE_CLIENT_ID"),
    clientSecret: getRequiredEnvVar("GOOGLE_CLIENT_SECRET"),
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback",
  },
  apis: {
    openWeatherApiKey: getRequiredEnvVar("OPENWEATHER_API_KEY"),
    googleMapsApiKey: getRequiredEnvVar("GOOGLE_MAPS_API_KEY"),
  },
};

// Validate API keys on startup and fail fast if missing
function validateApiKeys(): void {
  const requiredApiKeys = ["OPENWEATHER_API_KEY", "GOOGLE_MAPS_API_KEY"];

  const missingApiKeys = requiredApiKeys.filter((key) => !process.env[key]);

  if (missingApiKeys.length > 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Missing required API keys: ${missingApiKeys.join(", ")}`
      );
    } else {
      console.warn(
        `Warning: Missing API keys in development: ${missingApiKeys.join(", ")}`
      );
    }
  }

  // Validate API key formats (basic validation)
  if (
    process.env.OPENWEATHER_API_KEY &&
    process.env.OPENWEATHER_API_KEY.length < 10
  ) {
    throw new Error("OPENWEATHER_API_KEY appears to be invalid (too short)");
  }

  if (
    process.env.GOOGLE_MAPS_API_KEY &&
    process.env.GOOGLE_MAPS_API_KEY.length < 10
  ) {
    throw new Error("GOOGLE_MAPS_API_KEY appears to be invalid (too short)");
  }
}

// Validate all required environment variables
function validateEnvironment(): void {
  const requiredEnvVars = [
    "DATABASE_URL",
    "JWT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "REDIS_URL",
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`
      );
    } else {
      console.warn(
        `Warning: Missing environment variables in development: ${missingEnvVars.join(
          ", "
        )}`
      );
    }
  }

  // Validate JWT secret strength in production
  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error(
        "JWT_SECRET must be at least 32 characters long in production"
      );
    }
  }

  // Validate API keys
  validateApiKeys();
}

// Run validation
validateEnvironment();
validateSecurityConfig();

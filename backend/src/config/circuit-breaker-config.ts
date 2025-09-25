/**
 * Circuit breaker configurations for all external services
 * Provides service-specific failure thresholds and recovery settings
 */

import { CircuitBreakerConfig } from "../utils/circuit-breaker";

export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  // OAuth 2.0 Service
  oauth2: {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["OAUTH_RATE_LIMITED"], // Don't trip on rate limits
  },

  // Gmail API
  gmail_api: {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["RATE_LIMITED", "QUOTA_EXCEEDED"],
  },

  // Google Calendar API
  calendar_api: {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["RATE_LIMITED", "QUOTA_EXCEEDED"],
  },

  // Google Maps API
  maps_api: {
    failureThreshold: 3,
    recoveryTimeout: 120000, // 2 minutes
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["RATE_LIMITED", "QUOTA_EXCEEDED"],
  },

  // OpenWeatherMap API
  weather_api: {
    failureThreshold: 4,
    recoveryTimeout: 300000, // 5 minutes
    monitoringPeriod: 600000, // 10 minutes
    expectedErrors: ["RATE_LIMITED"],
  },

  // Database connections
  database: {
    failureThreshold: 3,
    recoveryTimeout: 15000, // 15 seconds
    monitoringPeriod: 180000, // 3 minutes
    expectedErrors: ["CONNECTION_TIMEOUT"],
  },

  // Redis cache
  cache: {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["CONNECTION_TIMEOUT"],
  },

  // SMS service (Twilio or similar)
  sms_service: {
    failureThreshold: 3,
    recoveryTimeout: 120000, // 2 minutes
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["RATE_LIMITED", "QUOTA_EXCEEDED"],
  },

  // Push notification service
  push_service: {
    failureThreshold: 4,
    recoveryTimeout: 180000, // 3 minutes
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["RATE_LIMITED"],
  },

  // PDF processing service
  pdf_processor: {
    failureThreshold: 3,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: ["PDF_CORRUPTED", "OCR_FAILED"],
  },
};

/**
 * Get circuit breaker configuration for a service
 */
export function getCircuitBreakerConfig(
  serviceName: string
): CircuitBreakerConfig {
  const config = CIRCUIT_BREAKER_CONFIGS[serviceName.toLowerCase()];

  if (!config) {
    // Return default configuration for unknown services
    return {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      expectedErrors: [],
    };
  }

  return config;
}

/**
 * Initialize circuit breakers for all configured services
 */
export function initializeCircuitBreakers(): void {
  const { CircuitBreakerRegistry } = require("../utils/circuit-breaker");
  const registry = CircuitBreakerRegistry.getInstance();

  Object.entries(CIRCUIT_BREAKER_CONFIGS).forEach(([serviceName, config]) => {
    registry.getOrCreate(serviceName, config);
  });
}

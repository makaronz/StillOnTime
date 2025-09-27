// Common types for the StillOnTime backend application
import {
  User as PrismaUser,
  ProcessedEmail as PrismaProcessedEmail,
  ScheduleData as PrismaScheduleData,
  RoutePlan as PrismaRoutePlan,
  WeatherData as PrismaWeatherData,
  CalendarEvent as PrismaCalendarEvent,
  UserConfig as PrismaUserConfig,
  Notification as PrismaNotification,
  Summary as PrismaSummary,
  Prisma,
} from "@prisma/client";
import {
  CalendarConflict,
  AlertRule,
  Alert,
  TimeRecommendation,
} from "./domain";

// Re-export Prisma types for consistency
export type User = PrismaUser;
export type ProcessedEmail = PrismaProcessedEmail;
export type ScheduleData = PrismaScheduleData;
export type RoutePlan = PrismaRoutePlan;
export type WeatherData = PrismaWeatherData;
export type CalendarEvent = PrismaCalendarEvent;
export type UserConfig = PrismaUserConfig;
export type Notification = PrismaNotification;
export type Summary = PrismaSummary;

// Prisma input types for creating/updating records
export type CreateUserInput = Prisma.UserCreateInput;
export type UpdateUserInput = Prisma.UserUpdateInput;
export type CreateProcessedEmailInput = Prisma.ProcessedEmailCreateInput;
export type UpdateProcessedEmailInput = Prisma.ProcessedEmailUpdateInput;
export type CreateScheduleDataInput = Prisma.ScheduleDataCreateInput;
export type UpdateScheduleDataInput = Prisma.ScheduleDataUpdateInput;
export type CreateRoutePlanInput = Prisma.RoutePlanCreateInput;
export type UpdateRoutePlanInput = Prisma.RoutePlanUpdateInput;
export type CreateWeatherDataInput = Prisma.WeatherDataCreateInput;
export type UpdateWeatherDataInput = Prisma.WeatherDataUpdateInput;
export type CreateCalendarEventInput = Prisma.CalendarEventCreateInput;
export type UpdateCalendarEventInput = Prisma.CalendarEventUpdateInput;
export type CreateUserConfigInput = Prisma.UserConfigCreateInput;
export type UpdateUserConfigInput = Prisma.UserConfigUpdateInput;
export type CreateNotificationInput = Prisma.NotificationCreateInput;
export type UpdateNotificationInput = Prisma.NotificationUpdateInput;
export type CreateSummaryInput = Prisma.SummaryCreateInput;
export type UpdateSummaryInput = Prisma.SummaryUpdateInput;

// Complex types with relations
export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    processedEmails: true;
    schedules: true;
    routePlans: true;
    weatherData: true;
    calendarEvents: true;
    userConfig: true;
    notifications: true;
    summaries: true;
  };
}>;

export type ScheduleDataWithRelations = Prisma.ScheduleDataGetPayload<{
  include: {
    user: true;
    email: true;
    routePlan: true;
    weatherData: true;
    calendarEvent: true;
    summary: true;
  };
}>;

export type ProcessedEmailWithSchedule = Prisma.ProcessedEmailGetPayload<{
  include: {
    user: true;
    schedule: true;
  };
}>;

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface RouteResult {
  distance: string;
  duration: string;
  durationInTraffic?: string;
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
}

export interface RouteSegment {
  from: string;
  to: string;
  distance: string;
  duration: string;
  durationInTraffic?: string;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
  }>;
}

export interface WeatherForecast {
  temperature: number;
  description: string;
  windSpeed: number;
  precipitation: number;
  humidity: number;
  conditions: string[];
}

export interface ContactInfo {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface TimeBuffers {
  carChange: number;
  parking: number;
  entry: number;
  traffic: number;
  morningRoutine: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  confidence: number;
}

export interface EmailProcessingData {
  userId: string;
  messageId?: string;
}

export interface WeatherUpdateData {
  scheduleId: string;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  services: {
    database: boolean;
    redis: boolean;
    gmail: boolean;
    calendar: boolean;
    weather: boolean;
  };
  timestamp: Date;
}

// Notification types
export type NotificationChannel = "email" | "sms" | "push";

export type NotificationTemplate =
  | "schedule_processed"
  | "schedule_updated"
  | "weather_warning"
  | "processing_error"
  | "wake_up_reminder"
  | "departure_reminder"
  | "system_alert";

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  smsNumber?: string;
  pushToken?: string;
}

export interface NotificationData {
  id: string;
  userId: string;
  channel: NotificationChannel;
  template: NotificationTemplate;
  subject: string;
  message: string;
  data?: Record<string, any>;
  scheduledFor?: Date;
  sentAt?: Date;
  status: "pending" | "sent" | "failed" | "cancelled";
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplateData {
  scheduleData?: ScheduleDataWithRelations;
  routePlan?: RoutePlan;
  weatherData?: WeatherData;
  error?: string;
  user?: User;
  [key: string]: any;
}

export interface NotificationDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt: Date;
}

// Summary types
export interface SummaryData {
  id: string;
  userId: string;
  scheduleId: string;
  language: "pl" | "en";
  content: string;
  htmlContent: string;
  timeline: TimelineEntry[];
  weatherSummary?: string;
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TimelineEntry {
  time: Date;
  event: string;
  description?: string;
  type: "wake_up" | "departure" | "arrival" | "call_time" | "wrap" | "other";
  location?: string;
}

export interface SummaryGenerationOptions {
  language?: "pl" | "en";
  includeWeather?: boolean;
  includeRoute?: boolean;
  includeContacts?: boolean;
  includeEquipment?: boolean;
  includeSafetyNotes?: boolean;
  format?: "text" | "html" | "both";
}

export interface GeneratedSummary {
  content: string;
  htmlContent: string;
  timeline: TimelineEntry[];
  weatherSummary?: string;
  warnings: string[];
  metadata: {
    generatedAt: Date;
    language: string;
    scheduleDate: Date;
    location: string;
    callTime: string;
  };
}

// Additional types for fixing 'any' usage

// Database query types
export interface WhereCondition {
  [key: string]: any;
}

export interface OrderByCondition {
  [key: string]: "asc" | "desc";
}

export interface FindManyOptions {
  where?: WhereCondition;
  orderBy?: OrderByCondition | OrderByCondition[];
  skip?: number;
  take?: number;
  include?: Record<string, boolean | object>;
  select?: Record<string, boolean>;
}

// Calendar override types
export interface CalendarOverride {
  eventId: string;
  overrideType: "time" | "location" | "description" | "alarms";
  originalValue: string | Date | object;
  overrideValue: string | Date | object;
  timestamp: Date;
  reason: string;
  appliedBy: string;
  appliedAt: Date;
}

// Calendar update data
export interface CalendarUpdateData {
  summary?: string;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  start?: {
    dateTime: string;
    timeZone: string;
  };
  end?: {
    dateTime: string;
    timeZone: string;
  };
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

// Conflict resolution types
export type { CalendarConflict };

// Error handling types - ErrorContext and FallbackData are now exported from utils/errors.ts
export type { ErrorContext, FallbackData } from "../utils/errors";

// Weather monitoring types
export interface WeatherChange {
  type: "temperature" | "precipitation" | "wind" | "conditions";
  field: string;
  previousValue: number | string | string[];
  currentValue: number | string | string[];
  timestamp: Date;
  changeAmount?: number;
  changePercentage?: number;
  description: string;
  significance: "low" | "medium" | "high";
}

// Time calculation types
export interface TimeCalculationOptions {
  includeWeatherBuffer?: boolean;
  includeTrafficBuffer?: boolean;
  customBuffers?: Partial<TimeBuffers>;
  minimumWakeUpTime?: Date;
  maximumWakeUpTime?: Date;
  weatherConditions?: string[];
  location?: string;
  sceneType?: "INT" | "EXT";
}

export type { TimeRecommendation };

// Monitoring and metrics types
export interface MetricsData {
  timestamp: Date;
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  queueSize: number;
  services: Array<{
    serviceName: string;
    status: "healthy" | "degraded" | "unhealthy";
    responseTime: number;
    errorCount: number;
    successCount: number;
    availability: number;
    lastCheck: Date;
    circuitBreakerState?: string;
  }>;
  circuitBreakers: Record<string, CircuitBreakerState>;
  errorMetrics: Record<
    string,
    {
      errorCount: number;
      lastError?: Date;
      errorRate: number;
    }
  >;
}

export interface CircuitBreakerState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export type { AlertRule, Alert };

// SMS service types
export interface SMSDeliveryStatus {
  messageId: string;
  status: "queued" | "sent" | "delivered" | "failed" | "undelivered";
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

export interface SMSAccountInfo {
  accountSid: string;
  balance?: string;
  currency?: string;
  usage?: Array<{
    category: string;
    count: number;
    price: string;
  }>;
}

// Nested object access types
export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type NestedValue<T, K extends string> = K extends keyof T
  ? T[K]
  : K extends `${infer K1}.${infer K2}`
  ? K1 extends keyof T
    ? NestedValue<T[K1], K2>
    : never
  : never;

// JSON type safety utilities
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {}

/**
 * Type guard to validate ContactInfo object
 */
export function isContactInfo(data: unknown): data is ContactInfo {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as ContactInfo).name === "string" &&
    ((data as ContactInfo).role === undefined ||
      typeof (data as ContactInfo).role === "string") &&
    ((data as ContactInfo).phone === undefined ||
      typeof (data as ContactInfo).phone === "string") &&
    ((data as ContactInfo).email === undefined ||
      typeof (data as ContactInfo).email === "string")
  );
}

/**
 * Type guard to validate ContactInfo array
 */
export function isContactInfoArray(data: unknown): data is ContactInfo[] {
  return Array.isArray(data) && data.every(isContactInfo);
}

/**
 * Safely parse JSON with type validation
 */
export function safeJsonParse<T>(
  json: string,
  validator: (data: unknown) => data is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    return validator(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Safely extract ContactInfo array from unknown data
 */
export function safeGetContactInfoArray(data: unknown): ContactInfo[] {
  if (isContactInfoArray(data)) {
    return data;
  }

  // Try to extract valid contacts from malformed data
  if (Array.isArray(data)) {
    return data.filter(isContactInfo).map((item) => ({
      name: item.name,
      role: item.role,
      phone: item.phone,
      email: item.email,
    }));
  }

  return [];
}

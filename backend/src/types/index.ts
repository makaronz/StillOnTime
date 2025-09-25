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
}

// Calendar update data
export interface CalendarUpdateData {
  summary?: string;
  description?: string;
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
export interface CalendarConflict {
  type: "time_overlap" | "duplicate_event" | "invalid_time";
  existingEvent?: CalendarEvent;
  conflictingData: ScheduleData;
  severity: "low" | "medium" | "high";
  suggestedResolution: string;
}

// Error handling types
export interface ErrorContext {
  operation: string;
  userId?: string;
  scheduleId?: string;
  messageId?: string;
  additionalData?: Record<string, unknown>;
}

export interface FallbackData {
  [key: string]: unknown;
}

// Weather monitoring types
export interface WeatherChange {
  type: "temperature" | "precipitation" | "wind" | "conditions";
  field: string;
  previousValue: number | string | string[];
  currentValue: number | string | string[];
  timestamp: Date;
  changeAmount?: number;
  changePercentage?: number;
}

// Time calculation types
export interface TimeCalculationOptions {
  includeWeatherBuffer?: boolean;
  includeTrafficBuffer?: boolean;
  customBuffers?: Partial<TimeBuffers>;
  minimumWakeUpTime?: Date;
  maximumWakeUpTime?: Date;
}

export interface TimeRecommendation {
  type: "buffer_adjustment" | "route_alternative" | "schedule_change";
  description: string;
  impact: "positive" | "negative" | "neutral";
  timeSaving?: number;
  confidence: number;
}

// Monitoring and metrics types
export interface MetricsData {
  timestamp: Date;
  errorRate: number;
  responseTime: number;
  throughput: number;
  circuitBreakers: Record<string, CircuitBreakerState>;
  [key: string]: unknown;
}

export interface CircuitBreakerState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

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

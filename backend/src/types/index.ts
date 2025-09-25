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

import type { ColumnType, Insertable, Selectable, Updateable } from "kysely";

/**
 * Database schema types for Kysely
 * Generated from Prisma schema
 */

export interface UserTable {
  id: string;
  email: string;
  name: string | null;
  googleId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: ColumnType<Date | null, Date | string | null, Date | string | null>;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
}

export interface ProcessedEmailTable {
  id: string;
  messageId: string;
  subject: string;
  sender: string;
  receivedAt: ColumnType<Date, Date | string, Date | string>;
  threadId: string | null;
  processed: boolean;
  processingStatus: string;
  pdfHash: string | null;
  error: string | null;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
  userId: string;
}

export interface ScheduleDataTable {
  id: string;
  shootingDate: ColumnType<Date, Date | string, Date | string>;
  callTime: string;
  location: string;
  baseLocation: string | null;
  sceneType: string;
  scenes: ColumnType<unknown, unknown, unknown> | null;
  safetyNotes: string | null;
  equipment: ColumnType<unknown, unknown, unknown> | null;
  contacts: ColumnType<unknown, unknown, unknown> | null;
  notes: string | null;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
  userId: string;
  emailId: string;
}

export interface RoutePlanTable {
  id: string;
  wakeUpTime: ColumnType<Date, Date | string, Date | string>;
  departureTime: ColumnType<Date, Date | string, Date | string>;
  arrivalTime: ColumnType<Date, Date | string, Date | string>;
  totalTravelMinutes: number;
  routeSegments: ColumnType<unknown, unknown, unknown>;
  buffers: ColumnType<unknown, unknown, unknown>;
  calculatedAt: ColumnType<Date, Date | string | undefined, Date | string>;
  userId: string;
  scheduleId: string;
}

export interface WeatherDataTable {
  id: string;
  forecastDate: ColumnType<Date, Date | string, Date | string>;
  temperature: number | null;
  description: string | null;
  windSpeed: number | null;
  precipitation: number | null;
  humidity: number | null;
  warnings: ColumnType<unknown, unknown, unknown> | null;
  fetchedAt: ColumnType<Date, Date | string | undefined, Date | string>;
  userId: string;
  scheduleId: string;
}

export interface CalendarEventTable {
  id: string;
  calendarEventId: string;
  title: string;
  startTime: ColumnType<Date, Date | string, Date | string>;
  endTime: ColumnType<Date, Date | string, Date | string>;
  description: string | null;
  location: string | null;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  userId: string;
  scheduleId: string;
}

export interface UserConfigTable {
  id: string;
  homeAddress: string;
  panavisionAddress: string;
  bufferCarChange: number;
  bufferParking: number;
  bufferEntry: number;
  bufferTraffic: number;
  bufferMorningRoutine: number;
  notificationEmail: boolean;
  notificationSMS: boolean;
  notificationPush: boolean;
  smsNumber: string | null;
  smsVerified: boolean;
  smsVerificationCode: string | null;
  smsVerificationExpiry: ColumnType<Date | null, Date | string | null, Date | string | null>;
  pushToken: string | null;
  pushTokenVerified: boolean;
  userId: string;
}

export interface NotificationTable {
  id: string;
  channel: string;
  template: string;
  subject: string;
  message: string;
  data: ColumnType<unknown, unknown, unknown> | null;
  scheduledFor: ColumnType<Date | null, Date | string | null, Date | string | null>;
  sentAt: ColumnType<Date | null, Date | string | null, Date | string | null>;
  status: string;
  error: string | null;
  retryCount: number;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
  userId: string;
}

export interface SummaryTable {
  id: string;
  language: string;
  content: string;
  htmlContent: string;
  timeline: ColumnType<unknown, unknown, unknown>;
  weatherSummary: string | null;
  warnings: ColumnType<unknown, unknown, unknown> | null;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string, Date | string>;
  userId: string;
  scheduleId: string;
}

/**
 * Database schema mapping table names to table types
 */
export interface Database {
  users: UserTable;
  processed_emails: ProcessedEmailTable;
  schedule_data: ScheduleDataTable;
  route_plans: RoutePlanTable;
  weather_data: WeatherDataTable;
  calendar_events: CalendarEventTable;
  user_configs: UserConfigTable;
  notifications: NotificationTable;
  summaries: SummaryTable;
}

/**
 * Helper types for database operations
 */
export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type ProcessedEmail = Selectable<ProcessedEmailTable>;
export type NewProcessedEmail = Insertable<ProcessedEmailTable>;
export type ProcessedEmailUpdate = Updateable<ProcessedEmailTable>;

export type ScheduleData = Selectable<ScheduleDataTable>;
export type NewScheduleData = Insertable<ScheduleDataTable>;
export type ScheduleDataUpdate = Updateable<ScheduleDataTable>;

export type RoutePlan = Selectable<RoutePlanTable>;
export type NewRoutePlan = Insertable<RoutePlanTable>;
export type RoutePlanUpdate = Updateable<RoutePlanTable>;

export type WeatherData = Selectable<WeatherDataTable>;
export type NewWeatherData = Insertable<WeatherDataTable>;
export type WeatherDataUpdate = Updateable<WeatherDataTable>;

export type CalendarEvent = Selectable<CalendarEventTable>;
export type NewCalendarEvent = Insertable<CalendarEventTable>;
export type CalendarEventUpdate = Updateable<CalendarEventTable>;

export type UserConfig = Selectable<UserConfigTable>;
export type NewUserConfig = Insertable<UserConfigTable>;
export type UserConfigUpdate = Updateable<UserConfigTable>;

export type Notification = Selectable<NotificationTable>;
export type NewNotification = Insertable<NotificationTable>;
export type NotificationUpdate = Updateable<NotificationTable>;

export type Summary = Selectable<SummaryTable>;
export type NewSummary = Insertable<SummaryTable>;
export type SummaryUpdate = Updateable<SummaryTable>;

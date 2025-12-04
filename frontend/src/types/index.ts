// Common types for the StillOnTime frontend application

export interface User {
  id: string;
  email: string;
  name?: string;
  googleId?: string;
}

export interface ScheduleData {
  id: string;
  shootingDate: Date;
  callTime: string;
  location: string;
  baseLocation?: string;
  sceneType: 'INT' | 'EXT';
  scenes?: string[];
  safetyNotes?: string;
  equipment?: string[];
  contacts?: ContactInfo[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactInfo {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface RoutePlan {
  id: string;
  wakeUpTime: Date;
  departureTime: Date;
  arrivalTime: Date;
  totalTravelMinutes: number;
  routeSegments: RouteSegment[];
  buffers: TimeBuffers;
  calculatedAt: Date;
}

export interface RouteSegment {
  from: string;
  to: string;
  distance: string;
  duration: string;
  durationInTraffic?: string;
}

export interface TimeBuffers {
  carChange: number;
  parking: number;
  entry: number;
  traffic: number;
  morningRoutine: number;
}

export interface WeatherData {
  id: string;
  forecastDate: Date;
  temperature?: number;
  description?: string;
  windSpeed?: number;
  precipitation?: number;
  humidity?: number;
  warnings?: string[];
  fetchedAt: Date;
}

export interface ProcessedEmail {
  id: string;
  messageId: string;
  subject: string;
  sender: string;
  receivedAt: Date;
  processed: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    database: boolean;
    redis: boolean;
    gmail: boolean;
    calendar: boolean;
    weather: boolean;
  };
  lastCheck: Date;
}

export interface UserConfig {
  homeAddress: string;
  panavisionAddress: string;
  buffers: TimeBuffers;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
/**
 * @file Domain model type definitions for StillOnTime backend
 * @description Consolidated business logic types with strict validation
 */

import { CalendarEvent } from "./index";
import { z } from "zod";

/**
 * @interface CalendarConflict
 * @description Represents a conflict between calendar events.
 */
export interface CalendarConflict {
  /**
   * @property conflictingEvent - The conflicting calendar event.
   */
  conflictingEvent: CalendarEvent;
  /**
   * @property overlapType - The type of overlap between the events.
   */
  overlapType: "partial" | "complete" | "encompasses";
  /**
   * @property overlapDuration - The duration of the overlap in minutes.
   */
  overlapDuration: number; // in minutes
  /**
   * @property type - The type of conflict.
   */
  type: "time_overlap" | "resource_conflict" | "location_conflict";
  /**
   * @property conflictingData - Additional data about the conflict.
   */
  conflictingData: Record<string, any>;
  /**
   * @property severity - The severity level of the conflict.
   */
  severity: "low" | "medium" | "high" | "critical";
  /**
   * @property suggestedResolution - Suggested resolution for the conflict.
   */
  suggestedResolution: string;
}

/**
 * @interface AlertRule
 * @description Represents a rule for triggering alerts.
 */
export interface AlertRule {
  /**
   * @property id - The unique identifier of the alert rule.
   */
  id: string;
  /**
   * @property name - The name of the alert rule.
   */
  name: string;
  /**
   * @property condition - The condition that triggers the alert.
   */
  condition: string;
  /**
   * @property threshold - The threshold value for the condition.
   */
  threshold: number;
  /**
   * @property severity - The severity level of the alert.
   */
  severity: "low" | "medium" | "high" | "critical";
  /**
   * @property enabled - Indicates whether the alert rule is enabled.
   */
  enabled: boolean;
  /**
   * @property cooldownPeriod - The cooldown period in seconds before the alert can be triggered again.
   */
  cooldownPeriod: number;
  /**
   * @property lastTriggered - The date and time when the alert was last triggered.
   */
  lastTriggered?: Date;
  /**
   * @property description - A description of the alert rule.
   */
  description: string;
}

/**
 * @interface Alert
 * @description Represents an alert that has been triggered.
 */
export interface Alert {
  /**
   * @property id - The unique identifier of the alert.
   */
  id: string;
  /**
   * @property ruleId - The identifier of the alert rule that triggered the alert.
   */
  ruleId: string;
  /**
   * @property severity - The severity level of the alert.
   */
  severity: "low" | "medium" | "high" | "critical";
  /**
   * @property message - The message associated with the alert.
   */
  message: string;
  /**
   * @property timestamp - The timestamp when the alert was triggered.
   */
  timestamp: Date;
  /**
   * @property resolved - Indicates whether the alert has been resolved.
   */
  resolved: boolean;
  /**
   * @property resolvedAt - The date and time when the alert was resolved.
   */
  resolvedAt?: Date;
  /**
   * @property metadata - Additional metadata associated with the alert.
   */
  metadata: Record<string, any>;
}

/**
 * @interface TimeRecommendation
 * @description Represents a time recommendation.
 */
export interface TimeRecommendation {
  /**
   * @property type - The type of time recommendation.
   */
  type: "buffer_adjustment" | "departure_time" | "preparation";
  /**
   * @property priority - The priority of the time recommendation.
   */
  priority: "low" | "medium" | "high";
  /**
   * @property message - The message associated with the time recommendation.
   */
  message: string;
  /**
   * @property description - Detailed description of the recommendation.
   */
  description: string;
  /**
   * @property impact - The expected impact of following this recommendation.
   */
  impact: string;
  /**
   * @property confidence - Confidence level in this recommendation (0-100).
   */
  confidence: number;
  /**
   * @property suggestedChange - A suggested change to a time buffer, if applicable.
   */
  suggestedChange?: {
    /**
     * @property field - The field to adjust.
     */
    field: keyof TimeBuffers;
    /**
     * @property currentValue - The current value of the field.
     */
    currentValue: number;
    /**
     * @property suggestedValue - The suggested value for the field.
     */
    suggestedValue: number;
  };
}

/**
 * @interface TimeBuffers
 * @description Represents the different time buffers used in the time calculation.
 */
export interface TimeBuffers {
  carChange: number;
  parking: number;
  entry: number;
  traffic: number;
  morningRoutine: number;
}

// Zod validation schemas for runtime type checking
export const CalendarConflictSchema = z.object({
  conflictingEvent: z.any(), // CalendarEvent schema would be defined separately
  overlapType: z.enum(["partial", "complete", "encompasses"]),
  overlapDuration: z.number().min(0),
  type: z.enum(["time_overlap", "resource_conflict", "location_conflict"]),
  conflictingData: z.record(z.any()),
  severity: z.enum(["low", "medium", "high", "critical"]),
  suggestedResolution: z.string().min(1)
});

export const AlertRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  condition: z.string().min(1),
  threshold: z.number(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  enabled: z.boolean(),
  cooldownPeriod: z.number().min(0),
  lastTriggered: z.date().optional(),
  description: z.string().min(1)
});

export const AlertSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string().min(1),
  timestamp: z.date(),
  resolved: z.boolean(),
  resolvedAt: z.date().optional(),
  metadata: z.record(z.any())
});

export const TimeBuffersSchema = z.object({
  carChange: z.number().min(0),
  parking: z.number().min(0),
  entry: z.number().min(0),
  traffic: z.number().min(0),
  morningRoutine: z.number().min(0)
});

export const TimeRecommendationSchema = z.object({
  type: z.enum(["buffer_adjustment", "departure_time", "preparation"]),
  priority: z.enum(["low", "medium", "high"]),
  message: z.string().min(1),
  description: z.string().min(1),
  impact: z.string().min(1),
  confidence: z.number().min(0).max(100),
  suggestedChange: z.object({
    field: z.string(),
    currentValue: z.number(),
    suggestedValue: z.number()
  }).optional()
});

// Type validators for runtime validation
export function validateCalendarConflict(data: unknown): data is CalendarConflict {
  try {
    CalendarConflictSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function validateAlertRule(data: unknown): data is AlertRule {
  try {
    AlertRuleSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function validateAlert(data: unknown): data is Alert {
  try {
    AlertSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function validateTimeBuffers(data: unknown): data is TimeBuffers {
  try {
    TimeBuffersSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function validateTimeRecommendation(data: unknown): data is TimeRecommendation {
  try {
    TimeRecommendationSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

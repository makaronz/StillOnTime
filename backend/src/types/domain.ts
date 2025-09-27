/**
 * @file This file contains consolidated and standardized type definitions for the backend.
 */

import { CalendarEvent } from "./index";

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
interface TimeBuffers {
  carChange: number;
  parking: number;
  entry: number;
  traffic: number;
  morningRoutine: number;
}

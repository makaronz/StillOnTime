import {
  TimeBuffers,
  TimeRecommendation,
  TimeCalculationOptions,
} from "../types";
import { logger } from "../utils/logger";

export interface TimeCalculationResult {
  wakeUpTime: Date;
  departureTime: Date;
  arrivalTime: Date;
  totalTravelMinutes: number;
  bufferBreakdown: BufferBreakdown;
  recommendations: TimeRecommendation[];
  warnings: string[];
}

export interface BufferBreakdown {
  travelTime: number;
  carChange: number;
  parking: number;
  entry: number;
  traffic: number;
  morningRoutine: number;
  total: number;
}

export interface TimeValidationResult {
  isValid: boolean;
  issues: TimeIssue[];
  severity: "info" | "warning" | "error";
}

export interface TimeIssue {
  type:
    | "early_wakeup"
    | "excessive_travel"
    | "insufficient_buffer"
    | "unrealistic_timing";
  message: string;
  severity: "info" | "warning" | "error";
  suggestedFix?: string;
}

export class TimeCalculationService {
  /**
   * Calculate comprehensive time plan with recommendations
   */
  calculateTimeSchedule(
    callTime: Date,
    travelTimeMinutes: number,
    buffers: TimeBuffers,
    options: {
      location?: string;
      sceneType?: "INT" | "EXT";
      weatherConditions?: string[];
    } = {}
  ): TimeCalculationResult {
    try {
      logger.info("Calculating time schedule", {
        callTime: callTime.toISOString(),
        travelTimeMinutes,
        buffers,
        options,
      });

      // Calculate buffer breakdown
      const bufferBreakdown = this.calculateBufferBreakdown(
        travelTimeMinutes,
        buffers
      );

      // Calculate key times
      const arrivalTime = new Date(callTime);
      const departureTime = new Date(
        callTime.getTime() - travelTimeMinutes * 60 * 1000
      );
      const wakeUpTime = new Date(
        callTime.getTime() - bufferBreakdown.total * 60 * 1000
      );

      // Generate recommendations
      const recommendations = this.generateTimeRecommendations(
        wakeUpTime,
        departureTime,
        callTime,
        bufferBreakdown,
        options
      );

      // Generate warnings
      const warnings = this.generateTimeWarnings(
        wakeUpTime,
        bufferBreakdown,
        options
      );

      const result: TimeCalculationResult = {
        wakeUpTime,
        departureTime,
        arrivalTime,
        totalTravelMinutes: bufferBreakdown.total,
        bufferBreakdown,
        recommendations,
        warnings,
      };

      logger.info("Time schedule calculated successfully", {
        wakeUpTime: wakeUpTime.toISOString(),
        departureTime: departureTime.toISOString(),
        totalMinutes: bufferBreakdown.total,
        recommendationCount: recommendations.length,
        warningCount: warnings.length,
      });

      return result;
    } catch (error) {
      logger.error("Failed to calculate time schedule", {
        error: error instanceof Error ? error.message : "Unknown error",
        callTime: callTime.toISOString(),
        travelTimeMinutes,
        buffers,
      });
      throw error;
    }
  }

  /**
   * Validate time schedule for reasonableness
   */
  validateTimeSchedule(
    wakeUpTime: Date,
    callTime: Date,
    buffers: TimeBuffers,
    travelTimeMinutes: number
  ): TimeValidationResult {
    const issues: TimeIssue[] = [];
    let maxSeverity: "info" | "warning" | "error" = "info";

    // Check wake-up time
    if (wakeUpTime.getUTCHours() < 3) {
      issues.push({
        type: "early_wakeup",
        message: `Czas pobudki (${this.formatTime(
          wakeUpTime
        )}) jest ekstremalnie wczesny`,
        severity: "error",
        suggestedFix:
          "Rozważ nocleg w pobliżu lokacji lub znaczne zwiększenie buforów",
      });
      maxSeverity = "error";
    } else if (wakeUpTime.getUTCHours() < 4) {
      issues.push({
        type: "early_wakeup",
        message: `Czas pobudki (${this.formatTime(
          wakeUpTime
        )}) jest bardzo wczesny`,
        severity: "warning",
        suggestedFix:
          "Rozważ zwiększenie buforów czasowych lub wcześniejszy wyjazd",
      });
      if (maxSeverity === "info") maxSeverity = "warning";
    }

    // Check total travel time
    const totalMinutes =
      travelTimeMinutes + this.calculateTotalBuffers(buffers);
    if (totalMinutes > 240) {
      // More than 4 hours
      issues.push({
        type: "excessive_travel",
        message: `Całkowity czas (${Math.floor(totalMinutes / 60)}h ${
          totalMinutes % 60
        }min) jest bardzo długi`,
        severity: "warning",
        suggestedFix: "Sprawdź alternatywne trasy lub rozważ nocleg",
      });
      if (maxSeverity === "info") maxSeverity = "warning";
    }

    // Check buffer adequacy
    if (buffers.traffic < 15 && travelTimeMinutes > 60) {
      issues.push({
        type: "insufficient_buffer",
        message: "Bufor na korki może być niewystarczający dla tej trasy",
        severity: "warning",
        suggestedFix: "Zwiększ bufor ruchu do co najmniej 30 minut",
      });
      if (maxSeverity === "info") maxSeverity = "warning";
    }

    // Check morning routine buffer
    if (buffers.morningRoutine < 30) {
      issues.push({
        type: "insufficient_buffer",
        message: "Bufor na poranną rutynę może być za krótki",
        severity: "info",
        suggestedFix: "Rozważ zwiększenie bufora do 45-60 minut",
      });
    }

    return {
      isValid: maxSeverity !== "error",
      issues,
      severity: maxSeverity,
    };
  }

  /**
   * Generate optimized buffer recommendations based on conditions
   */
  generateOptimizedBuffers(
    baseBuffers: TimeBuffers,
    conditions: {
      travelTimeMinutes: number;
      sceneType?: "INT" | "EXT";
      weatherConditions?: string[];
      timeOfDay?: "early" | "normal" | "late";
      location?: string;
    }
  ): TimeBuffers & { reasoning: string[] } {
    const optimized = { ...baseBuffers };
    const reasoning: string[] = [];

    // Adjust traffic buffer based on travel time and time of day
    if (conditions.travelTimeMinutes > 90) {
      optimized.traffic = Math.max(optimized.traffic, 30);
      reasoning.push("Zwiększono bufor ruchu ze względu na długą trasę");
    }

    if (conditions.timeOfDay === "early") {
      optimized.traffic = Math.max(optimized.traffic, 25);
      reasoning.push(
        "Zwiększono bufor ruchu ze względu na poranne godziny szczytu"
      );
    }

    // Adjust based on weather conditions
    if (
      conditions.weatherConditions?.includes("rain") ||
      conditions.weatherConditions?.includes("snow")
    ) {
      optimized.traffic += 15;
      optimized.parking += 5;
      reasoning.push(
        "Zwiększono bufory ze względu na niekorzystne warunki pogodowe"
      );
    }

    if (conditions.weatherConditions?.includes("fog")) {
      optimized.traffic += 20;
      reasoning.push("Zwiększono bufor ruchu ze względu na mgłę");
    }

    // Adjust based on scene type
    if (conditions.sceneType === "EXT") {
      optimized.morningRoutine += 10;
      reasoning.push("Zwiększono bufor porannej rutyny dla scen zewnętrznych");
    }

    // Adjust car change buffer for longer distances
    if (conditions.travelTimeMinutes > 120) {
      optimized.carChange += 5;
      reasoning.push("Zwiększono bufor zmiany samochodu dla długiej trasy");
    }

    return {
      ...optimized,
      reasoning,
    };
  }

  /**
   * Calculate detailed buffer breakdown
   */
  private calculateBufferBreakdown(
    travelTimeMinutes: number,
    buffers: TimeBuffers
  ): BufferBreakdown {
    return {
      travelTime: travelTimeMinutes,
      carChange: buffers.carChange,
      parking: buffers.parking,
      entry: buffers.entry,
      traffic: buffers.traffic,
      morningRoutine: buffers.morningRoutine,
      total: travelTimeMinutes + this.calculateTotalBuffers(buffers),
    };
  }

  /**
   * Calculate total buffer time
   */
  private calculateTotalBuffers(buffers: TimeBuffers): number {
    return (
      buffers.carChange +
      buffers.parking +
      buffers.entry +
      buffers.traffic +
      buffers.morningRoutine
    );
  }

  /**
   * Generate time-based recommendations
   */
  private generateTimeRecommendations(
    wakeUpTime: Date,
    departureTime: Date,
    callTime: Date,
    bufferBreakdown: BufferBreakdown,
    options: TimeCalculationOptions
  ): TimeRecommendation[] {
    const recommendations: TimeRecommendation[] = [];

    // Early wake-up recommendations
    if (wakeUpTime.getUTCHours() < 5) {
      recommendations.push({
        type: "preparation",
        priority: "high",
        message:
          "Przygotuj wszystko wieczorem przed - ubrania, sprzęt, dokumenty",
        description:
          "Bardzo wczesny czas pobudki wymaga przygotowania poprzedniego wieczoru",
        impact: "Zmniejszy stres i czas potrzebny rano",
        confidence: 95,
      });

      recommendations.push({
        type: "departure_time",
        priority: "medium",
        message: "Rozważ wyjazd wieczorem i nocleg w pobliżu lokacji",
        description: "Nocleg w pobliżu lokacji może być bardziej praktyczny",
        impact: "Znacznie zmniejszy czas podróży i stres rano",
        confidence: 85,
      });
    }

    // Traffic buffer recommendations
    if (bufferBreakdown.traffic < 20 && bufferBreakdown.travelTime > 60) {
      recommendations.push({
        type: "buffer_adjustment",
        priority: "medium",
        message: "Zwiększ bufor na korki dla bezpieczeństwa",
        description:
          "Obecny bufor ruchu może być niewystarczający dla długiej trasy",
        impact: "Zmniejszy ryzyko spóźnienia z powodu korków",
        confidence: 80,
        suggestedChange: {
          field: "traffic",
          currentValue: bufferBreakdown.traffic,
          suggestedValue: Math.max(30, bufferBreakdown.traffic + 15),
        },
      });
    }

    // Morning routine recommendations
    if (bufferBreakdown.morningRoutine < 45) {
      recommendations.push({
        type: "buffer_adjustment",
        priority: "low",
        message: "Rozważ zwiększenie czasu na poranną rutynę",
        description: "Dodatkowy czas na poranną rutynę może zmniejszyć stres",
        impact: "Pozwoli na spokojniejsze przygotowanie się rano",
        confidence: 70,
        suggestedChange: {
          field: "morningRoutine",
          currentValue: bufferBreakdown.morningRoutine,
          suggestedValue: 60,
        },
      });
    }

    // Weather-based recommendations
    if (options.weatherConditions && options.weatherConditions.length > 0) {
      recommendations.push({
        type: "preparation",
        priority: "medium",
        message: "Sprawdź prognozę pogody rano i dostosuj czas wyjazdu",
        description: "Warunki pogodowe mogą wpłynąć na czas podróży",
        impact: "Pozwoli na dostosowanie planu do aktualnych warunków",
        confidence: 75,
      });
    }

    return recommendations;
  }

  /**
   * Generate time-related warnings
   */
  private generateTimeWarnings(
    wakeUpTime: Date,
    bufferBreakdown: BufferBreakdown,
    options: TimeCalculationOptions
  ): string[] {
    const warnings: string[] = [];

    if (wakeUpTime.getUTCHours() < 4) {
      warnings.push(
        `Czas pobudki (${this.formatTime(wakeUpTime)}) jest bardzo wczesny. ` +
          "Rozważ zwiększenie buforów czasowych lub wcześniejszy wyjazd poprzedniego dnia."
      );
    }

    if (bufferBreakdown.total > 180) {
      warnings.push(
        `Całkowity czas podróży (${Math.floor(bufferBreakdown.total / 60)}h ${
          bufferBreakdown.total % 60
        }min) ` +
          "jest bardzo długi. Sprawdź trasę i rozważ alternatywne opcje."
      );
    }

    if (bufferBreakdown.traffic < 30 && bufferBreakdown.travelTime > 90) {
      warnings.push(
        "Bufor na korki może być niewystarczający dla tak długiej trasy. " +
          "Rozważ zwiększenie bufora ruchu."
      );
    }

    return warnings;
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  }
}

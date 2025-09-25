import { WeatherService } from "./weather.service";
import { WeatherDataRepository } from "@/repositories/weather-data.repository";
import { ScheduleDataRepository } from "@/repositories/schedule-data.repository";
import { weatherCacheService, WeatherCacheData } from "./weather-cache.service";
import { WeatherData, ScheduleDataWithRelations, WeatherChange } from "@/types";
import { logger } from "@/utils/logger";

/**
 * Weather Monitoring Service
 * Handles scheduled weather updates, change notifications, and impact analysis
 * Implements requirements 5.2, 5.3, 5.4, 5.5
 */

export interface WeatherChangeNotification {
  scheduleId: string;
  location: string;
  date: string;
  previousWeather: WeatherCacheData;
  currentWeather: WeatherCacheData;
  significantChanges: WeatherChange[];
  impactAnalysis: WeatherImpact;
  timestamp: Date;
}

// WeatherChange interface moved to types/index.ts

export interface WeatherImpact {
  routePlanning: {
    affectsTravel: boolean;
    suggestedBufferIncrease: number; // in minutes
    recommendations: string[];
  };
  shootingConditions: {
    severity: "none" | "minor" | "moderate" | "severe";
    concerns: string[];
    recommendations: string[];
  };
  overallRisk: "low" | "medium" | "high" | "critical";
}

export class WeatherMonitoringService {
  private weatherService: WeatherService;
  private weatherRepository: WeatherDataRepository;
  private scheduleRepository: ScheduleDataRepository;

  constructor(
    weatherService: WeatherService,
    weatherRepository: WeatherDataRepository,
    scheduleRepository: ScheduleDataRepository
  ) {
    this.weatherService = weatherService;
    this.weatherRepository = weatherRepository;
    this.scheduleRepository = scheduleRepository;
  }

  /**
   * Update weather data for all upcoming schedules
   * Requirement 5.2: Implement weather change notifications
   */
  async updateWeatherForUpcomingSchedules(): Promise<void> {
    try {
      logger.info("Starting weather update for upcoming schedules");

      // Get all schedules for the next 5 days
      const upcomingSchedules = await this.getUpcomingSchedules(5);

      logger.info(
        `Found ${upcomingSchedules.length} upcoming schedules to update`
      );

      const updatePromises = upcomingSchedules.map((schedule) =>
        this.updateWeatherForSchedule(schedule)
      );

      const results = await Promise.allSettled(updatePromises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      logger.info("Weather update completed", {
        total: upcomingSchedules.length,
        successful,
        failed,
      });

      if (failed > 0) {
        const errors = results
          .filter((r) => r.status === "rejected")
          .map((r) => (r as PromiseRejectedResult).reason);

        logger.warn("Some weather updates failed", { errors });
      }
    } catch (error) {
      logger.error("Failed to update weather for upcoming schedules", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update weather data for a specific schedule and detect changes
   * Requirement 5.3: Implement weather change notifications
   */
  async updateWeatherForSchedule(
    schedule: ScheduleDataWithRelations
  ): Promise<WeatherChangeNotification | null> {
    try {
      const { id: scheduleId, location, shootingDate, user } = schedule;
      const dateStr = shootingDate.toISOString().split("T")[0];

      logger.debug("Updating weather for schedule", {
        scheduleId,
        location,
        date: dateStr,
      });

      // Get current weather data from database
      const existingWeather = schedule.weatherData;

      // Fetch fresh weather data
      const freshWeatherData = await this.weatherService.getWeatherForecast(
        location,
        dateStr
      );

      // Compare with existing data to detect changes
      let changeNotification: WeatherChangeNotification | null = null;

      if (existingWeather) {
        const previousWeatherData: WeatherCacheData = {
          temperature: existingWeather.temperature || 0,
          description: existingWeather.description || "",
          windSpeed: existingWeather.windSpeed || 0,
          precipitation: existingWeather.precipitation || 0,
          humidity: existingWeather.humidity || 0,
          warnings: (existingWeather.warnings as string[]) || [],
          fetchedAt: existingWeather.fetchedAt,
          location,
          date: dateStr,
        };

        const changes = this.detectWeatherChanges(
          previousWeatherData,
          freshWeatherData
        );

        if (changes.length > 0) {
          const impactAnalysis = this.analyzeWeatherImpact(
            freshWeatherData,
            schedule
          );

          changeNotification = {
            scheduleId,
            location,
            date: dateStr,
            previousWeather: previousWeatherData,
            currentWeather: freshWeatherData,
            significantChanges: changes,
            impactAnalysis,
            timestamp: new Date(),
          };

          logger.info("Weather changes detected", {
            scheduleId,
            changesCount: changes.length,
            overallRisk: impactAnalysis.overallRisk,
          });
        }

        // Update existing weather data
        await this.weatherService.updateWeatherData(
          existingWeather.id,
          freshWeatherData
        );
      } else {
        // Create new weather data
        await this.weatherService.storeWeatherData(
          scheduleId,
          user.id,
          freshWeatherData
        );

        logger.info("New weather data created for schedule", { scheduleId });
      }

      return changeNotification;
    } catch (error) {
      logger.error("Failed to update weather for schedule", {
        scheduleId: schedule.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Detect significant changes between weather data
   * Requirement 5.3: Weather change detection
   */
  private detectWeatherChanges(
    previous: WeatherCacheData,
    current: WeatherCacheData
  ): WeatherChange[] {
    const changes: WeatherChange[] = [];

    // Temperature changes
    const tempDiff = current.temperature - previous.temperature;
    if (Math.abs(tempDiff) >= 5) {
      changes.push({
        type: "temperature",
        field: "temperature",
        previousValue: previous.temperature,
        currentValue: current.temperature,
        changeAmount: tempDiff,
        significance: Math.abs(tempDiff) >= 10 ? "high" : "medium",
        description: `Temperature ${
          tempDiff > 0 ? "increased" : "decreased"
        } by ${Math.abs(tempDiff)}°C`,
      });
    }

    // Precipitation changes
    const precipDiff = current.precipitation - previous.precipitation;
    if (Math.abs(precipDiff) >= 1) {
      changes.push({
        type: "precipitation",
        field: "precipitation",
        previousValue: previous.precipitation,
        currentValue: current.precipitation,
        changeAmount: precipDiff,
        significance: Math.abs(precipDiff) >= 5 ? "high" : "medium",
        description: `Precipitation ${
          precipDiff > 0 ? "increased" : "decreased"
        } by ${Math.abs(precipDiff)}mm`,
      });
    }

    // Wind speed changes
    const windDiff = current.windSpeed - previous.windSpeed;
    if (Math.abs(windDiff) >= 3) {
      changes.push({
        type: "wind",
        field: "windSpeed",
        previousValue: previous.windSpeed,
        currentValue: current.windSpeed,
        changeAmount: windDiff,
        significance: Math.abs(windDiff) >= 7 ? "high" : "medium",
        description: `Wind speed ${
          windDiff > 0 ? "increased" : "decreased"
        } by ${Math.abs(windDiff)}m/s`,
      });
    }

    // Weather conditions changes (comparing descriptions)
    if (previous.description !== current.description) {
      changes.push({
        type: "conditions",
        field: "description",
        previousValue: previous.description,
        currentValue: current.description,
        significance: "medium",
        description: `Weather conditions changed from "${previous.description}" to "${current.description}"`,
      });
    }

    return changes;
  }

  /**
   * Analyze weather impact on route planning and shooting conditions
   * Requirement 5.4: Weather impact analysis for route planning
   */
  private analyzeWeatherImpact(
    weatherData: WeatherCacheData,
    schedule: ScheduleDataWithRelations
  ): WeatherImpact {
    const impact: WeatherImpact = {
      routePlanning: {
        affectsTravel: false,
        suggestedBufferIncrease: 0,
        recommendations: [],
      },
      shootingConditions: {
        severity: "none",
        concerns: [],
        recommendations: [],
      },
      overallRisk: "low",
    };

    // Analyze route planning impact
    this.analyzeRoutePlanningImpact(weatherData, impact);

    // Analyze shooting conditions impact
    this.analyzeShootingConditionsImpact(weatherData, schedule, impact);

    // Determine overall risk
    impact.overallRisk = this.calculateOverallRisk(impact);

    return impact;
  }

  /**
   * Analyze impact on route planning and travel
   */
  private analyzeRoutePlanningImpact(
    weatherData: WeatherCacheData,
    impact: WeatherImpact
  ): void {
    const { temperature, precipitation, windSpeed, warnings } = weatherData;

    // Temperature impact on travel
    if (temperature < -5) {
      impact.routePlanning.affectsTravel = true;
      impact.routePlanning.suggestedBufferIncrease += 15;
      impact.routePlanning.recommendations.push(
        "Extra time for snow removal and car warming"
      );
    }

    if (temperature > 35) {
      impact.routePlanning.affectsTravel = true;
      impact.routePlanning.suggestedBufferIncrease += 10;
      impact.routePlanning.recommendations.push(
        "Avoid travel during the hottest hours"
      );
    }

    // Precipitation impact
    if (precipitation > 0) {
      impact.routePlanning.affectsTravel = true;

      if (precipitation < 2) {
        impact.routePlanning.suggestedBufferIncrease += 10;
        impact.routePlanning.recommendations.push(
          "Light precipitation - drive carefully"
        );
      } else if (precipitation < 10) {
        impact.routePlanning.suggestedBufferIncrease += 20;
        impact.routePlanning.recommendations.push(
          "Moderate precipitation - significantly increase caution"
        );
      } else {
        impact.routePlanning.suggestedBufferIncrease += 30;
        impact.routePlanning.recommendations.push(
          "Heavy precipitation - consider delaying departure"
        );
      }
    }

    // Wind impact
    if (windSpeed > 15) {
      impact.routePlanning.affectsTravel = true;
      impact.routePlanning.suggestedBufferIncrease += 15;
      impact.routePlanning.recommendations.push(
        "Strong wind - caution on bridges and open areas"
      );
    }

    // Severe weather warnings
    const severeWarnings = warnings.filter(
      (w) => w.includes("Burza") || w.includes("Mgła") || w.includes("Śnieg")
    );

    if (severeWarnings.length > 0) {
      impact.routePlanning.affectsTravel = true;
      impact.routePlanning.suggestedBufferIncrease += 25;
      impact.routePlanning.recommendations.push(
        "Difficult weather conditions - consider alternative route"
      );
    }
  }

  /**
   * Analyze impact on shooting conditions
   */
  private analyzeShootingConditionsImpact(
    weatherData: WeatherCacheData,
    schedule: ScheduleDataWithRelations,
    impact: WeatherImpact
  ): void {
    const { temperature, precipitation, windSpeed, warnings } = weatherData;
    const isExterior = schedule.sceneType === "EXT";

    if (!isExterior) {
      // Interior shoots are less affected by weather
      impact.shootingConditions.severity = "none";
      return;
    }

    // Temperature concerns for exterior shoots
    if (temperature < 0) {
      impact.shootingConditions.severity = "moderate";
      impact.shootingConditions.concerns.push("Very low temperature");
      impact.shootingConditions.recommendations.push(
        "Prepare warm clothing for the crew"
      );
      impact.shootingConditions.recommendations.push(
        "Protect equipment from frost"
      );
    }

    if (temperature > 30) {
      impact.shootingConditions.severity = "moderate";
      impact.shootingConditions.concerns.push("High temperature");
      impact.shootingConditions.recommendations.push(
        "Provide shade and hydration for the crew"
      );
      impact.shootingConditions.recommendations.push(
        "Plan breaks during the hottest hours"
      );
    }

    // Precipitation concerns
    if (precipitation > 0) {
      if (precipitation < 5) {
        impact.shootingConditions.severity = "minor";
        impact.shootingConditions.concerns.push("Light precipitation");
        impact.shootingConditions.recommendations.push(
          "Prepare equipment protection"
        );
      } else {
        impact.shootingConditions.severity = "severe";
        impact.shootingConditions.concerns.push("Heavy precipitation");
        impact.shootingConditions.recommendations.push(
          "Consider postponing outdoor shoots"
        );
        impact.shootingConditions.recommendations.push(
          "Prepare backup plan for indoor scenes"
        );
      }
    }

    // Wind concerns
    if (windSpeed > 10) {
      impact.shootingConditions.severity = "moderate";
      impact.shootingConditions.concerns.push("Strong wind");
      impact.shootingConditions.recommendations.push("Secure film equipment");
      impact.shootingConditions.recommendations.push(
        "Watch out for microphones and lighting"
      );
    }

    // Severe weather
    if (warnings.some((w) => w.includes("Storm") || w.includes("Thunder"))) {
      impact.shootingConditions.severity = "severe";
      impact.shootingConditions.concerns.push("Storm");
      impact.shootingConditions.recommendations.push(
        "Stop outdoor shooting during storms"
      );
      impact.shootingConditions.recommendations.push(
        "Secure electronic equipment"
      );
    }
  }

  /**
   * Calculate overall risk level based on impact analysis
   */
  private calculateOverallRisk(
    impact: WeatherImpact
  ): "low" | "medium" | "high" | "critical" {
    const { routePlanning, shootingConditions } = impact;

    // Critical risk conditions
    if (
      shootingConditions.severity === "severe" &&
      routePlanning.suggestedBufferIncrease > 30
    ) {
      return "critical";
    }

    // High risk conditions
    if (
      shootingConditions.severity === "severe" ||
      routePlanning.suggestedBufferIncrease > 25
    ) {
      return "high";
    }

    // Medium risk conditions
    if (
      shootingConditions.severity === "moderate" ||
      routePlanning.suggestedBufferIncrease > 15
    ) {
      return "medium";
    }

    return "low";
  }

  /**
   * Get upcoming schedules within specified days
   */
  private async getUpcomingSchedules(
    days: number
  ): Promise<ScheduleDataWithRelations[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    try {
      return await this.scheduleRepository.findUpcomingSchedulesInDateRange(
        startDate,
        endDate
      );
    } catch (error) {
      logger.error("Failed to get upcoming schedules", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process weather change notifications
   * Requirement 5.3: Weather change notifications
   */
  async processWeatherChangeNotifications(
    notifications: WeatherChangeNotification[]
  ): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    logger.info(
      `Processing ${notifications.length} weather change notifications`
    );

    for (const notification of notifications) {
      try {
        await this.sendWeatherChangeNotification(notification);
      } catch (error) {
        logger.error("Failed to send weather change notification", {
          scheduleId: notification.scheduleId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Send weather change notification
   */
  private async sendWeatherChangeNotification(
    notification: WeatherChangeNotification
  ): Promise<void> {
    const { scheduleId, location, date, significantChanges, impactAnalysis } =
      notification;

    // Create notification message
    const message = this.createWeatherChangeMessage(notification);

    logger.info("Weather change notification created", {
      scheduleId,
      location,
      date,
      changesCount: significantChanges.length,
      overallRisk: impactAnalysis.overallRisk,
      message: message.substring(0, 100) + "...",
    });

    // TODO: Integrate with notification service to send email/SMS/push notifications
    // This would be implemented when the notification service is available
  }

  /**
   * Create weather change notification message
   */
  private createWeatherChangeMessage(
    notification: WeatherChangeNotification
  ): string {
    const { location, date, significantChanges, impactAnalysis } = notification;

    let message = `🌤️ Weather change for shoot at ${location} (${date})\n\n`;

    // Add changes
    message += "📊 Detected changes:\n";
    significantChanges.forEach((change) => {
      message += `• ${change.description}\n`;
    });

    // Add impact analysis
    message += "\n🎬 Impact on shooting:\n";
    if (impactAnalysis.shootingConditions.concerns.length > 0) {
      impactAnalysis.shootingConditions.concerns.forEach((concern) => {
        message += `• ${concern}\n`;
      });
    }

    // Add recommendations
    if (impactAnalysis.shootingConditions.recommendations.length > 0) {
      message += "\n💡 Recommendations:\n";
      impactAnalysis.shootingConditions.recommendations.forEach((rec) => {
        message += `• ${rec}\n`;
      });
    }

    // Add route planning impact
    if (impactAnalysis.routePlanning.affectsTravel) {
      message += `\n🚗 Impact on travel:\n`;
      message += `• Suggested additional time: ${impactAnalysis.routePlanning.suggestedBufferIncrease} minutes\n`;
      impactAnalysis.routePlanning.recommendations.forEach((rec) => {
        message += `• ${rec}\n`;
      });
    }

    // Add overall risk
    const riskEmoji = {
      low: "🟢",
      medium: "🟡",
      high: "🟠",
      critical: "🔴",
    };

    message += `\n${
      riskEmoji[impactAnalysis.overallRisk]
    } Overall risk: ${impactAnalysis.overallRisk.toUpperCase()}`;

    return message;
  }

  /**
   * Get weather monitoring statistics
   */
  async getMonitoringStats(): Promise<{
    totalSchedulesMonitored: number;
    recentUpdates: number;
    activeWarnings: number;
    averageUpdateFrequency: number;
  }> {
    try {
      // This would be implemented with actual database queries
      return {
        totalSchedulesMonitored: 0,
        recentUpdates: 0,
        activeWarnings: 0,
        averageUpdateFrequency: 0,
      };
    } catch (error) {
      logger.error("Failed to get monitoring statistics", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

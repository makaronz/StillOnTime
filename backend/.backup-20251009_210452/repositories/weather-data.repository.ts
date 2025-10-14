import { prisma } from "@/prisma";
import { Prisma } from "@prisma/client";
import {
  WeatherData,
  CreateWeatherDataInput,
  UpdateWeatherDataInput,
} from "@/types";
import { AbstractBaseRepository } from "./base.repository";

/**
 * WeatherData Repository Interface
 */
export interface IWeatherDataRepository {
  // Base CRUD operations
  create(data: CreateWeatherDataInput): Promise<WeatherData>;
  findById(id: string): Promise<WeatherData | null>;
  update(id: string, data: UpdateWeatherDataInput): Promise<WeatherData>;
  delete(id: string): Promise<WeatherData>;

  // WeatherData-specific operations
  findByScheduleId(scheduleId: string): Promise<WeatherData | null>;
  findByUserId(userId: string, limit?: number): Promise<WeatherData[]>;
  findStaleWeatherData(hoursOld?: number): Promise<WeatherData[]>;
  findWeatherByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeatherData[]>;

  // Weather analysis operations
  findWeatherWarnings(userId: string): Promise<WeatherData[]>;
  getWeatherStats(userId: string): Promise<{
    totalForecasts: number;
    averageTemperature: number;
    rainDays: number;
    warningDays: number;
  }>;
}

/**
 * WeatherData Repository Implementation
 */
export class WeatherDataRepository
  extends AbstractBaseRepository<
    WeatherData,
    CreateWeatherDataInput,
    UpdateWeatherDataInput
  >
  implements IWeatherDataRepository
{
  protected model = prisma.weatherData;

  // Prisma-specific methods for advanced usage
  createPrisma(args: Prisma.WeatherDataCreateArgs) {
    return this.model.create(args);
  }

  createManyPrisma(args: Prisma.WeatherDataCreateManyArgs) {
    return this.model.createMany(args);
  }

  updatePrisma(args: Prisma.WeatherDataUpdateArgs) {
    return this.model.update(args);
  }

  findUnique(args: Prisma.WeatherDataFindUniqueArgs) {
    return this.model.findUnique(args);
  }

  findMany(args?: Prisma.WeatherDataFindManyArgs) {
    return this.model.findMany(args);
  }

  deletePrisma(args: Prisma.WeatherDataDeleteArgs) {
    return this.model.delete(args);
  }

  deleteManyPrisma(args: Prisma.WeatherDataDeleteManyArgs) {
    return this.model.deleteMany(args);
  }

  /**
   * Find weather data by schedule ID
   */
  async findByScheduleId(scheduleId: string): Promise<WeatherData | null> {
    return await this.model.findUnique({
      where: { scheduleId },
    });
  }

  /**
   * Find weather data by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 20
  ): Promise<WeatherData[]> {
    return await this.model.findMany({
      where: { userId },
      orderBy: { forecastDate: "desc" },
      take: limit,
      include: {
        schedule: {
          select: {
            location: true,
            shootingDate: true,
            sceneType: true,
          },
        },
      },
    });
  }

  /**
   * Find weather data that is stale (older than specified hours)
   */
  async findStaleWeatherData(hoursOld: number = 24): Promise<WeatherData[]> {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    const now = new Date();

    return await this.model.findMany({
      where: {
        fetchedAt: {
          lt: cutoffTime,
        },
        schedule: {
          shootingDate: {
            gte: now, // Only for future schedules
          },
        },
      },
      include: {
        schedule: true,
        user: true,
      },
    });
  }

  /**
   * Find weather data within date range
   */
  async findWeatherByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeatherData[]> {
    return await this.model.findMany({
      where: {
        userId,
        forecastDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        schedule: {
          select: {
            location: true,
            shootingDate: true,
            sceneType: true,
          },
        },
      },
      orderBy: { forecastDate: "asc" },
    });
  }

  /**
   * Find weather data with warnings
   */
  async findWeatherWarnings(userId: string): Promise<WeatherData[]> {
    return await this.model.findMany({
      where: {
        userId,
        warnings: {
          not: Prisma.JsonNull,
        },
        schedule: {
          shootingDate: {
            gte: new Date(), // Only future schedules
          },
        },
      },
      include: {
        schedule: {
          select: {
            location: true,
            shootingDate: true,
            callTime: true,
            sceneType: true,
          },
        },
      },
      orderBy: {
        schedule: {
          shootingDate: "asc",
        },
      },
    });
  }

  /**
   * Get weather statistics for a user
   */
  async getWeatherStats(userId: string): Promise<{
    totalForecasts: number;
    averageTemperature: number;
    rainDays: number;
    warningDays: number;
  }> {
    const weatherData = await this.model.findMany({
      where: { userId },
      select: {
        temperature: true,
        precipitation: true,
        warnings: true,
      },
    });

    const totalForecasts = weatherData.length;

    if (totalForecasts === 0) {
      return {
        totalForecasts: 0,
        averageTemperature: 0,
        rainDays: 0,
        warningDays: 0,
      };
    }

    // Calculate average temperature (excluding null values)
    const temperaturesWithValues = weatherData.filter(
      (w) => w.temperature !== null
    );
    const averageTemperature =
      temperaturesWithValues.length > 0
        ? Math.round(
            temperaturesWithValues.reduce(
              (sum, w) => sum + (w.temperature || 0),
              0
            ) / temperaturesWithValues.length
          )
        : 0;

    // Count rain days (precipitation > 0)
    const rainDays = weatherData.filter(
      (w) => w.precipitation !== null && w.precipitation > 0
    ).length;

    // Count warning days (has warnings)
    const warningDays = weatherData.filter(
      (w) =>
        w.warnings !== null &&
        Array.isArray(w.warnings) &&
        (w.warnings as any[]).length > 0
    ).length;

    return {
      totalForecasts,
      averageTemperature,
      rainDays,
      warningDays,
    };
  }

  /**
   * Update or create weather data for a schedule
   */
  async upsertWeatherData(
    scheduleId: string,
    userId: string,
    weatherData: {
      forecastDate: Date;
      temperature?: number;
      description?: string;
      windSpeed?: number;
      precipitation?: number;
      humidity?: number;
      warnings?: string[];
    }
  ): Promise<WeatherData> {
    return await this.model.upsert({
      where: { scheduleId },
      update: {
        ...weatherData,
        fetchedAt: new Date(),
      },
      create: {
        ...weatherData,
        user: { connect: { id: userId } },
        schedule: { connect: { id: scheduleId } },
        fetchedAt: new Date(),
      },
    });
  }

  /**
   * Find weather data needing updates (for upcoming schedules)
   */
  async findWeatherNeedingUpdate(): Promise<WeatherData[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return await this.model.findMany({
      where: {
        schedule: {
          shootingDate: {
            gte: tomorrow,
            lte: nextWeek,
          },
        },
        fetchedAt: {
          lt: oneDayAgo,
        },
      },
      include: {
        schedule: true,
        user: true,
      },
    });
  }

  /**
   * Clean up old weather data (data retention)
   */
  async cleanupOldWeatherData(
    daysToKeep: number = 90
  ): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return await this.model.deleteMany({
      where: {
        fetchedAt: {
          lt: cutoffDate,
        },
        schedule: {
          shootingDate: {
            lt: cutoffDate,
          },
        },
      },
    });
  }
}

// Export a ready-to-use singleton instance
export const weatherDataRepository = new WeatherDataRepository();

// Also export as default for flexibility
export default WeatherDataRepository;

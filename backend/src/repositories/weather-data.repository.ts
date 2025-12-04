import { db } from "@/config/database";
import {
  WeatherData,
  CreateWeatherDataInput,
  UpdateWeatherDataInput,
} from "@/types";
import type {
  NewWeatherData,
  WeatherDataUpdate,
} from "@/config/database-types";

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
 * WeatherData Repository Implementation with Kysely
 */
export class WeatherDataRepository implements IWeatherDataRepository {
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  }

  async create(data: CreateWeatherDataInput): Promise<WeatherData> {
    const id = this.generateCuid();
    const { id: _, ...dataWithoutId } = data;
    return await db
      .insertInto("weather_data")
      .values({
        id,
        ...dataWithoutId,
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewWeatherData)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<WeatherData | null> {
    const result = await db
      .selectFrom("weather_data")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return result || null;
  }

  async update(id: string, data: UpdateWeatherDataInput): Promise<WeatherData> {
    return await db
      .updateTable("weather_data")
      .set({ ...data, updatedAt: new Date() } as WeatherDataUpdate)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string): Promise<WeatherData> {
    return await db
      .deleteFrom("weather_data")
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find weather data by schedule ID
   */
  async findByScheduleId(scheduleId: string): Promise<WeatherData | null> {
    const result = await db
      .selectFrom("weather_data")
      .selectAll()
      .where("scheduleId", "=", scheduleId)
      .executeTakeFirst();
    return result || null;
  }

  /**
   * Find weather data by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 20
  ): Promise<WeatherData[]> {
    return await db
      .selectFrom("weather_data")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("forecastDate", "desc")
      .limit(limit)
      .execute();
  }

  /**
   * Find weather data that is stale (older than specified hours)
   */
  async findStaleWeatherData(hoursOld: number = 24): Promise<WeatherData[]> {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    return await db
      .selectFrom("weather_data")
      .selectAll()
      .where("fetchedAt", "<", cutoffTime)
      .execute();
  }

  /**
   * Find weather data within date range
   */
  async findWeatherByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeatherData[]> {
    return await db
      .selectFrom("weather_data")
      .selectAll()
      .where("userId", "=", userId)
      .where("forecastDate", ">=", startDate)
      .where("forecastDate", "<=", endDate)
      .orderBy("forecastDate", "asc")
      .execute();
  }

  /**
   * Find weather data with warnings
   */
  async findWeatherWarnings(userId: string): Promise<WeatherData[]> {
    return await db
      .selectFrom("weather_data")
      .selectAll()
      .where("userId", "=", userId)
      .execute();
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
    const weatherData = await db
      .selectFrom("weather_data")
      .select(["temperature", "precipitation", "warnings"])
      .where("userId", "=", userId)
      .execute();

    const totalForecasts = weatherData.length;

    if (totalForecasts === 0) {
      return {
        totalForecasts: 0,
        averageTemperature: 0,
        rainDays: 0,
        warningDays: 0,
      };
    }

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

    const rainDays = weatherData.filter(
      (w) => w.precipitation !== null && w.precipitation > 0
    ).length;

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
    const existing = await this.findByScheduleId(scheduleId);
    if (existing) {
      return await this.update(existing.id, weatherData as any);
    }
    return await this.create({
      ...weatherData,
      userId,
      scheduleId,
    } as any);
  }

  /**
   * Find weather data needing updates (for upcoming schedules)
   */
  async findWeatherNeedingUpdate(): Promise<WeatherData[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await db
      .selectFrom("weather_data")
      .selectAll()
      .where("fetchedAt", "<", oneDayAgo)
      .execute();
  }

  /**
   * Clean up old weather data (data retention)
   */
  async cleanupOldWeatherData(
    daysToKeep: number = 90
  ): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .deleteFrom("weather_data")
      .where("fetchedAt", "<", cutoffDate)
      .executeTakeFirst();

    return { count: Number(result.numDeletedRows || 0) };
  }
}

// Export a ready-to-use singleton instance
export const weatherDataRepository = new WeatherDataRepository();

// Also export as default for flexibility
export default WeatherDataRepository;

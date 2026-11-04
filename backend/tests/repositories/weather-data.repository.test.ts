import {
  WeatherDataRepository,
  weatherDataRepository,
} from "@/repositories/weather-data.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * WeatherDataRepository is written against Kysely. These tests run the real
 * query builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 *
 * Deliberately not asserted (see the report accompanying this suite):
 *  - the createdAt/updatedAt columns written by create()/update(): the
 *    weather_data table (schema.sql) has no such columns;
 *  - findWeatherWarnings(): it currently does not filter on warnings at all.
 */
describe("WeatherDataRepository", () => {
  let repo: WeatherDataRepository;

  const HOUR = 60 * 60 * 1000;

  const weatherRow = {
    id: "weather-1",
    forecastDate: new Date("2030-12-01T00:00:00Z"),
    temperature: 15.5,
    description: "Partly cloudy",
    windSpeed: 5.2,
    precipitation: 0,
    humidity: 65,
    warnings: ["Low temperature warning"],
    fetchedAt: new Date("2030-11-30T00:00:00Z"),
    userId: "user-1",
    scheduleId: "schedule-1",
  };

  beforeEach(() => {
    repo = new WeatherDataRepository();
  });

  describe("exports", () => {
    it("exports a ready-to-use singleton instance", () => {
      expect(weatherDataRepository).toBeInstanceOf(WeatherDataRepository);
    });
  });

  describe("create", () => {
    it("inserts a generated id plus the input and returns the created row", async () => {
      testDb.enqueueRows([weatherRow]);

      const result = await repo.create({
        forecastDate: weatherRow.forecastDate,
        temperature: 15.5,
        description: "Partly cloudy",
        windSpeed: 5.2,
        precipitation: 0,
        humidity: 65,
        userId: "user-1",
        scheduleId: "schedule-1",
      } as any);

      expect(result).toEqual(weatherRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^insert into "weather_data" \(/);
      expect(q.sql).toContain("returning *");
      for (const col of [
        '"id"',
        '"forecastDate"',
        '"temperature"',
        '"description"',
        '"windSpeed"',
        '"precipitation"',
        '"humidity"',
        '"userId"',
        '"scheduleId"',
        '"fetchedAt"',
      ]) {
        expect(q.sql).toContain(col);
      }
      // First column is the generated id, followed by the input in key order.
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1, 9)).toEqual([
        weatherRow.forecastDate,
        15.5,
        "Partly cloudy",
        5.2,
        0,
        65,
        "user-1",
        "schedule-1",
      ]);
      // fetchedAt is stamped by the repository.
      expect(q.parameters[9]).toBeInstanceOf(Date);
    });

    it("ignores a caller-supplied id and generates its own", async () => {
      testDb.enqueueRows([weatherRow]);

      await repo.create({
        id: "caller-id",
        forecastDate: weatherRow.forecastDate,
        userId: "user-1",
        scheduleId: "schedule-1",
      } as any);

      const q = testDb.lastQuery();
      expect(q.parameters).not.toContain("caller-id");
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
    });

    it("stamps fetchedAt with the current time", async () => {
      testDb.enqueueRows([weatherRow]);
      const before = Date.now();

      await repo.create({
        forecastDate: weatherRow.forecastDate,
        userId: "user-1",
        scheduleId: "schedule-1",
      } as any);

      const after = Date.now();
      const dates = testDb
        .lastQuery()
        .parameters.filter(
          (p): p is Date => p instanceof Date && p !== weatherRow.forecastDate
        );
      expect(dates.length).toBeGreaterThan(0);
      for (const d of dates) {
        expect(d.getTime()).toBeGreaterThanOrEqual(before);
        expect(d.getTime()).toBeLessThanOrEqual(after);
      }
    });

    it("generates a different id on each call", async () => {
      testDb.enqueueRows([weatherRow]);
      testDb.enqueueRows([weatherRow]);
      const input = {
        forecastDate: weatherRow.forecastDate,
        userId: "user-1",
        scheduleId: "schedule-1",
      } as any;

      await repo.create(input);
      await repo.create(input);

      expect(testDb.queries[0].parameters[0]).not.toBe(
        testDb.queries[1].parameters[0]
      );
    });

    it("throws when the insert returns no row", async () => {
      await expect(
        repo.create({
          forecastDate: weatherRow.forecastDate,
          userId: "user-1",
          scheduleId: "schedule-1",
        } as any)
      ).rejects.toThrow();
    });

    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("unique violation"));
      await expect(
        repo.create({
          forecastDate: weatherRow.forecastDate,
          userId: "user-1",
          scheduleId: "schedule-1",
        } as any)
      ).rejects.toThrow("unique violation");
    });
  });

  describe("findById", () => {
    it("filters on id and returns the row", async () => {
      testDb.enqueueRows([weatherRow]);

      const result = await repo.findById("weather-1");

      expect(result).toEqual(weatherRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "weather_data" where "id" = \$1/);
      expect(q.parameters).toEqual(["weather-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
      expect(testDb.lastQuery().parameters).toEqual(["missing"]);
    });
  });

  describe("update", () => {
    it("sets the given fields, scoped by id, and returns the updated row", async () => {
      testDb.enqueueRows([{ ...weatherRow, temperature: 20 }]);

      const result = await repo.update("weather-1", { temperature: 20 });

      expect(result.temperature).toBe(20);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^update "weather_data" set "temperature" = \$1/);
      expect(q.sql).toMatch(/where "id" = \$\d+ returning \*/);
      expect(q.parameters[0]).toBe(20);
      expect(q.parameters[q.parameters.length - 1]).toBe("weather-1");
    });

    it("writes multiple fields in the order given", async () => {
      testDb.enqueueRows([weatherRow]);

      await repo.update("weather-1", { description: "Rain", humidity: 90 });

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "weather_data" set "description" = \$1, "humidity" = \$2/
      );
      expect(q.parameters.slice(0, 2)).toEqual(["Rain", 90]);
      expect(q.parameters[q.parameters.length - 1]).toBe("weather-1");
    });

    it("throws when no row matches", async () => {
      await expect(
        repo.update("missing", { temperature: 1 })
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([weatherRow]);

      expect(await repo.delete("weather-1")).toEqual(weatherRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "weather_data" where "id" = \$1 returning \*/
      );
      expect(q.parameters).toEqual(["weather-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("findByScheduleId", () => {
    it("filters on scheduleId and returns the row", async () => {
      testDb.enqueueRows([weatherRow]);

      expect(await repo.findByScheduleId("schedule-1")).toEqual(weatherRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "weather_data" where "scheduleId" = \$1/
      );
      expect(q.parameters).toEqual(["schedule-1"]);
    });

    it("returns null when there is no weather for the schedule", async () => {
      expect(await repo.findByScheduleId("nonexistent")).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("filters on user, orders newest forecast first and defaults to 20 rows", async () => {
      testDb.enqueueRows([weatherRow]);

      const result = await repo.findByUserId("user-1");

      expect(result).toEqual([weatherRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "weather_data" where "userId" = \$1 order by "forecastDate" desc limit \$2$/
      );
      expect(q.parameters).toEqual(["user-1", 20]);
    });

    it("honours a custom limit", async () => {
      await repo.findByUserId("user-1", 5);
      expect(testDb.lastQuery().parameters).toEqual(["user-1", 5]);
    });

    it("returns an empty array when the user has no weather data", async () => {
      expect(await repo.findByUserId("user-1")).toEqual([]);
    });
  });

  describe("findStaleWeatherData", () => {
    it("selects rows fetched before now minus 24h by default", async () => {
      testDb.enqueueRows([weatherRow]);
      const before = Date.now();

      const result = await repo.findStaleWeatherData();

      const after = Date.now();
      expect(result).toEqual([weatherRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "weather_data" where "fetchedAt" < \$1$/
      );
      expect(q.parameters).toHaveLength(1);
      const cutoff = q.parameters[0] as Date;
      expect(cutoff).toBeInstanceOf(Date);
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 24 * HOUR);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after - 24 * HOUR);
    });

    it("uses the supplied number of hours", async () => {
      const before = Date.now();

      await repo.findStaleWeatherData(12);

      const after = Date.now();
      const cutoff = testDb.lastQuery().parameters[0] as Date;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 12 * HOUR);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after - 12 * HOUR);
    });

    it("returns an empty array when nothing is stale", async () => {
      expect(await repo.findStaleWeatherData()).toEqual([]);
    });
  });

  describe("findWeatherByDateRange", () => {
    it("filters by user and inclusive forecastDate range, oldest first", async () => {
      testDb.enqueueRows([weatherRow]);
      const start = new Date("2030-12-01T00:00:00Z");
      const end = new Date("2030-12-31T00:00:00Z");

      const result = await repo.findWeatherByDateRange("user-1", start, end);

      expect(result).toEqual([weatherRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "weather_data" where "userId" = \$1 and "forecastDate" >= \$2 and "forecastDate" <= \$3 order by "forecastDate" asc$/
      );
      expect(q.parameters).toEqual(["user-1", start, end]);
    });

    it("returns an empty array when nothing is in range", async () => {
      expect(
        await repo.findWeatherByDateRange(
          "user-1",
          new Date("2030-01-01"),
          new Date("2030-01-02")
        )
      ).toEqual([]);
    });
  });

  describe("getWeatherStats", () => {
    it("projects only the stat columns for the user", async () => {
      await repo.getWeatherStats("user-1");

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select "temperature", "precipitation", "warnings" from "weather_data" where "userId" = \$1$/
      );
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("returns zeroed stats when the user has no data", async () => {
      expect(await repo.getWeatherStats("user-1")).toEqual({
        totalForecasts: 0,
        averageTemperature: 0,
        rainDays: 0,
        warningDays: 0,
      });
    });

    it("computes totals, rounded average temperature, rain days and warning days", async () => {
      testDb.enqueueRows([
        { temperature: 20, precipitation: 0, warnings: null },
        { temperature: 15, precipitation: 5.2, warnings: ["Rain warning"] },
        { temperature: null, precipitation: 0, warnings: null },
      ]);

      expect(await repo.getWeatherStats("user-1")).toEqual({
        totalForecasts: 3,
        averageTemperature: 18, // (20 + 15) / 2 = 17.5 -> 18
        rainDays: 1,
        warningDays: 1,
      });
    });

    it("excludes null temperatures from the average but counts 0 as a value", async () => {
      testDb.enqueueRows([
        { temperature: 0, precipitation: null, warnings: null },
        { temperature: 10, precipitation: null, warnings: null },
        { temperature: null, precipitation: null, warnings: null },
      ]);

      const stats = await repo.getWeatherStats("user-1");

      expect(stats.totalForecasts).toBe(3);
      expect(stats.averageTemperature).toBe(5); // (0 + 10) / 2
    });

    it("rounds the average to the nearest integer", async () => {
      testDb.enqueueRows([
        { temperature: 10, precipitation: 0, warnings: null },
        { temperature: 11, precipitation: 0, warnings: null },
        { temperature: 11, precipitation: 0, warnings: null },
      ]);

      // 32 / 3 = 10.67 -> 11
      expect((await repo.getWeatherStats("user-1")).averageTemperature).toBe(11);
    });

    it("handles negative temperatures", async () => {
      testDb.enqueueRows([
        { temperature: -10, precipitation: 0, warnings: null },
        { temperature: -4, precipitation: 0, warnings: null },
      ]);

      expect((await repo.getWeatherStats("user-1")).averageTemperature).toBe(-7);
    });

    it("reports a 0 average when every temperature is null", async () => {
      testDb.enqueueRows([
        { temperature: null, precipitation: 1, warnings: null },
        { temperature: null, precipitation: null, warnings: null },
      ]);

      const stats = await repo.getWeatherStats("user-1");

      expect(stats.totalForecasts).toBe(2);
      expect(stats.averageTemperature).toBe(0);
      expect(stats.rainDays).toBe(1);
    });

    it("counts a rain day only for strictly positive precipitation", async () => {
      testDb.enqueueRows([
        { temperature: 10, precipitation: 0, warnings: null },
        { temperature: 10, precipitation: null, warnings: null },
        { temperature: 10, precipitation: 0.1, warnings: null },
        { temperature: 10, precipitation: 12, warnings: null },
      ]);

      expect((await repo.getWeatherStats("user-1")).rainDays).toBe(2);
    });

    it("counts a warning day only for a non-empty warnings array", async () => {
      testDb.enqueueRows([
        { temperature: 10, precipitation: 0, warnings: null },
        { temperature: 10, precipitation: 0, warnings: [] },
        { temperature: 10, precipitation: 0, warnings: ["Wind"] },
        { temperature: 10, precipitation: 0, warnings: ["Wind", "Rain"] },
        { temperature: 10, precipitation: 0, warnings: { not: "an array" } },
        { temperature: 10, precipitation: 0, warnings: "Wind" },
      ]);

      expect((await repo.getWeatherStats("user-1")).warningDays).toBe(2);
    });
  });

  describe("upsertWeatherData", () => {
    const input = {
      forecastDate: new Date("2030-12-01T00:00:00Z"),
      temperature: 15.5,
      description: "Partly cloudy",
      windSpeed: 5.2,
      precipitation: 0,
      humidity: 65,
    };

    it("updates the existing row (found by schedule) instead of inserting", async () => {
      testDb.enqueueRows([weatherRow]); // findByScheduleId
      testDb.enqueueRows([{ ...weatherRow, temperature: 15.5 }]); // update

      const result = await repo.upsertWeatherData(
        "schedule-1",
        "user-1",
        input
      );

      expect(result.temperature).toBe(15.5);
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[0].sql).toMatch(
        /^select \* from "weather_data" where "scheduleId" = \$1/
      );
      expect(testDb.queries[0].parameters).toEqual(["schedule-1"]);
      const upd = testDb.queries[1];
      expect(upd.sql).toMatch(/^update "weather_data" set /);
      expect(upd.sql).toContain('"forecastDate" = $1');
      expect(upd.sql).toContain('"temperature" = $2');
      expect(upd.sql).toMatch(/where "id" = \$\d+ returning \*/);
      expect(upd.parameters.slice(0, 2)).toEqual([input.forecastDate, 15.5]);
      // scoped to the existing row's id, not the schedule id
      expect(upd.parameters[upd.parameters.length - 1]).toBe("weather-1");
      expect(upd.parameters).not.toContain("user-1");
    });

    it("inserts a new row with userId and scheduleId when none exists", async () => {
      testDb.enqueueRows([]); // findByScheduleId -> none
      testDb.enqueueRows([weatherRow]); // insert

      const result = await repo.upsertWeatherData(
        "schedule-1",
        "user-1",
        input
      );

      expect(result).toEqual(weatherRow);
      expect(testDb.queries).toHaveLength(2);
      const ins = testDb.queries[1];
      expect(ins.sql).toMatch(/^insert into "weather_data" \(/);
      expect(ins.sql).toContain("returning *");
      expect(ins.sql).toContain('"userId"');
      expect(ins.sql).toContain('"scheduleId"');
      expect(ins.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(ins.parameters).toEqual(
        expect.arrayContaining([
          input.forecastDate,
          15.5,
          "Partly cloudy",
          5.2,
          65,
          "user-1",
          "schedule-1",
        ])
      );
    });

    it("propagates a failure of the lookup query without writing", async () => {
      testDb.enqueueError(new Error("db down"));

      await expect(
        repo.upsertWeatherData("schedule-1", "user-1", input)
      ).rejects.toThrow("db down");
      expect(testDb.queries).toHaveLength(1);
    });
  });

  describe("findWeatherNeedingUpdate", () => {
    it("selects rows fetched more than 24h ago", async () => {
      testDb.enqueueRows([weatherRow]);
      const before = Date.now();

      const result = await repo.findWeatherNeedingUpdate();

      const after = Date.now();
      expect(result).toEqual([weatherRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "weather_data" where "fetchedAt" < \$1$/
      );
      const cutoff = q.parameters[0] as Date;
      expect(cutoff).toBeInstanceOf(Date);
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 24 * HOUR);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after - 24 * HOUR);
    });

    it("returns an empty array when everything is fresh", async () => {
      expect(await repo.findWeatherNeedingUpdate()).toEqual([]);
    });
  });

  describe("cleanupOldWeatherData", () => {
    // Mirrors the repository's calendar-day arithmetic (setDate) so the check
    // is independent of DST changes in the machine's local time zone.
    const daysAgo = (from: Date, days: number): number => {
      const d = new Date(from.getTime());
      d.setDate(d.getDate() - days);
      return d.getTime();
    };

    it("deletes rows fetched before the 90 day default cutoff and reports the count", async () => {
      testDb.enqueueAffected(5);
      const before = new Date();

      const result = await repo.cleanupOldWeatherData();

      const after = new Date();
      expect(result).toEqual({ count: 5 });
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "weather_data" where "fetchedAt" < \$1$/
      );
      expect(q.parameters).toHaveLength(1);
      const cutoff = q.parameters[0] as Date;
      expect(cutoff).toBeInstanceOf(Date);
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(daysAgo(before, 90));
      expect(cutoff.getTime()).toBeLessThanOrEqual(daysAgo(after, 90));
    });

    it("uses the supplied retention in days", async () => {
      testDb.enqueueAffected(3);
      const before = new Date();

      const result = await repo.cleanupOldWeatherData(30);

      const after = new Date();
      expect(result).toEqual({ count: 3 });
      const cutoff = testDb.lastQuery().parameters[0] as Date;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(daysAgo(before, 30));
      expect(cutoff.getTime()).toBeLessThanOrEqual(daysAgo(after, 30));
    });

    it("reports a count of 0 when nothing was deleted", async () => {
      testDb.enqueueAffected(0);
      expect(await repo.cleanupOldWeatherData()).toEqual({ count: 0 });
    });

    it("reports a count of 0 when the driver gives no affected-row count", async () => {
      expect(await repo.cleanupOldWeatherData()).toEqual({ count: 0 });
    });

    it("converts a bigint affected-row count to a number", async () => {
      testDb.enqueueAffected(BigInt(12));
      const result = await repo.cleanupOldWeatherData();
      expect(result.count).toBe(12);
      expect(typeof result.count).toBe("number");
    });
  });

  describe("error propagation", () => {
    it("surfaces database errors from reads", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("weather-1")).rejects.toThrow(
        "connection lost"
      );
    });

    it("surfaces database errors from list queries", async () => {
      testDb.enqueueError(new Error("timeout"));
      await expect(repo.findByUserId("user-1")).rejects.toThrow("timeout");
    });

    it("surfaces database errors from cleanup", async () => {
      testDb.enqueueError(new Error("permission denied"));
      await expect(repo.cleanupOldWeatherData()).rejects.toThrow(
        "permission denied"
      );
    });
  });
});

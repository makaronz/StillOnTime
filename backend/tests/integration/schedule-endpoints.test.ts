/**
 * Schedule endpoints, exercised through the real route graph.
 *
 * - App: express + apiRoutes + errorHandler (not src/index, which starts the server).
 * - Auth: a real JWT from services.oauth2.generateJWT. requireValidOAuth runs for
 *   real: it loads the caller from the fake `users` table (valid Google tokens).
 * - Database: the fake Kysely driver (tests/helpers/kysely-test-db). `serve(tables)`
 *   answers every query from an in-memory table set, honouring simple
 *   `"col" <op> $n` where clauses, limit/offset, count(*), update ... set and
 *   delete, so tests can assert both the response and the SQL actually sent.
 * - External boundaries (job queue, weather API) are jest.spyOn'd on the exact
 *   service methods the controllers call.
 */
import express from "express";
import request from "supertest";
import { apiRoutes } from "@/routes";
import { errorHandler } from "@/middleware/errorHandler";
import { services } from "@/services";
import { testDb, RecordedQuery } from "../helpers/kysely-test-db";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SCHED = "csched000000000001";
const EMAIL = "cemail000000000001";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

// ---------------------------------------------------------------- fake world

const COMPARE: Record<string, (a: any, b: any) => boolean> = {
  "=": (a, b) => a === b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
  "<": (a, b) => a < b,
  ">": (a, b) => a > b,
};

const norm = (v: unknown): unknown => (v instanceof Date ? v.getTime() : v);

function conditions(clause: string): Array<{ col: string; op: string; idx: number }> {
  return [...clause.matchAll(/"(\w+)" (=|>=|<=|<|>) \$(\d+)/g)].map((m) => ({
    col: m[1],
    op: m[2],
    idx: Number(m[3]) - 1,
  }));
}

function whereClause(sql: string): string {
  const m = / where (.*?)(?= order by | limit | offset | returning |$)/.exec(sql);
  return m ? m[1] : "";
}

function matches(row: Row, sql: string, params: readonly unknown[]): boolean {
  return conditions(whereClause(sql)).every((c) =>
    COMPARE[c.op](norm(row[c.col]), norm(params[c.idx]))
  );
}

function runQuery(tables: Tables, q: RecordedQuery): Row[] {
  const { sql, parameters: p } = q;
  let m: RegExpExecArray | null;

  if ((m = /^update "(\w+)" set (.*?) where /.exec(sql))) {
    const sets = conditions(m[2]);
    const hit = (tables[m[1]] ?? []).filter((r) => matches(r, sql, p));
    hit.forEach((r) => sets.forEach((s) => (r[s.col] = p[s.idx])));
    return hit.map((r) => ({ ...r }));
  }

  if ((m = /^delete from "(\w+)"/.exec(sql))) {
    const rows = tables[m[1]] ?? [];
    const hit = rows.filter((r) => matches(r, sql, p));
    tables[m[1]] = rows.filter((r) => !hit.includes(r));
    return hit;
  }

  if ((m = /^select .*? from "(\w+)"/.exec(sql))) {
    let rows = (tables[m[1]] ?? []).filter((r) => matches(r, sql, p));
    const off = / offset \$(\d+)/.exec(sql);
    if (off) rows = rows.slice(Number(p[Number(off[1]) - 1]));
    const lim = / limit \$(\d+)/.exec(sql);
    if (lim) rows = rows.slice(0, Number(p[Number(lim[1]) - 1]));
    if (/^select count\(\*\)/.test(sql)) return [{ count: String(rows.length) }];
    return rows.map((r) => ({ ...r }));
  }

  return [];
}

/** Answer every query of the next request(s) from `tables`. */
function serve(tables: Tables): Tables {
  for (let i = 0; i < 50; i++) {
    testDb.enqueueFn((q) => ({ rows: runQuery(tables, q) }));
  }
  return tables;
}

const queriesOn = (table: string): RecordedQuery[] =>
  testDb.queries.filter((q) => q.sql.includes(`"${table}"`));

// ------------------------------------------------------------------ fixtures

const userRow = (id: string): Row => ({
  id,
  email: `${id}@example.invalid`,
  name: "Test User",
  googleId: `google-${id}`,
  accessToken: "encrypted-access-token",
  refreshToken: "encrypted-refresh-token",
  tokenExpiry: new Date(Date.now() + 3600_000),
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
});

const schedule = (over: Row = {}): Row => ({
  id: SCHED,
  userId: USER,
  emailId: EMAIL,
  shootingDate: new Date("2024-01-15T00:00:00.000Z"),
  callTime: "08:00",
  location: "Test Location, Warsaw",
  baseLocation: "Panavision Warsaw",
  sceneType: "EXT",
  scenes: ["Scene 1", "Scene 2"],
  safetyNotes: "Wear safety gear",
  equipment: ["Camera", "Lights"],
  contacts: [{ name: "Director", phone: "+48123456789" }],
  notes: "Test shooting day",
  createdAt: new Date("2024-01-10T00:00:00Z"),
  updatedAt: new Date("2024-01-10T00:00:00Z"),
  ...over,
});

const email = (over: Row = {}): Row => ({
  id: EMAIL,
  userId: USER,
  messageId: "test-message-id",
  subject: "Test Schedule Email",
  sender: "test@stillontime.com",
  receivedAt: new Date("2024-01-10T00:00:00Z"),
  threadId: "test-thread-id",
  processed: true,
  processingStatus: "completed",
  ...over,
});

const routePlan = (over: Row = {}): Row => ({
  id: "route-1",
  scheduleId: SCHED,
  userId: USER,
  wakeUpTime: new Date("2024-01-15T05:00:00Z"),
  departureTime: new Date("2024-01-15T06:30:00Z"),
  arrivalTime: new Date("2024-01-15T07:45:00Z"),
  totalTravelMinutes: 75,
  routeSegments: [
    { from: "Home", to: "Panavision", duration: 30, distance: "15 km" },
    { from: "Panavision", to: "Test Location", duration: 45, distance: "25 km" },
  ],
  buffers: { carChange: 15, parking: 10, entry: 10, traffic: 20, morningRoutine: 45 },
  calculatedAt: new Date("2024-01-14T00:00:00Z"),
  ...over,
});

const weather = (over: Row = {}): Row => ({
  id: "weather-1",
  scheduleId: SCHED,
  userId: USER,
  forecastDate: new Date("2024-01-15T00:00:00.000Z"),
  temperature: 15,
  description: "Partly cloudy",
  windSpeed: 5,
  precipitation: 0,
  humidity: 65,
  warnings: ["WIND_WARNING"],
  fetchedAt: new Date("2024-01-14T00:00:00Z"),
  ...over,
});

function world(over: Partial<Tables> = {}): Tables {
  return {
    users: [userRow(USER), userRow(OTHER)],
    processed_emails: [email()],
    schedule_data: [schedule()],
    route_plans: [routePlan()],
    weather_data: [weather()],
    calendar_events: [],
    ...over,
  };
}

// ----------------------------------------------------------------------- app

function buildApp(): express.Application {
  const a = express();
  a.use(express.json());
  a.use("/api", apiRoutes);
  a.use(errorHandler);
  return a;
}

const app = buildApp();

const auth = (id: string = USER): Record<string, string> => ({
  Authorization: `Bearer ${services.oauth2.generateJWT({
    id,
    email: `${id}@example.invalid`,
  } as any)}`,
});

afterEach(() => {
  jest.restoreAllMocks();
});

// --------------------------------------------------------------------- tests

describe("Schedule endpoints (route-level)", () => {
  describe("GET /api/schedule", () => {
    it("returns only the caller's schedules with default pagination", async () => {
      serve(world({ schedule_data: [schedule(), schedule({ id: "c-other", userId: OTHER })] }));

      const res = await request(app).get("/api/schedule").set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        pagination: { page: 1, limit: 20, type: "all" },
      });
      expect(res.body.schedules).toHaveLength(1);
      expect(res.body.schedules[0]).toMatchObject({
        id: SCHED,
        shootingDate: "2024-01-15T00:00:00.000Z",
        callTime: "08:00",
        location: "Test Location, Warsaw",
        baseLocation: "Panavision Warsaw",
        sceneType: "EXT",
        scenes: ["Scene 1", "Scene 2"],
      });

      const [q] = queriesOn("schedule_data");
      expect(q.sql).toMatch(/^select \* from "schedule_data" where "userId" = \$1/);
      expect(q.parameters[0]).toBe(USER);
      expect(q.sql).toMatch(/ limit \$2/);
      expect(q.parameters[1]).toBe(20);
    });

    it("authenticates the caller's Google OAuth status against their own user row", async () => {
      serve(world());

      const res = await request(app).get("/api/schedule").set(auth());

      expect(res.status).toBe(200);
      const [userQuery] = queriesOn("users");
      expect(userQuery.sql).toMatch(/from "users" where "id" = \$1/);
      expect(userQuery.parameters).toEqual([USER]);
    });

    it("flags schedules that have a route plan / weather data / calendar event", async () => {
      serve(world());

      const res = await request(app).get("/api/schedule").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.schedules[0]).toMatchObject({
        id: SCHED,
        hasRoutePlan: true,
        hasWeatherData: true,
        hasCalendarEvent: false,
      });
    });

    it("applies the page offset (page 2 does not repeat page 1)", async () => {
      serve(
        world({
          schedule_data: [
            schedule({ id: "c-1" }),
            schedule({ id: "c-2" }),
            schedule({ id: "c-3" }),
          ],
        })
      );

      const res = await request(app).get("/api/schedule?page=2&limit=2").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.pagination).toEqual({ page: 2, limit: 2, type: "all" });
      expect(res.body.schedules).toHaveLength(1);
      const [q] = queriesOn("schedule_data");
      const off = / offset \$(\d+)/.exec(q.sql);
      expect(off).not.toBeNull();
      expect(q.parameters[Number(off![1]) - 1]).toBe(2);
    });

    it("filters schedules by type=upcoming", async () => {
      const future = schedule({ id: "c-future", shootingDate: new Date("2099-03-10T00:00:00Z") });
      serve(world({ schedule_data: [schedule(), future] }));

      const res = await request(app).get("/api/schedule?type=upcoming").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.pagination.type).toBe("upcoming");
      expect(res.body.schedules.map((s: Row) => s.id)).toEqual(["c-future"]);
      const [q] = queriesOn("schedule_data");
      expect(q.sql).toMatch(/where "userId" = \$1 and "shootingDate" >= \$2/);
      expect(q.parameters[0]).toBe(USER);
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe(20);
    });

    it("filters schedules by sceneType", async () => {
      serve(
        world({
          schedule_data: [schedule(), schedule({ id: "c-int", sceneType: "INT" })],
        })
      );

      const res = await request(app).get("/api/schedule?sceneType=EXT").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.schedules.map((s: Row) => s.sceneType)).toEqual(["EXT"]);
      const [q] = queriesOn("schedule_data");
      expect(q.sql).toMatch(/where "userId" = \$1 and "sceneType" = \$2/);
      expect(q.parameters.slice(0, 2)).toEqual([USER, "EXT"]);
    });

    it("rejects an unknown type with 400 VALIDATION_ERROR", async () => {
      serve(world());

      const res = await request(app).get("/api/schedule?type=someday").set(auth());

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(queriesOn("schedule_data")).toHaveLength(0);
    });

    it("returns 401 without authentication", async () => {
      const res = await request(app).get("/api/schedule");

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: "Unauthorized", code: "MISSING_TOKEN" });
      expect(testDb.queries).toHaveLength(0);
    });
  });

  describe("GET /api/schedule/:scheduleId", () => {
    it("returns the schedule's own fields", async () => {
      serve(world());

      const res = await request(app).get(`/api/schedule/${SCHED}`).set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        schedule: {
          id: SCHED,
          shootingDate: "2024-01-15T00:00:00.000Z",
          callTime: "08:00",
          location: "Test Location, Warsaw",
          sceneType: "EXT",
          scenes: ["Scene 1", "Scene 2"],
          safetyNotes: "Wear safety gear",
          equipment: ["Camera", "Lights"],
          notes: "Test shooting day",
        },
      });
      const [q] = queriesOn("schedule_data");
      expect(q.sql).toMatch(/from "schedule_data" where "id" = \$1/);
      expect(q.parameters).toEqual([SCHED]);
    });

    it("returns the schedule with its email, route plan and weather data", async () => {
      serve(world());

      const res = await request(app).get(`/api/schedule/${SCHED}`).set(auth());

      expect(res.status).toBe(200);
      const s = res.body.schedule;
      expect(s.email).toMatchObject({ id: EMAIL, subject: "Test Schedule Email" });
      expect(s.routePlan).toMatchObject({
        id: "route-1",
        wakeUpTime: "2024-01-15T05:00:00.000Z",
        departureTime: "2024-01-15T06:30:00.000Z",
        arrivalTime: "2024-01-15T07:45:00.000Z",
      });
      expect([].concat(s.weatherData ?? [])).toEqual([
        expect.objectContaining({ temperature: 15, description: "Partly cloudy" }),
      ]);
    });

    it("returns 404 for a non-existent schedule", async () => {
      serve(world({ schedule_data: [] }));

      const res = await request(app).get("/api/schedule/non-existent-id").set(auth());

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: "Not Found", code: "SCHEDULE_NOT_FOUND" });
    });

    it("returns 403 for another user's schedule", async () => {
      serve(world({ schedule_data: [schedule({ userId: OTHER })] }));

      const res = await request(app).get(`/api/schedule/${SCHED}`).set(auth());

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: "Forbidden", code: "ACCESS_DENIED" });
      expect(res.body.schedule).toBeUndefined();
    });
  });

  describe("PUT /api/schedule/:scheduleId", () => {
    it("updates the schedule and queues a route recalculation", async () => {
      const recalc = jest
        .spyOn(services.jobProcessor, "addRouteRecalculationJob")
        .mockResolvedValue({ id: "job-1" });
      const weatherJob = jest
        .spyOn(services.jobProcessor, "addWeatherUpdateJob")
        .mockResolvedValue({ id: "job-2" });
      const tables = serve(world());
      const updateData = {
        location: "Updated Location",
        callTime: "09:00",
        safetyNotes: "Updated safety notes",
      };

      const res = await request(app).put(`/api/schedule/${SCHED}`).set(auth()).send(updateData);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        schedule: {
          id: SCHED,
          location: "Updated Location",
          callTime: "09:00",
          safetyNotes: "Updated safety notes",
        },
        message: "Schedule updated successfully",
      });
      expect(recalc).toHaveBeenCalledWith(SCHED);
      expect(weatherJob).not.toHaveBeenCalled();

      const updates = queriesOn("schedule_data").filter((q) => q.sql.startsWith("update"));
      expect(updates).toHaveLength(1);
      expect(updates[0].sql).toMatch(/where "id" = \$\d+ returning \*$/);
      expect(updates[0].parameters).toEqual(
        expect.arrayContaining(["Updated Location", "09:00", "Updated safety notes", SCHED])
      );
      expect(tables.schedule_data[0]).toMatchObject({ ...updateData, userId: USER });
    });

    it("returns 400 for an invalid callTime and writes nothing", async () => {
      serve(world());

      const res = await request(app)
        .put(`/api/schedule/${SCHED}`)
        .set(auth())
        .send({ callTime: "invalid-time" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(res.body.details).toEqual([expect.objectContaining({ path: "callTime" })]);
      expect(testDb.queries.filter((q) => q.sql.startsWith("update"))).toHaveLength(0);
    });

    it("returns 403 and writes nothing for another user's schedule", async () => {
      const tables = serve(world({ schedule_data: [schedule({ userId: OTHER })] }));

      const res = await request(app)
        .put(`/api/schedule/${SCHED}`)
        .set(auth())
        .send({ location: "Hijacked" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ACCESS_DENIED");
      expect(testDb.queries.filter((q) => q.sql.startsWith("update"))).toHaveLength(0);
      expect(tables.schedule_data[0].location).toBe("Test Location, Warsaw");
    });

    it("does not let the body reassign the schedule to another user", async () => {
      jest.spyOn(services.jobProcessor, "addRouteRecalculationJob").mockResolvedValue({ id: "j" });
      const tables = serve(world());

      await request(app)
        .put(`/api/schedule/${SCHED}`)
        .set(auth())
        .send({ location: "Moved", userId: OTHER });

      expect(tables.schedule_data[0].userId).toBe(USER);
      const updates = queriesOn("schedule_data").filter((q) => q.sql.startsWith("update"));
      updates.forEach((q) => expect(q.sql).not.toMatch(/ set .*"userId" = /));
    });
  });

  describe("DELETE /api/schedule/:scheduleId", () => {
    it("deletes the caller's schedule", async () => {
      const tables = serve(world());

      const res = await request(app).delete(`/api/schedule/${SCHED}`).set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: "Schedule deleted successfully",
      });
      const deletes = queriesOn("schedule_data").filter((q) => q.sql.startsWith("delete"));
      expect(deletes).toHaveLength(1);
      expect(deletes[0].sql).toMatch(/^delete from "schedule_data" where "id" = \$1/);
      expect(deletes[0].parameters).toEqual([SCHED]);
      expect(tables.schedule_data).toHaveLength(0);
    });
  });

  describe("GET /api/schedule/statistics", () => {
    it("returns schedule, route and weather statistics for the caller only", async () => {
      serve(
        world({
          schedule_data: [
            schedule({ id: "c-past", sceneType: "INT" }),
            schedule({
              id: "c-future",
              sceneType: "EXT",
              shootingDate: new Date("2099-03-10T00:00:00Z"),
            }),
            schedule({ id: "c-other", userId: OTHER }),
          ],
          route_plans: [
            routePlan({ id: "r-1", totalTravelMinutes: 75 }),
            routePlan({ id: "r-2", totalTravelMinutes: 45 }),
            routePlan({ id: "r-other", userId: OTHER, totalTravelMinutes: 999 }),
          ],
          weather_data: [
            weather({ id: "w-1", temperature: 15, precipitation: 0, warnings: ["WIND_WARNING"] }),
            weather({ id: "w-2", temperature: 5, precipitation: 2, warnings: [] }),
            weather({ id: "w-other", userId: OTHER, temperature: 40, precipitation: 9 }),
          ],
        })
      );

      const res = await request(app).get("/api/schedule/statistics").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.statistics.schedules).toEqual({
        total: 2,
        upcoming: 1,
        past: 1,
        bySceneType: { INT: 1, EXT: 1 },
        byMonth: { "2024-01": 1, "2099-03": 1 },
      });
      expect(res.body.statistics.routes).toMatchObject({
        totalRoutes: 2,
        averageTravelTime: 60,
      });
      expect(res.body.statistics.weather).toEqual({
        totalForecasts: 2,
        averageTemperature: 10,
        rainDays: 1,
        warningDays: 1,
      });

      const statQueries = ["schedule_data", "route_plans", "weather_data"].flatMap(queriesOn);
      expect(statQueries.length).toBeGreaterThanOrEqual(6);
      statQueries.forEach((q) => {
        expect(q.sql).toMatch(/where "userId" = \$1/);
        expect(q.parameters[0]).toBe(USER);
      });
    });
  });

  describe("GET /api/schedule/:scheduleId/route", () => {
    it("returns the route plan for the schedule", async () => {
      serve(world());

      const res = await request(app).get(`/api/schedule/${SCHED}/route`).set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        routePlan: {
          scheduleId: SCHED,
          wakeUpTime: "2024-01-15T05:00:00.000Z",
          departureTime: "2024-01-15T06:30:00.000Z",
          arrivalTime: "2024-01-15T07:45:00.000Z",
          totalTravelMinutes: 75,
          routeSegments: expect.arrayContaining([
            expect.objectContaining({ from: "Home", to: "Panavision" }),
          ]),
        },
      });
      const [q] = queriesOn("route_plans");
      expect(q.sql).toMatch(/from "route_plans" where "scheduleId" = \$1/);
      expect(q.parameters).toEqual([SCHED]);
    });
  });

  describe("PUT /api/schedule/:scheduleId/route", () => {
    it("updates the route plan", async () => {
      const tables = serve(world());

      const res = await request(app)
        .put(`/api/schedule/${SCHED}/route`)
        .set(auth())
        .send({
          wakeUpTime: "2024-01-15T04:30:00Z",
          departureTime: "2024-01-15T06:00:00Z",
          totalTravelMinutes: 90,
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        routePlan: { id: "route-1", scheduleId: SCHED, totalTravelMinutes: 90 },
        message: "Route plan updated successfully",
      });
      expect(new Date(res.body.routePlan.wakeUpTime).toISOString()).toBe(
        "2024-01-15T04:30:00.000Z"
      );
      expect(new Date(res.body.routePlan.departureTime).toISOString()).toBe(
        "2024-01-15T06:00:00.000Z"
      );

      const updates = queriesOn("route_plans").filter((q) => q.sql.startsWith("update"));
      expect(updates).toHaveLength(1);
      expect(updates[0].sql).toMatch(/where "id" = \$\d+ returning \*$/);
      expect(updates[0].parameters).toEqual(expect.arrayContaining([90, "route-1"]));
      expect(tables.route_plans[0].totalTravelMinutes).toBe(90);
    });

    it("does not let the body move the route plan to another schedule or user", async () => {
      const tables = serve(world());

      await request(app)
        .put(`/api/schedule/${SCHED}/route`)
        .set(auth())
        .send({ totalTravelMinutes: 30, scheduleId: "c-someone-else", userId: OTHER });

      expect(tables.route_plans[0]).toMatchObject({ scheduleId: SCHED, userId: USER });
    });
  });

  describe("POST /api/schedule/:scheduleId/route/recalculate", () => {
    it("queues a route recalculation", async () => {
      const recalc = jest
        .spyOn(services.jobProcessor, "addRouteRecalculationJob")
        .mockResolvedValue({ id: "job-1" });
      serve(world());

      const res = await request(app)
        .post(`/api/schedule/${SCHED}/route/recalculate`)
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        job: { id: "job-1", status: "queued" },
        message: "Route recalculation queued",
      });
      expect(recalc).toHaveBeenCalledWith(SCHED);
    });
  });

  describe("GET /api/schedule/:scheduleId/weather", () => {
    it("returns the weather data for the schedule", async () => {
      serve(world());

      const res = await request(app).get(`/api/schedule/${SCHED}/weather`).set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        weatherData: {
          scheduleId: SCHED,
          forecastDate: "2024-01-15T00:00:00.000Z",
          temperature: 15,
          description: "Partly cloudy",
          windSpeed: 5,
          precipitation: 0,
          warnings: ["WIND_WARNING"],
        },
      });
      const [q] = queriesOn("weather_data");
      expect(q.sql).toMatch(/from "weather_data" where "scheduleId" = \$1/);
      expect(q.parameters).toEqual([SCHED]);
    });
  });

  describe("POST /api/schedule/:scheduleId/weather/update", () => {
    it("queues a weather update", async () => {
      const job = jest
        .spyOn(services.jobProcessor, "addWeatherUpdateJob")
        .mockResolvedValue({ id: "job-2" });
      serve(world());

      const res = await request(app)
        .post(`/api/schedule/${SCHED}/weather/update`)
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        job: { id: "job-2", status: "queued" },
        message: "Weather update queued",
      });
      expect(job).toHaveBeenCalledWith(SCHED);
    });
  });

  describe("GET /api/schedule/weather/forecast", () => {
    const forecast = {
      temperature: 15,
      description: "Partly cloudy",
      windSpeed: 5,
      precipitation: 0,
      warnings: [],
    };

    it("returns the weather forecast for location and date", async () => {
      const spy = jest
        .spyOn(services.weather, "getWeatherForecast")
        .mockResolvedValue(forecast as any);
      serve(world());

      const res = await request(app)
        .get("/api/schedule/weather/forecast")
        .query({ location: "Warsaw, Poland", date: "2024-01-15" })
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, forecast });
      expect(spy).toHaveBeenCalledWith("Warsaw, Poland", "2024-01-15");
    });

    it("returns 400 when the date is missing", async () => {
      const spy = jest.spyOn(services.weather, "getWeatherForecast");
      serve(world());

      const res = await request(app)
        .get("/api/schedule/weather/forecast")
        .query({ location: "Warsaw, Poland" })
        .set(auth());

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(res.body.details).toEqual([expect.objectContaining({ path: "date" })]);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/schedule/weather/warnings", () => {
    const tablesWithWarnings = (): Tables =>
      world({
        weather_data: [
          weather(),
          weather({ id: "w-other", userId: OTHER, scheduleId: "c-other", warnings: ["STORM"] }),
        ],
      });

    it("returns the caller's weather warnings only", async () => {
      serve(tablesWithWarnings());

      const res = await request(app).get("/api/schedule/weather/warnings").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.warnings).toEqual([
        expect.objectContaining({
          id: "weather-1",
          scheduleId: SCHED,
          forecastDate: "2024-01-15T00:00:00.000Z",
          warnings: ["WIND_WARNING"],
        }),
      ]);
      const [q] = queriesOn("weather_data");
      expect(q.sql).toMatch(/from "weather_data" where "userId" = \$1/);
      expect(q.parameters[0]).toBe(USER);
    });

    it("includes the related schedule's location and scene type", async () => {
      serve(tablesWithWarnings());

      const res = await request(app).get("/api/schedule/weather/warnings").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.warnings[0].schedule).toMatchObject({
        location: "Test Location, Warsaw",
        sceneType: "EXT",
        callTime: "08:00",
      });
    });
  });
});

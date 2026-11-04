/**
 * Calendar endpoints, exercised through the real route graph.
 *
 * - App: express + apiRoutes + errorHandler (not src/index, which starts the server).
 * - Auth: a real JWT from services.oauth2.generateJWT. requireValidOAuth runs for
 *   real: it loads the caller from the fake `users` table (valid Google tokens).
 * - Database: the fake Kysely driver (tests/helpers/kysely-test-db). `serve(tables)`
 *   answers every query from an in-memory table set, honouring simple
 *   `"col" <op> $n` where clauses, limit/offset, count(*), update ... set and
 *   delete, so tests can assert both the response and the SQL actually sent.
 * - Google Calendar is mocked at its boundary: jest.spyOn on the calendarManager
 *   methods that talk to Google (create / update-from-schedule / update), or the
 *   googleapis client itself (delete), plus oauth2.getGoogleClient.
 */
import express from "express";
import request from "supertest";
import { google } from "googleapis";
import { apiRoutes } from "@/routes";
import { errorHandler } from "@/middleware/errorHandler";
import { services } from "@/services";
import { testDb, RecordedQuery } from "../helpers/kysely-test-db";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SCHED = "csched000000000001";
const SCHED2 = "csched000000000002";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

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
  emailId: "cemail000000000001",
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

const routePlan = (over: Row = {}): Row => ({
  id: "route-1",
  scheduleId: SCHED,
  userId: USER,
  wakeUpTime: new Date("2024-01-15T05:00:00Z"),
  departureTime: new Date("2024-01-15T06:30:00Z"),
  arrivalTime: new Date("2024-01-15T07:45:00Z"),
  totalTravelMinutes: 75,
  routeSegments: [{ from: "Home", to: "Panavision", duration: 30, distance: "15 km" }],
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
  warnings: [],
  fetchedAt: new Date("2024-01-14T00:00:00Z"),
  ...over,
});

const calendarEvent = (over: Row = {}): Row => ({
  id: "cal-event-1",
  userId: USER,
  scheduleId: SCHED,
  calendarEventId: "google-event-1",
  title: "StillOnTime — Dzień zdjęciowy (Test Location)",
  description: "Shooting schedule details",
  location: "Test Location, Warsaw",
  startTime: new Date("2024-01-15T08:00:00Z"),
  endTime: new Date("2024-01-15T18:00:00Z"),
  createdAt: new Date("2024-01-14T10:00:00Z"),
  ...over,
});

function world(over: Partial<Tables> = {}): Tables {
  return {
    users: [userRow(USER), userRow(OTHER)],
    schedule_data: [schedule()],
    route_plans: [routePlan()],
    weather_data: [weather()],
    calendar_events: [],
    user_configs: [],
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

describe("Calendar endpoints (route-level)", () => {
  describe("GET /api/calendar/events", () => {
    it("returns the caller's calendar events with default parameters", async () => {
      serve(
        world({
          calendar_events: [
            calendarEvent(),
            calendarEvent({ id: "cal-other", userId: OTHER, calendarEventId: "google-other" }),
          ],
        })
      );

      const res = await request(app).get("/api/calendar/events").set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        events: [
          {
            id: "google-event-1",
            summary: "StillOnTime — Dzień zdjęciowy (Test Location)",
            description: "Shooting schedule details",
            location: "Test Location, Warsaw",
            start: { dateTime: "2024-01-15T08:00:00.000Z" },
            end: { dateTime: "2024-01-15T18:00:00.000Z" },
            created: "2024-01-14T10:00:00.000Z",
            updated: "2024-01-14T10:00:00.000Z",
          },
        ],
      });
      const [q] = queriesOn("calendar_events");
      expect(q.sql).toMatch(/from "calendar_events" where "userId" = \$1 .*limit \$2/);
      expect(q.parameters).toEqual([USER, 50]);
    });

    it("passes the date range and maxResults to the calendar service as typed options", async () => {
      const spy = jest.spyOn(services.calendarManager, "getCalendarEvents");
      serve(world());

      const res = await request(app)
        .get("/api/calendar/events")
        .query({
          startDate: "2024-01-15T00:00:00Z",
          endDate: "2024-01-16T00:00:00Z",
          maxResults: "10",
        })
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, events: [] });
      expect(spy).toHaveBeenCalledWith(USER, {
        timeMin: new Date("2024-01-15T00:00:00Z"),
        timeMax: new Date("2024-01-16T00:00:00Z"),
        maxResults: 10,
      });
    });

    it("returns 400 for an invalid startDate", async () => {
      const spy = jest.spyOn(services.calendarManager, "getCalendarEvents");
      serve(world());

      const res = await request(app)
        .get("/api/calendar/events")
        .query({ startDate: "yesterday" })
        .set(auth());

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns 401 without authentication", async () => {
      const res = await request(app).get("/api/calendar/events");

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: "Unauthorized", code: "MISSING_TOKEN" });
      expect(testDb.queries).toHaveLength(0);
    });
  });

  describe("POST /api/calendar/events", () => {
    const created = {
      id: "cal-event-1",
      calendarEventId: "google-event-1",
      title: "StillOnTime — Dzień zdjęciowy (Test Location)",
      startTime: new Date("2024-01-15T06:30:00Z"),
      endTime: new Date("2024-01-15T18:00:00Z"),
      description: "Shooting schedule with route and weather info",
      location: "Test Location, Warsaw",
    };

    it("creates a calendar event for the caller's schedule", async () => {
      const spy = jest
        .spyOn(services.calendarManager, "createCalendarEvent")
        .mockResolvedValue(created as any);
      serve(world());

      const res = await request(app)
        .post("/api/calendar/events")
        .set(auth())
        .send({ scheduleId: SCHED });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        calendarEvent: {
          id: "cal-event-1",
          calendarEventId: "google-event-1",
          title: "StillOnTime — Dzień zdjęciowy (Test Location)",
          startTime: "2024-01-15T06:30:00.000Z",
          endTime: "2024-01-15T18:00:00.000Z",
          description: "Shooting schedule with route and weather info",
          location: "Test Location, Warsaw",
        },
        message: "Calendar event created successfully",
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatchObject({
        id: SCHED,
        userId: USER,
        location: "Test Location, Warsaw",
      });
      expect(spy.mock.calls[0][3]).toBe(USER);
      const [q] = queriesOn("schedule_data");
      expect(q.sql).toMatch(/from "schedule_data" where "id" = \$1/);
      expect(q.parameters).toEqual([SCHED]);
    });

    it("passes the schedule's route plan and weather data to the calendar service", async () => {
      const spy = jest
        .spyOn(services.calendarManager, "createCalendarEvent")
        .mockResolvedValue(created as any);
      serve(world());

      const res = await request(app)
        .post("/api/calendar/events")
        .set(auth())
        .send({ scheduleId: SCHED });

      expect(res.status).toBe(200);
      expect(spy.mock.calls[0][1]).toMatchObject({ id: "route-1", scheduleId: SCHED });
      expect(spy.mock.calls[0][2]).toMatchObject({ id: "weather-1", scheduleId: SCHED });
    });

    it("returns 400 when the schedule ID is missing", async () => {
      const spy = jest.spyOn(services.calendarManager, "createCalendarEvent");
      serve(world());

      const res = await request(app).post("/api/calendar/events").set(auth()).send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(res.body.details.length).toBeGreaterThan(0);
      res.body.details.forEach((d: Row) => expect(d.path).toBe("scheduleId"));
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns 404 when the schedule does not exist", async () => {
      const spy = jest.spyOn(services.calendarManager, "createCalendarEvent");
      serve(world({ schedule_data: [] }));

      const res = await request(app)
        .post("/api/calendar/events")
        .set(auth())
        .send({ scheduleId: "non-existent-id" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: "Schedule not found or access denied",
        code: "SCHEDULE_NOT_FOUND",
      });
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns 404 for another user's schedule and creates nothing", async () => {
      const spy = jest.spyOn(services.calendarManager, "createCalendarEvent");
      serve(world({ schedule_data: [schedule({ userId: OTHER })] }));

      const res = await request(app)
        .post("/api/calendar/events")
        .set(auth())
        .send({ scheduleId: SCHED });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SCHEDULE_NOT_FOUND");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/calendar/events/:eventId", () => {
    it("updates the calendar event", async () => {
      const spy = jest.spyOn(services.calendarManager, "updateCalendarEvent").mockResolvedValue({
        id: "cal-event-1",
        calendarEventId: "google-event-1",
        title: "Updated Event Title",
        description: "Updated description",
        location: "Test Location",
        startTime: new Date("2024-01-15T08:00:00Z"),
        endTime: new Date("2024-01-15T18:00:00Z"),
        createdAt: new Date("2024-01-14T12:00:00Z"),
      } as any);
      serve(world());
      const updateData = { title: "Updated Event Title", description: "Updated description" };

      const res = await request(app)
        .put("/api/calendar/events/google-event-1")
        .set(auth())
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        event: {
          id: "cal-event-1",
          calendarEventId: "google-event-1",
          title: "Updated Event Title",
          description: "Updated description",
          location: "Test Location",
          startTime: "2024-01-15T08:00:00.000Z",
          endTime: "2024-01-15T18:00:00.000Z",
          createdAt: "2024-01-14T12:00:00.000Z",
        },
        message: "Calendar event updated successfully",
      });
      expect(spy).toHaveBeenCalledWith("google-event-1", updateData, USER);
    });

    it("returns 400 for an empty title", async () => {
      const spy = jest.spyOn(services.calendarManager, "updateCalendarEvent");
      serve(world());

      const res = await request(app)
        .put("/api/calendar/events/google-event-1")
        .set(auth())
        .send({ title: "" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(res.body.details).toEqual([expect.objectContaining({ path: "title" })]);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/calendar/events/:eventId", () => {
    function mockGoogleDelete(): jest.Mock {
      const del = jest.fn().mockResolvedValue({ status: 204 });
      jest.spyOn(services.oauth2, "getGoogleClient").mockResolvedValue({} as any);
      (google.calendar as unknown as jest.Mock).mockReturnValue({ events: { delete: del } });
      return del;
    }

    it("deletes the caller's event from Google Calendar and the local store", async () => {
      const del = mockGoogleDelete();
      const tables = serve(world({ calendar_events: [calendarEvent()] }));

      const res = await request(app).delete("/api/calendar/events/cal-event-1").set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Calendar event deleted successfully",
      });
      expect(services.oauth2.getGoogleClient).toHaveBeenCalledWith(USER);
      expect(del).toHaveBeenCalledWith({ calendarId: "primary", eventId: "google-event-1" });
      const deletes = queriesOn("calendar_events").filter((q) => q.sql.startsWith("delete"));
      expect(deletes).toHaveLength(1);
      expect(deletes[0].sql).toMatch(/^delete from "calendar_events" where "id" = \$1/);
      expect(deletes[0].parameters).toEqual(["cal-event-1"]);
      expect(tables.calendar_events).toHaveLength(0);
    });

    it("does not delete another user's event", async () => {
      const del = mockGoogleDelete();
      const tables = serve(world({ calendar_events: [calendarEvent({ userId: OTHER })] }));

      const res = await request(app).delete("/api/calendar/events/cal-event-1").set(auth());

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).not.toBe(true);
      expect(del).not.toHaveBeenCalled();
      expect(tables.calendar_events).toHaveLength(1);
    });
  });

  describe("GET /api/calendar/sync/status", () => {
    it("returns the sync status with calendar access", async () => {
      serve(
        world({
          calendar_events: [
            calendarEvent(),
            calendarEvent({ id: "cal-event-2", calendarEventId: "google-event-2" }),
          ],
        })
      );

      const res = await request(app).get("/api/calendar/sync/status").set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        syncStatus: {
          isConnected: true,
          hasCalendarAccess: true,
          lastSync: expect.any(String),
          recentEventsCount: 2,
          scopes: expect.arrayContaining([CALENDAR_SCOPE]),
        },
      });
      const [q] = queriesOn("calendar_events");
      expect(q.parameters).toEqual([USER, 10]);
    });

    it("returns the sync status without calendar access", async () => {
      const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
      jest.spyOn(services.oauth2, "getOAuthStatus").mockResolvedValue({
        isAuthenticated: true,
        scopes,
        expiresAt: new Date("2099-01-16T00:00:00Z"),
        needsReauth: false,
      });
      const events = jest.spyOn(services.calendarManager, "getCalendarEvents");
      serve(world());

      const res = await request(app).get("/api/calendar/sync/status").set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        syncStatus: {
          isConnected: false,
          hasCalendarAccess: false,
          lastSync: expect.any(String),
          recentEventsCount: 0,
          scopes,
        },
      });
      expect(services.oauth2.getOAuthStatus).toHaveBeenCalledWith(USER);
      expect(events).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/calendar/sync", () => {
    it("creates calendar events for schedules that have none", async () => {
      const create = jest
        .spyOn(services.calendarManager, "createCalendarEvent")
        .mockImplementation(async (s: any) => ({ calendarEventId: `google-for-${s.id}` }) as any);
      const update = jest.spyOn(services.calendarManager, "updateCalendarEventFromSchedule");
      serve(world({ schedule_data: [schedule(), schedule({ id: SCHED2 })] }));

      const res = await request(app)
        .post("/api/calendar/sync")
        .set(auth())
        .send({ scheduleIds: [SCHED, SCHED2] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        results: [
          { scheduleId: SCHED, success: true, eventId: `google-for-${SCHED}` },
          { scheduleId: SCHED2, success: true, eventId: `google-for-${SCHED2}` },
        ],
        summary: { total: 2, successful: 2, failed: 0 },
        message: "Calendar sync completed: 2/2 events synced",
      });
      expect(create).toHaveBeenCalledTimes(2);
      create.mock.calls.forEach((call) => expect(call[3]).toBe(USER));
      expect(update).not.toHaveBeenCalled();
    });

    it("updates (does not duplicate) the event of a schedule already synced", async () => {
      const create = jest
        .spyOn(services.calendarManager, "createCalendarEvent")
        .mockResolvedValue({ calendarEventId: "google-event-1" } as any);
      const update = jest
        .spyOn(services.calendarManager, "updateCalendarEventFromSchedule")
        .mockResolvedValue({ calendarEventId: "google-event-2" } as any);
      serve(
        world({
          schedule_data: [schedule(), schedule({ id: SCHED2, sceneType: "INT" })],
          calendar_events: [
            calendarEvent({ id: "cal-event-2", scheduleId: SCHED2, calendarEventId: "google-event-2" }),
          ],
        })
      );

      const res = await request(app)
        .post("/api/calendar/sync")
        .set(auth())
        .send({ scheduleIds: [SCHED, SCHED2] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        results: [
          { scheduleId: SCHED, success: true, eventId: "google-event-1" },
          { scheduleId: SCHED2, success: true, eventId: "google-event-2" },
        ],
        summary: { total: 2, successful: 2, failed: 0 },
      });
      expect(create).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0]).toBe("google-event-2");
      expect(update.mock.calls[0][1]).toMatchObject({ id: SCHED2 });
      expect(update.mock.calls[0][4]).toBe(USER);
    });

    it("reports a schedule the caller does not own as failed and does not sync it", async () => {
      const create = jest
        .spyOn(services.calendarManager, "createCalendarEvent")
        .mockResolvedValue({ calendarEventId: "google-event-1" } as any);
      serve(world({ schedule_data: [schedule(), schedule({ id: SCHED2, userId: OTHER })] }));

      const res = await request(app)
        .post("/api/calendar/sync")
        .set(auth())
        .send({ scheduleIds: [SCHED, SCHED2] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        results: [
          { scheduleId: SCHED, success: true, eventId: "google-event-1" },
          { scheduleId: SCHED2, success: false, error: "Schedule not found or access denied" },
        ],
        summary: { total: 2, successful: 1, failed: 1 },
        message: "Calendar sync completed: 1/2 events synced",
      });
      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0]).toMatchObject({ id: SCHED });
    });

    it("returns 400 when schedule IDs are missing", async () => {
      const create = jest.spyOn(services.calendarManager, "createCalendarEvent");
      serve(world());

      const res = await request(app).post("/api/calendar/sync").set(auth()).send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "scheduleIds" })])
      );
      expect(create).not.toHaveBeenCalled();
    });

    it("returns 400 when schedule IDs is not an array", async () => {
      const create = jest.spyOn(services.calendarManager, "createCalendarEvent");
      serve(world());

      const res = await request(app)
        .post("/api/calendar/sync")
        .set(auth())
        .send({ scheduleIds: "not-an-array" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "Bad Request", code: "VALIDATION_ERROR" });
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/calendar/settings", () => {
    it("returns the calendar settings, reading the caller's config", async () => {
      serve(world());

      const res = await request(app).get("/api/calendar/settings").set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        settings: {
          autoSync: true,
          defaultCalendar: "primary",
          syncPastEvents: false,
          eventReminders: true,
          reminderMinutes: 15,
        },
      });
      const [q] = queriesOn("user_configs");
      expect(q.sql).toMatch(/from "user_configs" where "userId" = \$1/);
      expect(q.parameters).toEqual([USER]);
    });
  });

  describe("GET /api/calendar/health", () => {
    it("returns the health status", async () => {
      serve(world());

      const res = await request(app).get("/api/calendar/health").set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: "healthy",
        service: "calendar-management",
        timestamp: expect.any(String),
        version: "1.0.0",
      });
    });
  });
});

import { UserRepository } from "@/repositories/user.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * UserRepository is written against Kysely. These tests run the real query
 * builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 */
describe("UserRepository", () => {
  let repo: UserRepository;

  const userRow = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    googleId: "google-123",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenExpiry: new Date("2030-01-01T00:00:00Z"),
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    repo = new UserRepository();
  });

  describe("lookups", () => {
    it("findByEmail filters on email and returns the row", async () => {
      testDb.enqueueRows([userRow]);

      const result = await repo.findByEmail("test@example.com");

      expect(result).toEqual(userRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^select \* from "users" where "email" = \$1/);
      expect(q.parameters).toEqual(["test@example.com"]);
    });

    it("findByEmail returns null when nothing matches", async () => {
      expect(await repo.findByEmail("nobody@example.com")).toBeNull();
    });

    it("findByGoogleId filters on googleId", async () => {
      testDb.enqueueRows([userRow]);

      expect(await repo.findByGoogleId("google-123")).toEqual(userRow);
      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "googleId" = $1');
      expect(q.parameters).toEqual(["google-123"]);
    });

    it("findById filters on id and returns null when missing", async () => {
      expect(await repo.findById("missing")).toBeNull();
      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "id" = $1');
      expect(q.parameters).toEqual(["missing"]);
    });

    it("findAll orders newest first", async () => {
      testDb.enqueueRows([userRow]);

      expect(await repo.findAll()).toEqual([userRow]);
      expect(testDb.lastQuery().sql).toContain('order by "createdAt" desc');
    });
  });

  describe("findByIdWithConfig", () => {
    it("returns null when the user does not exist", async () => {
      expect(await repo.findByIdWithConfig("nope")).toBeNull();
    });

    it("left-joins user_configs and nests the config", async () => {
      testDb.enqueueRows([
        {
          ...userRow,
          userConfigId: "cfg-1",
          homeAddress: "Home 1",
          panavisionAddress: "Studio 2",
          bufferCarChange: 15,
          bufferParking: 10,
          bufferEntry: 10,
          bufferTraffic: 20,
          bufferMorningRoutine: 45,
          notificationEmail: true,
          notificationSMS: false,
          notificationPush: true,
          smsNumber: null,
          smsVerified: false,
          smsVerificationCode: null,
          smsVerificationExpiry: null,
          pushToken: null,
          pushTokenVerified: false,
          userConfigUserId: "user-1",
        },
      ]);

      const result = await repo.findByIdWithConfig("user-1");

      expect(testDb.lastQuery().sql).toContain(
        'left join "user_configs" on "users"."id" = "user_configs"."userId"'
      );
      expect(testDb.lastQuery().parameters).toEqual(["user-1"]);
      expect(result?.id).toBe("user-1");
      expect(result?.userConfig).toMatchObject({
        id: "cfg-1",
        homeAddress: "Home 1",
        userId: "user-1",
        bufferMorningRoutine: 45,
      });
    });

    it("returns userConfig: null when the join found no config", async () => {
      testDb.enqueueRows([{ ...userRow, userConfigId: null }]);

      const result = await repo.findByIdWithConfig("user-1");

      expect(result?.id).toBe("user-1");
      expect(result?.userConfig).toBeNull();
    });

    it("findWithRelations is an alias for findByIdWithConfig", async () => {
      testDb.enqueueRows([{ ...userRow, userConfigId: null }]);
      const result = await repo.findWithRelations("user-1");
      expect(result?.userConfig).toBeNull();
    });
  });

  describe("create", () => {
    it("inserts a generated id, nulls for omitted optionals, and returns the row", async () => {
      testDb.enqueueRows([userRow]);

      const result = await repo.create({
        email: "test@example.com",
        googleId: "google-123",
      });

      expect(result).toEqual(userRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^insert into "users" \(/);
      expect(q.sql).toContain("returning *");
      // id, email, googleId, name, accessToken, refreshToken, tokenExpiry, createdAt, updatedAt
      expect(q.parameters).toHaveLength(9);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1, 7)).toEqual([
        "test@example.com",
        "google-123",
        null,
        null,
        null,
        null,
      ]);
    });

    it("throws when the insert returns no row", async () => {
      await expect(
        repo.create({ email: "a@b.c", googleId: "g" })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("sets the fields plus updatedAt, scoped by id", async () => {
      testDb.enqueueRows([{ ...userRow, name: "Renamed" }]);

      const result = await repo.update("user-1", { name: "Renamed" });

      expect(result.name).toBe("Renamed");
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^update "users" set "name" = \$1, "updatedAt" = \$2 where "id" = \$3/);
      expect(q.parameters[0]).toBe("Renamed");
      expect(q.parameters[1]).toBeInstanceOf(Date);
      expect(q.parameters[2]).toBe("user-1");
    });

    it("throws when no user matches", async () => {
      await expect(repo.update("missing", { name: "x" })).rejects.toThrow();
    });
  });

  describe("token handling", () => {
    it("updateTokens writes access/refresh/expiry", async () => {
      const expiry = new Date("2030-06-01T00:00:00Z");
      testDb.enqueueRows([userRow]);

      await repo.updateTokens("user-1", "new-access", "new-refresh", expiry);

      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "users" set "accessToken" = \$1, "refreshToken" = \$2, "tokenExpiry" = \$3, "updatedAt" = \$4 where "id" = \$5/
      );
      expect(q.parameters[0]).toBe("new-access");
      expect(q.parameters[1]).toBe("new-refresh");
      expect(q.parameters[2]).toBe(expiry);
      expect(q.parameters[4]).toBe("user-1");
    });

    it("clearTokens nulls all three token columns", async () => {
      testDb.enqueueRows([{ ...userRow, accessToken: null }]);

      await repo.clearTokens("user-1");

      const q = testDb.lastQuery();
      expect(q.sql).toContain('"accessToken" = $1, "refreshToken" = $2, "tokenExpiry" = $3');
      expect(q.parameters.slice(0, 3)).toEqual([null, null, null]);
      expect(q.parameters[4]).toBe("user-1");
    });

    it("findUsersWithExpiredTokens selects expired tokens that still have an access token", async () => {
      testDb.enqueueRows([userRow]);

      expect(await repo.findUsersWithExpiredTokens()).toEqual([userRow]);
      const q = testDb.lastQuery();
      expect(q.sql).toContain('where "tokenExpiry" < $1 and "accessToken" is not null');
      expect(q.parameters[0]).toBeInstanceOf(Date);
    });
  });

  describe("createOrUpdateFromOAuth", () => {
    const oauth = {
      googleId: "google-123",
      email: "test@example.com",
      name: "Test User",
      accessToken: "a",
      refreshToken: "r",
    };

    it("updates when the google id is already known", async () => {
      testDb.enqueueRows([userRow]); // findByGoogleId
      testDb.enqueueRows([userRow]); // update

      await repo.createOrUpdateFromOAuth(oauth);

      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[0].sql).toMatch(/^select \* from "users"/);
      expect(testDb.queries[1].sql).toMatch(/^update "users"/);
      expect(testDb.queries[1].parameters).toContain("user-1");
    });

    it("inserts when the google id is new", async () => {
      testDb.enqueueRows([]); // findByGoogleId -> none
      testDb.enqueueRows([userRow]); // insert

      await repo.createOrUpdateFromOAuth(oauth);

      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[1].sql).toMatch(/^insert into "users"/);
    });
  });

  describe("updateUserConfig", () => {
    it("updates the existing config", async () => {
      testDb.enqueueRows([{ id: "cfg-1", userId: "user-1" }]); // exists
      testDb.enqueueRows([{ id: "cfg-1", userId: "user-1", homeAddress: "New" }]);

      const result = await repo.updateUserConfig("user-1", { homeAddress: "New" });

      expect(result.homeAddress).toBe("New");
      expect(testDb.queries[1].sql).toMatch(/^update "user_configs" set "homeAddress" = \$1 where "userId" = \$2/);
      expect(testDb.queries[1].parameters).toEqual(["New", "user-1"]);
    });

    it("creates a config with defaults when none exists", async () => {
      testDb.enqueueRows([]); // none
      testDb.enqueueRows([{ id: "cfg-new", userId: "user-1" }]);

      await repo.updateUserConfig("user-1", { homeAddress: "Home" });

      const q = testDb.queries[1];
      expect(q.sql).toMatch(/^insert into "user_configs"/);
      // defaults: buffers 15/10/10/20/45, email+push on, sms off
      expect(q.parameters).toEqual(
        expect.arrayContaining(["user-1", "Home", 15, 10, 20, 45, true, false])
      );
    });
  });

  describe("getUserStats", () => {
    it("coerces the four counts to numbers", async () => {
      testDb.enqueueRows([
        { totalEmails: "10", processedEmails: "7", totalSchedules: "3", upcomingSchedules: "1" },
      ]);

      const stats = await repo.getUserStats("user-1");

      expect(stats).toEqual({
        totalEmails: 10,
        processedEmails: 7,
        totalSchedules: 3,
        upcomingSchedules: 1,
      });
      expect(testDb.lastQuery().parameters).toContain("user-1");
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([userRow]);

      expect(await repo.delete("user-1")).toEqual(userRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^delete from "users" where "id" = \$1 returning \*/);
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("error propagation", () => {
    it("surfaces database errors", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("user-1")).rejects.toThrow("connection lost");
    });
  });
});

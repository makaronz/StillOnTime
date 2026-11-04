import DefaultExport, {
  UserConfigRepository,
  userConfigRepository,
} from "@/repositories/user-config.repository";
import { testDb } from "../helpers/kysely-test-db";

/**
 * UserConfigRepository is written against Kysely. These tests run the real
 * query builder + Postgres compiler against a fake driver (tests/helpers/
 * kysely-test-db.ts), so they assert on the SQL and bound parameters the
 * repository would send, and on how it maps scripted rows back.
 */
describe("UserConfigRepository", () => {
  let repo: UserConfigRepository;

  const DEFAULT_PANAVISION =
    "Panavision Office, 123 Example St, Los Angeles, CA 90028";

  const configRow = {
    id: "cfg-1",
    userId: "user-1",
    homeAddress: "123 Main St, Warsaw",
    panavisionAddress: "Studio Road 5, Warsaw",
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
  };

  // Parameter order of a full user_configs insert (create / createOrUpdate / reset):
  // id, userId, then the 16 data columns in this order.
  const defaultInsertTail = [
    "", // homeAddress
    DEFAULT_PANAVISION,
    15, // bufferCarChange
    10, // bufferParking
    10, // bufferEntry
    20, // bufferTraffic
    45, // bufferMorningRoutine
    true, // notificationEmail
    false, // notificationSMS
    true, // notificationPush
    null, // smsNumber
    false, // smsVerified
    null, // smsVerificationCode
    null, // smsVerificationExpiry
    null, // pushToken
    false, // pushTokenVerified
  ];

  const INSERT_COLUMNS =
    '("id", "userId", "homeAddress", "panavisionAddress", "bufferCarChange", ' +
    '"bufferParking", "bufferEntry", "bufferTraffic", "bufferMorningRoutine", ' +
    '"notificationEmail", "notificationSMS", "notificationPush", "smsNumber", ' +
    '"smsVerified", "smsVerificationCode", "smsVerificationExpiry", "pushToken", ' +
    '"pushTokenVerified")';

  beforeEach(() => {
    repo = new UserConfigRepository();
  });

  describe("exports", () => {
    it("exports a ready-to-use singleton and the class as default", () => {
      expect(userConfigRepository).toBeInstanceOf(UserConfigRepository);
      expect(DefaultExport).toBe(UserConfigRepository);
    });
  });

  describe("create", () => {
    it("inserts every column with a generated id and returns the row", async () => {
      testDb.enqueueRows([configRow]);
      const expiry = new Date("2030-01-01T00:00:00Z");

      const result = await repo.create({
        userId: "user-1",
        homeAddress: "123 Main St, Warsaw",
        panavisionAddress: "Studio Road 5, Warsaw",
        bufferCarChange: 1,
        bufferParking: 2,
        bufferEntry: 3,
        bufferTraffic: 4,
        bufferMorningRoutine: 5,
        notificationEmail: false,
        notificationSMS: true,
        notificationPush: false,
        smsNumber: "+48123456789",
        smsVerified: true,
        smsVerificationCode: "123456",
        smsVerificationExpiry: expiry,
        pushToken: "push-abc",
        pushTokenVerified: true,
      });

      expect(result).toEqual(configRow);
      expect(testDb.queries).toHaveLength(1);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(/^insert into "user_configs" /);
      expect(q.sql).toContain(INSERT_COLUMNS);
      expect(q.sql).toMatch(/returning \*$/);
      expect(q.parameters).toHaveLength(18);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1)).toEqual([
        "user-1",
        "123 Main St, Warsaw",
        "Studio Road 5, Warsaw",
        1,
        2,
        3,
        4,
        5,
        false,
        true,
        false,
        "+48123456789",
        true,
        "123456",
        expiry,
        "push-abc",
        true,
      ]);
      expect(q.parameters[15]).toBeInstanceOf(Date);
    });

    it("fills defaults for every omitted optional column", async () => {
      testDb.enqueueRows([configRow]);

      await repo.create({ userId: "user-1" });

      const q = testDb.lastQuery();
      expect(q.parameters).toHaveLength(18);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1)).toEqual(["user-1", ...defaultInsertTail]);
    });

    it("keeps explicit falsy values for ?? fields instead of defaulting them", async () => {
      testDb.enqueueRows([configRow]);

      await repo.create({
        userId: "user-1",
        bufferCarChange: 0,
        bufferParking: 0,
        bufferEntry: 0,
        bufferTraffic: 0,
        bufferMorningRoutine: 0,
        notificationEmail: false,
        notificationPush: false,
        notificationSMS: false,
        smsVerified: false,
        pushTokenVerified: false,
      });

      const p = testDb.lastQuery().parameters;
      // buffers 0, all notifications off
      expect(p.slice(4, 9)).toEqual([0, 0, 0, 0, 0]);
      expect(p.slice(9, 12)).toEqual([false, false, false]);
    });

    it("turns empty strings into defaults/nulls for || fields", async () => {
      testDb.enqueueRows([configRow]);

      await repo.create({
        userId: "user-1",
        homeAddress: "",
        panavisionAddress: "",
        smsNumber: "",
        smsVerificationCode: "",
        pushToken: "",
      });

      const p = testDb.lastQuery().parameters;
      expect(p[2]).toBe("");
      expect(p[3]).toBe(DEFAULT_PANAVISION);
      expect(p[12]).toBeNull(); // smsNumber
      expect(p[14]).toBeNull(); // smsVerificationCode
      expect(p[16]).toBeNull(); // pushToken
    });

    it("throws when the insert returns no row", async () => {
      await expect(repo.create({ userId: "user-1" })).rejects.toThrow();
      expect(testDb.queries).toHaveLength(1);
    });

    it("propagates database errors", async () => {
      testDb.enqueueError(new Error("duplicate key"));
      await expect(repo.create({ userId: "user-1" })).rejects.toThrow(
        "duplicate key"
      );
    });
  });

  describe("findById", () => {
    it("selects by primary key and returns the row", async () => {
      testDb.enqueueRows([configRow]);

      const result = await repo.findById("cfg-1");

      expect(result).toEqual(configRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "user_configs" where "id" = \$1/
      );
      expect(q.parameters).toEqual(["cfg-1"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await repo.findById("missing")).toBeNull();
      expect(testDb.lastQuery().parameters).toEqual(["missing"]);
    });

    it("propagates database errors", async () => {
      testDb.enqueueError(new Error("connection lost"));
      await expect(repo.findById("cfg-1")).rejects.toThrow("connection lost");
    });
  });

  describe("findByUserId", () => {
    it("filters on userId (not id) and returns the row", async () => {
      testDb.enqueueRows([configRow]);

      const result = await repo.findByUserId("user-1");

      expect(result).toEqual(configRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^select \* from "user_configs" where "userId" = \$1/
      );
      expect(q.parameters).toEqual(["user-1"]);
    });

    it("returns null when the user has no config", async () => {
      expect(await repo.findByUserId("nonexistent")).toBeNull();
    });

    it("propagates database errors", async () => {
      testDb.enqueueError(new Error("boom"));
      await expect(repo.findByUserId("user-1")).rejects.toThrow("boom");
    });
  });

  describe("update", () => {
    it("sets only the provided fields, scoped by id, and returns the row", async () => {
      testDb.enqueueRows([{ ...configRow, bufferTraffic: 30 }]);

      const result = await repo.update("cfg-1", {
        bufferTraffic: 30,
        homeAddress: "456 New St",
      });

      expect(result.bufferTraffic).toBe(30);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^update "user_configs" set "bufferTraffic" = \$1, "homeAddress" = \$2 where "id" = \$3 returning \*$/
      );
      expect(q.parameters).toEqual([30, "456 New St", "cfg-1"]);
    });

    it("binds explicit null / false values", async () => {
      testDb.enqueueRows([configRow]);

      await repo.update("cfg-1", { smsNumber: null, notificationSMS: false });

      const q = testDb.lastQuery();
      expect(q.sql).toContain('set "smsNumber" = $1, "notificationSMS" = $2 where "id" = $3');
      expect(q.parameters).toEqual([null, false, "cfg-1"]);
    });

    it("throws when no config matches", async () => {
      await expect(
        repo.update("missing", { homeAddress: "x" })
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes by id and returns the removed row", async () => {
      testDb.enqueueRows([configRow]);

      const result = await repo.delete("cfg-1");

      expect(result).toEqual(configRow);
      const q = testDb.lastQuery();
      expect(q.sql).toMatch(
        /^delete from "user_configs" where "id" = \$1 returning \*$/
      );
      expect(q.parameters).toEqual(["cfg-1"]);
    });

    it("throws when nothing was deleted", async () => {
      await expect(repo.delete("missing")).rejects.toThrow();
    });
  });

  describe("createOrUpdateForUser", () => {
    it("updates by userId when a config already exists", async () => {
      testDb.enqueueRows([configRow]); // findByUserId
      testDb.enqueueRows([
        { ...configRow, homeAddress: "456 New St", bufferTraffic: 30 },
      ]); // update

      const result = await repo.createOrUpdateForUser("user-1", {
        homeAddress: "456 New St",
        bufferTraffic: 30,
      });

      expect(result.homeAddress).toBe("456 New St");
      expect(result.bufferTraffic).toBe(30);
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[0].sql).toMatch(
        /^select \* from "user_configs" where "userId" = \$1/
      );
      expect(testDb.queries[0].parameters).toEqual(["user-1"]);
      expect(testDb.queries[1].sql).toMatch(
        /^update "user_configs" set "homeAddress" = \$1, "bufferTraffic" = \$2 where "userId" = \$3 returning \*$/
      );
      expect(testDb.queries[1].parameters).toEqual([
        "456 New St",
        30,
        "user-1",
      ]);
    });

    it("does not insert when a config exists", async () => {
      testDb.enqueueRows([configRow]);
      testDb.enqueueRows([configRow]);

      await repo.createOrUpdateForUser("user-1", { bufferParking: 5 });

      expect(testDb.queries.some((q) => /^insert/.test(q.sql))).toBe(false);
    });

    it("throws if the update matches no row", async () => {
      testDb.enqueueRows([configRow]); // exists
      // update returns nothing queued
      await expect(
        repo.createOrUpdateForUser("user-1", { bufferParking: 5 })
      ).rejects.toThrow();
      expect(testDb.queries).toHaveLength(2);
    });

    it("inserts with defaults overlaid by the supplied data when no config exists", async () => {
      testDb.enqueueRows([]); // findByUserId -> none
      testDb.enqueueRows([{ ...configRow, homeAddress: "Home 1" }]); // insert

      const result = await repo.createOrUpdateForUser("user-1", {
        homeAddress: "Home 1",
        bufferTraffic: 33,
        notificationSMS: true,
      });

      expect(result.homeAddress).toBe("Home 1");
      expect(testDb.queries).toHaveLength(2);
      const q = testDb.queries[1];
      expect(q.sql).toMatch(/^insert into "user_configs" /);
      expect(q.sql).toContain(INSERT_COLUMNS);
      expect(q.sql).toMatch(/returning \*$/);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1)).toEqual([
        "user-1",
        "Home 1", // homeAddress overridden
        DEFAULT_PANAVISION,
        15,
        10,
        10,
        33, // bufferTraffic overridden
        45,
        true,
        true, // notificationSMS overridden
        true,
        null,
        false,
        null,
        null,
        null,
        false,
      ]);
    });

    it("inserts pure defaults when given empty data", async () => {
      testDb.enqueueRows([]);
      testDb.enqueueRows([configRow]);

      await repo.createOrUpdateForUser("user-1", {});

      expect(testDb.queries[1].parameters.slice(1)).toEqual([
        "user-1",
        ...defaultInsertTail,
      ]);
    });

    it("throws if the insert returns no row", async () => {
      testDb.enqueueRows([]); // none exists, insert returns nothing
      await expect(
        repo.createOrUpdateForUser("user-1", { homeAddress: "x" })
      ).rejects.toThrow();
    });

    it("propagates lookup errors without writing", async () => {
      testDb.enqueueError(new Error("lookup failed"));
      await expect(
        repo.createOrUpdateForUser("user-1", { homeAddress: "x" })
      ).rejects.toThrow("lookup failed");
      expect(testDb.queries).toHaveLength(1);
    });
  });

  describe("getDefaultConfig", () => {
    it("returns the documented defaults with blank ids", () => {
      expect(repo.getDefaultConfig()).toEqual({
        id: "",
        userId: "",
        homeAddress: "",
        panavisionAddress: DEFAULT_PANAVISION,
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
      });
    });

    it("returns a fresh object each call (mutations do not leak)", () => {
      const a = repo.getDefaultConfig();
      a.bufferTraffic = 999;
      expect(repo.getDefaultConfig().bufferTraffic).toBe(20);
    });

    it("runs no queries", () => {
      repo.getDefaultConfig();
      expect(testDb.queries).toHaveLength(0);
    });
  });

  describe("validateConfig", () => {
    it("accepts an empty config", () => {
      expect(repo.validateConfig({})).toEqual({ isValid: true, errors: [] });
    });

    it("accepts a valid config", () => {
      expect(
        repo.validateConfig({
          homeAddress: "123 Main St, Warsaw",
          panavisionAddress: "Studio Road 5",
          bufferCarChange: 15,
          bufferParking: 0,
          bufferEntry: 120,
          notificationEmail: true,
          notificationSMS: false,
        })
      ).toEqual({ isValid: true, errors: [] });
    });

    describe("addresses", () => {
      it("rejects a home address shorter than 5 characters", () => {
        const r = repo.validateConfig({ homeAddress: "1234" });
        expect(r.isValid).toBe(false);
        expect(r.errors).toEqual([
          "Home address must be at least 5 characters long",
        ]);
      });

      it("accepts a home address of exactly 5 characters", () => {
        expect(repo.validateConfig({ homeAddress: "12345" }).isValid).toBe(
          true
        );
      });

      it("trims whitespace before measuring the home address", () => {
        expect(
          repo.validateConfig({ homeAddress: "  ab  " }).errors
        ).toContain("Home address must be at least 5 characters long");
      });

      it("rejects an empty home address when it is provided", () => {
        expect(repo.validateConfig({ homeAddress: "" }).isValid).toBe(false);
      });

      it("rejects a panavision address shorter than 5 characters", () => {
        const r = repo.validateConfig({ panavisionAddress: "abcd" });
        expect(r.isValid).toBe(false);
        expect(r.errors).toEqual([
          "Panavision address must be at least 5 characters long",
        ]);
      });

      it("accepts a panavision address of exactly 5 characters", () => {
        expect(
          repo.validateConfig({ panavisionAddress: "abcde" }).isValid
        ).toBe(true);
      });

      it("trims whitespace before measuring the panavision address", () => {
        expect(
          repo.validateConfig({ panavisionAddress: "   a   " }).errors
        ).toContain("Panavision address must be at least 5 characters long");
      });
    });

    describe("buffers", () => {
      const fields = [
        "bufferCarChange",
        "bufferParking",
        "bufferEntry",
        "bufferTraffic",
        "bufferMorningRoutine",
      ] as const;

      it.each(fields)("validates %s independently", (field) => {
        const bad = repo.validateConfig({ [field]: -1 });
        expect(bad.isValid).toBe(false);
        expect(bad.errors).toEqual([
          `${field} must be an integer between 0 and 120 minutes`,
        ]);
        expect(repo.validateConfig({ [field]: 60 }).isValid).toBe(true);
      });

      it("accepts the boundaries 0 and 120", () => {
        expect(repo.validateConfig({ bufferTraffic: 0 }).isValid).toBe(true);
        expect(repo.validateConfig({ bufferTraffic: 120 }).isValid).toBe(true);
      });

      it("rejects values just outside the boundaries", () => {
        expect(repo.validateConfig({ bufferTraffic: -1 }).isValid).toBe(false);
        expect(repo.validateConfig({ bufferTraffic: 121 }).isValid).toBe(false);
      });

      it("rejects non-integer numbers", () => {
        expect(repo.validateConfig({ bufferEntry: 10.5 }).isValid).toBe(false);
        expect(repo.validateConfig({ bufferEntry: NaN }).isValid).toBe(false);
      });

      it("rejects numeric strings", () => {
        expect(
          repo.validateConfig({ bufferParking: "10" as any }).isValid
        ).toBe(false);
      });

      it("reports one error per invalid buffer", () => {
        const r = repo.validateConfig({
          bufferCarChange: -5,
          bufferTraffic: 150,
        });
        expect(r.errors).toEqual([
          "bufferCarChange must be an integer between 0 and 120 minutes",
          "bufferTraffic must be an integer between 0 and 120 minutes",
        ]);
      });
    });

    describe("notification preferences", () => {
      it.each(["notificationEmail", "notificationSMS", "notificationPush"])(
        "rejects a non-boolean %s",
        (field) => {
          const r = repo.validateConfig({ [field]: "yes" } as any);
          expect(r.isValid).toBe(false);
          expect(r.errors).toEqual([`${field} must be a boolean value`]);
        }
      );

      it("rejects numeric truthy/falsy values as non-boolean", () => {
        expect(
          repo.validateConfig({ notificationEmail: 1 as any }).isValid
        ).toBe(false);
        expect(
          repo.validateConfig({ notificationEmail: 0 as any }).isValid
        ).toBe(false);
      });

      it("requires at least one method when all three are explicitly false", () => {
        const r = repo.validateConfig({
          notificationEmail: false,
          notificationSMS: false,
          notificationPush: false,
        });
        expect(r.isValid).toBe(false);
        expect(r.errors).toEqual([
          "At least one notification method must be enabled",
        ]);
      });

      it.each([
        [{ notificationEmail: true, notificationSMS: false, notificationPush: false }],
        [{ notificationEmail: false, notificationSMS: true, notificationPush: false }],
        [{ notificationEmail: false, notificationSMS: false, notificationPush: true }],
      ])("accepts when exactly one method is enabled: %j", (prefs) => {
        expect(repo.validateConfig(prefs)).toEqual({
          isValid: true,
          errors: [],
        });
      });

      it("does not apply the at-least-one rule to a partial config", () => {
        expect(
          repo.validateConfig({
            notificationEmail: false,
            notificationSMS: false,
          }).isValid
        ).toBe(true);
      });
    });

    it("collects errors from every category together", () => {
      const r = repo.validateConfig({
        homeAddress: "123",
        bufferCarChange: -5,
        bufferTraffic: 150,
        notificationEmail: "yes" as any,
      });

      expect(r.isValid).toBe(false);
      expect(r.errors).toEqual([
        "Home address must be at least 5 characters long",
        "bufferCarChange must be an integer between 0 and 120 minutes",
        "bufferTraffic must be an integer between 0 and 120 minutes",
        "notificationEmail must be a boolean value",
      ]);
    });
  });

  describe("getConfigWithDefaults", () => {
    it("returns the stored config when it exists", async () => {
      testDb.enqueueRows([configRow]);

      const result = await repo.getConfigWithDefaults("user-1");

      expect(result).toEqual(configRow);
      expect(testDb.queries).toHaveLength(1);
      expect(testDb.lastQuery().sql).toContain('where "userId" = $1');
      expect(testDb.lastQuery().parameters).toEqual(["user-1"]);
    });

    it("returns defaults stamped with the userId when none is stored, without writing", async () => {
      const result = await repo.getConfigWithDefaults("user-9");

      expect(result).toEqual({ ...repo.getDefaultConfig(), userId: "user-9" });
      expect(result.id).toBe("");
      expect(testDb.queries).toHaveLength(1);
      expect(testDb.lastQuery().sql).toMatch(/^select /);
    });

    it("propagates database errors", async () => {
      testDb.enqueueError(new Error("db down"));
      await expect(repo.getConfigWithDefaults("user-1")).rejects.toThrow(
        "db down"
      );
    });
  });

  describe("updateBuffers", () => {
    it("upserts only the supplied buffers (update path)", async () => {
      testDb.enqueueRows([configRow]);
      testDb.enqueueRows([{ ...configRow, bufferParking: 25 }]);

      const result = await repo.updateBuffers("user-1", {
        bufferParking: 25,
        bufferEntry: 5,
      });

      expect(result.bufferParking).toBe(25);
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[1].sql).toMatch(
        /^update "user_configs" set "bufferParking" = \$1, "bufferEntry" = \$2 where "userId" = \$3/
      );
      expect(testDb.queries[1].parameters).toEqual([25, 5, "user-1"]);
    });

    it("inserts with the buffers overlaid on defaults (insert path)", async () => {
      testDb.enqueueRows([]);
      testDb.enqueueRows([configRow]);

      await repo.updateBuffers("user-1", { bufferMorningRoutine: 90 });

      const q = testDb.queries[1];
      expect(q.sql).toMatch(/^insert into "user_configs"/);
      expect(q.parameters[1]).toBe("user-1");
      expect(q.parameters[8]).toBe(90); // bufferMorningRoutine
      expect(q.parameters[4]).toBe(15); // bufferCarChange default retained
    });
  });

  describe("updateNotificationPreferences", () => {
    it("rejects when all methods are disabled, without touching the database", async () => {
      await expect(
        repo.updateNotificationPreferences("user-1", {
          notificationEmail: false,
          notificationSMS: false,
          notificationPush: false,
        })
      ).rejects.toThrow(
        "Invalid notification preferences: At least one notification method must be enabled"
      );
      expect(testDb.queries).toHaveLength(0);
    });

    it("rejects non-boolean values, without touching the database", async () => {
      await expect(
        repo.updateNotificationPreferences("user-1", {
          notificationEmail: "yes" as any,
        })
      ).rejects.toThrow(
        "Invalid notification preferences: notificationEmail must be a boolean value"
      );
      expect(testDb.queries).toHaveLength(0);
    });

    it("joins multiple validation errors with a comma and space", async () => {
      await expect(
        repo.updateNotificationPreferences("user-1", {
          notificationEmail: "x" as any,
          notificationSMS: "y" as any,
        })
      ).rejects.toThrow(
        "Invalid notification preferences: notificationEmail must be a boolean value, notificationSMS must be a boolean value"
      );
    });

    it("upserts valid preferences (update path)", async () => {
      testDb.enqueueRows([configRow]);
      testDb.enqueueRows([{ ...configRow, notificationEmail: false }]);

      const result = await repo.updateNotificationPreferences("user-1", {
        notificationEmail: false,
        notificationSMS: true,
      });

      expect(result.notificationEmail).toBe(false);
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[1].sql).toMatch(
        /^update "user_configs" set "notificationEmail" = \$1, "notificationSMS" = \$2 where "userId" = \$3/
      );
      expect(testDb.queries[1].parameters).toEqual([false, true, "user-1"]);
    });

    it("upserts valid preferences (insert path)", async () => {
      testDb.enqueueRows([]);
      testDb.enqueueRows([configRow]);

      await repo.updateNotificationPreferences("user-1", {
        notificationEmail: false,
        notificationSMS: true,
      });

      const q = testDb.queries[1];
      expect(q.sql).toMatch(/^insert into "user_configs"/);
      // email overridden to false, sms overridden to true, push default true
      expect(q.parameters.slice(9, 12)).toEqual([false, true, true]);
    });
  });

  describe("updateAddresses", () => {
    it("rejects a short home address, without touching the database", async () => {
      await expect(
        repo.updateAddresses("user-1", { homeAddress: "abc" })
      ).rejects.toThrow(
        "Invalid addresses: Home address must be at least 5 characters long"
      );
      expect(testDb.queries).toHaveLength(0);
    });

    it("reports both address errors joined together", async () => {
      await expect(
        repo.updateAddresses("user-1", {
          homeAddress: "abc",
          panavisionAddress: "xy",
        })
      ).rejects.toThrow(
        "Invalid addresses: Home address must be at least 5 characters long, Panavision address must be at least 5 characters long"
      );
    });

    it("upserts valid addresses (update path)", async () => {
      testDb.enqueueRows([configRow]);
      testDb.enqueueRows([{ ...configRow, homeAddress: "789 Elm Street" }]);

      const result = await repo.updateAddresses("user-1", {
        homeAddress: "789 Elm Street",
        panavisionAddress: "Studio Road 7",
      });

      expect(result.homeAddress).toBe("789 Elm Street");
      expect(testDb.queries[1].sql).toMatch(
        /^update "user_configs" set "homeAddress" = \$1, "panavisionAddress" = \$2 where "userId" = \$3/
      );
      expect(testDb.queries[1].parameters).toEqual([
        "789 Elm Street",
        "Studio Road 7",
        "user-1",
      ]);
    });

    it("upserts valid addresses (insert path)", async () => {
      testDb.enqueueRows([]);
      testDb.enqueueRows([configRow]);

      await repo.updateAddresses("user-1", { homeAddress: "789 Elm Street" });

      const q = testDb.queries[1];
      expect(q.sql).toMatch(/^insert into "user_configs"/);
      expect(q.parameters[2]).toBe("789 Elm Street");
      expect(q.parameters[3]).toBe(DEFAULT_PANAVISION);
    });
  });

  describe("getTotalBufferTime", () => {
    it("sums all five buffers of the stored config", async () => {
      testDb.enqueueRows([
        {
          ...configRow,
          bufferCarChange: 1,
          bufferParking: 2,
          bufferEntry: 4,
          bufferTraffic: 8,
          bufferMorningRoutine: 16,
        },
      ]);

      expect(await repo.getTotalBufferTime("user-1")).toBe(31);
      expect(testDb.lastQuery().parameters).toEqual(["user-1"]);
    });

    it("falls back to the default buffers (100) when no config exists", async () => {
      expect(await repo.getTotalBufferTime("user-1")).toBe(100);
    });
  });

  describe("resetToDefaults", () => {
    it("overwrites an existing config with the defaults, scoped by userId", async () => {
      const resetRow = { ...configRow, homeAddress: "" };
      testDb.enqueueRows([
        { ...configRow, bufferTraffic: 99, notificationEmail: false },
      ]); // findByUserId
      testDb.enqueueRows([resetRow]); // update

      const result = await repo.resetToDefaults("user-1");

      expect(result).toEqual(resetRow);
      expect(testDb.queries).toHaveLength(2);
      expect(testDb.queries[0].sql).toMatch(
        /^select \* from "user_configs" where "userId" = \$1/
      );
      const q = testDb.queries[1];
      expect(q.sql).toMatch(
        /^update "user_configs" set "homeAddress" = \$1, "panavisionAddress" = \$2, "bufferCarChange" = \$3, "bufferParking" = \$4, "bufferEntry" = \$5, "bufferTraffic" = \$6, "bufferMorningRoutine" = \$7, "notificationEmail" = \$8, "notificationSMS" = \$9, "notificationPush" = \$10, "smsNumber" = \$11, "smsVerified" = \$12, "smsVerificationCode" = \$13, "smsVerificationExpiry" = \$14, "pushToken" = \$15, "pushTokenVerified" = \$16 where "userId" = \$17 returning \*$/
      );
      expect(q.parameters).toEqual([...defaultInsertTail, "user-1"]);
    });

    it("inserts a default config when none exists", async () => {
      testDb.enqueueRows([]); // none
      testDb.enqueueRows([configRow]); // insert

      const result = await repo.resetToDefaults("user-1");

      expect(result).toEqual(configRow);
      expect(testDb.queries).toHaveLength(2);
      const q = testDb.queries[1];
      expect(q.sql).toMatch(/^insert into "user_configs" /);
      expect(q.sql).toContain(INSERT_COLUMNS);
      expect(q.parameters).toHaveLength(18);
      expect(q.parameters[0]).toMatch(/^c[a-z0-9]+$/);
      expect(q.parameters.slice(1)).toEqual(["user-1", ...defaultInsertTail]);
    });

    it("throws if the update matches no row", async () => {
      testDb.enqueueRows([configRow]);
      await expect(repo.resetToDefaults("user-1")).rejects.toThrow();
    });

    it("throws if the insert returns no row", async () => {
      await expect(repo.resetToDefaults("user-1")).rejects.toThrow();
      expect(testDb.queries).toHaveLength(2);
    });

    it("propagates database errors from the write", async () => {
      testDb.enqueueRows([configRow]);
      testDb.enqueueError(new Error("write failed"));
      await expect(repo.resetToDefaults("user-1")).rejects.toThrow(
        "write failed"
      );
    });
  });
});

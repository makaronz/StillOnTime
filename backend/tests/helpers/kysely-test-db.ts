/**
 * A real Kysely instance wired to a fake driver.
 *
 * Repositories under test build their queries with the genuine Kysely query
 * builder and Postgres compiler, so a test can assert on the SQL text and the
 * bound parameters that would be sent, and script what the "database" returns.
 * Nothing touches a network or a real Postgres.
 *
 * tests/setup.ts mocks `@/config/database` so that its `db` export is
 * `testDb.db`. In a test:
 *
 *   import { testDb } from "../helpers/kysely-test-db";
 *   testDb.enqueueRows([{ id: "u1" }]);          // result of the 1st query
 *   await repo.findById("u1");
 *   expect(testDb.lastQuery().sql).toContain('from "users"');
 *   expect(testDb.lastQuery().parameters).toEqual(["u1", 1]);
 *
 * Results are consumed in the order queries are executed; a query with nothing
 * queued returns `{ rows: [] }`. `testDb.reset()` runs before every test.
 */
import {
  CompiledQuery,
  DatabaseConnection,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryResult,
  TransactionSettings,
} from "kysely";

export interface RecordedQuery {
  sql: string;
  parameters: readonly unknown[];
}

type Scripted =
  | { kind: "result"; result: QueryResult<any> }
  | { kind: "error"; error: Error }
  | { kind: "fn"; fn: (q: CompiledQuery) => QueryResult<any> };

class FakeConnection implements DatabaseConnection {
  constructor(
    private readonly queue: Scripted[],
    private readonly log: RecordedQuery[]
  ) {}

  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    this.log.push({ sql: query.sql, parameters: query.parameters });
    const next = this.queue.shift();
    if (!next) return { rows: [] };
    if (next.kind === "error") throw next.error;
    if (next.kind === "fn") return next.fn(query);
    return next.result as QueryResult<R>;
  }

  // eslint-disable-next-line require-yield
  async *streamQuery(): AsyncIterableIterator<never> {
    throw new Error("streamQuery is not supported by the test driver");
  }
}

class FakeDriver implements Driver {
  constructor(private readonly connection: FakeConnection) {}
  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }
  async beginTransaction(
    connection: DatabaseConnection,
    _settings: TransactionSettings
  ): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("begin"));
  }
  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("commit"));
  }
  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("rollback"));
  }
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

function createTestDb() {
  const queue: Scripted[] = [];
  const queries: RecordedQuery[] = [];
  const connection = new FakeConnection(queue, queries);

  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new FakeDriver(connection),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return {
    db,
    /** Every query executed since the last reset, in order. */
    queries,
    lastQuery(): RecordedQuery {
      const q = queries[queries.length - 1];
      if (!q) throw new Error("No query has been executed");
      return q;
    },
    /** Queue the rows returned by the next query. For INSERT/UPDATE/DELETE pass
     *  numAffectedRows (what `executeTakeFirst()` reports as numUpdatedRows etc). */
    enqueueRows(rows: unknown[], numAffectedRows?: number | bigint): void {
      queue.push({
        kind: "result",
        result: {
          rows,
          ...(numAffectedRows !== undefined
            ? { numAffectedRows: BigInt(numAffectedRows) }
            : {}),
        },
      });
    },
    /** Queue the result of a write that returns no rows. */
    enqueueAffected(numAffectedRows: number | bigint): void {
      queue.push({
        kind: "result",
        result: { rows: [], numAffectedRows: BigInt(numAffectedRows) },
      });
    },
    enqueueError(error: Error): void {
      queue.push({ kind: "error", error });
    },
    /** Compute the result from the executed query (e.g. branch on its SQL). */
    enqueueFn(fn: (q: CompiledQuery) => QueryResult<any>): void {
      queue.push({ kind: "fn", fn });
    },
    reset(): void {
      queue.length = 0;
      queries.length = 0;
    },
  };
}

export const testDb = createTestDb();

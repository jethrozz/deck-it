import test from "node:test";
import assert from "node:assert/strict";
import {
  CRITICAL_TABLES,
  collectTableCounts,
  ensureDatabaseUrl,
  maskDatabaseUrl,
  verifyDatabaseConnection
} from "../../scripts/db-utils.mjs";

test("maskDatabaseUrl redacts passwords when displaying database urls", () => {
  assert.equal(
    maskDatabaseUrl("postgresql://postgres:super-secret@db.example.supabase.co:5432/postgres"),
    "postgresql://postgres:***@db.example.supabase.co:5432/postgres"
  );
});

test("ensureDatabaseUrl requires a database url before running checks", () => {
  assert.throws(() => ensureDatabaseUrl(""), /DATABASE_URL is not set/);
});

test("verifyDatabaseConnection runs a simple connectivity query", async () => {
  const calls = [];
  const client = {
    async $queryRawUnsafe(query) {
      calls.push(query);
      return [{ connected: 1 }];
    }
  };

  await verifyDatabaseConnection(client);

  assert.deepEqual(calls, ["SELECT 1 AS connected"]);
});

test("collectTableCounts returns counts for every critical table", async () => {
  const counts = new Map(CRITICAL_TABLES.map((tableName, index) => [tableName, index + 1]));
  const client = {
    async $queryRawUnsafe(query) {
      const tableName = query.match(/FROM "([^"]+)"/)?.[1];
      return [{ count: counts.get(tableName ?? "") ?? 0 }];
    }
  };

  const inventory = await collectTableCounts(client);

  assert.deepEqual(
    inventory,
    CRITICAL_TABLES.map((tableName, index) => ({
      tableName,
      rowCount: index + 1
    }))
  );
});

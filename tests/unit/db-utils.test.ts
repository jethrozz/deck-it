import { describe, expect, it } from "vitest";
import {
  CRITICAL_TABLES,
  collectTableCounts,
  ensureDatabaseUrl,
  maskDatabaseUrl,
  verifyDatabaseConnection
} from "../../scripts/db-utils.mjs";

describe("db utils", () => {
  it("redacts passwords when displaying database urls", () => {
    expect(maskDatabaseUrl("mysql://deckit:super-secret@db.example.com:3306/deck_it")).toBe(
      "mysql://deckit:***@db.example.com:3306/deck_it"
    );
  });

  it("requires a database url before running checks", () => {
    expect(() => ensureDatabaseUrl("")).toThrow(/DATABASE_URL is not set/);
  });

  it("runs a simple connectivity query", async () => {
    const calls: string[] = [];
    const client = {
      async $queryRawUnsafe(query: string) {
        calls.push(query);
        return [{ connected: 1 }];
      }
    };

    await verifyDatabaseConnection(client);

    expect(calls).toEqual(["SELECT 1 AS connected"]);
  });

  it("returns counts for every critical table", async () => {
    const counts = new Map(CRITICAL_TABLES.map((tableName, index) => [tableName, index + 1]));
    const client = {
      async $queryRawUnsafe(query: string) {
        const tableName = query.match(/FROM `([^`]+)`/)?.[1];
        return [{ count: counts.get(tableName ?? "") ?? 0 }];
      }
    };

    const inventory = await collectTableCounts(client);

    expect(inventory).toEqual(
      CRITICAL_TABLES.map((tableName, index) => ({
        tableName,
        rowCount: index + 1
      }))
    );
  });
});

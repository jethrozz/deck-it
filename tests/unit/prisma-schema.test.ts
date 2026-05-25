import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("prisma schema", () => {
  it("stores floor plan data urls in a long text column", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toMatch(/floorPlanUrl\s+String\?\s+@db\.LongText/);
  });
});

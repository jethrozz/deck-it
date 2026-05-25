export const CRITICAL_TABLES = [
  "Project",
  "Order",
  "Coupon",
  "CouponRedemption",
  "FloorPlanAnalysis",
  "PreferenceProfile",
  "AgentConversation",
  "DesignPlan",
  "RenderingAsset",
  "BriefExport"
];

export function ensureDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  const value = databaseUrl?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is not set. Point it to your MySQL connection string before running database checks.");
  }

  return value;
}

export function maskDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);

    if (parsed.password) {
      parsed.password = "***";
    }

    return parsed.toString();
  } catch {
    return "[invalid DATABASE_URL]";
  }
}

export async function verifyDatabaseConnection(client) {
  await client.$queryRawUnsafe("SELECT 1 AS connected");
}

export async function collectTableCounts(client, tableNames = CRITICAL_TABLES) {
  const inventory = [];

  for (const tableName of tableNames) {
    const rows = await client.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
    const rowCount = Number(rows?.[0]?.count ?? 0);

    inventory.push({
      tableName,
      rowCount
    });
  }

  return inventory;
}

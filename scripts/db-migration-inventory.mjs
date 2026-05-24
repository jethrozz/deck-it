import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { collectTableCounts, ensureDatabaseUrl, maskDatabaseUrl } from "./db-utils.mjs";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const databaseUrl = ensureDatabaseUrl();

  console.log(`Capturing migration inventory from ${maskDatabaseUrl(databaseUrl)}`);

  const inventory = await collectTableCounts(prisma);

  console.log(JSON.stringify(inventory, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to capture database migration inventory.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl, maskDatabaseUrl, verifyDatabaseConnection } from "./db-utils.mjs";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const databaseUrl = ensureDatabaseUrl();

  console.log(`Checking Prisma connectivity against ${maskDatabaseUrl(databaseUrl)}`);
  await verifyDatabaseConnection(prisma);
  console.log("Database connection check passed.");
}

main()
  .catch((error) => {
    console.error("Database connection check failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

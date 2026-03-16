import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  // 'query',
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Graceful shutdown
process.on("beforeExit", async () => {
  console.info("Closing Prisma connection...");
  await prisma.$disconnect();
});

export default prisma;

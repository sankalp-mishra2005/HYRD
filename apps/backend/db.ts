import { PrismaClient } from "./generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = (process.env.DATABASE_URL || "").replace(
  "@localhost:",
  "@127.0.0.1:"
);

const adapter = new PrismaPg({
  connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});

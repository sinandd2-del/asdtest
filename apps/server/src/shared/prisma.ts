import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function checkDatabaseHealth() {
  await prisma.$queryRaw`SELECT 1`;
}

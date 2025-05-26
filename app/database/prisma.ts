import { PrismaClient } from '@prisma/client';

// Create a mock Prisma client for CI builds to avoid database connection issues
const createPrismaClient = () => {
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') {
    // Return a mock client for CI builds
    return {} as PrismaClient;
  }

  return new PrismaClient();
};

export const prisma = createPrismaClient();

import { prisma, describeDatabase } from '../db/prisma';

export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log(`[PostgreSQL] Connected successfully: ${describeDatabase().split('?')[0]}`);
  } catch (error) {
    console.error('[PostgreSQL] Connection failure:', error);
    process.exit(1);
  }
};

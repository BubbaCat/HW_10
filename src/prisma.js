import { PrismaClient } from '@prisma/client';

// 💡 ПОДСКАЗКА: singleton-экземпляр Prisma Client.
//    Импортируй { prisma } в каждом репозитории.
//    НЕ создавай new PrismaClient() на каждый запрос!

export const prisma = new PrismaClient({
  // 💡 В development видно все SQL-запросы в консоли —
  //    это помогает отлаживать N+1 и лишние запросы.
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

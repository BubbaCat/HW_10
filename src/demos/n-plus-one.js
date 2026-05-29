import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

// 💡 ПОДСКАЗКА: включаем log: ['query'], чтобы видеть КАЖДЫЙ SQL-запрос.
//    Так вы увидите разницу между N+1 и include.

const prisma = new PrismaClient({
  log: ['query'],
});

console.log('=== N+1 Problem Demo ===\n');

// ─── ПЛОХО: N+1 ────────────────────────────────────────────────
// 💡 1 запрос на список + N запросов на каждый пост = N+1
console.log('--- ❌ BAD (N+1) ---');
console.time('N+1');

const postsBasic = await prisma.post.findMany({
  where: { status: 'published' },
});

for (const post of postsBasic) {
  // 💡 КАЖДЫЙ findUnique — отдельный SQL-запрос!
  const user = await prisma.user.findUnique({
    where: { id: post.userId },
    select: { name: true },
  });
  const commentCount = await prisma.comment.count({
    where: { postId: post.id },
  });
  console.log(`  "${post.title}" by ${user.name}, ${commentCount} comments`);
}

console.timeEnd('N+1');
console.log(`  Запросов: 1 (post list) + ${postsBasic.length} (users) + ${postsBasic.length} (counts) = ${1 + postsBasic.length * 2}\n`);

// ─── ХОРОШО: include ───────────────────────────────────────────
// 💡 ВСЕ данные загружаются ОДНИМ запросом (или 2 — с count)
console.log('--- ✅ GOOD (include) ---');
console.time('include');

const postsGood = await prisma.post.findMany({
  where: { status: 'published' },
  include: {
    // 💡 include = JOIN: подтягивает связанные данные автоматически
    user: { select: { name: true } },
    // 💡 _count = COUNT: агрегация без лишних запросов
    _count: { select: { comments: true } },
  },
});

for (const post of postsGood) {
  // 💡 post.user уже загружен — никаких дополнительных запросов!
  console.log(`  "${post.title}" by ${post.user.name}, ${post._count.comments} comments`);
}

console.timeEnd('include');
console.log('  Запросов: 1–2 (findMany + count)');

await prisma.$disconnect();
process.exit(0);

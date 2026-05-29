import { PrismaClient } from '@prisma/client';

// 💡 ПОДСКАЗКА: сид для Prisma использует тот же Prisma Client,
//    что и основное приложение.
//    Запуск: npx prisma db seed

const prisma = new PrismaClient();

async function main() {
  // ── Clean (в обратном порядке зависимостей) ────────────────
  // 💡 Сначала удаляем link-таблицу, потом зависимые, потом корневые
  await prisma.postTag.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();

  // ── Users ──────────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.create({ data: { email: 'alice@test.com', name: 'Alice' } }),
    prisma.user.create({ data: { email: 'bob@test.com', name: 'Bob' } }),
    prisma.user.create({ data: { email: 'charlie@test.com', name: 'Charlie', role: 'admin' } }),
    prisma.user.create({ data: { email: 'diana@test.com', name: 'Diana' } }),
    prisma.user.create({ data: { email: 'eve@test.com', name: 'Eve' } }),
  ]);

  // ── Tags ───────────────────────────────────────────────────
  const tags = await Promise.all([
    prisma.tag.create({ data: { name: 'javascript' } }),
    prisma.tag.create({ data: { name: 'nodejs' } }),
    prisma.tag.create({ data: { name: 'databases' } }),
    prisma.tag.create({ data: { name: 'devops' } }),
    prisma.tag.create({ data: { name: 'architecture' } }),
  ]);

  // ── Posts + tags (в одном вызове!) ─────────────────────────
  // 💡 В Prisma можно создать пост И привязать теги одним create()
  //    через вложенный `tags: { create: [...] }`
  const titles = [
    'Knex basics: getting started',
    'Prisma vs Knex: when to use what',
    'SQL tricks you didnt know',
    'Database migrations best practices',
    'Writing effective seeds',
    'Understanding the N+1 problem',
    'Transactions in Node.js',
    'JOINs in depth',
    'Connection pooling explained',
    'ORM vs Query Builder',
  ];

  const posts = [];
  for (let i = 0; i < 10; i++) {
    const post = await prisma.post.create({
      data: {
        title: `Post ${i + 1}: ${titles[i]}`,
        body: `Body of post ${i + 1}. Lorem ipsum dolor sit amet.`,
        status: i % 3 === 0 ? 'draft' : 'published',
        userId: users[i % users.length].id,
        // 💡 connect — связывает с существующим тегом по id
        tags: {
          create: [
            { tag: { connect: { id: tags[i % tags.length].id } } },
            { tag: { connect: { id: tags[(i + 1) % tags.length].id } } },
          ],
        },
      },
    });
    posts.push(post);
  }

  // ── Comments ───────────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    await prisma.comment.create({
      data: {
        postId: posts[i % posts.length].id,
        authorId: users[(i + 1) % users.length].id,
        body: `Comment ${i + 1}: Great article, very informative!`,
      },
    });
  }

  console.log('✅ Prisma seed: 5 users, 10 posts, 20 comments, 5 tags');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

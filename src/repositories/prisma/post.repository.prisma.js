import { prisma } from '../../prisma.js';

/**
 * Prisma-реализация PostRepository.
 *
 * 💡 ЭТОТ ФАЙЛ — самая важная часть Prisma-ветки.
 *    Здесь: include (связи), _count, $transaction, connect (M:N).
 *
 * 💡 СРАВНЕНИЕ с Knex:
 *    Knex:  db('posts').join('users', ...)  → вручную JOIN
 *    Prisma: prisma.post.findMany({ include: { user } }) → автоматически JOIN
 *
 *    Knex:  db.transaction(trx => ...)       → вручную передаём trx
 *    Prisma: prisma.$transaction(tx => ...)  → вручную передаём tx
 *
 * @returns {import('../interfaces.js').PostRepository}
 */
export function createPrismaPostRepository() {
  return {
    /**
     * Список постов с авторами и счётчиком комментариев.
     *
     * 💡 include = JOIN:
     *    include: { user, _count: { select: { comments } } }
     *    эквивалентно LEFT JOIN users + COUNT(comments)
     *
     * 💡 Фильтр по M:N тегу:
     *    where: { tags: { some: { tagId } } }
     *    эквивалентно EXISTS (SELECT 1 FROM post_tags WHERE ...)
     */
    async findAll({ status, userId, tagId, page = 1, limit = 20 } = {}) {
      const where = {};
      if (status) where.status = status;
      if (userId) where.userId = userId;
      // 💡 Фильтр по M:N связи через `some`
      if (tagId) where.tags = { some: { tagId } };

      const [data, total] = await Promise.all([
        prisma.post.findMany({
          where,
          include: {
            // 💡 include: { user: { select } } — загрузить автора, но только нужные поля
            user: { select: { id: true, name: true } },
            // 💡 _count — агрегация: количество связанных записей
            _count: { select: { comments: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.post.count({ where }),
      ]);

      return {
        data: data.map((p) => ({
          id: p.id,
          userId: p.userId,
          title: p.title,
          body: p.body,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          // 💡 include автоматически подтягивает user
          authorName: p.user.name,
          // 💡 _count — вместо отдельного COUNT-запроса
          commentsCount: p._count.comments,
        })),
        total,
        page,
        limit,
      };
    },

    /**
     * Один пост со ВСЕМИ связями: автор + комментарии + теги.
     *
     * 💡 В Knex мы делали 3 отдельных запроса.
     *    В Prisma — ОДИН findUnique с вложенным include.
     *    Prisma сама сделает нужные JOIN'ы.
     */
    async findById(id) {
      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          // 💡 Автор: только id, name, email
          user: { select: { id: true, name: true, email: true } },

          // 💡 Комментарии С авторами — вложенный include!
          comments: {
            include: {
              author: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },

          // 💡 Теги: через link-модель PostTag → tag
          tags: {
            include: {
              tag: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!post) return null;

      return {
        id: post.id,
        userId: post.userId,
        title: post.title,
        body: post.body,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        author: post.user,
        comments: post.comments.map((c) => ({
          id: c.id,
          postId: c.postId,
          authorId: c.authorId,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          authorName: c.author?.name ?? null,
        })),
        // 💡 post.tags — это массив PostTag, у каждого есть .tag
        tags: post.tags.map((pt) => pt.tag),
      };
    },

    async create({ userId, title, body = null, status = 'draft' }) {
      const post = await prisma.post.create({
        data: { userId, title, body, status },
      });
      return formatPost(post);
    },

    /**
     * 💡 ТРАНЗАКЦИЯ: prisma.$transaction(async (tx) => { ... })
     *
     *    Сравните с Knex: db.transaction(async (trx) => { ... })
     *    Паттерн ОДИНАКОВЫЙ — отличается только объект (tx vs trx).
     *
     *    Все операции внутри — через tx, не через prisma:
     *      tx.post.create(...)  ← правильно
     *      prisma.post.create(...)  ← НЕ правильно (вне транзакции!)
     */
    async createWithTags({ userId, title, body = null, status = 'draft', tagIds = [] }) {
      const postDetail = await prisma.$transaction(async (tx) => {
        // Шаг 1: создаём пост
        const created = await tx.post.create({
          data: {
            userId, title, body, status,
            // 💡 connect — связывает с СУЩЕСТВУЮЩИМ тегом по id
            //    (аналог INSERT INTO post_tags в Knex)
            tags: {
              create: tagIds.map((tagId) => ({
                tag: { connect: { id: tagId } },
              })),
            },
          },
        });

        // Шаг 2: возвращаем полную информацию (с include)
        return tx.post.findUnique({
          where: { id: created.id },
          include: {
            user: { select: { id: true, name: true, email: true } },
            comments: {
              include: { author: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
            },
            tags: { include: { tag: { select: { id: true, name: true } } } },
          },
        });
      });

      return {
        id: postDetail.id,
        userId: postDetail.userId,
        title: postDetail.title,
        body: postDetail.body,
        status: postDetail.status,
        createdAt: postDetail.createdAt.toISOString(),
        updatedAt: postDetail.updatedAt.toISOString(),
        author: postDetail.user,
        comments: postDetail.comments.map((c) => ({
          id: c.id,
          postId: c.postId,
          authorId: c.authorId,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          authorName: c.author?.name ?? null,
        })),
        tags: postDetail.tags.map((pt) => pt.tag),
      };
    },

    async update(id, data) {
      try {
        const post = await prisma.post.update({ where: { id }, data });
        return formatPost(post);
      } catch (err) {
        if (err.code === 'P2025') return null;
        throw err;
      }
    },

    async remove(id) {
      try {
        // 💡 CASCADE удалит комментарии и post_tags автоматически
        await prisma.post.delete({ where: { id } });
        return true;
      } catch (err) {
        if (err.code === 'P2025') return false;
        throw err;
      }
    },
  };
}

function formatPost(post) {
  return {
    id: post.id,
    userId: post.userId,
    title: post.title,
    body: post.body,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

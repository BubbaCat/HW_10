import { prisma } from '../../prisma.js';

/**
 * Prisma-реализация CommentRepository.
 *
 * 💡 ПОДСКАЗКА: это самый простой репозиторий.
 *    Используй его как отправную точку перед PostRepository.
 *
 * @returns {import('../interfaces.js').CommentRepository}
 */
export function createPrismaCommentRepository() {
  return {
    async findAll({ postId, page = 1, limit = 20 } = {}) {
      // 💡 where — объект условий
      const where = {};
      if (postId) where.postId = postId;

      const [data, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          // 💡 include: автор — один JOIN вместо отдельного запроса
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.comment.count({ where }),
      ]);

      return {
        data: data.map(formatComment),
        total,
        page,
        limit,
      };
    },

    async findById(id) {
      const comment = await prisma.comment.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, name: true } },
        },
      });
      return comment ? formatComment(comment) : null;
    },

    async create({ postId, authorId, body }) {
      const comment = await prisma.comment.create({
        data: { postId, authorId, body },
        // 💡 Возвращаем с автором — чтобы сразу получить authorName
        include: {
          author: { select: { id: true, name: true } },
        },
      });
      return formatComment(comment);
    },

    async remove(id) {
      try {
        await prisma.comment.delete({ where: { id } });
        return true;
      } catch (err) {
        // 💡 P2025 = "Record not found" — стандартный код Prisma
        if (err.code === 'P2025') return false;
        throw err;
      }
    },
  };
}

/**
 * 💡 Date → ISO string. Prisma возвращает Date, API отдаёт строки.
 */
function formatComment(c) {
  return {
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    authorName: c.author?.name ?? null,
  };
}

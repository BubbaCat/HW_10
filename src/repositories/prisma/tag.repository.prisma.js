import { prisma } from '../../prisma.js';
import { ConflictError } from '../../errors/index.js';

/**
 * Prisma-реализация TagRepository.
 *
 * 💡 Ключевые отличия от Knex-версии:
 *    - findUnique вместо where().select()
 *    - connect/disconnect для M:N связей
 *    - err.code === 'P2025' для "not found"
 *
 * @returns {import('../interfaces.js').TagRepository}
 */
export function createPrismaTagRepository() {
  return {
    async findAll() {
      return prisma.tag.findMany({ orderBy: { id: 'asc' } });
    },

    async findById(id) {
      return prisma.tag.findUnique({ where: { id } });
    },

    async findByName(name) {
      return prisma.tag.findUnique({ where: { name } });
    },

    async create({ name }) {
      const existing = await this.findByName(name);
      if (existing) throw new ConflictError(`Tag "${name}" already exists`);

      return prisma.tag.create({ data: { name } });
    },

    /**
     * 💡 Привязать тег к посту = создать запись в PostTag (link-таблица).
     *
     *    Knex:  INSERT INTO post_tags (post_id, tag_id) VALUES (...)
     *    Prisma: prisma.postTag.create({ data: { postId, tagId } })
     *
     *    Результат одинаковый — Prisma просто чище.
     */
    async attachToPost(postId, tagId) {
      await prisma.postTag.create({
        data: { postId, tagId },
      });
    },

    /**
     * 💡 Отвязить тег = удалить запись из PostTag.
     *
     *    Knex:  DELETE FROM post_tags WHERE post_id = ? AND tag_id = ?
     *    Prisma: prisma.postTag.delete({ where: { postId_tagId: { postId, tagId } } })
     *
     *    💡 postId_tagId — это составной ID (объявлен как @@id([postId, tagId])
     *       в schema.prisma). Prisma генерирует такое имя автоматически.
     */
    async detachFromPost(postId, tagId) {
      try {
        await prisma.postTag.delete({
          where: { postId_tagId: { postId, tagId } },
        });
        return true;
      } catch (err) {
        if (err.code === 'P2025') return false;
        throw err;
      }
    },
  };
}

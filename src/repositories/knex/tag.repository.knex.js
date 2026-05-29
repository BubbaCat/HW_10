import { db } from '../../db.js';
import { ConflictError } from '../../errors/index.js';

/**
 * Knex-реализация TagRepository.
 *
 * 💡 ПОДСКАЗКА: обратите внимание на attachToPost / detachFromPost —
 *    это операции с link-таблицей post_tags (M:N).
 *    Тот же паттерн применяется для любых M:N связей.
 *
 * @returns {import('../interfaces.js').TagRepository}
 */
export function createKnexTagRepository() {
  return {
    async findAll() {
      return db('tags').select('id', 'name').orderBy('id');
    },

    async findById(id) {
      const [row] = await db('tags').where({ id }).select('id', 'name');
      return row || null;
    },

    async findByName(name) {
      const [row] = await db('tags').where({ name }).select('id', 'name');
      return row || null;
    },

    async create({ name }) {
      // 💡 Проверяем уникальность вручную (в БД и так UNIQUE, но хотим
      //    дать понятную ошибку ConflictError вместо 500)
      const existing = await this.findByName(name);
      if (existing) throw new ConflictError(`Tag "${name}" already exists`);

      const [row] = await db('tags').insert({ name }).returning('*');
      return row;
    },

    /**
     * 💡 Привязать тег к посту = INSERT в link-таблицу post_tags.
     *    Это «половина» M:N операции (вторая — detachFromPost).
     */
    async attachToPost(postId, tagId) {
      await db('post_tags').insert({ post_id: postId, tag_id: tagId });
    },

    /**
     * 💡 Отвязать тег = DELETE из post_tags.
     */
    async detachFromPost(postId, tagId) {
      const deleted = await db('post_tags')
        .where({ post_id: postId, tag_id: tagId })
        .del();
      return deleted > 0;
    },
  };
}

import { db } from '../../db.js';

/**
 * Knex-реализация CommentRepository.
 *
 * 💡 ПОДСКАЗКА: это самый простой репозиторий — без транзакций,
 *    без M:N. Используй его как шаблон для первых попыток.
 *
 * 💡 КОНТРАКТ (из interfaces.js):
 *    findAll({ postId?, page?, limit? }) → { data: Comment[], total, page, limit }
 *    findById(id)                        → Comment | null
 *    create({ postId, authorId, body })  → Comment
 *    remove(id)                          → boolean
 *
 * @returns {import('../interfaces.js').CommentRepository}
 */
export function createKnexCommentRepository() {
  return {
    async findAll({ postId, page = 1, limit = 20 } = {}) {
      // 💡 LEFT JOIN users чтобы получить authorName
      let query = db('comments as c')
        .select('c.id', 'c.post_id', 'c.author_id', 'c.body', 'c.created_at',
          'u.name as authorName')
        .leftJoin('users as u', 'c.author_id', 'u.id');

      // 💡 Динамический WHERE: фильтруем по postId только если передан
      if (postId) query = query.where('c.post_id', postId);

      // Total
      const totalQuery = db('comments');
      if (postId) totalQuery.where({ post_id: postId });
      const [{ count }] = await totalQuery.count('* as count');
      const total = Number(count);

      // 💡 ORDER + LIMIT + OFFSET — стандартная пагинация
      const rows = await query
        .orderBy('c.created_at', 'desc')
        .limit(limit)
        .offset((page - 1) * limit);

      return { data: rows.map(formatComment), total, page, limit };
    },

    async findById(id) {
      const [row] = await db('comments as c')
        .select('c.id', 'c.post_id', 'c.author_id', 'c.body', 'c.created_at',
          'u.name as authorName')
        .leftJoin('users as u', 'c.author_id', 'u.id')
        .where('c.id', id);
      return row ? formatComment(row) : null;
    },

    async create({ postId, authorId, body }) {
      // 💡 Вставляем snake_case колонки, returning — получаем обратно
      const [row] = await db('comments')
        .insert({ post_id: postId, author_id: authorId, body })
        .returning('*');
      return formatComment(row);
    },

    async remove(id) {
      const deleted = await db('comments').where({ id }).del();
      return deleted > 0;
    },
  };
}

/**
 * 💡 snake_case → camelCase.
 *    Стаб-репозиторий уже возвращал camelCase —
 *    Knex-версия тоже должна, чтобы сервисы не заметили разницу.
 */
function formatComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    authorName: row.authorName || null,
  };
}

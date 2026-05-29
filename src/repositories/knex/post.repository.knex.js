import { db } from '../../db.js';

/**
 * Knex-реализация PostRepository.
 *
 * 💡 ПОДСКАЗКА: это самый сложный репозиторий — здесь JOIN'ы и транзакции.
 *    Разбери его по методам, каждый метод — 1–2 Knex-запроса.
 *
 * 💡 КЛЮЧЕВЫЕ ПРИЁМЫ Knex:
 *    - db('posts as p').join('users as u', 'p.user_id', 'u.id')  → JOIN
 *    - db('posts').insert({...}).returning('*')                   → INSERT + вернуть
 *    - db.transaction(async (trx) => { ... })                     → ТРАНЗАКЦИЯ
 *    - db('tags').join('post_tags', ...)                           → M:N через link-таблицу
 *
 * @returns {import('../interfaces.js').PostRepository}
 */
export function createKnexPostRepository() {
  return {
    /**
     * Список постов с авторами + количество комментариев.
     * 💡 LEFT JOIN comments чтобы посчитать COUNT, GROUP BY чтобы не было дублей.
     */
    async findAll({ status, userId, tagId, page = 1, limit = 20 } = {}) {
      // Основной запрос
      let query = db('posts as p')
        .select(
          'p.id', 'p.user_id', 'p.title', 'p.body', 'p.status',
          'p.created_at', 'p.updated_at',
          'u.name as authorName',
        )
        .join('users as u', 'p.user_id', 'u.id')
        .countDistinct('c.id as commentsCount')
        .leftJoin('comments as c', 'p.id', 'c.post_id')
        .groupBy('p.id', 'u.name');

      // 💡 Динамические фильтры — добавляем WHERE только если передан параметр
      if (status) query = query.where('p.status', status);
      if (userId) query = query.where('p.user_id', userId);

      // 💡 Фильтр по тегу — JOIN с link-таблицей post_tags
      if (tagId) {
        query = query
          .join('post_tags as pt', 'p.id', 'pt.post_id')
          .where('pt.tag_id', tagId);
      }

      // Total (для пагинации)
      const totalQuery = db('posts as p').count('* as count');
      if (status) totalQuery.where('p.status', status);
      if (userId) totalQuery.where('p.user_id', userId);
      if (tagId) {
        totalQuery
          .join('post_tags as pt', 'p.id', 'pt.post_id')
          .where('pt.tag_id', tagId);
      }
      const [{ count }] = await totalQuery;
      const total = Number(count);

      // 💡 ORDER BY + LIMIT + OFFSET = пагинация
      const rows = await query
        .orderBy('p.created_at', 'desc')
        .limit(limit)
        .offset((page - 1) * limit);

      const data = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        body: r.body,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        authorName: r.authorName,
        commentsCount: Number(r.commentsCount),
      }));

      return { data, total, page, limit };
    },

    /**
     * Один пост со ВСЕМИ связями: автор, теги, комментарии.
     * 💡 ПОДСКАЗКА: используем 3 отдельных запроса вместо 1 мега-JOIN —
     *    так проще и нет проблемы с дублями.
     */
    async findById(id) {
      // Запрос 1: пост + автор
      const [post] = await db('posts as p')
        .select(
          'p.id', 'p.user_id', 'p.title', 'p.body', 'p.status',
          'p.created_at', 'p.updated_at',
          'u.id as author_id', 'u.name as author_name', 'u.email as author_email',
        )
        .join('users as u', 'p.user_id', 'u.id')
        .where('p.id', id);

      if (!post) return null;

      // Запрос 2: теги (через link-таблицу)
      const tagRows = await db('tags as t')
        .join('post_tags as pt', 't.id', 'pt.tag_id')
        .where('pt.post_id', id)
        .select('t.id', 't.name');

      // Запрос 3: комментарии + имена авторов
      const commentRows = await db('comments as c')
        .leftJoin('users as u', 'c.author_id', 'u.id')
        .where('c.post_id', id)
        .select('c.id', 'c.post_id', 'c.author_id', 'c.body', 'c.created_at',
          'u.name as authorName')
        .orderBy('c.created_at', 'desc');

      return {
        id: post.id,
        userId: post.user_id,
        title: post.title,
        body: post.body,
        status: post.status,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        author: {
          id: post.author_id,
          name: post.author_name,
          email: post.author_email,
        },
        comments: commentRows.map((c) => ({
          id: c.id,
          postId: c.post_id,
          authorId: c.author_id,
          body: c.body,
          createdAt: c.created_at,
          authorName: c.authorName,
        })),
        tags: tagRows.map((t) => ({ id: t.id, name: t.name })),
      };
    },

    async create({ userId, title, body = null, status = 'draft' }) {
      const [post] = await db('posts')
        .insert({ user_id: userId, title, body, status })
        .returning('*');
      return formatPost(post);
    },

    /**
     * 💡 ТРАНЗАКЦИЯ: создаём пост + привязываем теги ОДНОЙ атомарной операцией.
     *    Если хоть один INSERT упадёт — откатится ВСЁ.
     *
     *    Сигнатура: db.transaction(async (trx) => { ... })
     *    Все запросы внутри — через trx, не через db!
     */
    async createWithTags({ userId, title, body = null, status = 'draft', tagIds = [] }) {
      return db.transaction(async (trx) => {
        // Шаг 1: создаём пост через trx
        const [post] = await trx('posts')
          .insert({ user_id: userId, title, body, status })
          .returning('*');

        // Шаг 2: вставляем связи post_tags через trx
        if (tagIds.length > 0) {
          await trx('post_tags').insert(
            tagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId }))
          );
        }

        // Шаг 3: возвращаем полную информацию (переиспользуем findById, но через trx — нет, используем db)
        return this.findById(post.id);
      });
    },

    async update(id, data) {
      const fields = {};
      if (data.title !== undefined) fields.title = data.title;
      if (data.body !== undefined) fields.body = data.body;
      if (data.status !== undefined) fields.status = data.status;

      const [post] = await db('posts')
        .where({ id })
        .update(fields)
        .returning('*');
      return post ? formatPost(post) : null;
    },

    async remove(id) {
      // 💡 post_tags удалится автоматически (ON DELETE CASCADE)
      const deleted = await db('posts').where({ id }).del();
      return deleted > 0;
    },
  };
}

function formatPost(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

import { db } from '../../db.js';

/**
 * Knex-реализация UserRepository.
 *
 * 💡 ПОДСКАЗКА: интерфейс ДОЛЖЕН совпадать с stub-версией.
 *    Сравни методы один-в-один:
 *    - stub: store.values() → knex: db('users').select()
 *    - stub: store.get(id)  → knex: db('users').where({ id })
 *    - stub: store.set()    → knex: db('users').insert().returning('*')
 *
 * 💡 КОНТРАКТ (из interfaces.js):
 *    findAll({ page?, limit?, role? }) → { data: User[], total, page, limit }
 *    findById(id)                      → User | null
 *    create({ email, name, role? })    → User
 *    update(id, { email?, name?, role? }) → User | null
 *    remove(id)                        → boolean
 *
 * @returns {import('../interfaces.js').UserRepository}
 */
export function createKnexUserRepository() {
  return {
    async findAll({ page = 1, limit = 20, role } = {}) {
      // 💡 Строим WHERE динамически: если role передан — фильтруем
      let query = db('users')
        .select('id', 'email', 'name', 'role', 'created_at', 'updated_at');
      if (role) query = query.where({ role });

      // 💡 Отдельный COUNT для пагинации (не .length на массиве!)
      const totalResult = await db('users')
        .count('* as count')
        .modify((q) => { if (role) q.where({ role }); });
      const total = Number(totalResult[0].count);

      // 💡 LIMIT + OFFSET = пагинация
      const rows = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset((page - 1) * limit);

      return { data: rows.map(formatUser), total, page, limit };
    },

    async findById(id) {
      // 💡 Деструктуризация [user] — берём первый элемент массива
      const [user] = await db('users')
        .where({ id })
        .select('id', 'email', 'name', 'role', 'created_at', 'updated_at');
      return user ? formatUser(user) : null;
    },

    async create(data) {
      // 💡 .returning('*') — PostgreSQL возвращает созданную строку
      const [user] = await db('users')
        .insert({
          email: data.email,
          name: data.name,
          role: data.role || 'user',
        })
        .returning(['id', 'email', 'name', 'role', 'created_at', 'updated_at']);
      return formatUser(user);
    },

    async update(id, data) {
      const [user] = await db('users')
        .where({ id })
        .update(data)
        .returning(['id', 'email', 'name', 'role', 'created_at', 'updated_at']);
      return user ? formatUser(user) : null;
    },

    async remove(id) {
      // 💡 .del() возвращает количество удалённых строк
      const deleted = await db('users').where({ id }).del();
      return deleted > 0;
    },
  };
}

/**
 * 💡 Конвертируем snake_case (из БД) → camelCase (для API).
 *    Это единственное место, где мы приводим формат —
 *    сервисы и контроллеры работают с camelCase.
 */
function formatUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

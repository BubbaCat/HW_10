import { prisma } from '../../prisma.js';

/**
 * Prisma-реализация UserRepository.
 *
 * 💡 СРАВНЕНИЕ: Knex vs Prisma
 *
 *    Knex:   db('users').where({ role }).select(...).orderBy(...).limit(...)
 *            → вы строите SQL пошагово
 *
 *    Prisma: prisma.user.findMany({ where: { role }, select, orderBy, take })
 *            → вы описываете ЧТО хотите получить
 *
 * 💡 КОНТРАКТ (из interfaces.js) — тот же что у stub/knex:
 *    findAll({ page?, limit?, role? }) → { data: User[], total, page, limit }
 *    findById(id)                      → User | null
 *    create({ email, name, role? })    → User
 *    update(id, { email?, name?, role? }) → User | null
 *    remove(id)                        → boolean
 *
 * @returns {import('../interfaces.js').UserRepository}
 */
export function createPrismaUserRepository() {
  return {
    async findAll({ page = 1, limit = 20, role } = {}) {
      // 💡 where — объект, не цепочка .where() как в Knex
      const where = {};
      if (role) where.role = role;

      // 💡 Promise.all — выполняем COUNT и SELECT параллельно
      const [data, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,   // 💡 skip = OFFSET в Knex
          take: limit,                 // 💡 take  = LIMIT в Knex
        }),
        prisma.user.count({ where }),
      ]);

      return {
        data: data.map(formatUser),
        total,
        page,
        limit,
      };
    },

    async findById(id) {
      // 💡 findUnique — по primary key или @unique полю
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? formatUser(user) : null;
    },

    async create({ email, name, role = 'user' }) {
      const user = await prisma.user.create({
        data: { email, name, role },
      });
      return formatUser(user);
    },

    async update(id, data) {
      // 💡 Prisma бросает P2025 если запись не найдена.
      //    Перехватываем и возвращаем null — чтобы контракт совпадал с stub/knex.
      try {
        const user = await prisma.user.update({ where: { id }, data });
        return formatUser(user);
      } catch (err) {
        if (err.code === 'P2025') return null;
        throw err;
      }
    },

    async remove(id) {
      try {
        await prisma.user.delete({ where: { id } });
        return true;
      } catch (err) {
        if (err.code === 'P2025') return false;
        throw err;
      }
    },
  };
}

/**
 * 💡 Prisma возвращает Date-объекты, а API отдаёт ISO-строки.
 *    Stub-репозиторий возвращал строки — Prisma тоже должен.
 */
function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

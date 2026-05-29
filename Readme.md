# Домашнее задание #8: Knex Query Builder + Prisma ORM

**Зачем?**
Вы возьмёте работающий сервер с in-memory репозиториями и перепишете слой данных сначала на Knex (Query Builder), затем на Prisma (ORM) — при этом ни сервис, ни контроллер, ни роуты не изменятся. Это и есть сила Dependency Injection: меняете реализацию, контракт остаётся.

---

## Что нужно сдать

Ссылку на публичный репозиторий на GitHub. Преподаватель проверяет: код, историю коммитов, работоспособность (curl или Postman/Bruno).

В репозитории есть ветка `helper` с полностью готовым решением.

---

## Модель данных

```
users
├── id            serial PRIMARY KEY
├── email         varchar(255) UNIQUE NOT NULL
├── name          varchar(100) NOT NULL
├── role          varchar(20) DEFAULT 'user'   -- "user" | "admin"
├── created_at    timestamptz DEFAULT now()
└── updated_at    timestamptz DEFAULT now()

posts
├── id            serial PRIMARY KEY
├── user_id       integer REFERENCES users(id) ON DELETE CASCADE
├── title         varchar(300) NOT NULL
├── body          text
├── status        varchar(20) DEFAULT 'draft'   -- "draft" | "published"
├── created_at    timestamptz DEFAULT now()
└── updated_at    timestamptz DEFAULT now()

comments
├── id            serial PRIMARY KEY
├── post_id       integer REFERENCES posts(id) ON DELETE CASCADE
├── author_id     integer REFERENCES users(id) ON DELETE SET NULL
├── body          text NOT NULL
└── created_at    timestamptz DEFAULT now()

tags
├── id            serial PRIMARY KEY
├── name          varchar(50) UNIQUE NOT NULL

post_tags
├── post_id       integer REFERENCES posts(id) ON DELETE CASCADE
├── tag_id        integer REFERENCES tags(id) ON DELETE CASCADE
└── PRIMARY KEY (post_id, tag_id)
```

---

## Стартовая точка (уже есть в репозитории)

Запустите сервер:

```bash
npm install
npm start
```

Сервер работает с **stub-репозиториями** (данные в `Map`). Все 13 эндпоинтов возвращают корректные ответы. Данные живут в памяти и сбрасываются при перезапуске.

```
src/
├── server.js                     # Composition Root
├── app.js                        # Fastify app factory
├── errors/index.js               # Кастомные ошибки
├── schemas/
│   ├── user.schema.js
│   ├── post.schema.js
│   ├── comment.schema.js
│   └── tag.schema.js
├── plugins/zod-validator.js      # Zod → preHandler
├── repositories/
│   ├── interfaces.js             # Контракты (JSDoc)
│   └── stub/
│       ├── user.repository.stub.js
│       ├── post.repository.stub.js
│       ├── comment.repository.stub.js
│       └── tag.repository.stub.js
├── services/
│   ├── user.service.js
│   ├── post.service.js
│   ├── comment.service.js
│   └── tag.service.js
├── controllers/
│   ├── user.controller.js
│   ├── post.controller.js
│   ├── comment.controller.js
│   └── tag.controller.js
└── routes/
    ├── user.routes.js
    ├── post.routes.js
    ├── comment.routes.js
    └── tag.routes.js
```

В `src/repositories/interfaces.js` описаны контракты — какие методы и какие аргументы/возврат должен иметь каждый репозиторий.

**Ваша задача** — создать новые файлы реализаций (`repositories/knex/*.js` и `repositories/prisma/*.js`) и подменить их в `server.js`. Сервисы, контроллеры и роуты **не меняются**.
Рекомендую делать knex и prisma в разных ветках.

---

## Часть 1 — Knex: Query Builder, миграции, сиды

> **Цель:** переписать stub-репозитории на Knex. Создать миграции и сиды. Сервер продолжает работать — но данные теперь в PostgreSQL. Делать в отдельной ветке. feature/knex

### Что нужно сделать (пошагово)

**Шаг 1. Установите Knex и pg**

```bash
npm install knex pg
```

**Шаг 2. Переменные окружения**

Добавьте в `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blog_db
DB_USER=postgres
DB_PASSWORD=your_password
```

Создайте базу `blog_db` в PostgreSQL.

**Шаг 3. Knexfile и подключение**

Создайте `knexfile.js` в корне проекта:

```js
import 'dotenv/config';

export default {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' },
};
```

Создайте `src/db.js`:
```js
import knex from 'knex';
import 'dotenv/config';

export const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
});
```

Добавьте скрипты в `package.json`:
```json
"migrate": "knex migrate:latest --knexfile knexfile.js",
"migrate:rollback": "knex migrate:rollback --knexfile knexfile.js",
"migrate:make": "knex migrate:make --knexfile knexfile.js",
"seed": "knex seed:run --knexfile knexfile.js"
```

**Шаг 4. Миграция**

```bash
npm run migrate:make create_initial_schema
```

Реализуйте `up` и `down`:
- `up`: создайте все 5 таблиц + триггер `update_updated_at()` для `users` и `posts`
- `down`: удалите таблицы и функцию триггера

```bash
npm run migrate
```

**Шаг 5. Сид**

Создайте `seeds/001_blog_data.js`:
- 5 пользователей
- 10 постов (по 2 на пользователя)
- 20 комментариев
- 5 тегов
- Связи `post_tags`

```bash
npm run seed
```

**Шаг 6. Реализуйте Knex-репозитории**

Создайте 4 файла в `src/repositories/knex/`:

```
src/repositories/knex/
├── user.repository.knex.js
├── post.repository.knex.js
├── comment.repository.knex.js
└── tag.repository.knex.js
```

Каждый файл — функция-фабрика, возвращающая объект с **теми же методами**, что и stub (см. `src/repositories/interfaces.js`):

```js
// Пример: src/repositories/knex/user.repository.knex.js
import { db } from '../../db.js';

export function createKnexUserRepository() {
  return {
    async findAll({ page = 1, limit = 20, role } = {}) {
      // Knex-запрос
    },
    async findById(id) { /* ... */ },
    async create(data) { /* ... */ },
    async update(id, data) { /* ... */ },
    async remove(id) { /* ... */ },
  };
}
```

Для `post.repository.knex.js`:
- `findAll` — JOIN с `users` для получения `author_name`; если передан `tagId` — JOIN с `post_tags`
- `findById` — два запроса: пост + автор, затем теги
- `createWithTags` — **транзакция**: создаёте пост, затем вставляете связи в `post_tags`

**Шаг 7. Подключите Knex-репозитории**

В `src/server.js` замените импорты:

```js
// Было (stub):
// import { createUserRepository } from './repositories/stub/user.repository.stub.js';

// Стало (knex):
import { createKnexUserRepository } from './repositories/knex/user.repository.knex.js';

const userRepo = createKnexUserRepository();
```

Запустите сервер: `npm start` — все эндпоинты должны работать как раньше, но данные теперь в PostgreSQL.

**Шаг 8. Проверьте**

- Создайте пользователя через `POST /api/users`
- Создайте пост через `POST /api/posts`
- Перезапустите сервер — данные остались (в отличие от stub)

### Контрольные точки Части 1

- [ ] `npm run migrate` — миграция накатывается
- [ ] `npm run migrate:rollback` — откатывается корректно
- [ ] `npm run seed` — данные заполняются
- [ ] `GET /api/posts/:id` — возвращает пост + автор + теги (JOIN)
- [ ] `GET /api/posts?tagId=1` — фильтрация по тегу через JOIN с `post_tags`
- [ ] `POST /api/posts` с `tagIds` — транзакция `createWithTags` работает
- [ ] Ни в одном `.js` файле (кроме миграции) нет `knex.raw()` или raw SQL-строк
- [ ] После перезапуска сервера данные сохраняются (PostgreSQL)

---

## Часть 2 — Prisma: ORM, типы, N+1

> **Цель:** переписать Knex-репозитории на Prisma. Сравнить подходы. Обнаружить и устранить N+1. Делать в отдельной ветке. feature/prisma

### Что нужно сделать (пошагово)

**Шаг 1. Установите Prisma**

```bash
npm install prisma @prisma/client
npx prisma init
```

Создайте отдельную базу (или schema) `blog_prisma`.

**Шаг 2. Опишите схему в `prisma/schema.prisma`**

Опишите модели `User`, `Post`, `Comment`, `Tag`, `PostTag` с:
- `@map()` для snake_case колонок
- `@@map()` для таблиц
- `@updatedAt` для `updated_at`
- Связи: `User → Post` (1:N), `Post → Comment` (1:N), `User → Comment` (1:N), `Post ↔ Tag` (M:N через `PostTag`)

```bash
npx prisma migrate dev --name init
```

**Шаг 3. Создайте `src/prisma.js`**

```js
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});
```

**Шаг 4. Сид для Prisma**

Создайте `prisma/seed.js` — аналогичные данные как в Knex-сиде.

```bash
npx prisma db seed
```

**Шаг 5. Реализуйте Prisma-репозитории**

Создайте 4 файла в `src/repositories/prisma/`:

```
src/repositories/prisma/
├── user.repository.prisma.js
├── post.repository.prisma.js
├── comment.repository.prisma.js
└── tag.repository.prisma.js
```

Каждый файл — функция-фабрика с **теми же методами**, что и stub/knex:

```js
// Пример: src/repositories/prisma/user.repository.prisma.js
import { prisma } from '../../prisma.js';

export function createPrismaUserRepository() {
  return {
    async findAll({ page = 1, limit = 20, role } = {}) {
      const where = {};
      if (role) where.role = role;

      const [data, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return { data, total, page, limit };
    },
    // ... остальные методы
  };
}
```

Для `post.repository.prisma.js`:
- `findAll` — `include: { user, _count: { select: { comments: true } } }`
- `findById` — вложенный `include`: `user`, `comments` с `author`, `tags` с `tag`
- `create` — `tags: { create: tagIds.map(id => ({ tag: { connect: { id } } })) }`
- `createWithTags` — `prisma.$transaction(async (tx) => { ... })`

**Шаг 6. Подключите Prisma-репозитории**

В `src/server.js`:
```js
import { createPrismaUserRepository } from './repositories/prisma/user.repository.prisma.js';

const userRepo = createPrismaUserRepository();
```

**Шаг 7. N+1 — найдите и исправьте**

Создайте `src/demos/n-plus-one.js`:

**Плохой вариант (N+1):**
```js
const posts = await prisma.post.findMany();
for (const post of posts) {
  const user = await prisma.user.findUnique({ where: { id: post.userId } });
  console.log(`"${post.title}" by ${user.name}`);
}
// N+1 запросов!
```

**Хороший вариант (include):**
```js
const posts = await prisma.post.findMany({
  include: { user: { select: { name: true } } },
});
for (const post of posts) {
  console.log(`"${post.title}" by ${post.user.name}`);
}
// 1–2 запроса
```

Сравните время и количество запросов (включите `log: ['query']`).

### Контрольные точки Части 2

- [ ] `npx prisma migrate dev` — миграция создана
- [ ] `npx prisma db seed` — данные заполнены
- [ ] Все 13 эндпоинтов работают с Prisma
- [ ] `GET /api/posts/:id` — один запрос, все связи через `include`
- [ ] `POST /api/posts` с `tagIds` — M:N через `connect`
- [ ] `src/demos/n-plus-one.js` — видно разницу N+1 vs `include`
- [ ] Сервисы, контроллеры, роуты **не изменились** — только репозитории

---

## Часть 3 (Доп.) — Сравнение и бенчмарк

### Сравнительная таблица (в README.md)

| Критерий         | Raw SQL | Knex         | Prisma        |
| ---------------- | ------- | ------------ | ------------- |
| Типобезопасность | ❌      | ⚠️ частично  | ✅ автоген     |
| Контроль над SQL | ✅      | ✅           | ⚠️ ограничен  |
| N+1 из коробки   | ❌      | ❌           | ✅ `include`   |
| Миграции         | ручные  | ✅           | ✅            |
| Бойлерплейт      | много   | средне       | мало          |

### Бенчмарк

Создайте `src/demos/benchmark.js`:
- 100 запросов `findAll()` через Knex
- 100 запросов `findAll()` через Prisma
- Сравните время

### Вопросы для самопроверки (в README.md)

1. Почему сервисы и контроллеры **не изменились** при замене stub → Knex → Prisma? Какой принцип это обеспечивает?
2. Что такое N+1 проблема? Покажите «плохой» и «хороший» вариант из вашего кода.
3. Когда вы выберете Knex, а когда Prisma? (3–4 предложения с примерами)
4. `prisma migrate dev` vs `prisma migrate deploy` — в чём разница?
5. Как Knex защищает от SQL-инъекций?

### Контрольные точки Части 3

- [ ] Сравнительная таблица заполнена
- [ ] Бенчмарк выполнен, результаты в README
- [ ] 5 ответов на вопросы — своими словами

---

## Структура файлов (итоговая)

```
migrations/                                  # Knex-миграции
seeds/
└── 001_blog_data.js                         # Knex-сид
prisma/
├── schema.prisma                            # Prisma-схема
├── seed.js                                  # Prisma-сид
└── migrations/                              # Prisma-миграции
src/
├── server.js                                # 🏁 Composition Root
├── app.js                                   # Fastify app factory
├── db.js                                    # Knex-подключение
├── prisma.js                                # Prisma Client
├── errors/index.js
├── schemas/
│   ├── user.schema.js
│   ├── post.schema.js
│   ├── comment.schema.js
│   └── tag.schema.js
├── plugins/zod-validator.js
├── repositories/
│   ├── interfaces.js                        # 📋 Контракты
│   ├── stub/                                # 💾 In-memory (стартовые)
│   │   ├── user.repository.stub.js
│   │   ├── post.repository.stub.js
│   │   ├── comment.repository.stub.js
│   │   └── tag.repository.stub.js
│   ├── knex/                                # 📦 Студенты реализуют
│   │   ├── user.repository.knex.js
│   │   ├── post.repository.knex.js
│   │   ├── comment.repository.knex.js
│   │   └── tag.repository.knex.js
│   └── prisma/                              # 📦 Студенты реализуют
│       ├── user.repository.prisma.js
│       ├── post.repository.prisma.js
│       ├── comment.repository.prisma.js
│       └── tag.repository.prisma.js
├── services/
│   ├── user.service.js
│   ├── post.service.js
│   ├── comment.service.js
│   └── tag.service.js
├── controllers/
│   ├── user.controller.js
│   ├── post.controller.js
│   ├── comment.controller.js
│   └── tag.controller.js
├── routes/
│   ├── user.routes.js
│   ├── post.routes.js
│   ├── comment.routes.js
│   └── tag.routes.js
└── demos/
    ├── n-plus-one.js
    └── benchmark.js
knexfile.js
.env
.env.example
.gitignore
package.json
README.md
```

---

## Дедлайн

06.06.2026, 12:00 по МСК

---

## Как сдать

1. Убедитесь, что репозиторий **публичный**.
2. Пришлите ссылку на репозиторий преподавателю.
3. В `README.md` — ответы на вопросы + сравнительная таблица.

---

## Полезные ресурсы

- [Knex — документация](https://knexjs.org/)
- [Prisma — документация](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [N+1 проблема](https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance)
- [PostgreSQL — документация](https://www.postgresql.org/docs/)

# 💡 Подсказки: Prisma ORM

Эта ветка (`helper/prisma`) содержит **полное решение** Части 2 ДЗ.
Если вы застряли — смотрите файлы ниже как референс.

## Что было изменено относительно master

| Файл | Что изменилось |
|------|---------------|
| `src/server.js` | Импорты: `stub` → `prisma`. **Других изменений нет.** |
| `src/prisma.js` | **НОВЫЙ** — Prisma Client singleton |
| `prisma/schema.prisma` | **НОВЫЙ** — модели User, Post, Comment, Tag, PostTag |
| `prisma/seed.js` | **НОВЫЙ** — тестовые данные |
| `src/repositories/prisma/*.js` | **НОВЫЕ** — 4 репозитория с Prisma |
| `src/demos/n-plus-one.js` | **НОВЫЙ** — демо N+1 vs include |
| `src/services/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |
| `src/controllers/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |
| `src/routes/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |
| `src/schemas/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |

**Вывод:** мы написали 4 файла (репозитории) + schema.prisma + prisma.js — и сервер работает с PostgreSQL. Сервисы, контроллеры, роуты — **те же файлы**, что и в stub- и Knex-версиях. Dependency Injection работает!

---

## Как запустить

```bash
# 1. Настройте DATABASE_URL в .env
#    DATABASE_URL="postgresql://postgres:password@localhost:5432/blog_prisma"
# 2. Создайте базу: createdb blog_prisma

# 3. Сгенерируйте миграцию + клиент:
npx prisma migrate dev --name init

# 4. Заполните данными:
npx prisma db seed

# 5. Запустите:
npm start
```

---

## Ключевые приёмы (читайте комментарии в коде)

### 1. schema.prisma → SQL
```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")
  posts     Post[]   // 1:N связь
}
```
- `@map("created_at")` — маппинг на snake_case колонку
- `@@map("users")` — маппинг на таблицу
- `@updatedAt` — Prisma автоматически обновит поле

### 2. include = JOIN
```js
// Загрузить пост + автора + кол-во комментариев:
prisma.post.findMany({
  include: {
    user: { select: { name: true } },
    _count: { select: { comments: true } },
  },
})
```
Эквивалент: `SELECT posts.*, users.name, COUNT(comments.*) FROM posts JOIN users JOIN comments`

### 3. connect = INSERT в link-таблицу
```js
// Создать пост И привязать теги:
prisma.post.create({
  data: {
    title: '...',
    tags: {
      create: [
        { tag: { connect: { id: 1 } } },
        { tag: { connect: { id: 2 } } },
      ],
    },
  },
})
```
Эквивалент: `INSERT INTO posts (...) + INSERT INTO post_tags (post_id, tag_id) VALUES (...)`

### 4. $transaction = атомарность
```js
prisma.$transaction(async (tx) => {
  const post = await tx.post.create({ data: {...} });
  await tx.postTag.createMany({ data: [...] });
  // Если что-то упадёт — откатится ВСЁ
});
```

### 5. N+1 → include
```js
// ❌ ПЛОХО: N+1 (1 + N запросов)
const posts = await prisma.post.findMany();
for (const p of posts) {
  const user = await prisma.user.findUnique({ where: { id: p.userId } });
}

// ✅ ХОРОШО: 1–2 запроса
const posts = await prisma.post.findMany({
  include: { user: true },
});
```

---

## Сравнение: Knex vs Prisma (один и тот же метод)

### findAll({ status: 'published', page: 1, limit: 20 })

**Knex:**
```js
db('posts')
  .where({ status: 'published' })
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(0);
```

**Prisma:**
```js
prisma.post.findMany({
  where: { status: 'published' },
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: 0,
});
```

---

## Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Invalid prisma.post.findMany() invocation` | Нет Prisma Client | Запустите `npx prisma generate` |
| `P2025: Record not found` | Запись не найдена для update/delete | Перехватывайте `err.code === 'P2025'` |
| `Unique constraint failed` | Дубликат unique-поля | Проверьте перед create через findUnique |
| N+1 в логах | findMany + цикл с findUnique | Замените на `include` |
| `Argument `tags` is not valid` | Неправильный синтаксис M:N | Используйте `{ create: [{ tag: { connect: { id } } }] }` |

---

## Коды ошибок Prisma (часто встречающиеся)

| Код | Значение |
|-----|----------|
| P2025 | Record not found (update/delete) |
| P2002 | Unique constraint violation |
| P2003 | Foreign key constraint failed |
| P2014 | Required relation violation |

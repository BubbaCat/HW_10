# 💡 Подсказки: Knex Query Builder

Эта ветка (`helper/knex`) содержит **полное решение** Части 1 ДЗ.
Если вы застряли — смотрите файлы ниже как референс.

## Что было изменено относительно master

| Файл | Что изменилось |
|------|---------------|
| `src/server.js` | Импорты: `stub` → `knex`. **Других изменений нет.** |
| `src/db.js` | **НОВЫЙ** — Knex-подключение к PostgreSQL |
| `knexfile.js` | **НОВЫЙ** — конфиг для CLI (`migrate`, `seed`) |
| `migrations/...js` | **НОВЫЙ** — CREATE TABLE + триггер |
| `seeds/001_blog_data.js` | **НОВЫЙ** — тестовые данные |
| `src/repositories/knex/*.js` | **НОВЫЕ** — 4 репозитория с Knex |
| `src/services/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |
| `src/controllers/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |
| `src/routes/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |
| `src/schemas/*.js` | ❌ **НЕ ИЗМЕНЕНЫ** — те же файлы |

**Вывод:** мы написали 4 файла (репозитории) + 3 конфига (db, knexfile, migration) — и сервер работает с PostgreSQL. Сервисы и контроллеры даже не узнали о замене.

---

## Как запустить

```bash
# 1. Настройте .env (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
# 2. Создайте базу: createdb blog_db
# 3. Накатите миграцию:
npm run migrate

# 4. Заполните данными:
npm run seed

# 5. Запустите:
npm start
```

---

## Ключевые приёмы (читайте комментарии в коде)

### 1. snake_case → camelCase
БД хранит `created_at`, а API отдаёт `createdAt`. Функция `formatUser()` / `formatPost()` делает конвертацию. Сервисы ничего не знают про snake_case.

### 2. JOIN для связанных данных
```js
// Пост + автор:
db('posts as p')
  .join('users as u', 'p.user_id', 'u.id')
  .select('p.*', 'u.name as authorName')

// Фильтр по тегу (через link-таблицу):
db('posts as p')
  .join('post_tags as pt', 'p.id', 'pt.post_id')
  .where('pt.tag_id', tagId)
```

### 3. Транзакция
```js
db.transaction(async (trx) => {
  const [post] = await trx('posts').insert({...}).returning('*');
  await trx('post_tags').insert([...]);
  // Если что-то упадёт — оба INSERT откатятся
});
```

### 4. Пагинация
```js
query
  .orderBy('created_at', 'desc')
  .limit(limit)              // сколько строк
  .offset((page - 1) * limit); // пропустить сколько
```

### 5. Проверка перед throw
```js
// Stub: if (!store.has(id)) return null;
// Knex: const [row] = await db('users').where({ id }); return row || null;
```

---

## Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `column "createdAt" does not exist` | Используете camelCase в SQL | БД → snake_case, форматте в JS |
| `insert into "users" (...) returning * — syntax error` | Не PostgreSQL | `returning()` работает только в PG |
| N+1 в findById | Один мега-JOIN | Разбейте на 2–3 простых запроса |
| `Unhandled rejection` в транзакции | trx не передан в insert | Все запросы внутри — через `trx` |

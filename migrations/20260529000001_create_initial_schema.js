/**
 * Миграция: создаёт все таблицы блога.
 *
 * 💡 ПОДСКАЗКА: knex.raw() здесь — ОК, потому что Knex не умеет
 *    декларативно создавать триггеры. В репозиториях raw() не нужен.
 *
 * Запуск:
 *   npm run migrate           — накатить
 *   npm run migrate:rollback  — откатить
 *
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  // ── Helper: триггер для auto-update updated_at ──────────
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ── users ───────────────────────────────────────────────
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email', 255).unique().notNullable();
    table.string('name', 100).notNullable();
    table.string('role', 20).defaultTo('user');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);

  // ── posts ───────────────────────────────────────────────
  await knex.schema.createTable('posts', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('title', 300).notNullable();
    table.text('body');
    table.string('status', 20).defaultTo('draft');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE TRIGGER posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);

  // ── comments ────────────────────────────────────────────
  await knex.schema.createTable('comments', (table) => {
    table.increments('id').primary();
    table.integer('post_id').unsigned().notNullable()
      .references('id').inTable('posts').onDelete('CASCADE');
    table.integer('author_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.text('body').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── tags ────────────────────────────────────────────────
  await knex.schema.createTable('tags', (table) => {
    table.increments('id').primary();
    table.string('name', 50).unique().notNullable();
  });

  // ── post_tags (M:N) ─────────────────────────────────────
  await knex.schema.createTable('post_tags', (table) => {
    table.integer('post_id').unsigned().notNullable()
      .references('id').inTable('posts').onDelete('CASCADE');
    table.integer('tag_id').unsigned().notNullable()
      .references('id').inTable('tags').onDelete('CASCADE');
    table.primary(['post_id', 'tag_id']);
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  // 💡 ПОДСКАЗКА: удаляем в обратном порядке — сначала зависимые таблицы
  await knex.schema.dropTableIfExists('post_tags');
  await knex.schema.dropTableIfExists('comments');
  await knex.schema.dropTableIfExists('posts');
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at()');
}

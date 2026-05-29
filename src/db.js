import knex from 'knex';
import 'dotenv/config';

// 💡 ПОДСКАЗКА: это singleton-подключение. Импортируй { db } в репозиториях.
//    Каждый репозиторий НЕ создаёт своё подключение — он использует это.

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

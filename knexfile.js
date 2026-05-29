import 'dotenv/config';

// 💡 ПОДСКАЗКА: knexfile — это конфиг для CLI-команд knex (migrate, seed).
//    Само подключение к БД в рантайме — в src/db.js

export default {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  migrations: {
    directory: './migrations',
  },
  seeds: {
    directory: './seeds',
  },
};

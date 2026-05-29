import 'dotenv/config';
import { createApp } from './app.js';

// ─── Repository layer (Knex) ───────────────────────────────
// 💡 ПОДСКАЗКА: заменили stub на knex — сервисы/контроллеры/роуты НЕ тронутЫ
import { createKnexUserRepository } from './repositories/knex/user.repository.knex.js';
import { createKnexPostRepository } from './repositories/knex/post.repository.knex.js';
import { createKnexCommentRepository } from './repositories/knex/comment.repository.knex.js';
import { createKnexTagRepository } from './repositories/knex/tag.repository.knex.js';

// ─── Service layer (БЕЗ ИЗМЕНЕНИЙ — те же файлы что и на master) ──
import { createUserService } from './services/user.service.js';
import { createPostService } from './services/post.service.js';
import { createCommentService } from './services/comment.service.js';
import { createTagService } from './services/tag.service.js';

// ─── Controller layer (БЕЗ ИЗМЕНЕНИЙ) ──────────────────────
import { createUserController } from './controllers/user.controller.js';
import { createPostController } from './controllers/post.controller.js';
import { createCommentController } from './controllers/comment.controller.js';
import { createTagController } from './controllers/tag.controller.js';

// ─── Composition Root ──────────────────────────────────────
// 💡 Единственное место, где мы выбираем реализацию.
//    Было: createStubUserRepository()
//    Стало: createKnexUserRepository()
const userRepo = createKnexUserRepository();
const postRepo = createKnexPostRepository();
const commentRepo = createKnexCommentRepository();
const tagRepo = createKnexTagRepository();

// Services
const userService = createUserService({ userRepo });
const postService = createPostService({ postRepo });
const commentService = createCommentService({ commentRepo });
const tagService = createTagService({ tagRepo, postRepo });

// Controllers
const userController = createUserController({ userService });
const postController = createPostController({ postService });
const commentController = createCommentController({ commentService });
const tagController = createTagController({ tagService });

// App
const app = await createApp({
  userController,
  postController,
  commentController,
  tagController,
});

// ─── Start ─────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`🟢 Server (Knex) running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

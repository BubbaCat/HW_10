import 'dotenv/config';
import { createApp } from './app.js';

// ─── Repository layer (Prisma) ─────────────────────────────
// 💡 ПОДСКАЗКА: заменили stub на prisma — сервисы/контроллеры/роуты НЕ ТРОНУТЫ
import { createPrismaUserRepository } from './repositories/prisma/user.repository.prisma.js';
import { createPrismaPostRepository } from './repositories/prisma/post.repository.prisma.js';
import { createPrismaCommentRepository } from './repositories/prisma/comment.repository.prisma.js';
import { createPrismaTagRepository } from './repositories/prisma/tag.repository.prisma.js';

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
//    Стало: createPrismaUserRepository()
const userRepo = createPrismaUserRepository();
const postRepo = createPrismaPostRepository();
const commentRepo = createPrismaCommentRepository();
const tagRepo = createPrismaTagRepository();

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
  app.log.info(`🟣 Server (Prisma) running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

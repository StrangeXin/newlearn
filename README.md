# 智学闯关 · AI 学习平台

游戏化的内部员工学习平台（多学科可扩展）。详见 [`PRD.md`](./PRD.md)（产品共识）、[`TASKS.md`](./TASKS.md)（任务拆解）、[`CLAUDE.md`](./CLAUDE.md)（开发指引）。

## 技术栈

- Next.js 16（App Router, TypeScript）+ Tailwind CSS 4
- PostgreSQL 16 + Prisma 7（本地用 Docker 起库）
- 打分服务抽象：`mock`（测试/演示）/ `deepseek`（生产），由 `SCORING_PROVIDER` 切换
- 测试：Vitest

## 本地启动

```bash
# 1) 准备环境变量
cp .env.example .env        # 按需填入 DEEPSEEK_API_KEY

# 2) 安装依赖
pnpm install

# 3) 起本地数据库（Docker）
pnpm db:up

# 4) 迁移 + 生成客户端 + 灌种子数据
pnpm db:migrate
pnpm db:seed

# 5) 启动开发服务器
pnpm dev          # http://localhost:3000
```

## 常用脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm db:up` / `pnpm db:down` | 起/停 Docker Postgres |
| `pnpm db:migrate` | 执行 Prisma 迁移（开发） |
| `pnpm db:reset` | 重置数据库并重灌种子 |
| `pnpm db:seed` | 灌种子数据（含 AI 学科 100 关键词与演示账号） |
| `pnpm db:studio` | 打开 Prisma Studio 看数据 |
| `pnpm test` | 运行单元测试（Mock 评分器） |
| `pnpm typecheck` | TypeScript 类型检查 |

## 演示账号

灌种子后可用（首登强制改密，默认密码见 `.env` 的 `DEFAULT_PASSWORD`）：

- 超管 / 管理员、若干样例员工 —— 具体名单见 `prisma/seed.ts`。

## 环境变量

见 [`.env.example`](./.env.example)。关键项：`DATABASE_URL`、`SCORING_PROVIDER`、`DEEPSEEK_API_KEY`、`AUTH_SECRET`、`DEFAULT_PASSWORD`。

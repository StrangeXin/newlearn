# 智学闯关 · AI 学习平台

游戏化的内部员工学习平台（多学科可扩展）。详见 [`PRD.md`](./PRD.md)（产品共识）、[`TASKS.md`](./TASKS.md)（任务拆解）、[`CLAUDE.md`](./CLAUDE.md)（开发指引）。

在线体验：https://newlearn.vercel.app （登录页有演示账号可一键登录）。

> **商业授权 / 付费部署 / 定制开发**：本项目以 Apache-2.0 开源，欢迎学习与二次开发；如需商业授权、托管部署或按需定制，欢迎联系：
> 邮箱 hexin@rxyai.com · 电话 +86 152 1113 5683

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

见 [`.env.example`](./.env.example)。

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | Postgres 连接串。本地 Docker 为 `:5433`；线上用托管库（如 Neon）。 |
| `SCORING_PROVIDER` | `mock`（测试/演示，无需 key） \| `deepseek`（生产真实打分）。 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | `SCORING_PROVIDER=deepseek` 时必填。 |
| `AUTH_SECRET` | 会话签名密钥，任意 32+ 字节随机串。**生产务必换成强随机值。** |
| `DEFAULT_PASSWORD` | 白名单账号的共享默认密码（首登强制改密）。 |
| `REQUIRE_PASSWORD_CHANGE` | 是否强制首登改密，默认 `true`。 |
| `CRON_SECRET` | 保护 `/api/cron/settle` 周结算任务；Vercel Cron 自动以 `Bearer` 形式带上。 |
| `IMAGE_BASE_URL` / `IMAGE_API_KEY` | 可选，管理后台「关键词手绘配图」生成功能用。 |

生成随机密钥：`openssl rand -base64 32`。

## 部署到 Vercel

本项目可直接部署到 Vercel（Next.js 16 + 托管 Postgres）。

1. **导入仓库**：在 [Vercel](https://vercel.com/new) 选择本仓库 Import，框架自动识别为 Next.js。
2. **建数据库**：项目 → Storage → Create Database → Postgres（Neon），创建后 `DATABASE_URL` 等会自动注入到环境变量。
3. **配置环境变量**（Project Settings → Environment Variables）：
   - `SCORING_PROVIDER`、`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`
   - `AUTH_SECRET`（强随机）、`DEFAULT_PASSWORD`、`REQUIRE_PASSWORD_CHANGE`、`CRON_SECRET`（强随机）
4. **迁移 + 灌种子**：首次部署后，在本地用线上连接串执行一次（`DATABASE_URL` 用 Neon 的 **非连接池 / direct** 串）：
   ```bash
   DATABASE_URL="<线上 direct 连接串>" pnpm prisma migrate deploy
   DATABASE_URL="<线上 direct 连接串>" pnpm db:seed
   ```
   或用 `vercel env pull .env.production` 拉下来再跑。
5. **周结算**：`vercel.json` 已配置每周日的 Cron 触发 `/api/cron/settle`（依赖已设置的 `CRON_SECRET`）。

> 构建时 `postinstall` 会自动 `prisma generate`，生成的客户端不入库。

## 许可证

[Apache License 2.0](./LICENSE)。

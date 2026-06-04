# CLAUDE.md

本文件为 Claude Code 在本仓库工作时提供指引。

## 项目是什么

游戏化的内部员工 **AI 学习平台**（设计为多学科可扩展：AI / 医学 / 心理学等）。
核心方法论来自麦肯锡「了解一个行业先总结 100 个关键词」：系统内置某学科 100 个关键词（分 5 章，每章 20 个），员工每周完成一章——针对每个关键词提交外部检索后的学习笔记，由 DeepSeek 进行 1–100 分打分并追问，最终分 ≥60 即得 1 积分；积分按 1:1 兑换报销额度；每章前 3 名额外奖励 +100 积分。

**当前状态**：规划完成、尚无代码。先读 `PRD.md`（完整产品共识）与 `TASKS.md`（竖切片任务拆解）。

## 关键文档

- `PRD.md` — 唯一的需求事实来源（13 节 + 数据模型草图）。任何功能行为以它为准。
- `TASKS.md` — 按 tracer-bullet 竖切片拆的任务与建议执行顺序（S0→S13）。

## 计划技术栈（见 PRD §2）

- Next.js（App Router, TypeScript）全栈
- Postgres + Prisma ORM
- Tailwind（游戏化闯关风、明亮色、PC/移动端均完整响应式）
- AI 评分走 `ScoringService` 抽象：`DeepSeekScoringService`（生产）/ `MockScoringService`（测试与本地演示），由 `SCORING_PROVIDER` 环境变量切换

## 环境变量约定

- `DATABASE_URL` — Postgres 连接串（本地：`localhost:5433`）
- `DEEPSEEK_API_KEY` — DeepSeek 密钥（放 `.env`，**绝不入库**）
- `SCORING_PROVIDER` — `mock` | `deepseek`

## 环境/工具坑（本项目实测，省得重踩）

- **本地 DB 端口是 5433，不是 5432**：本机有原生 Postgres 占着 `127.0.0.1:5432`，`localhost` 会优先命中它导致 Prisma P1010 鉴权失败。docker-compose 已映射到 5433。
- **Prisma 7 运行时必须用 driver adapter**：`new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`。**不支持** `datasourceUrl`/裸 `new PrismaClient()`；客户端也不会自动读 env。统一用 `@/lib/db` 的单例。
- **Prisma 7 generator 是 `prisma-client`**（输出 `src/generated/prisma`，已 gitignore），连接串在 `prisma.config.ts`（dotenv）里给 CLI 用；客户端从 `@/generated/prisma/client` 导入。
- **种子/脚本用 tsx 跑**需自己 `import "dotenv/config"`（tsx 不自动加载 .env）。
- **pnpm 11 构建脚本**：原生包（sharp/prisma/esbuild/pg 等）需在 `pnpm-workspace.yaml` 的 `allowBuilds` 里置 `true`。

## 关键业务规则（最易踩坑，务必遵守 PRD）

- **及格线**：最终分 ≥60 才记 1 积分；<60 可**无限重提**，**取历史最高分**。
- **追问**：DeepSeek 按笔记薄弱点**动态生成 1–3 个**追问；终评综合「原笔记 + 追问回答」。
- **节奏**：管理员开启学科时设开始日；**自然周（周一~周日）**为界，**顺序解锁**，本周内可提前干完当周章但不能跳章。
- **排名**：周日夜结算；仅完成该章**全部 20 词**者入排名，按 20 词最终分平均值取 top3，各 +100 积分；**并列均给 +100**（不稀释、不限人数）。
- **补进**：旧章保持解锁可随时补完赚积分，但错过当周排名不补。
- **积分/兑换**：1 积分=1 元；可多次部分兑换；员工申请→管理员审批→扣分。
- **同伴可见性（防抄袭）**：仅自己完成某关键词后，才能看他人该词笔记。
- **公开身份**：排行榜只公开靠前/完成者真名；落后者低分不公开。
- **笔记字数**：100–5000 字。
- **登录**：白名单 + 共享默认密码 `Aa123456!`；首登强制改密。

## 约定

- 全站中文 UI。
- 移动端是一等公民，不是「能看就行」。
- 改动业务行为时同步更新 `PRD.md`；完成任务时勾选 `TASKS.md`。
- **种子内容按章分文件**：`prisma/seed-data/<学科>/chapter-N.json`（每文件一章/20词），避免单文件过大；`seed.ts` 用 `loadChapters(学科)` 目录扫描按 index 组装。加学科只需新建目录。

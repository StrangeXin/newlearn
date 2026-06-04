# 任务拆解（竖切片 / Tracer Bullet）

> 来源：`PRD.md` v1 共识稿。
> 原则：尽量每个切片是一条**端到端能跑通、能演示**的薄线；按依赖顺序排列。
> 标记：`[ ]` 待办 `[~]` 进行中 `[x]` 完成。

---

## S0 · 项目骨架（Walking Skeleton）
**目标**：一个能跑起来、能连库、能部署的空壳。 ✅ 已完成
- [x] 初始化 Next.js 16（App Router, TypeScript）+ Tailwind 4
- [x] 接入 Prisma 7 + Postgres（Docker，主机 5433 避开本机原生 PG），跑通 migration
- [x] 全局布局、字体、明亮游戏化主题；响应式骨架；品牌化首页
- [x] `.env` 约定（`DATABASE_URL`、`DEEPSEEK_API_KEY`、`SCORING_PROVIDER`、`AUTH_SECRET`、`DEFAULT_PASSWORD`）
- [x] docker-compose、README、package 脚本（db:up/migrate/seed/test/typecheck）
**验收**：✅ `dev` 首页 200；`build` 通过；DB 连接成功；migration 已执行。
**依赖**：无。

---

## S1 · 数据模型 + 种子数据 ✅
**目标**：PRD §13 全部实体落为 Prisma schema，并有可演示的真实数据。
- [x] Prisma schema：全部实体（经对抗式评审，含幂等积分流水、活跃学科单例、规范化登录名等强化）
- [x] 生成并执行 migration（含后续 profile/记忆/快照/反思等迁移）
- [x] 种子脚本：超管 + 管理员 + 8 名员工（共享默认密码 `Aa123456!`，首登强制改密）
- [x] 种子脚本：真实「AI 行业 100 关键词 + 5 章主题」入库 + 激活当前学科
- [x] 种子脚本：演示答题/积分/排名/兑换/画像数据（李四画像轨迹+待审兑换；赵六/钱七/孙八/周九完成第1章用于排名/同伴笔记）
**验收**：✅ `seed` 一键跑通；10 账号 / 5 章 / 100 词 / 已激活学科，数据已校验。
**依赖**：S0。

> 📦 **额外**：打分库随地基预建（`ScoringService` 接口、确定性 `MockScoringService`、`DeepSeekScoringService`、按 `SCORING_PROVIDER` 切换的工厂）——后续 S3 闭环编排、S4 真实联调均已完成。

---

## S2 · 登录与激活（竖切片） ✅
**目标**：从登录到落地仪表盘的完整身份闭环。
- [x] 登录页（姓名 + 密码），白名单校验（loginName 归一），名单外姓名拒绝
- [x] 首登强制改密流程（`mustChangePassword`，登录即激活 isActivated）
- [x] 基于 `role` 的路由：员工 → `/learn`，管理员/超管 → `/admin`（含越权弹回）
- [x] 会话管理：jose 签发 httpOnly JWT cookie，受保护路由守卫，登出
- [x] 顶栏「修改密码」入口（首登免输当前密码，日常改密需校验）
**验收**：✅ 端到端验证（INTG_PASS）：首登→强制改密；改密后进员工首页见姓名+章节；
员工越权 /admin 弹回 /learn；超管进后台。登录核心逻辑真库 smoke 通过；build 通过。
**依赖**：S1。

> 实现：`src/lib/auth/*`（password/session/user）、`src/app/actions/auth.ts`、
> `(auth)/login`、`(auth)/change-password`、`(app)/{layout,learn,admin}`、`components/app-header`。

---

## S2.5 · 员工资料与个性化记忆基础 ✅
**目标**：把「照本宣科」变成「结合岗位、逐步深入」的个性化引导地基（PRD §14）。
- [x] 数据模型：`EmployeeProfile`（6 项资料）+ `EmployeeMemory`（结构化标签 + 画像摘要），迁移
- [x] onboarding：`/onboarding` 表单 + 保存 action；员工无资料进 `/learn` 被引导去填
- [x] 打分契约扩展：`submitNote`/`finalize` 接 `LearnerContext`；新增 `updateMemory`（每词终评后增量更新）
- [x] Mock 实现保持确定性（个性化追问 + 确定性 updateMemory）；DeepSeek 注入资料+记忆、LLM 维护画像
- [x] `getLearnerContext(userId)` 装配器
**验收**：✅ 端到端 ONBOARD_PASS（无资料→onboarding；填完→放行；已填→跳 learn）；
11 个打分单测全绿（含个性化追问、updateMemory 确定性/增量累积）；typecheck + build 通过。
**依赖**：S2。

---

## S2.6 · 画像快照与成长轨迹 ✅
**目标**：把「AI 对你的画像」做成可追溯、可视化的成长轨迹（PRD §14.5）。
- [x] 数据模型：`EmployeeMemorySnapshot`（关键词/分数/标签/画像/diff/seq），迁移
- [x] `applyMemoryUpdate()`（写当前记忆 + 追加快照，S3 终评后调用）；纯函数 `computeMemoryDiff` + `lineDiff`(git 风格)
- [x] `/profile`：资料**可编辑**、AI 画像**只读**；`/growth`：线性卡片时间线 + 画像 **git 行 diff**
- [x] 顶栏员工导航（成长 / 我的）；种子模拟「李四」6 词学习产出真实轨迹
- [x] 追问提示修正：单词追问只拼上下文、不写元指令；画像改 Markdown 文档
**验收**：✅ 成长页端到端渲染（李四轨迹：图灵机→盲区、图灵测试→待加强、其余→强项，4 项强项累积，git-diff 正常）；
打分+diff 单测 16/16；typecheck + build 通过。
**依赖**：S2.5。

---

## S3 · 学习闭环核心（Mock 评分器）✅（含章节反思）
**目标**：用确定性 Mock 把核心闭环端到端跑通（先不接真 AI），并接入个性化（S2.5/S2.6）。
- [x] `ScoringService` 接口（打分 + 动态追问 + 终评 + updateMemory，已含学习者上下文）
- [x] `MockScoringService`：确定性初分、模拟 1–3 追问、终评
- [x] 闯关地图(进度/积分) → 章节页(20词+状态+进度条) → 关键词页（term+简介，不露考核要点）
- [x] 笔记输入（100–5000 字实时计数校验）
- [x] 提交 → 初分 → 追问问答（拼入资料+记忆）→ 终评 → **applyMemoryUpdate 更新画像/快照**
- [x] 判定：≥60 通过记 1 积分（幂等 BASE 流水）；<60 可无限重提，**取历史最高分**
- [x] 已通过关键词可重提刷高分（`?new=1`）
- [x] 每章完成后「章节总结 + 反思追问（结合岗位）」环节（PRD §14.4）：`ChapterReflection` + `/learn/chapter/[index]/reflect`
**验收**：✅ 端到端 smoke 通过（首过记分/重提不重复发分/取最高分/不及格不记分/每终评一张快照/进度完成）；
单测 16/16；typecheck + build 通过。实现：`src/lib/learn.ts`、`src/app/actions/learn.ts`、
`(app)/learn/{chapter/[index],keyword/[id]}`。
**依赖**：S2.5 / S2.6。

---

## S4 · DeepSeek 真实接入 ✅
**目标**：把 Mock 替换为真 AI，业务代码不变。
- [x] `DeepSeekScoringService`（按 §6.1 rubric；submitNote/finalize/updateMemory，注入学习者档案）
- [x] `SCORING_PROVIDER` 切换（生产 deepseek / 测试与种子 mock）；默认模型 `deepseek-v4-flash`
- [x] 同步等待 + 加载动画（写笔记/答追问按钮态）；终评后画像更新失败不影响评分（try/catch）
- [x] API 失败友好提示 + 重试（action 返回错误态，不丢草稿）
**验收**：✅ 真 key 实测——submitNote(初分75+3高质量追问)、finalize(70/通过/中文反馈)、
updateMemory(结构化标签+markdown画像，兴趣项自动贴合岗位)；JSON/response_format 正常；每调用 4–6s。
单测 16/16；typecheck + build 通过。
**依赖**：S3。

> key 放 `.env`（已 gitignore，不入库）。模型可切 `deepseek-v4-pro` 提质。

---

## S5 · 章节 / 周期机制 ✅
**目标**：顺序解锁 + 自然周边界 + 演示控制。
- [x] 学科 startDate + 自然周（周一~周日）边界计算（`src/lib/schedule.ts`，DST 安全）
- [x] 第 N 周解锁第 N 章；地图锁定未解锁章、章节/关键词页拦截
- [x] 旧章保持解锁、可随时补完（index ≤ 当前周即开放）
- [x] 演示：管理后台「快进/回退一周」（移动 startDate）+ 「结算本章排名」按钮（见 S6）
- [x] 生产：周日夜定时结算 `/api/cron/settle`（CRON_SECRET 保护、幂等结算到期章节）+ `vercel.json` cron（周日 23:00）
**验收**：✅ schedule 单测 4/4；当前第 3 周（1-3 关开放、4-5 锁定）。
**依赖**：S3。

---

## S6 · 周结算与排名 ✅（对抗式审查后加固为一次性快照结算）
**目标**：每章 top3 排名与奖励。
- [x] 结算逻辑：仅完成该章**全部 20 词**（且 completedAt ≤ 本周末）者入排名
- [x] 按 20 词最终分均值标准竞赛排名取 top3，各 +100 积分
- [x] **并列均给 +100**（不稀释、不限人数）
- [x] `RankingResult` 落库（subject/chapter/week/user 唯一）；RANK_BONUS 按 rankingResultId 幂等
- [x] **一次性快照**：整段事务 + advisory 锁，首结算即权威，重复/并发结算不改写不重发
**验收**：✅ 结算 smoke（4 人，含并列 rank3）+ 冻结验证（刷分后再结算名次不变、不重发）。
**依赖**：S5 + S3。

---

## S7 · 积分与兑换 ✅
**目标**：积分流水 + 兑换申请审批闭环。
- [x] `PointsLedger` 余额（1 分=1 元）；可用余额 = 余额 − 待审批占用
- [x] 员工 `/redeem`：余额三连卡 + 申请（物品+金额+可选凭证）+ 我的申请列表
- [x] 管理员 `/admin/redemptions`：待审列表 + 通过/驳回（通过扣分记流水、驳回不扣）
- [x] **并发安全**（对抗式审查后加固）：申请/审批走交互式事务 + per-账户 advisory 锁 + 状态 CAS，
  杜绝 TOCTOU 超额与双花；REDEEM 按 redemptionId 幂等
- [x] learn.ts 发分改自愈式（按 isCompleted 补发，只吞 P2002，避免静默丢分）
- [x] 种子：李四真实 5 积分 + 1 待审兑换演示
**验收**：✅ 功能 + **并发** smoke 全通过（并发申请只成 1 笔、并发审批只扣 1 次余额不为负、
重复审批/超额被拒）；3 路对抗式审查发现的高危并发 bug 已修复；单测 16/16；build 通过。
**依赖**：S3（基础积分）。

---

## S8 · 社交与同伴可见性 ✅
**目标**：防抄袭的解锁式同伴学习 + 公开排行榜。
- [x] 同词他人笔记：**仅自己完成该词后**可见，按分数从高到低（`getPeerNotes`）
- [x] 公开排行榜 `/leaderboard`：积分榜（只展示有分者）+ 各章 top3 冠军
- [x] 落后者低分不公开（积分榜过滤 0 分；落后提醒在管理端统计）
**验收**：未完成看不到他人该词笔记；完成后解锁；排行榜不暴露落后者。
**依赖**：S3 + S6。

---

## S9 · 管理端内容与配置 ✅
**目标**：管理员可维护内容、名单与学科配置。
- [x] 关键词编辑（简介 / 参考考核要点）`/admin/content`
- [x] 员工名单：添加 / 批量导入（去重）/ 重置默认密码
- [x] 设为当前学科 + 设开始日
- [x] 超管：把员工提升/降为管理员（`requireSuperadmin` + setRole）
- [x] 从零新建学科 UI：新建空学科 + JSON 批量导入「5章+100词」+ 关键词逐条编辑
**验收**：✅ 超管渲染 /admin/users、/admin/content 均 200；各 action 已实现。
**依赖**：S1 + S2。

---

## S10 · 管理后台统计（四类）✅
- [x] 全员进度总览（完成率进度条/落后提醒）`/admin/stats`
- [x] 每章排行榜 / top3 获奖名单 `/admin/rankings`
- [x] 分数质量分析（平均分、难词 top5、分数分布）
- [x] 积分与兑换财务统计（发放/已兑换/在册余额/待审批）
**验收**：✅ 统计页超管渲染 200，三大块齐全。
**依赖**：S6 + S7。

---

## S11 · 员工端统计 ✅
- [x] 完成关键词后展示「全员该词均分 / 你超过百分之多少」+ 解锁同伴笔记（S8）
- [x] 排行榜（积分榜 + 各章冠军）形成对比与比拼
**验收**：完成后能看到对应统计与同伴学习材料。
**依赖**：S8 + S10。

---

## S12 · 游戏化 UI 与全端响应式打磨 ✅（基础完成；重动效可再加深）
**目标**：把闯关风做足，PC/移动端均一等可用。
- [x] 闯关地图、进度条、奖牌(🥇🥈🥉)、积分卡、明亮游戏化主题
- [x] PC 与移动端响应式（grid/flex-wrap、移动端导航精简）；404 + 全局加载态
- [x] 动效：得分翻滚+弹跳、通过彩屑(confetti)、积分徽章弹入（ScoreReveal + CSS 关键帧）
**验收**：✅ 移动端完整可用；视觉为游戏化闯关风（轻动效 animate-float-in）。
**依赖**：贯穿。

---

## S13 · 自动化测试与演示路径 ✅
- [x] 单测 22（`pnpm test`，确定性无 DB）：打分 rubric/Mock 确定性/个性化记忆/画像 git-diff/周解锁/章节反思
- [x] 集成测试（`pnpm test:int`，真 DB + Mock，自清理）：学习闭环提交→打分→追问→终评→记分、重提取最高分不重复发分、画像快照
- [x] 「登录到兑换」全链路演示文档 `DEMO.md`
- [x] 兑换并发 / 排名冻结等「碰钱」逻辑：Next 运行时临时路由做并发/幂等端到端 smoke（已记入提交）
**验收**：✅ 单测 22/22 + 集成 3/3 + typecheck + build(18 路由) 全绿。
**依赖**：相关切片完成后补齐。

---

## 状态总览

**全部切片已完成 ✅**（S0–S13 + S2.5/S2.6）。

实际推进顺序：`S0 → S1 → S2 → S2.5 → S2.6 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10 → S11 → S12 → S13`。

整体验证：单测 **22/22**、集成测试 **3/3**、`typecheck` + `build`(18 路由) 全绿；碰钱逻辑（兑换、排名）经对抗式审查加固并以运行时 smoke 验证。演示见 `DEMO.md`。

原列为「可选增强」的三项也已补完：✅ 周日夜定时结算 cron、✅ 从零新建学科录入 UI、✅ 游戏化动效（得分翻滚/彩屑/徽章）。

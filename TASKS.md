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
- [x] 登录页（姓名/手机号 + 密码），白名单校验（loginName/phone 归一），名单外账号拒绝；手机号字段为后续开放注册预留
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

## S14 · 体验增补（v1.2）✅（PRD §15）
- [x] AI 调用审计：`AiCallLog` 表 + 编排层 `AsyncLocalStorage` 归属 + DeepSeek `chat()` 统一记录（提示/推理/返回/用量/耗时/错误）；管理后台 `/admin/ai-logs` 按阶段筛选、逐条展开
- [x] AI 调用 **token 用量统计**（`/admin/ai-logs` 页首）：总调用 / token 总量（输入·输出·推理）/ 失败 + 按类型（`groupBy(phase)`，占比条）+ 按日（`$queryRaw date_trunc`，近 14 天）；全程「token」全称不用「tok」，千分位
- [x] **章节反思与单词提交统一风格**：提交反思走流式（Node 路由 `/api/learn/reflect` + `streamReflectionSummaryDeepSeek`），实时 `ThinkingPanel`；小结 reasoning 落库 `ChapterReflection.reasoning` + 旁置「AI 思考过程」`ReasoningDialog`；`thinking.tsx` / `reasoning-dialog.tsx` 提到 `src/components` 共用；删除旧 server action 改流式路由；`reflectionQuestions` 加非法 JSON 兜底（防整页 500）
- [x] **反思作为「各章冠军」周结算门槛**（PRD §7.2）：`ranking.ts` 结算加「该章反思已完成（截至周末）」过滤；**学习榜不卡反思**（`getLeaderboard` 维持通关即上榜）；完成整章第 20 词后，关键词结果页醒目 CTA 引导去做反思（含「做完才参与周冠军结算」文案）；排行榜文案相应更新
- [x] 中途退出保留记录：`NoteDraft`（笔记防抖自动保存、预填、提交清除）+ 答追问自动保存到 `Followup.answer`
- [x] 员工完整答题记录：结果页「本次答题记录」+ 可展开「全部 N 次」归档（无新表）
- [x] 追问内容依据强化：`Keyword.chapterTheme` 入打分上下文；submitNote 提示显式对照「参考考核要点 + 章节主题 + 本篇笔记」找薄弱点（守 §14.3.1，不写元指令）
- [x] 同伴笔记空态（完成本词但暂无他人记录时显示「暂无」，刷新后自动出真实数据）；首页排行榜/闯关地图为公开页**示例**并标注（真实排行榜在登录后 `/leaderboard`，数据来自 `pointsLedger`）
- [x] 管理员也可参与学习：开放 `/learn` `/redeem` `/growth` `/profile` `/onboarding` 给管理员（无资料引导 onboarding，打分上下文降级为通用）
- [x] 顶栏导航按角色梳理为一致结构（员工：闯关/排行榜/兑换/成长/我的；管理员：管理后台 + 同一套学习侧），后台子页收进「管理后台」首页卡片
- [x] 同伴笔记演示数据改用关键词真实简介+考核要点+岗位口吻生成，替换「…分水平示例」占位模板
**验收**：typecheck + lint + 单测 22/22 全绿；真实 DeepSeek 端到端（提交→初评→终评→画像更新）三条审计日志齐全；管理员可进入闯关地图、同伴笔记为真实内容。

---

## S15 · 闯关体验细化（v1.3）✅（PRD §15.6）
- [x] 字数：笔记 100–2000 字（原 5000 收紧）；追问回答每条 ≤ 1000 字（客户端 maxLength + 计数 + 服务端校验）
- [x] 初评分在答追问页显著显示（大号品牌色）；答追问时可对照原笔记（折叠面板）
- [x] 结果页「向 AI 追问」：`LearnerQuestion` 表 + `answerQuestion` 打分契约（DeepSeek/Mock，进 AI 审计 phase=answerQuestion）；结合笔记/追问/历史提问多轮作答，可多次，追加在结果后
- [x] 长文收纳：`ExpandableText` **默认全部展开**，超过约 3 行才出现「收起 / 展开全文」开关（按钮右下角），用于同伴笔记与答题记录（笔记 + 每条回答）
- [x] 向 AI 追问**流式输出**：Node 路由 `/api/learn/ask` + DeepSeek SSE（Mock 切片模拟），客户端逐字实时渲染，整段完成后落库，流式调用照样进 AI 审计日志
- [x] 「同事怎么写的」展示同伴**完整记录**：笔记 + 每条追问与回答（不含对方 AI 反馈）
- [x] 追问流式带回 DeepSeek **思考过程**（reasoning，NDJSON 区分 reasoning/answer；落库 `LearnerQuestion.reasoning`），生成中实时显示、完成后折叠
- [x] **Markdown 渲染**（react-markdown + remark-gfm，`.md` 排版）：AI 回答/反馈 + 笔记；`ExpandableText` 支持 markdown（按高度折叠）；按钮补 `cursor:pointer`
- [x] **提交笔记 / 答追问改流式**（路由 `/api/learn/submit`、`/api/learn/finalize`）：等待时展示 AI 思考过程；JSON 结果只后台解析落库不外泄；`startAttempt`/`completeAttempt` 加 `onReasoning`，`streamSubmitNoteDeepSeek`/`streamFinalizeDeepSeek` 用 `response_format:json_object + stream`；client `router.refresh()` 进下一步（移除原 server action）
- [x] 答追问页「你的笔记」去掉「答追问时可对照」、改 Markdown + `ExpandableText`；统一思考过程面板高度、`<details>` 转向箭头、反思页 AI 小结改 Markdown（样式/交互一致性）
- [x] 「同事怎么写的」只展示**得分最高 3 位**
- [x] 排行榜点进 top10 成员「闯关记录」`/leaderboard/[userId]`：守防抄袭（仅观看者也完成的词解锁笔记/回答，锁住内容服务端不下发，仅在榜可看）
- [x] 学习榜改按**每词最高分的均分**排名（保留两位小数）而非积分（积分大家差不多）；并列按完成词数；积分仍只用于兑换
- [x] **每天最多新完成 10 个关键词**（PRD §6.3）：`startAttempt` 服务端拦截 + 写笔记页提示「今天已完成 10 个」；重刷已通过的词、答完已开始的词不受限
- [x] **初评 / 终评思考过程小弹窗**：流式 reasoning 落库 `Scoring.initialReasoning` / `Scoring.finalReasoning`，分数旁小按钮（shadcn Dialog）回看完整推理——答追问页 / 结果页 / 答题记录每条；Mock / 历史无 reasoning 不显示
- [x] 所有「展开全文」改为**默认展开**（`ExpandableText` 初值 expanded，测高改为自然全高 vs 折叠阈值）
- [x] 成长轨迹 / 我的资料「画像全文」改 **Markdown 渲染 + 默认展开**（`ExpandableText markdown`，替换原等宽 `<pre>` 折叠）
- [x] **成长轨迹入口扩散**：闯关首页头部常驻「画像更新 N 次·看轨迹」入口（有画像才显示）+ 排行榜「我的名次」下「看我的成长轨迹」（原有：顶栏 / 我的资料 / 结果页 / 章节反思小结）
- [x] **排行榜详情看他人「当前画像」（仅正向公开，不含成长时间线）**：`getPeerRecords` 增 `growth`（强项 + 兴趣 + 隐去短板的画像）；`stripSensitivePortrait` 剔除「待加强/盲区」小节；`/leaderboard/[userId]` 加「当前画像」区（成长轨迹仍仅本人可见）。3 个纯函数单测（共 25 通过）
- [x] 引入 shadcn/ui（Radix）Select 替换原生下拉（角色 / AI 熟悉度），语义色映射到现有品牌色板；顶栏窄屏改汉堡菜单；修复 chapter/content 移动端网格溢出
**验收**：typecheck + lint + 单测 22/22 全绿；真实 DeepSeek 跑通「提交→初评→答追问→结果→追问」。

---

## S16 · AI 助手与 Agent 能力层（v1.4）⏳（PRD §16）
**目标**：在系统右下角增加「智学助手」入口，做成标准 Agent 流程与可扩展 Skill 能力层，而不是一次性硬编码聊天框。
- [x] 数据模型：`AssistantConversation` / `AssistantMessage` / `AssistantRun` / `AssistantToolCall`（或等价模型），支持最近会话恢复、Agent 执行审计、工具调用摘要；普通对话不写入 `EmployeeMemory`
- [x] Agent 核心：`AssistantSkill` / `AssistantTool` 契约、Capability Registry、受控 Query API 模式、参数 schema、权限声明与执行层鉴权兜底
- [x] Capability 接入约定：页面能力不开放裸 SQL；业务页面服务函数旁注册 capability provider，Agent 自动汇总 manifest；新增页面功能时只需注册能力，不重新开发 AI 编排
- [x] Agent 编排：`context assembly → LLM planner（读历史+Skill manifest）→ tool execution → LLM streamed synthesis → optional confirmation action`；本地 matcher 仅作 DeepSeek 不可用时的降级
- [x] 流式路由：`/api/assistant/chat`（Node runtime），复用 NDJSON/SSE 风格事件；支持文本增量、工具状态、工具结果摘要、确认卡片、导航动作、错误
- [x] 全局 UI：`AssistantWidget` 挂在 `(app)/layout`；右下角入口 + 桌面右侧抽屉 + 移动端底部近全屏面板；跨页面保留最近会话
- [x] 页面上下文：发送消息时带 `pathname`、`subjectId`、`chapterIndex`、`keywordId`、`submissionId` 等临时上下文；Agent 不把页面上下文写入长期画像
- [x] Skill：`learning-progress`（学习进度、章节解锁、待办、每日上限、反思待办）
- [x] Skill：`personal-account`（积分余额、待审批占用、近期流水、兑换规则）
- [x] Skill：`keyword-coach`（基于本人 submission 继续辅导；关键词结果页自动带上下文；不代写完整笔记）
- [x] Skill：`peer-summary`（仅已解锁关键词范围内摘要 top 同伴记录；复用同伴可见性规则；不全库搜索、不整段搬运）
- [x] Skill：`redemption`（第一版唯一写操作：自然语言生成兑换申请确认卡；用户确认后调用现有兑换服务层）
- [x] Skill：`admin-insights`（管理员只读：平台概览、待审批数量、学习进度大盘、章节排名、预算与积分统计）
- [x] Capability：`leaderboard`（复用 `getLeaderboard` / `getPointsLeaderboard` / `getChapterWinners`；查询学习榜、积分总榜、章节冠军、已通过关键词上榜人员）
- [x] 权限与安全：所有工具严格等同当前用户权限；员工无法通过助手越权看后台、低分名单、未解锁同伴笔记；写操作必须确认卡
- [x] 审计与隐私：模型调用进 `AiCallLog`（assistant phase）；Agent run / tool call 单独记录；管理员默认只看摘要和成本，不看员工完整私聊
- [x] 导航动作：Agent 返回结构化按钮，用户点击跳转 `/learn`、关键词页、反思页、`/redeem`、后台只读页等；不自动跳转
- [x] 自动任务预留：定义确认动作类型与未来调度接口草案，但 v1.4 不实现后台自动任务
- [x] 测试：Skill 选择 / 参数校验 / 权限拒绝 / 兑换确认卡 / 同伴可见性 / 流式协议 / 会话恢复；Mock provider 下可稳定跑通
**验收**：登录后右下角可打开智学助手；对话流式输出；能查学习进度/积分、辅导当前关键词、摘要已解锁同伴记录、生成并确认兑换申请；管理员可查只读运营概览；越权与高风险写操作被拒绝或引导到页面；typecheck + lint + 单测通过。
**依赖**：S14/S15 的 AI 审计、流式基础、结果页追问、同伴可见性、兑换服务层。

---

## 状态总览

**已完成**：S0–S15 + S2.5/S2.6。  
**下一批规划**：S16 · AI 助手与 Agent 能力层。

实际推进顺序：`S0 → S1 → S2 → S2.5 → S2.6 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10 → S11 → S12 → S13 → S14 → S15`。

整体验证：单测 **22/22**、集成测试 **3/3**、`typecheck` + `build`(18 路由) 全绿；碰钱逻辑（兑换、排名）经对抗式审查加固并以运行时 smoke 验证。演示见 `DEMO.md`。

原列为「可选增强」的三项也已补完：✅ 周日夜定时结算 cron、✅ 从零新建学科录入 UI、✅ 游戏化动效（得分翻滚/彩屑/徽章）。

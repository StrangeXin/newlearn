export const meta = {
  name: 'ai-learn-foundation',
  description: '生成并对抗式验证 AI 学习平台的三大基础产物：100关键词内容、Prisma schema、打分服务设计',
  phases: [
    { title: 'Design', detail: '并行：关键词弧线+逐章充实 / Prisma schema / 打分服务设计' },
    { title: 'Verify', detail: '对抗式验证：查重覆盖排序 / schema对照PRD规则 / 打分契约' },
    { title: 'Finalize', detail: '根据评审产出最终修订版产物' },
  ],
}

const NO_NONDET = '禁止使用随机数或读取当前时间的任何 API（随机/时钟类函数一律不准用）';

const PRD_RULES = `
产品关键业务规则（用于校验数据模型/打分契约）：
- 身份：管理员预导入员工白名单；员工用「姓名+共享默认密码 Aa123456!」登录；首登强制改密(mustChangePassword)；角色枚举 employee/admin/superadmin；超管可提升他人。
- 学科可扩展：Subject 有 isActive、startDate；每学科固定 5 章、每章 20 词、共 100 词；每学科进度与积分独立核算；管理员统一指定全公司当前学科。
- 内容：Chapter(index 1..5, title, theme)；Keyword(term, description可选, referencePoints可选)。
- 学习闭环：员工对每个关键词提交学习笔记(noteText, 100~5000字)。一次提交=一条 Submission。
- 打分：DeepSeek 给初始分(1-100)并按笔记薄弱点动态生成 1-3 个追问；员工答完后综合「原笔记+追问回答」给最终分。最终分>=60 视为该词通过(isPassed)。
- 取最高分：同一关键词可无限重提，KeywordProgress 记录 bestFinalScore、isCompleted、completedAt；通过即记 1 积分(基础积分)。
- 节奏：管理员开启学科设开始日；自然周(周一~周日)为界；顺序解锁(第N周解锁第N章)；旧章保持解锁可随时补完赚积分。
- 排名：周日夜结算；仅完成该章「全部20词」者入排名；按20个最终分平均值取 top3，各 +100 积分；并列名次均给 +100(不稀释不限人数)。错过当周排名不补。RankingResult 按 (subject, chapter, weekIndex, user) 记 avgScore/rank/bonusAwarded。
- 积分与兑换：1积分=1元；积分流水 PointsLedger 类型 base|rank_bonus|redeem(redeem为负或单独记)，含 refId、subjectId；可多次部分兑换。Redemption(item, amount, attachment可选, status pending/approved/rejected, reviewedBy, 时间戳)；员工申请→管理员审批通过才扣分。
- 同伴可见性(防抄袭)：仅当查看者自己已完成(isCompleted)某关键词，才能查询他人该关键词的 Submission(按分数高到低)。
- 公开身份：排行榜只公开靠前/完成者真名+头像；落后者低分不公开。
`;

const ARC_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    chapters: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          title: { type: 'string' },
          theme: { type: 'string' },
          terms: { type: 'array', minItems: 20, maxItems: 20, items: { type: 'string' } },
        },
        required: ['index', 'title', 'theme', 'terms'],
      },
    },
  },
  required: ['chapters'],
};

const CHAPTER_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    index: { type: 'integer' },
    title: { type: 'string' },
    theme: { type: 'string' },
    keywords: {
      type: 'array', minItems: 20, maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          term: { type: 'string' },
          description: { type: 'string' },
          referencePoints: { type: 'string' },
        },
        required: ['term', 'description', 'referencePoints'],
      },
    },
  },
  required: ['index', 'title', 'theme', 'keywords'],
};

const KEYWORDS_FULL = {
  type: 'object', additionalProperties: false,
  properties: { chapters: { type: 'array', minItems: 5, maxItems: 5, items: CHAPTER_SCHEMA } },
  required: ['chapters'],
};

const KW_REVIEW = {
  type: 'object', additionalProperties: false,
  properties: {
    total: { type: 'integer' },
    duplicates: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    orderingOk: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
    approved: { type: 'boolean' },
  },
  required: ['total', 'duplicates', 'gaps', 'orderingOk', 'issues', 'approved'],
};

const SCHEMA_OUT = {
  type: 'object', additionalProperties: false,
  properties: { prismaSchema: { type: 'string' }, notes: { type: 'string' } },
  required: ['prismaSchema', 'notes'],
};

const REVIEW_OUT = {
  type: 'object', additionalProperties: false,
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { rule: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } },
        required: ['rule', 'problem', 'fix'],
      },
    },
    approved: { type: 'boolean' },
  },
  required: ['issues', 'approved'],
};

const SCORING_OUT = {
  type: 'object', additionalProperties: false,
  properties: {
    interfaceTs: { type: 'string' },
    mockTs: { type: 'string' },
    deepseekSystemPrompt: { type: 'string' },
    deepseekUserPromptTemplate: { type: 'string' },
    rubricDimensions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { name: { type: 'string' }, weight: { type: 'number' }, description: { type: 'string' } },
        required: ['name', 'weight', 'description'],
      },
    },
  },
  required: ['interfaceTs', 'mockTs', 'deepseekSystemPrompt', 'deepseekUserPromptTemplate', 'rubricDimensions'],
};

phase('Design');

async function buildKeywords() {
  const arc = await agent(
    `你是 AI 领域资深教育专家。为一套面向公司内部员工的「人工智能行业 100 关键词」学习内容设计 5 章弧线。
要求：
- 5 章按时间/认知脉络从「起源与基础」到「最新发展趋势」递进（例如：①起源与数学基础 ②经典机器学习 ③深度学习与神经网络 ④大模型与Transformer时代 ⑤前沿趋势/应用/伦理治理，可优化）。
- 每章给 index(1-5)、title(中文章节标题)、theme(中文一句话主题)、terms(恰好20个关键词名称)。
- 全 100 个关键词覆盖 AI 行业核心概念，不重复、不遗漏重大概念；术语用通用中文表述，必要时括号附英文(如「反向传播(Backpropagation)」「注意力机制(Attention)」)。
- 关键词分配到对应章节要符合该章主题与时间脉络。
只返回结构化数据。`,
    { schema: ARC_SCHEMA, label: 'kw:arc', phase: 'Design' }
  );
  const chapters = await parallel(
    arc.chapters.map((ch) => () =>
      agent(
        `你是 AI 领域资深教育专家。下面是某学习章节及其分配到的 20 个关键词，请为每个关键词补充内容。
章节：第${ch.index}章《${ch.title}》——${ch.theme}
关键词列表：${JSON.stringify(ch.terms)}

为这 20 个关键词逐一产出：
- term：沿用上面的关键词名称（可微调表述使其更标准，但语义不变）。
- description：1-2 句中文简介，点明它是什么、为何重要（给员工看，激发检索兴趣，不要写成完整答案）。
- referencePoints：中文「参考考核要点」，列出员工笔记应覆盖的 3-5 个要点（用于辅助 AI 打分），简洁分号分隔。

保持恰好 20 个，顺序与输入一致。只返回结构化数据。`,
        { schema: CHAPTER_SCHEMA, label: `kw:ch${ch.index}`, phase: 'Design' }
      )
    )
  );
  return { chapters: chapters.filter(Boolean).sort((a, b) => a.index - b.index) };
}

const designs = await parallel([
  () => buildKeywords(),
  () =>
    agent(
      `你是资深后端架构师，精通 Prisma + PostgreSQL。为下述产品产出一份完整、可直接使用的 prisma/schema.prisma。
${PRD_RULES}

要求：
- datasource 用 provider="postgresql"、url=env("DATABASE_URL")；generator client provider="prisma-client-js"。
- 用 enum 表达：Role(EMPLOYEE/ADMIN/SUPERADMIN)、SubmissionStatus、RedemptionStatus(PENDING/APPROVED/REJECTED)、LedgerType(BASE/RANK_BONUS/REDEEM)。
- 实体至少覆盖：User、Subject、Chapter、Keyword、Submission、Scoring、KeywordProgress、PointsLedger、RankingResult、Redemption，并建立正确关系与反向关系。
- Submission 存 noteText 及一次评分流程；Scoring 存 initialScore、finalScore、followups(追问，建议 Json 或独立模型存 question+answer)、isPassed。
- KeywordProgress 体现「取最高分」：唯一约束(userId+keywordId)、bestFinalScore、isCompleted、completedAt。
- RankingResult 唯一约束(subjectId+chapterId+weekIndex+userId)，含 avgScore、rank、bonusAwarded。
- PointsLedger 含 userId、subjectId、type、amount、refId、createdAt；余额由流水求和得出。
- Redemption 含 item、amount、attachment?、status、reviewedById?、createdAt、reviewedAt?。
- 合理的 @@index / @@unique 以支撑按用户、按关键词、按(学科,章节)查询及同伴可见性查询。
- 字段加必要默认值与时间戳(createdAt/updatedAt)。
prismaSchema 字段放完整 schema 文本；notes 用中文说明关键设计取舍（如追问如何存、余额如何算、解锁周次如何由 startDate 推导）。只返回结构化数据。`,
      { schema: SCHEMA_OUT, label: 'schema:design', phase: 'Design' }
    ),
  () =>
    agent(
      `你是资深 TypeScript 工程师。为 AI 学习平台设计「打分服务」抽象与实现（Next.js + TS 项目，文件将放在 src/lib/scoring/ 下）。
契约（两段式，对应产品流程）：
1) submitNote：输入 { note: string, keyword: { term, description?, referencePoints? } } → 输出 { initialScore: number(1-100整数), followups: string[](根据笔记薄弱点动态 1~3 个，笔记越完整问越少) }。
2) finalize：输入 { note, keyword, followups: string[], answers: string[] } → 输出 { finalScore: number(1-100整数), passed: boolean(finalScore>=60), feedback: string(中文) }。
产出：
- interfaceTs：定义 ScoringService 接口与相关类型（含上面输入输出类型）。
- mockTs：MockScoringService 实现，必须「完全确定性」——${NO_NONDET}；用笔记长度、是否覆盖 referencePoints 关键词、答案长度等可重复的启发式算分；追问数量按笔记质量确定性地取 1~3；finalScore 在 initialScore 基础上按答案质量确定性微调。代码要能直接编译（含必要类型）。
- deepseekSystemPrompt + deepseekUserPromptTemplate：中文，指导 DeepSeek 按 rubric 打分并以严格 JSON 返回（submitNote 返回 {initialScore, followups}；finalize 返回 {finalScore, passed, feedback}）。模板中用 {{note}}{{term}}{{referencePoints}}{{followups}}{{answers}} 之类占位符。
- rubricDimensions：通用评分维度数组（name/weight/description，权重之和=1），如准确性、深度、完整性、条理性、原创思考等。
只返回结构化数据。`,
      { schema: SCORING_OUT, label: 'scoring:design', phase: 'Design' }
    ),
]);

const keywords = designs[0];
const schemaD = designs[1];
const scoringD = designs[2];

phase('Verify');

const reviews = await parallel([
  () =>
    agent(
      `严格审查这份「AI 行业 100 关键词」内容（5章×20词）。检查：
1) 总数是否恰好100；2) 是否有重复/近义重复关键词(列出)；3) 是否遗漏 AI 领域重大核心概念(列出 gaps)；4) 章节是否按「起源→最新趋势」的合理脉络排序、关键词归章是否得当(orderingOk)；5) description/referencePoints 是否中文、是否质量合格、是否泄露成完整答案(列入 issues)。
内容：${JSON.stringify(keywords)}
只返回结构化评审结果。approved 仅在无重大问题时为 true。`,
      { schema: KW_REVIEW, label: 'kw:review', phase: 'Verify' }
    ),
  () =>
    agent(
      `你是挑剔的后端评审。对照下面每一条产品业务规则，逐条审查这份 Prisma schema 是否能支撑；找出缺失字段、错误关系、缺失唯一约束/索引、enum 缺失、无法表达「取最高分/周排名/并列奖励/同伴可见性/积分流水」等问题。
${PRD_RULES}

待审 schema：
${schemaD.prismaSchema}

设计说明：${schemaD.notes}

对每个问题给 {rule, problem, fix}。approved 仅在无阻断性问题时为 true。只返回结构化结果。`,
      { schema: REVIEW_OUT, label: 'schema:review', phase: 'Verify' }
    ),
  () =>
    agent(
      `审查这份打分服务设计是否满足契约：两段式(submitNote/finalize)；分数为1-100整数；追问动态1-3个且笔记越好越少；finalize 综合原笔记+追问回答；passed=finalScore>=60。
重点核查 MockScoringService 是否「完全确定性」（${NO_NONDET}），且 TypeScript 能编译。DeepSeek 提示是否要求严格 JSON 返回、是否用到 rubric 与 referencePoints。
设计内容：
interfaceTs:
${scoringD.interfaceTs}
---
mockTs:
${scoringD.mockTs}
---
systemPrompt: ${scoringD.deepseekSystemPrompt}
userTemplate: ${scoringD.deepseekUserPromptTemplate}
rubric: ${JSON.stringify(scoringD.rubricDimensions)}

对每个问题给 {rule, problem, fix}。approved 仅在契约完全满足且 mock 确定性、可编译时为 true。只返回结构化结果。`,
      { schema: REVIEW_OUT, label: 'scoring:review', phase: 'Verify' }
    ),
]);

const kwReview = reviews[0];
const schemaReview = reviews[1];
const scoringReview = reviews[2];

phase('Finalize');

const finals = await parallel([
  () =>
    kwReview && kwReview.approved
      ? keywords
      : agent(
          `根据评审意见修订「AI 100 关键词」内容，输出最终版（仍为5章×20词、共100、无重复无遗漏、脉络正确、description/referencePoints 中文合格）。
原内容：${JSON.stringify(keywords)}
评审意见：${JSON.stringify(kwReview)}
只返回结构化数据(chapters)。`,
          { schema: KEYWORDS_FULL, label: 'kw:fix', phase: 'Finalize' }
        ),
  () =>
    schemaReview && schemaReview.approved
      ? schemaD
      : agent(
          `根据评审意见修订 Prisma schema，输出可直接使用的最终版，修复所有列出的问题。
${PRD_RULES}
原 schema：
${schemaD.prismaSchema}
评审意见：${JSON.stringify(schemaReview)}
prismaSchema 放完整最终 schema；notes 用中文说明所做修订。只返回结构化数据。`,
          { schema: SCHEMA_OUT, label: 'schema:fix', phase: 'Finalize' }
        ),
  () =>
    scoringReview && scoringReview.approved
      ? scoringD
      : agent(
          `根据评审意见修订打分服务设计，输出最终版。确保 MockScoringService 完全确定性(${NO_NONDET})且可编译，契约完整。
原设计：interfaceTs=${scoringD.interfaceTs}
mockTs=${scoringD.mockTs}
systemPrompt=${scoringD.deepseekSystemPrompt}
userTemplate=${scoringD.deepseekUserPromptTemplate}
rubric=${JSON.stringify(scoringD.rubricDimensions)}
评审意见：${JSON.stringify(scoringReview)}
只返回结构化数据。`,
          { schema: SCORING_OUT, label: 'scoring:fix', phase: 'Finalize' }
        ),
]);

log('foundation 产物生成完毕');

return {
  keywords: finals[0],
  schema: finals[1],
  scoring: finals[2],
  reviews: { kwReview, schemaReview, scoringReview },
};

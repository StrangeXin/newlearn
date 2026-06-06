import Link from "next/link";

// 「人工智能」学科的 5 章 + 闯关状态：作为 Hero 的闯关地图预览
const chapters = [
  { title: "起源与数学", theme: "图灵机、感知机到概率与线代", state: "done" },
  { title: "经典机器学习", theme: "回归、决策树、SVM、特征工程", state: "done" },
  { title: "深度学习", theme: "神经网络、CNN、RNN、反向传播", state: "open" },
  { title: "大模型时代", theme: "Transformer、预训练、RLHF、提示工程", state: "locked" },
  { title: "前沿与治理", theme: "Agent、多模态、对齐、AI 安全", state: "locked" },
] as const;

// 麦肯锡进入陌生行业的三个动作（纯方法论，不强行映射平台功能）
const method = [
  {
    n: 1,
    title: "先摸清最核心的概念",
    desc: "一个行业再大，真正撑起骨架的核心概念也就一百个上下。先把它们摸清，整张地图就立住了，之后读什么、问谁都有了坐标。",
  },
  {
    n: 2,
    title: "找内行问判断",
    desc: "书上写的是共识，真正的判断在内行脑子里。带着具体问题去问做过的人，能问出哪些坑书里不写、哪条路现在已经走不通。",
  },
  {
    n: 3,
    title: "读权威著作对照",
    desc: "几本被反复引用的著作摆在一起读，重复出现的结论就是最稳的共识；彼此打架的地方，往往正是还没定论的前沿。",
  },
];

// 一个关键词的四步微循环：每条说清「这一步对你的作用」，不堆规则
const steps = [
  {
    n: 1,
    title: "看关键词",
    desc: "每章 20 个核心词，从起源排到前沿。照着走，等于先拿到这个领域的地图，不用自己摸方向。",
  },
  {
    n: 2,
    title: "写笔记",
    desc: "检索后用自己的话讲一遍。能讲清楚才算真懂，卡住讲不出的地方，就是还没学透的地方。",
  },
  {
    n: 3,
    title: "AI 打分追问",
    desc: "AI 顺着你笔记里最薄弱的一环追问 1–3 题。分数告诉你学到几分，追问把你没想透的地方补上。",
  },
  {
    n: 4,
    title: "拿积分",
    desc: "每达标一个词得 1 积分，抵 1 元报销额度。没到 60 分能无限重写，只取最高分，写错不扣分。",
  },
];

// 排行榜示例：完成整章前三名各 +100（金色奖励），并列都给
const ranking = [
  { rank: 1, name: "张明", avg: 92, reward: true },
  { rank: 2, name: "李哲", avg: 89, reward: true },
  { rank: 3, name: "王芳", avg: 87, reward: true },
  { rank: 4, name: "陈宇", avg: 81, reward: false },
  { rank: 5, name: "刘洋", avg: 78, reward: false },
];

const navLinks = [
  { href: "#method", label: "方法论" },
  { href: "#how", label: "玩法" },
  { href: "#rewards", label: "奖励" },
  { href: "#subjects", label: "学科" },
];

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <rect x="4.5" y="11" width="15" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      {/* 顶部导航：logo 点击回首页 */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
              智
            </span>
            <span>智学闯关</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-brand-50 hover:text-brand-700"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link href="/login" className="btn btn-primary btn-sm">
            登录
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero：左文案 + 右闯关地图（产品的标志性视觉） */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="animate-float-in text-center lg:text-left">
            <span className="badge badge-brand px-3 py-1.5 text-sm">多学科内部学习平台</span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              用 100 个关键词，
              <span className="mt-1 block text-brand-600">读懂一个新领域</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
              一门学科浓缩成 100 个关键词，每周学一章。检索、写笔记，大模型 AI 当场打分、追问你的薄弱点；达标得积分，可兑换书和工具。
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <Link href="/login" className="btn btn-primary btn-lg btn-block sm:w-auto">
                开始闯关 →
              </Link>
              <a href="#how" className="btn btn-secondary btn-lg btn-block sm:w-auto">
                看看怎么学
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
              {["5 章 100 词", "AI 打分追问", "每章前三 +100"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="font-bold text-brand-600" aria-hidden>
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* 闯关地图预览：人工智能学科的 5 章解锁进度 */}
          <div className="animate-float-in relative" style={{ animationDelay: "120ms" }}>
            <div
              className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-brand-100/45"
              aria-hidden
            />
            <div className="card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="badge badge-brand">人工智能</span>
                  <span className="text-xs text-muted">5 章 · 100 词</span>
                </div>
                <span className="flex items-center gap-2">
                  <span className="badge badge-muted">示例</span>
                  <span className="text-xs font-medium text-muted">第 3 周</span>
                </span>
              </div>

              <ol className="mt-5">
                {chapters.map((c, i) => {
                  const last = i === chapters.length - 1;
                  const nodeClass =
                    c.state === "done"
                      ? "map-node-done"
                      : c.state === "open"
                        ? "map-node-open"
                        : "map-node-locked";
                  return (
                    <li key={c.title} className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <span className={`map-node h-8 w-8 text-xs ${nodeClass}`}>
                          {c.state === "done" ? "✓" : c.state === "locked" ? <LockIcon /> : i + 1}
                        </span>
                        {!last && <span className="my-1 w-px flex-1 bg-line" />}
                      </div>
                      <div className={last ? "pb-0.5" : "pb-5"}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-ink">{c.title}</span>
                          {c.state === "done" && (
                            <span className="text-xs text-muted">已通关</span>
                          )}
                          {c.state === "open" && <span className="badge badge-brand">本周</span>}
                          {c.state === "locked" && (
                            <span className="text-xs text-muted">未解锁</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{c.theme}</p>
                        {c.state === "open" && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="progress w-28">
                              <span style={{ width: "70%" }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums text-muted">
                              14 / 20
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        {/* 方法论：标题在左、三步在右的编辑式版式，不用等大卡片网格 */}
        <section id="method" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <h2 className="text-2xl font-bold text-ink sm:text-3xl">
                  麦肯锡进入一个陌生行业，先做三件事
                </h2>
                <p className="mt-4 max-w-md leading-relaxed text-muted">
                  第一件，就是先摸清这个行业最核心的一百来个概念。本平台正建在这一步上。
                </p>
              </div>
              <ol className="divide-y divide-line">
                {method.map((m) => (
                  <li key={m.n} className="flex gap-5 py-6 first:pt-0 last:pb-0 sm:gap-7">
                    <span className="w-7 shrink-0 text-3xl font-extrabold leading-none tabular-nums text-brand-300">
                      {m.n}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-ink">{m.title}</h3>
                      <p className="mt-2 leading-relaxed text-muted">{m.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 玩法：左侧四步闯关轨道 + 右侧真实评分样例（surface-2 色带分隔） */}
        <section id="how" className="scroll-mt-20 border-y border-line bg-surface-2">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">每个关键词，四步学透</h2>
              <p className="mt-3 leading-relaxed text-muted">
                从看词到拿分，走完就是一个关键词的完整闭环。右边是一次真实的评分过程。
              </p>
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
              {/* 四步闯关轨道（连线强化「一条路」的闯关感） */}
              <ol>
                {steps.map((s, i) => {
                  const last = i === steps.length - 1;
                  return (
                    <li key={s.n} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="map-node map-node-open h-9 w-9 text-sm">{s.n}</span>
                        {!last && <span className="my-1.5 w-px flex-1 bg-line" />}
                      </div>
                      <div className={last ? "pb-0" : "pb-7"}>
                        <h3 className="font-bold text-ink">{s.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* 评分样例卡片 */}
              <div className="card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="badge badge-brand">深度学习 · 关键词 14/20</span>
                  <span className="text-xs font-medium text-muted">评分样例</span>
                </div>
                <h3 className="mt-3 text-xl font-extrabold text-ink">Transformer</h3>

                <div className="mt-4 text-xs font-semibold text-muted">你的笔记</div>
                <p className="mt-1.5 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">
                  注意力机制让模型一次看到整段序列，用 Q/K/V 算出每个词该关注谁，再并行编码……
                </p>

                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="text-muted">AI 初评</span>
                  <span className="font-bold tabular-nums text-ink">78</span>
                  <span className="text-muted">分</span>
                </div>

                <div className="mt-4 text-xs font-semibold text-brand-700">AI 追问</div>
                <p className="mt-1.5 rounded-xl bg-brand-50 p-3 text-sm leading-relaxed text-ink">
                  自注意力是 O(n²) 复杂度，长序列下你会怎么优化？
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-muted">终评</span>
                    <span className="text-xl font-extrabold tabular-nums text-success-600">86</span>
                    <span className="badge badge-success">✓ 已通过</span>
                  </span>
                  <span className="badge badge-gold">+1 积分</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 奖励：排行榜（金色奖励）+ 两块说明，非等大网格 */}
        <section id="rewards" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">学到的东西，变成看得见的回报</h2>
              <p className="mt-3 leading-relaxed text-muted">
                每达标一个词得积分，积分抵报销；完成整章还能上排行榜，拿额外奖励。
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
              {/* 排行榜面板：金色严格只用于前三的奖励 */}
              <div className="card flex flex-col p-6 lg:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-ink">本周排行榜</h3>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-muted shrink-0">示例</span>
                    <span className="badge badge-brand shrink-0">经典机器学习</span>
                  </div>
                </div>
                <ol className="mt-4 flex-1 divide-y divide-line">
                  {ranking.map((r) => (
                    <li key={r.rank} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                          r.reward
                            ? "bg-accent-400 text-ink"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {r.rank}
                      </span>
                      <span className="flex-1 text-sm font-medium text-ink">{r.name}</span>
                      <span className="text-sm tabular-nums text-muted">
                        均分 <span className="font-semibold text-ink">{r.avg}</span>
                      </span>
                      {r.reward ? (
                        <span className="badge badge-gold w-16 justify-center">+100</span>
                      ) : (
                        <span className="w-16 text-center text-xs text-muted">—</span>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                  完成整章 20 个词才入排名，按 20 词平均分取前三，各得 100 积分，并列都给。
                </p>
              </div>

              {/* 右列两块：积分兑换 + 个性化 */}
              <div className="grid content-start gap-5">
                <div className="card p-6">
                  <h3 className="text-lg font-bold text-ink">1 积分 = 1 元报销</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    学完的每个词都能换报销额度，可多次部分兑换。员工申请、管理员审批后到账。
                  </p>
                </div>
                <div className="card p-6">
                  <h3 className="text-lg font-bold text-ink">AI 越学越懂你</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    填一次资料，系统生成画像并持续更新。追问会结合你的岗位，不是套用通用模板。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 学科：AI 已开课（左大）+ 其余（右列），非等大网格 */}
        <section id="subjects" className="scroll-mt-20 border-y border-line bg-surface-2">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">不止 AI 一门</h2>
              <p className="mt-3 leading-relaxed text-muted">
                每个学科都是 5 章 100 词，从起源到前沿。管理员开哪门，你就学哪门。
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
              <div className="card flex flex-col p-6 lg:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-extrabold text-ink">人工智能</h3>
                  <span className="badge badge-success shrink-0">已开课</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  从图灵机到大模型 Agent，AI 这几十年的脉络完整走一遍。
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {chapters.map((c) => (
                    <li
                      key={c.title}
                      className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink"
                    >
                      {c.title}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid content-start gap-5">
                <div className="card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-ink">心电高频QRS</h3>
                    <span className="badge badge-muted shrink-0">即将开放</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    分析 QRS 波内的高频成分，比常规 ST 段更早捕捉心肌缺血的信号。
                  </p>
                </div>
                <div className="card border-dashed p-6">
                  <h3 className="text-lg font-bold text-ink">更多主题</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    心理学、医学、管理…… 任何能拆成 100 个关键词的领域，都能开成一门课。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 收尾 CTA：靛蓝色带，一个明确的下一步 */}
        <section className="bg-brand-600">
          <div className="mx-auto max-w-6xl px-5 py-16 text-center lg:py-20">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">第 1 关已解锁</h2>
            <p className="mx-auto mt-3 max-w-md leading-relaxed text-brand-100">
              用姓名和默认密码登录，首登改个密码就能开闯。
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                className="btn btn-lg bg-white text-brand-700 hover:bg-brand-50"
              >
                开始闯关 →
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row">
            <Link href="/" className="flex items-center gap-2 font-extrabold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-xs text-white">
                智
              </span>
              智学闯关
            </Link>
            <p className="text-sm text-muted">内部学习平台 · 麦肯锡 100 关键词方法论</p>
            <Link
              href="/login"
              className="text-sm font-medium text-brand-700 transition hover:text-brand-600"
            >
              登录 →
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}

import Link from "next/link";

// 麦肯锡了解一个行业的三步，每步对应平台里一件具体的事
const method = [
  {
    n: 1,
    action: "总结 100 个关键词",
    desc: "一个行业再大，最核心的概念也就 100 个上下。抓全它们，骨架就立住了。",
    here: "平台已按 5 章排好序，从起源一路排到前沿。",
  },
  {
    n: 2,
    action: "找几位内行访谈",
    desc: "带着具体问题请教懂行的人，问出书里写不全的判断。",
    here: "大模型 AI 扮演这位内行，盯着你笔记的薄弱处追问。",
  },
  {
    n: 3,
    action: "精读几本专业书",
    desc: "几本权威著作对照着读，把反复出现的共识提炼出来。",
    here: "你带着关键词检索、精读，写成 100–5000 字的笔记。",
  },
];

// 一个关键词的微循环（产品玩法）
const steps = [
  { n: 1, title: "看关键词", desc: "每章 20 个核心词，从起源串到前沿，每周一章。" },
  { n: 2, title: "写笔记", desc: "外部检索后，用自己的话写 100–5000 字，写明白才算数。" },
  { n: 3, title: "AI 打分追问", desc: "大模型 AI 打 1–100 分，按你的薄弱点追问 1–3 题。" },
  { n: 4, title: "拿积分", desc: "终评 ≥60 得 1 分；没到也能无限重写，系统取最高分。" },
];

const features = [
  {
    title: "AI 越学越懂你",
    desc: "填一次资料，系统为你生成画像并持续更新。追问会结合你的岗位，而不是套用通用模板。",
  },
  {
    title: "积分换书和工具",
    desc: "1 积分 = 1 元报销额度，可多次部分兑换。学到的东西，直接变成书和工具。",
  },
  {
    title: "跟同事比着学",
    desc: "每周排行榜，完成整章的前三名各 +100。通关一个词后才能看别人的笔记，参考彼此的写法。",
  },
];

// 「人工智能」学科的 5 章作为示例大纲
const aiChapters = [
  { title: "起源与数学", theme: "图灵、感知机到概率与线性代数" },
  { title: "经典机器学习", theme: "回归、决策树、SVM 与特征工程" },
  { title: "深度学习", theme: "神经网络、CNN、RNN 与反向传播" },
  { title: "大模型时代", theme: "Transformer、预训练、RLHF 与提示工程" },
  { title: "前沿与治理", theme: "Agent、多模态、对齐与 AI 安全" },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero：左文案 + 右产品预览（show, don't tell） */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-16 lg:grid-cols-2 lg:gap-14 lg:pt-24">
        <div className="animate-float-in text-center lg:text-left">
          <span className="badge badge-brand px-3 py-1.5 text-sm">多学科内部学习平台</span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            用 100 个关键词
            <span className="mt-1 block text-brand-600">读懂一个新领域</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
            一个行业的来龙去脉，浓缩成 100 个关键词，每周学一章。你检索、写笔记，大模型 AI
            当场打分、按薄弱点追问；达标即得积分，凭积分兑换书籍和工具。
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
            <Link href="/login" className="btn btn-primary btn-lg btn-block sm:w-auto">
              开始闯关 →
            </Link>
            <a href="#method" className="btn btn-secondary btn-lg btn-block sm:w-auto">
              看看怎么学
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted lg:justify-start">
            {["5 章 100 词", "AI 打分 + 追问", "每章前三 +100"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="text-brand-600" aria-hidden>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* 产品预览：一个关键词从笔记到通过的完整过程 */}
        <div className="animate-float-in relative" style={{ animationDelay: "120ms" }}>
          <div
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-brand-100/50"
            aria-hidden
          />
          <p className="mb-3 text-center text-xs font-medium text-muted">一个关键词的评分过程</p>
          <div className="card mx-auto max-w-md p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="badge badge-brand">人工智能 · 深度学习</span>
              <span className="text-xs font-medium text-muted">关键词 14 / 20</span>
            </div>
            <h3 className="mt-3 text-xl font-extrabold text-ink">Transformer</h3>

            <div className="mt-3 text-xs font-semibold text-muted">你的笔记</div>
            <p className="mt-1 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">
              注意力机制让模型一次看到整段序列，用 Q/K/V 算出每个词该关注谁，再并行编码……
            </p>

            <div className="mt-3 flex items-center gap-1.5 text-sm">
              <span className="text-muted">AI 初评</span>
              <span className="font-bold tabular-nums text-ink">78</span>
              <span className="text-muted">分</span>
            </div>

            <div className="mt-3 text-xs font-semibold text-brand-700">AI 追问</div>
            <p className="mt-1 rounded-xl bg-brand-50 p-3 text-sm leading-relaxed text-ink">
              自注意力是 O(n²) 复杂度，长序列下你会怎么优化？
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <span className="flex items-center gap-2">
                <span className="text-sm text-muted">终评</span>
                <span className="text-lg font-extrabold tabular-nums text-success-600">86</span>
                <span className="badge badge-success">✓ 已通过</span>
              </span>
              <span className="badge badge-gold">🏅 +1 积分</span>
            </div>
          </div>
        </div>
      </section>

      {/* 方法论：麦肯锡了解一个行业的三步 */}
      <section id="method" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-2xl font-bold text-ink sm:text-3xl">
            麦肯锡进入一个陌生行业，先做三件事
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            其中第一件，就是总结出这个行业最核心的 100 个关键词。这三件事，我们都做进了每周的学习。
          </p>
        </div>
        <ol className="mt-10 grid gap-5 lg:grid-cols-3">
          {method.map((m) => (
            <li key={m.n} className="card flex flex-col p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-extrabold text-white">
                {m.n}
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{m.action}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{m.desc}</p>
              <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-ink">
                <span className="font-semibold text-brand-700">在这里：</span>
                {m.here}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 产品玩法：一个关键词的四步微循环 */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">一个关键词，四步通关</h2>
          <p className="mt-3 text-muted">每个关键词都是一次小闯关，写得越透，分越高。</p>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="animate-float-in card p-5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="map-node map-node-open h-8 w-8 text-sm">{s.n}</span>
                {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-line lg:block" />}
              </div>
              <div className="mt-3 font-bold text-ink">{s.title}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted">{s.desc}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* 差异点：为什么大家愿意学 */}
      <section className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">不只是背词</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <h3 className="text-lg font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 学科：现在能学什么 */}
      <section id="subjects" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">现在能学什么</h2>
          <p className="mt-3 leading-relaxed text-muted">
            每个学科都是 5 章 100 词，从起源排到前沿。需要哪个领域，开一门就能学。
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {/* 人工智能：已开课，附示例大纲 */}
          <div className="card flex flex-col p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-extrabold text-ink">人工智能</h3>
              <span className="badge badge-success shrink-0">已开课</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              从图灵机到大模型 Agent，把 AI 这几十年的来路完整走一遍。
            </p>
            <ol className="mt-4 space-y-2.5">
              {aiChapters.map((c, i) => (
                <li key={c.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold text-ink">{c.title}</span>
                    <span className="text-muted"> · {c.theme}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* 右列：即将开放 + 更多 */}
          <div className="grid content-start gap-4">
            <div className="card flex flex-col p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-extrabold text-ink">心电高频QRS</h3>
                <span className="badge badge-muted shrink-0">即将开放</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                分析 QRS 波内的高频成分，比常规 ST 段更早捕捉心肌缺血的信号。
              </p>
              <p className="mt-4 text-xs font-medium text-muted">5 章 · 100 个关键词</p>
            </div>

            <div className="card flex flex-1 flex-col justify-center border-dashed p-6">
              <h3 className="text-lg font-bold text-ink">更多主题</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                心理学、医学、管理…… 任何能拆成 100 个关键词的领域，都能开成一门新课。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 收尾 CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-4">
        <div className="panel flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center">
          <h2 className="text-2xl font-bold text-ink">第 1 关已经解锁</h2>
          <p className="max-w-md text-muted">
            用姓名和默认密码登录即可激活账号，首次登录改个密码就能开始。
          </p>
          <Link href="/login" className="btn btn-primary btn-lg">
            开始闯关 →
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-center text-sm text-muted">
        智学闯关 · 内部学习平台
      </footer>
    </main>
  );
}

import Link from "next/link";

const steps = [
  { icon: "🔑", title: "看关键词", desc: "系统每章给出 20 个行业关键词" },
  { icon: "📝", title: "写笔记", desc: "外部检索后总结成 100–5000 字笔记" },
  { icon: "🤖", title: "AI 打分", desc: "DeepSeek 打分并动态追问 1–3 个问题" },
  { icon: "🏆", title: "赚积分", desc: "达标得积分，章节前三额外奖励" },
];

const chapters = [
  "起源与数学",
  "经典机器学习",
  "深度学习",
  "大模型时代",
  "前沿与治理",
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-10 sm:pt-24 text-center animate-float-in">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-700">
          🚀 借助麦肯锡方法论 · 100 个关键词读懂一个行业
        </span>
        <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight text-ink">
          智学闯关
          <span className="block bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">
            把学习变成一场闯关
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-muted">
          内部员工的游戏化学习平台。5 章闯关、AI 实时打分与追问、积分兑换实物——
          先从「人工智能」起步，未来可扩展医学、心理学等学科。
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-xl bg-brand-600 px-7 py-3 text-center font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 hover:-translate-y-0.5"
          >
            开始闯关 →
          </Link>
          <a
            href="#how"
            className="w-full sm:w-auto rounded-xl border border-brand-200 bg-white/70 px-7 py-3 text-center font-semibold text-brand-700 transition hover:bg-white"
          >
            了解玩法
          </a>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-5 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm animate-float-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-3xl">{s.icon}</div>
              <div className="mt-3 font-bold text-ink">{s.title}</div>
              <div className="mt-1 text-sm text-muted">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-center text-2xl font-bold text-ink">五章闯关地图</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {chapters.map((c, i) => (
            <div key={c} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-md">
                  {i + 1}
                </div>
                <div className="mt-2 w-20 text-center text-xs font-medium text-muted">
                  {c}
                </div>
              </div>
              {i < chapters.length - 1 && (
                <div className="hidden sm:block h-1 w-8 rounded-full bg-brand-200" />
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-5 py-10 text-center text-sm text-muted">
        智学闯关 · 内部学习平台 · 原型阶段
      </footer>
    </main>
  );
}

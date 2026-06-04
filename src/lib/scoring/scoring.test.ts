import { describe, expect, it } from "vitest";
import { MockScoringService } from "./mock";
import { PASS_THRESHOLD } from "./types";

const svc = new MockScoringService();

const keyword = {
  term: "反向传播(Backpropagation)",
  description: "神经网络训练的核心算法",
  referencePoints: ["链式法则", "梯度", "误差反向传播", "权重更新"],
};

const weakNote = "反向传播就是一种算法。";
const strongNote =
  "反向传播(Backpropagation)是训练神经网络的核心算法。它基于链式法则，" +
  "把损失函数对输出的误差逐层反向传播到每一层的权重，计算出梯度。" +
  "随后用梯度下降进行权重更新。\n" +
  "具体来说，前向传播得到预测值与损失，反向传播再按链式法则求偏导，" +
  "误差反向传播到隐藏层，最终更新权重，使损失下降。".repeat(20);

describe("MockScoringService · 契约", () => {
  it("submitNote 返回 1-100 整数初始分与 1-3 个追问", async () => {
    const r = await svc.submitNote({ note: strongNote, keyword });
    expect(Number.isInteger(r.initialScore)).toBe(true);
    expect(r.initialScore).toBeGreaterThanOrEqual(1);
    expect(r.initialScore).toBeLessThanOrEqual(100);
    expect(r.followups.length).toBeGreaterThanOrEqual(1);
    expect(r.followups.length).toBeLessThanOrEqual(3);
  });

  it("完全确定性：相同输入得到相同输出", async () => {
    const a = await svc.submitNote({ note: strongNote, keyword });
    const b = await svc.submitNote({ note: strongNote, keyword });
    expect(a).toEqual(b);

    const f1 = await svc.finalize({
      note: strongNote,
      keyword,
      followups: a.followups,
      answers: a.followups.map(() => "这是一个比较充分的回答，覆盖了原理与实例。"),
    });
    const f2 = await svc.finalize({
      note: strongNote,
      keyword,
      followups: a.followups,
      answers: a.followups.map(() => "这是一个比较充分的回答，覆盖了原理与实例。"),
    });
    expect(f1).toEqual(f2);
  });

  it("笔记越完整，追问越少", async () => {
    const weak = await svc.submitNote({ note: weakNote, keyword });
    const strong = await svc.submitNote({ note: strongNote, keyword });
    expect(strong.followups.length).toBeLessThanOrEqual(weak.followups.length);
    expect(strong.initialScore).toBeGreaterThan(weak.initialScore);
  });

  it("覆盖参考考核要点能拿更高初始分（同等其它条件）", async () => {
    const covering = "本笔记覆盖了链式法则、梯度、误差反向传播与权重更新四个要点。".repeat(
      5,
    );
    const notCovering = "这段文字与考核要点无关，只是随便写写凑字数罢了。".repeat(5);
    const a = await svc.submitNote({ note: covering, keyword });
    const b = await svc.submitNote({ note: notCovering, keyword });
    expect(a.initialScore).toBeGreaterThan(b.initialScore);
  });
});

describe("MockScoringService · finalize", () => {
  it("passed 严格等价于 finalScore >= 及格线", async () => {
    const { followups } = await svc.submitNote({ note: strongNote, keyword });
    const r = await svc.finalize({
      note: strongNote,
      keyword,
      followups,
      answers: followups.map(() => "充分回答，结合原理与具体实例展开说明，内容详实。"),
    });
    expect(r.passed).toBe(r.finalScore >= PASS_THRESHOLD);
    expect(r.finalScore).toBeGreaterThanOrEqual(1);
    expect(r.finalScore).toBeLessThanOrEqual(100);
  });

  it("空白回答会拉低最终分", async () => {
    const { followups } = await svc.submitNote({ note: strongNote, keyword });
    const good = await svc.finalize({
      note: strongNote,
      keyword,
      followups,
      answers: followups.map(() => "充分回答，结合原理与具体实例展开说明，内容详实可靠。"),
    });
    const blank = await svc.finalize({
      note: strongNote,
      keyword,
      followups,
      answers: followups.map(() => ""),
    });
    expect(blank.finalScore).toBeLessThan(good.finalScore);
  });
});

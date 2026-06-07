"use client";

// 把证书绘制到 canvas 并下载为 PNG 图片（零依赖；用固定 hex 取色，规避 oklch 在
// html2canvas 等库里的兼容问题，输出稳定可控）。

export interface CertImageData {
  name: string;
  subjectTitle: string;
  totalKeywords: number;
  completed: number;
  avg: number;
  dateText: string;
  week: number | null;
  totalChapters: number;
  reflected: number;
  reflectionDone: boolean;
  no: string;
}

const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif';
const C = {
  white: "#ffffff",
  ink: "#1e293b",
  muted: "#64748b",
  line: "#e2e8f0",
  brand: "#4f46e5",
  brand700: "#4338ca",
  brand200: "#c7d2fe",
  brandSoft: "#eef2ff",
  accent: "#f59e0b",
  accent700: "#b45309",
  accent100: "#fef3c7",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
function hLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

export function DownloadCertificate(d: CertImageData) {
  function draw() {
    const W = 1400;
    const H = 900;
    const scale = 2; // 高清
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);

    // 背景
    ctx.fillStyle = C.white;
    ctx.fillRect(0, 0, W, H);

    // 角落柔色装饰（裁剪在卡片圆角内）
    ctx.save();
    roundRect(ctx, 16, 16, W - 32, H - 32, 28);
    ctx.clip();
    ctx.fillStyle = C.brandSoft;
    ctx.beginPath();
    ctx.arc(W - 30, 30, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.accent100;
    ctx.beginPath();
    ctx.arc(30, H - 30, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 外框 + 内细框
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.brand200;
    roundRect(ctx, 16, 16, W - 32, H - 32, 28);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.line;
    roundRect(ctx, 34, 34, W - 68, H - 68, 20);
    ctx.stroke();

    const cx = W / 2;
    ctx.textAlign = "center";

    // logo：「智」徽标 + 智学闯关
    const bw = 40;
    const bx = cx - 72;
    const by = 78;
    ctx.fillStyle = C.brand;
    roundRect(ctx, bx, by, bw, bw, 10);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText("智", bx + bw / 2, by + 29);
    ctx.fillStyle = C.brand700;
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("智学闯关", bx + bw + 12, by + 29);
    ctx.textAlign = "center";

    // CERTIFICATE
    ctx.fillStyle = C.muted;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText("C E R T I F I C A T E", cx, 180);
    // 结业证书
    ctx.fillStyle = C.ink;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText("结业证书", cx, 248);
    // 兹证明
    ctx.fillStyle = C.muted;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText("兹证明", cx, 318);
    // 姓名
    ctx.fillStyle = C.brand700;
    ctx.font = `800 48px ${FONT}`;
    ctx.fillText(d.name, cx, 382);

    // 主句（单行，自动缩字号以适配宽度，不换行）
    const sentence =
      `已完成 ${d.subjectTitle} 全部 ${d.totalKeywords} 个关键词的学习与考核` +
      (d.reflectionDone ? `，并完成全部 ${d.totalChapters} 章反思` : "") +
      "。";
    let fs = 26;
    ctx.font = `400 ${fs}px ${FONT}`;
    while (ctx.measureText(sentence).width > W - 180 && fs > 14) {
      fs -= 1;
      ctx.font = `400 ${fs}px ${FONT}`;
    }
    ctx.fillStyle = C.ink;
    ctx.fillText(sentence, cx, 444);

    // 分隔线
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    hLine(ctx, 200, 492, W - 200);

    // 数据栏 4 列
    const stats: { l: string; v: string; c: string }[] = [
      { l: "通过关键词", v: `${d.completed}/${d.totalKeywords}`, c: C.ink },
      { l: "平均分", v: String(d.avg), c: C.accent700 },
      { l: "章节", v: `${d.totalChapters} 章`, c: C.ink },
      { l: "章节反思", v: `${d.reflected}/${d.totalChapters}`, c: C.ink },
    ];
    const colW = (W - 300) / 4;
    const startX = 150 + colW / 2;
    stats.forEach((st, i) => {
      const x = startX + i * colW;
      ctx.fillStyle = C.muted;
      ctx.font = `500 16px ${FONT}`;
      ctx.fillText(st.l, x, 548);
      ctx.fillStyle = st.c;
      ctx.font = `800 32px ${FONT}`;
      ctx.fillText(st.v, x, 590);
    });
    hLine(ctx, 200, 636, W - 200);

    // 页脚：左 完成日期/用时；右 证书编号 + 印章
    ctx.textAlign = "left";
    ctx.fillStyle = C.muted;
    ctx.font = `400 18px ${FONT}`;
    ctx.fillText(`完成日期  ${d.dateText}`, 120, 712);
    if (d.week) ctx.fillText(`用时  第 ${d.week} 周完成`, 120, 744);

    ctx.textAlign = "right";
    ctx.fillStyle = C.muted;
    ctx.font = `400 15px ${FONT}`;
    ctx.fillText("证书编号", W - 230, 702);
    ctx.fillStyle = C.ink;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(d.no, W - 230, 730);

    // 印章
    ctx.save();
    ctx.translate(W - 150, 720);
    ctx.rotate((-8 * Math.PI) / 180);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.accent700;
    ctx.textAlign = "center";
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText("智学闯关", 0, -4);
    ctx.fillText("结业认证", 0, 16);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = `结业证书-${d.name}-${d.subjectTitle}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    }, "image/png");
  }

  return (
    <button type="button" onClick={draw} className="btn btn-primary print:hidden">
      下载证书图片
    </button>
  );
}

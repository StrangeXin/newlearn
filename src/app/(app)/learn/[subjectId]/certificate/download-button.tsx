"use client";

// 把证书绘制到 canvas 并下载为 PNG 图片（零依赖；用固定 hex 取色，规避 oklch 在
// html2canvas 等库里的兼容问题，输出稳定可控）。

export interface CertImageData {
  name: string;
  subjectTitle: string;
  totalKeywords: number;
  avg: number;
  dateText: string;
  learningMinutes: number;
  totalChapters: number;
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

    const contentW = 980;
    const contentX = (W - contentW) / 2;
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
    ctx.font = `800 60px ${FONT}`;
    ctx.fillText("结业证书", cx, 254);
    // 兹证明
    ctx.fillStyle = C.muted;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText("兹证明", cx, 330);
    // 姓名
    ctx.fillStyle = C.brand700;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText(d.name, cx, 398);

    // 主句（单行，自动缩字号以适配宽度，不换行）
    const sentence = `恭喜你完成 ${d.subjectTitle} 的完整闯关学习。`;
    let fs = 25;
    ctx.font = `400 ${fs}px ${FONT}`;
    while (ctx.measureText(sentence).width > contentW - 180 && fs > 14) {
      fs -= 1;
      ctx.font = `400 ${fs}px ${FONT}`;
    }
    ctx.fillStyle = C.ink;
    ctx.fillText(sentence, cx, 470);

    // 数据栏 4 列
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    hLine(ctx, contentX + 90, 540, contentX + contentW - 90);
    const stats: { l: string; v: string; c: string }[] = [
      { l: "平均终评分", v: String(d.avg), c: C.accent700 },
      { l: "关键词地图", v: `${d.totalKeywords} 词`, c: C.ink },
      { l: "完成章节", v: `${d.totalChapters} 章`, c: C.ink },
      { l: "学习时长", v: `${d.learningMinutes} 分钟`, c: C.ink },
    ];
    const colW = (contentW - 180) / 4;
    const startX = contentX + 90 + colW / 2;
    stats.forEach((st, i) => {
      const x = startX + i * colW;
      ctx.fillStyle = C.muted;
      ctx.font = `500 15px ${FONT}`;
      ctx.fillText(st.l, x, 596);
      ctx.fillStyle = st.c;
      ctx.font = `800 ${st.v.length > 5 ? 25 : 31}px ${FONT}`;
      ctx.fillText(st.v, x, 638);
    });
    hLine(ctx, contentX + 90, 688, contentX + contentW - 90);

    // 页脚：左 完成日期；右 证书编号 + 印章
    ctx.textAlign = "left";
    ctx.fillStyle = C.muted;
    ctx.font = `400 18px ${FONT}`;
    ctx.fillText(`完成日期  ${d.dateText}`, contentX + 90, 782);

    ctx.textAlign = "right";
    ctx.fillStyle = C.muted;
    ctx.font = `400 15px ${FONT}`;
    ctx.fillText("证书编号", contentX + contentW - 170, 772);
    ctx.fillStyle = C.ink;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(d.no, contentX + contentW - 170, 802);

    // 印章
    ctx.save();
    ctx.translate(contentX + contentW - 88, 790);
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

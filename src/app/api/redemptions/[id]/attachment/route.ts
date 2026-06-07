// ===========================================================================
// /api/redemptions/[id]/attachment —— 下载/预览报销凭证（截图/PDF）。
// 鉴权：仅该兑换的申请人本人或管理员可看；凭证存在 DB，不进 public。
// ===========================================================================

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();

  const redemption = await prisma.redemption.findUnique({
    where: { id },
    select: { userId: true, attachmentFile: true },
  });
  if (!redemption?.attachmentFile) {
    return new Response("凭证不存在", { status: 404 });
  }
  // 仅本人或管理员可看
  const isAdmin = user.role !== "EMPLOYEE";
  if (!isAdmin && redemption.userId !== user.id) {
    return new Response("无权查看", { status: 403 });
  }

  const file = redemption.attachmentFile;
  const filename = encodeURIComponent(file.fileName);
  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      // 内联预览（图片/PDF 可直接在浏览器打开），文件名按 RFC 5987 编码
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}

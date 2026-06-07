// 报销凭证上传的共享约束（客户端表单与服务端 action 都用，故不引入任何 server-only 依赖）。

/** 允许的凭证类型：常见截图格式 + PDF。 */
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

/** 单个凭证大小上限（5MB）。 */
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

/** <input accept> 用的字符串。 */
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(",");

/** 提示文案用的大小（MB）。 */
export const MAX_ATTACHMENT_MB = MAX_ATTACHMENT_SIZE / (1024 * 1024);

export function isAllowedAttachmentType(type: string): boolean {
  return (ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(type);
}

import { ILLUSTRATION_BY_TERM } from "./keyword-illustration-manifest";

/**
 * 关键词手绘配图：按关键词文案（term）查清单返回公开路径，没有则返回 null。
 *
 * 旧实现按 `keyword.id` 命名文件并用 existsSync 查找；但 id 由 Prisma 每次 seed 随机生成，
 * 重灌数据库后全部失配（线上更因 serverless 读不到 public/ 而更不可靠）。
 * 现改为按稳定的 term 索引（见 keyword-illustration-manifest.ts），与数据库 id 解耦。
 */
export function getKeywordIllustrationSrc({
  term,
}: {
  /** 兼容旧调用签名，已不再使用 */
  keywordId?: string;
  term: string;
}): string | null {
  return ILLUSTRATION_BY_TERM[term] ?? null;
}

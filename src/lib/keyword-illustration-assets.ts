import { existsSync } from "node:fs";
import { join } from "node:path";

const LEGACY_ASSET_BY_TERM: Record<string, string> = {
  "人工智能(AI)": "/keyword-illustrations/ai-generated.png",
};

export function keywordIllustrationPublicPath(keywordId: string) {
  return `/keyword-illustrations/${keywordId}.png`;
}

export function keywordIllustrationFilePath(keywordId: string) {
  return join(process.cwd(), "public", "keyword-illustrations", `${keywordId}.png`);
}

export function getKeywordIllustrationSrc({
  keywordId,
  term,
}: {
  keywordId: string;
  term: string;
}) {
  if (existsSync(keywordIllustrationFilePath(keywordId))) {
    return keywordIllustrationPublicPath(keywordId);
  }
  return LEGACY_ASSET_BY_TERM[term] ?? null;
}

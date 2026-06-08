"use client";

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function KeywordIllustrationImage({
  term,
  src,
  compact = false,
  preview = true,
}: {
  term: string;
  src?: string | null;
  compact?: boolean;
  preview?: boolean;
}) {
  const image = (
    <figure className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className={`relative bg-white ${compact ? "aspect-[3/2]" : "aspect-video"}`}>
        {src ? (
          <Image
            src={src}
            alt={`${term} 的手绘配图`}
            fill
            sizes={compact ? "(max-width: 1024px) 100vw, 420px" : "(max-width: 896px) 100vw, 848px"}
            className="object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <div className="text-sm font-bold text-ink">待生成手绘配图</div>
              <p className="mt-1 text-xs text-muted">
                这张图会根据关键词、简介和考核要点生成。
              </p>
            </div>
          </div>
        )}
      </div>
    </figure>
  );

  if (!preview || !src) return image;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative block w-full text-left"
          aria-label={`放大查看${term}的手绘配图`}
        >
          {image}
          <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/90 text-brand-700 shadow-sm backdrop-blur transition group-hover:bg-brand-600 group-hover:text-white">
            <Maximize2 className="size-3.5" aria-hidden />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[min(96vw,1100px)] p-3 sm:max-w-[min(96vw,1100px)]">
        <DialogTitle className="sr-only">{term} 的手绘配图</DialogTitle>
        <DialogDescription className="sr-only">
          查看关键词手绘配图的大图预览。
        </DialogDescription>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-white">
          <Image
            src={src}
            alt={`${term} 的手绘配图大图预览`}
            fill
            sizes="96vw"
            className="object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KeywordIllustrationAdminPanel({
  term,
  src,
}: {
  term: string;
  src?: string | null;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-brand-700">关键词手绘配图</div>
          <p className="mt-0.5 text-xs text-muted">由开发人员离线生成并放入项目资源。</p>
        </div>
        {src ? (
          <span className="badge badge-success">已有图片</span>
        ) : (
          <span className="badge badge-muted">待生成</span>
        )}
      </div>
      <div className="max-w-48">
        <KeywordIllustrationImage term={term} src={src} compact />
      </div>
    </section>
  );
}

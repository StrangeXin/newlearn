import Image from "next/image";

const illustrations = {
  home: "/ui-illustrations/home-hero.png",
  learn: "/ui-illustrations/learn-entry.png",
  subject: "/ui-illustrations/subject-map.png",
  chapter: "/ui-illustrations/chapter-home.png",
  certificate: "/ui-illustrations/certificate.png",
} as const;

type IllustrationName = keyof typeof illustrations;

export function UiIllustration({
  name,
  alt,
  className = "",
  imageClassName = "",
  priority = false,
}: {
  name: IllustrationName;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-line bg-white ${className}`}
      aria-hidden={alt ? undefined : true}
    >
      <Image
        src={illustrations[name]}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 42vw, 90vw"
        className={`object-contain p-3 ${imageClassName}`}
        priority={priority}
      />
    </div>
  );
}

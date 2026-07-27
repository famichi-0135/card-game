import type { RuleIllustration as RuleIllustrationData } from "./rule-guide.ts";

export function RuleIllustration({
  illustration,
}: {
  illustration: RuleIllustrationData;
}) {
  return (
    <figure className="min-w-0">
      {illustration.src === undefined ? (
        <div
          aria-label={illustration.alt}
          className="grid aspect-video place-items-center rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500"
          role="img"
        >
          図解を準備中
        </div>
      ) : (
        <img
          alt={illustration.alt}
          className="aspect-video w-full rounded border border-slate-300 object-cover"
          src={illustration.src}
        />
      )}
      <figcaption className="mt-2 text-xs leading-5 text-slate-500">
        {illustration.caption}
      </figcaption>
    </figure>
  );
}

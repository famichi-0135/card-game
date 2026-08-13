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
          className="grid aspect-video place-items-center border border-dashed border-[#3d5a6d] bg-[#07131c]/80 p-6 text-center text-sm text-[#819aa8]"
          role="img"
        >
          図解を準備中
        </div>
      ) : (
        <img
          alt={illustration.alt}
          className="aspect-video w-full border border-[#2f4a5e] object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)]"
          src={illustration.src}
        />
      )}
      <figcaption className="mt-2 text-xs leading-5 text-[#718895]">
        {illustration.caption}
      </figcaption>
    </figure>
  );
}

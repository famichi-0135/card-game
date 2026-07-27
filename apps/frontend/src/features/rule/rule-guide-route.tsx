import { Link } from "react-router";
import { AccountMenu } from "../account/account-menu.tsx";
import {
  RULE_GUIDE_SECTIONS,
  RULE_GUIDE_SETTINGS,
  type RuleGuideSection,
} from "./rule-guide.ts";
import { RuleIllustration } from "./rule-illustration.tsx";

export function RuleGuideRoute() {
  return (
    <main className="min-h-dvh bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 py-4">
          <Link
            className="text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/"
          >
            DISASTAR CARD GAME
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="関連ページ" className="flex flex-wrap gap-2">
              <Link
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                to="/learn"
              >
                防災情報
              </Link>
              <Link
                className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                to="/"
              >
                対戦準備へ
              </Link>
            </nav>
            <AccountMenu />
          </div>
        </header>

        <div className="py-10">
          <section className="border-b border-slate-300 pb-8">
            <p className="text-sm font-semibold text-slate-600">ゲームルール</p>
            <h1 className="mt-2 text-3xl font-semibold">遊び方</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              対戦を始める前に、カードの役割と 1
              ラウンドの流れを確認しましょう。画面では現在できる操作と残り時間が表示されます。
            </p>
          </section>

          <section aria-label="ゲームの基本条件" className="py-8">
            <dl className="grid gap-px overflow-hidden rounded border border-slate-300 bg-slate-300 sm:grid-cols-2 lg:grid-cols-4">
              <RuleMetric
                label="開始時のスタミナ"
                value={`${RULE_GUIDE_SETTINGS.initialStamina}`}
              />
              <RuleMetric
                label="初期手札 / 上限"
                value={`${RULE_GUIDE_SETTINGS.initialHandSize} 枚`}
              />
              <RuleMetric
                label="攻撃グループ"
                value={`最大 ${RULE_GUIDE_SETTINGS.maxAttackGroups} 個`}
              />
              <RuleMetric
                label="最大ラウンド数"
                value={`${RULE_GUIDE_SETTINGS.maxRounds} R`}
              />
            </dl>
          </section>

          <nav
            aria-label="ルール解説の目次"
            className="border-y border-slate-300 py-4"
          >
            <ol className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {RULE_GUIDE_SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a
                    className="text-slate-700 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                    href={`#${section.id}`}
                  >
                    {index + 1}. {section.eyebrow}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="divide-y divide-slate-300">
            {RULE_GUIDE_SECTIONS.map((section, index) => (
              <RuleGuideSectionView
                index={index + 1}
                key={section.id}
                section={section}
              />
            ))}
          </div>

          <aside className="mt-10 border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <h2 className="font-semibold">覚えておくこと</h2>
            <p className="mt-2">
              みなもとは消費してなくなるものではありません。場にある攻撃・サポートカードのコスト分だけ使用中になり、カードが場を離れると再び使えるようになります。
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function RuleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-4">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function RuleGuideSectionView({
  index,
  section,
}: {
  index: number;
  section: RuleGuideSection;
}) {
  return (
    <section className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] lg:items-start">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-600">
          {index}. {section.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id={section.id}>
          {section.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
          {section.description}
        </p>
        <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-700">
          {section.points.map((point) => (
            <li className="border-l-2 border-slate-300 pl-3" key={point}>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <RuleIllustration illustration={section.illustration} />
    </section>
  );
}

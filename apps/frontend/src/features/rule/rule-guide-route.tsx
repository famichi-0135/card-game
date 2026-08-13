import {
  AppPanel,
  AppShell,
  PageHeader,
} from "../../components/application-ui.tsx";
import {
  RULE_GUIDE_SECTIONS,
  RULE_GUIDE_SETTINGS,
  type RuleGuideSection,
} from "./rule-guide.ts";
import { RuleIllustration } from "./rule-illustration.tsx";

export function RuleGuideRoute() {
  return (
    <AppShell contentClassName="max-w-6xl">
      <PageHeader
        description="対戦を始める前に、カードの役割と 1 ラウンドの流れを確認しましょう。画面では現在できる操作と残り時間が表示されます。"
        eyebrow="GAME RULES"
        title="遊び方"
      />

      <section aria-label="ゲームの基本条件" className="py-8">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        className="border-y border-[#2a3d4b] py-5"
      >
        <ol className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {RULE_GUIDE_SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                className="text-[#a9c8db] underline decoration-[#456a81] underline-offset-4 hover:text-[#e8f6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
                href={`#${section.id}`}
              >
                {index + 1}. {section.eyebrow}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="divide-y divide-[#2a3d4b]">
        {RULE_GUIDE_SECTIONS.map((section, index) => (
          <RuleGuideSectionView
            index={index + 1}
            key={section.id}
            section={section}
          />
        ))}
      </div>

      <aside className="mt-10 border border-[#8d6b2d] bg-[linear-gradient(145deg,rgba(64,48,18,.68),rgba(20,17,8,.92))] p-5 text-sm leading-6 text-[#f3dfab] shadow-[inset_0_1px_0_rgba(255,238,185,.08)]">
        <h2 className="font-semibold text-[#ffe6a2]">覚えておくこと</h2>
        <p className="mt-2">
          みなもとは消費してなくなるものではありません。場にある攻撃・サポートカードのコスト分だけ使用中になり、カードが場を離れると再び使えるようになります。
        </p>
      </aside>
    </AppShell>
  );
}

function RuleMetric({ label, value }: { label: string; value: string }) {
  return (
    <AppPanel className="p-4 sm:p-4" label={label}>
      <dd className="text-2xl font-semibold tracking-[-.03em] text-[#edf3f7]">
        {value}
      </dd>
    </AppPanel>
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
    <section className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)] lg:items-start">
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[.18em] text-[#5798c9]">
          {index}. {section.eyebrow}
        </p>
        <h2
          className="mt-3 text-2xl font-semibold tracking-[-.025em] text-[#edf3f7]"
          id={section.id}
        >
          {section.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a7b8c2]">
          {section.description}
        </p>
        <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#b8c7ce]">
          {section.points.map((point) => (
            <li className="border-l-2 border-[#456a81] pl-3" key={point}>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <RuleIllustration illustration={section.illustration} />
    </section>
  );
}

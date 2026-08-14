export type GameBoardOnboardingStep = {
  description: string;
  element: string;
  title: string;
};

export const gameBoardOnboardingSteps: readonly GameBoardOnboardingStep[] = [
  {
    element: '[data-onboarding-target="game-progress"]',
    title: "ラウンド・フェーズ・制限時間",
    description:
      "ここで現在のラウンド、行動するフェーズ、残り時間を確認します。対戦の制限時間は、両者が準備完了して対戦画面へ入ってから開始します。",
  },
  {
    element: '[data-onboarding-target="hand"]',
    title: "手札を確認する",
    description:
      "手札のカードをホバーすると詳細を確認できます。操作可能なカードを選び、ドラッグまたはクリックで使う場所を選択します。",
  },
  {
    element: '[data-onboarding-target="battle-zone"]',
    title: "バトルゾーン",
    description:
      "上段は相手、下段は自分の攻撃グループです。攻撃カードは配置フェーズに自分側へ置きます。",
  },
  {
    element: '[data-onboarding-target="attack-slot"]',
    title: "攻撃カードを配置する",
    description:
      "攻撃カードを空いている枠へドラッグすると、新しい攻撃グループを作れます。黄色く表示された枠だけが配置候補です。",
  },
  {
    element: '[data-onboarding-target="attack-chain"]',
    title: "連鎖させる",
    description:
      "連鎖可能な攻撃カードは、既存の攻撃グループへ重ねて配置できます。連鎖できる組み合わせはカード詳細で確認してください。",
  },
  {
    element: '[data-onboarding-target="discard-zone"]',
    title: "捨て札を使う",
    description:
      "配置フェーズでは、条件を満たす手札を捨て札へ移せます。捨て札をクリックすると、これまでに捨てたカードも確認できます。",
  },
  {
    element: '[data-onboarding-target="support-zone"]',
    title: "サポートカードを使う",
    description:
      "サポートフェーズでは、サポートカードをこのゾーンへドラッグします。対象が必要なカードは、その後に対象を選んでから確定します。",
  },
  {
    element: '[data-onboarding-target="phase-finish"]',
    title: "操作を確定して次へ進む",
    description:
      "配置やサポートが終わったら、ここからフェーズを終了します。ドラッグが難しい場合は、カードをクリックしてから操作先をクリックまたはEnterで選べます。最終的な可否はサーバーが判定します。",
  },
];

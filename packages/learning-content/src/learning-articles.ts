import type { LearningArticle } from "./article-types.js";

export const learningArticles: readonly LearningArticle[] = Object.freeze([
  {
    id: "weather-information",
    slug: "weather-information",
    title: "防災気象情報を確認する",
    summary:
      "大雨や台風の前に、住んでいる地域に関係する気象情報の確認先を決めておきます。",
    category: "disaster-information",
    tags: Object.freeze(["大雨", "台風", "気象情報"]),
    sourceName: "気象庁「防災情報」",
    sourceUrl: "https://www.jma.go.jp/jma/menu/menuflash.html",
    reviewedAt: "2026-07-23",
    status: "published",
    relatedCardDefinitionIds: Object.freeze([
      "disaster-attack-4",
      "disaster-attack-8",
    ]),
    body: `## 平時に確認すること

- 気象庁の防災情報で、自宅や学校、職場のある地域の情報を確認する場所を決めます。
- 大雨、洪水、土砂災害、高潮など、地域で起こりうる災害の種類を家族や周囲の人と話し合います。
- 自治体からの避難情報を受け取る方法も、あわせて確認します。

## 災害が近づいたとき

気象情報だけで判断せず、自治体が出す避難情報、地域の状況、ハザードマップをあわせて確認します。情報の名称や運用は更新されることがあるため、最新の公式情報を確認してください。`,
  },
  {
    id: "hazard-map",
    slug: "hazard-map",
    title: "ハザードマップで地域の危険性を確認する",
    summary:
      "住んでいる場所やよく行く場所に、どのような災害リスクがあるかを平時に確認します。",
    category: "preparedness-action",
    tags: Object.freeze(["ハザードマップ", "浸水", "土砂災害"]),
    sourceName: "国土地理院「ハザードマップポータルサイト」",
    sourceUrl:
      "https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/pamphlet/pamphlet.html",
    reviewedAt: "2026-07-23",
    status: "published",
    relatedCardDefinitionIds: Object.freeze(["countermeasure-attack-1"]),
    body: `## 確認する場所

- 自宅、学校、職場と、そこへ向かう経路を地図で確認します。
- 洪水、土砂災害、高潮など、地域に関係する災害の情報を見比べます。
- 自治体が公開するハザードマップも確認し、更新日を確かめます。

## 事前に決めること

災害が起きてから地図を探すのではなく、避難先や連絡方法を平時に家族や周囲の人と確認します。実際の避難では、自治体の避難情報とその時点の安全な行動を優先してください。`,
  },
  {
    id: "evacuation-actions",
    slug: "evacuation-actions",
    title: "避難行動を平時に考える",
    summary:
      "地域の危険性と自宅の条件をもとに、避難先と連絡方法を前もって確認します。",
    category: "preparedness-action",
    tags: Object.freeze(["避難", "警戒レベル", "家族"]),
    sourceName: "内閣府（防災担当）「避難情報に関するガイドライン」",
    sourceUrl:
      "https://www.bousai.go.jp/oukyu/hinanjouhou/r3_hinanjouhou_guideline/index.html",
    reviewedAt: "2026-07-23",
    status: "published",
    relatedCardDefinitionIds: Object.freeze([
      "countermeasure-attack-8",
      "countermeasure-attack-9",
    ]),
    body: `## 避難先を確認する

内閣府の避難行動判定フローは、ハザードマップとあわせて地域の災害リスクや住宅の条件を考え、避難行動や避難先を確認するための資料です。地域によって使える避難先や条件は異なるため、自治体の情報を確認します。

## 連絡方法を決める

- 家族や周囲の人と、災害時に連絡を取る方法を決めます。
- 外出中に災害が起きた場合を想定し、集合場所や安否確認の方法を決めます。
- 避難情報が出たときは、自治体の指示と周囲の安全を優先します。`,
  },
  {
    id: "information-services",
    slug: "information-services",
    title: "防災情報を受け取る手段を確認する",
    summary:
      "公式情報をどこで受け取るかを決め、災害時に必要な情報へすぐアクセスできるようにします。",
    category: "preparedness-service",
    tags: Object.freeze(["防災サービス", "気象庁", "自治体"]),
    sourceName: "気象庁「防災気象情報などの入手方法」",
    sourceUrl:
      "https://www.jma.go.jp/jma/kishou/know/ame_chuui/ame_chuui_p9.html",
    reviewedAt: "2026-07-23",
    status: "published",
    relatedCardDefinitionIds: Object.freeze(["countermeasure-attack-7"]),
    body: `## 情報源を決める

気象庁の防災情報、自治体の公式サイトや公式配信、テレビやラジオなど、複数の公式情報源を平時に確認しておきます。通信が不安定になる場合もあるため、家族や周囲の人と情報の受け取り方を話し合います。

## 最新情報を優先する

このサイトの記事は学習用の情報です。災害時は、過去に保存した情報ではなく、気象庁、自治体、報道機関などが発信する最新の公式情報を確認してください。`,
  },
]);

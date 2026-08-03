import type { CardDefinitionId } from "@disastar/game-engine/contracts";
import type { LearningArticle, LearningCategory } from "./article-types.js";

type CardLearningArticleSpec = Readonly<{
  slug: string;
  title: string;
  summary: string;
  category: LearningCategory;
  tags: readonly string[];
  cardDefinitionId: CardDefinitionId;
  body: string;
}>;

const articleSources: Record<
  LearningCategory,
  Readonly<{ name: string; url: string }>
> = {
  "disaster-information": {
    name: "気象庁「防災情報」",
    url: "https://www.jma.go.jp/jma/menu/menuflash.html",
  },
  "preparedness-action": {
    name: "内閣府（防災担当）「防災情報」",
    url: "https://www.bousai.go.jp/",
  },
  "preparedness-service": {
    name: "消防庁「防災・危機管理eカレッジ」",
    url: "https://www.fdma.go.jp/",
  },
};

const articleSpecs: readonly CardLearningArticleSpec[] = [
  {
    slug: "card-disaster-mana-1",
    title: "大地の変化を知る",
    summary:
      "地震、土砂災害、火山噴火など、大地の変化で起こる災害の特徴を学びます。",
    category: "disaster-information",
    tags: ["地震", "土砂災害", "火山"],
    cardDefinitionId: "disaster-mana-1",
    body:
      "## 大地の災害\n\n" +
      "地面の動きは、地震だけでなく、土砂災害や火山噴火にもつながります。災害の種類によって危険な場所や避難のタイミングが異なるため、自分の地域で想定される災害を確認しておくことが大切です。\n\n" +
      "## 平時にできること\n\n" +
      "- ハザードマップで活断層、土砂災害警戒区域、火山周辺の危険区域を確認します。\n" +
      "- 家具の転倒防止や、避難経路をふさがない室内配置を行います。\n" +
      "- 気象庁や自治体が発表する最新の情報を確認します。",
  },
  {
    slug: "card-disaster-mana-2",
    title: "水の動きと災害を知る",
    summary:
      "大雨、河川の氾濫、津波など、水の動きが生む災害への備えを学びます。",
    category: "disaster-information",
    tags: ["大雨", "洪水", "津波"],
    cardDefinitionId: "disaster-mana-2",
    body:
      "## 水による災害\n\n" +
      "大雨で河川の水位が上がる洪水、斜面が崩れる土砂災害、地震による津波は、発生場所や進み方が異なります。低い場所や川・海の近くでは、少しの時間で安全な場所が変わることがあります。\n\n" +
      "## 確認すること\n\n" +
      "- 浸水想定区域と、浸水しにくい避難先をハザードマップで確認します。\n" +
      "- 雨量、水位、津波の情報を複数の公式情報源で確認します。\n" +
      "- 危険が高まる前に移動できるよう、避難開始の目安を家族と決めます。",
  },
  {
    slug: "card-disaster-mana-3",
    title: "空と大気の変化を知る",
    summary: "台風、強風、猛暑など、空と大気の変化がもたらす危険を学びます。",
    category: "disaster-information",
    tags: ["台風", "強風", "猛暑"],
    cardDefinitionId: "disaster-mana-3",
    body:
      "## 空から来る危険\n\n" +
      "台風や低気圧は、強風だけでなく大雨、高潮、土砂災害を同時に引き起こすことがあります。猛暑も健康に影響する災害の一つで、屋外活動や避難の方法を見直す必要があります。\n\n" +
      "## 早めの判断\n\n" +
      "- 台風の進路や警報の発表前から、飛ばされやすい物を片付けます。\n" +
      "- 暑さ指数や熱中症警戒情報を確認し、無理な外出を避けます。\n" +
      "- 危険が迫ってからではなく、交通や停電の影響が少ないうちに行動します。",
  },
  {
    slug: "card-disaster-attack-1",
    title: "小さな地震にも備える",
    summary:
      "小さな揺れをきっかけに、日頃の地震対策を点検する方法を確認します。",
    category: "disaster-information",
    tags: ["地震", "初動", "防災点検"],
    cardDefinitionId: "disaster-attack-1",
    body:
      "## 小さな揺れを点検の機会にする\n\n" +
      "感じないほどの微小地震が大きな地震を直接予告するとは限りません。しかし、いつ起きてもおかしくない地震への備えを見直すきっかけにはできます。\n\n" +
      "## 点検のポイント\n\n" +
      "- 家具や家電が倒れないか、固定具のゆるみを確認します。\n" +
      "- 懐中電灯、靴、モバイルバッテリーをすぐ取れる場所に置きます。\n" +
      "- 家族との連絡方法と、一時的に身を寄せる場所を確認します。",
  },
  {
    slug: "card-disaster-attack-2",
    title: "直下型地震の揺れに備える",
    summary:
      "震源が浅い地震で強い揺れが起こる仕組みと、屋内での安全確保を学びます。",
    category: "disaster-information",
    tags: ["直下型地震", "強い揺れ", "屋内安全"],
    cardDefinitionId: "disaster-attack-2",
    body:
      "## 直下型地震の特徴\n\n" +
      "震源が都市の近くや浅い場所にあると、短い時間で非常に強い揺れが届くことがあります。揺れの大きさだけでなく、家具の転倒、ガラスの破損、火災にも注意が必要です。\n\n" +
      "## 揺れている間の行動\n\n" +
      "- まず低い姿勢を取り、丈夫な机の下などで頭を守ります。\n" +
      "- 揺れが収まるまで、慌てて外へ飛び出しません。\n" +
      "- 火元の確認や避難は、周囲の安全を確かめてから行います。",
  },
  {
    slug: "card-disaster-attack-3",
    title: "海溝型巨大地震と長い揺れ",
    summary:
      "海溝型地震で起こる広域の揺れや津波を想定し、早期避難の理由を学びます。",
    category: "disaster-information",
    tags: ["海溝型地震", "長周期地震動", "津波"],
    cardDefinitionId: "disaster-attack-3",
    body:
      "## 海溝型地震\n\n" +
      "プレート境界で起きる海溝型地震は、広い範囲に強い揺れを長く伝え、海底の変動によって津波を発生させることがあります。揺れが長く続いたときは、津波の可能性も考えます。\n\n" +
      "## 沿岸での基本行動\n\n" +
      "- 強い揺れ、または長い揺れを感じたら、警報を待たず高い場所へ移動します。\n" +
      "- 海や川の様子を見に行かず、公式の避難情報に従います。\n" +
      "- 避難経路を複数確認し、夜間や停電時にも歩けるか試します。",
  },
  {
    slug: "card-disaster-attack-5",
    title: "河川の氾濫が起こるまで",
    summary:
      "大雨で河川の水位が上がり、氾濫するまでの変化と避難の考え方を学びます。",
    category: "disaster-information",
    tags: ["河川", "氾濫", "洪水"],
    cardDefinitionId: "disaster-attack-5",
    body:
      "## 氾濫の種類\n\n" +
      "大量の雨が川へ集まると水位が上がり、堤防を越えたり、堤防が壊れたりして水が市街地へ流れ出します。川から離れた場所でも、雨水が排水しきれない内水氾濫が起こることがあります。\n\n" +
      "## 避難の判断\n\n" +
      "- 水位、雨量、自治体の避難情報を早めに確認します。\n" +
      "- 浸水が始まってからの徒歩移動は危険なため、早い段階で避難します。\n" +
      "- 逃げ遅れた場合は、無理に水の中を進まず、建物の上階など安全な場所へ移ります。",
  },
  {
    slug: "card-disaster-attack-6",
    title: "想定を超える津波から逃げる",
    summary:
      "防潮堤の高さを超える津波を想定し、施設に頼りきらない避難を学びます。",
    category: "disaster-information",
    tags: ["津波", "防潮堤", "高台避難"],
    cardDefinitionId: "disaster-attack-6",
    body:
      "## 津波は何度も来る\n\n" +
      "津波は第一波が最大とは限らず、河川を遡上して内陸へ入り込むこともあります。防潮堤は被害を減らす施設ですが、想定を超える津波を完全に止めるものではありません。\n\n" +
      "## 命を守る避難\n\n" +
      "- 強い揺れや長い揺れを感じたら、すぐに海や川から離れます。\n" +
      "- 防潮堤や警報を確認するために、海岸へ戻ってはいけません。\n" +
      "- 津波警報が解除されるまで、十分な高さと距離のある場所で待ちます。",
  },
  {
    slug: "card-disaster-attack-7",
    title: "温帯低気圧の雨と風を読む",
    summary:
      "台風から変化することもある温帯低気圧の特徴と、雨や風への備えを確認します。",
    category: "disaster-information",
    tags: ["温帯低気圧", "大雨", "強風"],
    cardDefinitionId: "disaster-attack-7",
    body:
      "## 温帯低気圧の特徴\n\n" +
      "温帯低気圧は、暖かい空気と冷たい空気の境目で発達します。台風が温帯低気圧に変わっても、雨や風が弱くなるとは限らず、前線と重なると広い範囲で荒天になります。\n\n" +
      "## 天気が変わる前に\n\n" +
      "- 台風の名前が変わっても、気象警報と雨雲の動きを確認します。\n" +
      "- 屋外の物を固定し、停電に備えて照明や充電器を用意します。\n" +
      "- 交通機関の計画運休や自治体の情報も確認し、移動を延期します。",
  },
  {
    slug: "card-disaster-attack-9",
    title: "液状化現象と地盤の弱点",
    summary:
      "地震で水を含んだ砂地盤が液体のようになる液状化現象と、その影響を学びます。",
    category: "disaster-information",
    tags: ["液状化", "地盤", "ライフライン"],
    cardDefinitionId: "disaster-attack-9",
    body:
      "## 液状化現象\n\n" +
      "地下水を多く含む砂質地盤が強く揺さぶられると、粒子の支え合いが崩れ、地盤が一時的に液体のようになります。建物の沈下や傾き、マンホールの浮上、道路や水道管の損傷につながります。\n\n" +
      "## 事前に確認すること\n\n" +
      "- 自治体の液状化ハザードマップや地盤情報を確認します。\n" +
      "- 避難先までの道路が使えない場合の代替経路を考えます。\n" +
      "- 水や携帯トイレなど、ライフライン停止に備えた備蓄を用意します。",
  },
  {
    slug: "card-disaster-attack-10",
    title: "津波の河川遡上に注意する",
    summary:
      "津波が川を逆流して内陸へ進む河川遡上の危険と、避難の方向を確認します。",
    category: "disaster-information",
    tags: ["津波", "河川遡上", "避難"],
    cardDefinitionId: "disaster-attack-10",
    body:
      "## 河川遡上とは\n\n" +
      "津波は海岸だけでなく、川の水面を伝わって上流へ進むことがあります。川幅が狭くなる場所や堤防の近くでは水があふれ、海から離れた地域にも被害が及ぶことがあります。\n\n" +
      "## 避難時の注意\n\n" +
      "- 津波警報が出たら、海だけでなく河口や川沿いからも離れます。\n" +
      "- 川の様子を見に行かず、内陸または高台へ向かいます。\n" +
      "- 避難先と経路を地図で確認し、橋を渡らない経路も用意します。",
  },
  {
    slug: "card-disaster-attack-11",
    title: "偏西風と火山灰の広がり",
    summary:
      "上空の偏西風で火山灰が遠くへ運ばれる仕組みと、健康・交通への影響を学びます。",
    category: "disaster-information",
    tags: ["火山灰", "偏西風", "航空"],
    cardDefinitionId: "disaster-attack-11",
    body:
      "## 火山灰は遠くまで届く\n\n" +
      "日本付近の上空では西から東へ風が吹くことが多く、噴火で放出された火山灰が広い範囲へ運ばれます。火山の近くにいなくても、視界不良、航空便や鉄道の乱れ、呼吸器への影響が起こることがあります。\n\n" +
      "## 火山灰への備え\n\n" +
      "- 気象庁の降灰予報や自治体の情報を確認します。\n" +
      "- 外出時はマスクやゴーグルを使い、灰を吸い込まないようにします。\n" +
      "- 車の運転や清掃は、視界と路面の安全を確認してから行います。",
  },
  {
    slug: "card-disaster-support-remove-support",
    title: "ライフラインが途絶えたときの生活",
    summary:
      "電気、ガス、水道、通信が止まったときに、生活を維持する方法を確認します。",
    category: "preparedness-action",
    tags: ["ライフライン", "停電", "断水"],
    cardDefinitionId: "disaster-support-remove-support",
    body:
      "## 止まる前提で備える\n\n" +
      "災害時は電気・ガス・水道・通信が同時に使えなくなることがあります。復旧までの時間は地域や被害によって異なるため、最低限の生活を自分で維持できる準備が必要です。\n\n" +
      "## 備蓄と情報\n\n" +
      "- 飲料水、食料、携帯トイレ、明かり、電池を準備します。\n" +
      "- モバイルバッテリーや乾電池式ラジオを用意します。\n" +
      "- 断水時は水を無駄にせず、自治体の給水情報を確認します。",
  },
  {
    slug: "card-disaster-support-building-collapse",
    title: "建物の倒壊から身を守る",
    summary:
      "地震による建物の倒壊リスクを減らし、倒壊後に近づかないための知識を学びます。",
    category: "preparedness-action",
    tags: ["建物", "倒壊", "耐震"],
    cardDefinitionId: "disaster-support-reduce-mana",
    body:
      "## 倒壊の危険\n\n" +
      "強い揺れでは、古い建物や耐震性が不足する建物が倒壊することがあります。建物が無事に見えても、内部や基礎が損傷している場合があります。\n\n" +
      "## 命を守る行動\n\n" +
      "- 自宅の耐震診断や改修について自治体へ相談します。\n" +
      "- 揺れの最中は家具から離れ、頭を守ります。\n" +
      "- 被災した建物には無断で入らず、専門家や自治体の安全確認を待ちます。",
  },
  {
    slug: "card-disaster-support-earthquake-fire",
    title: "地震後の火災を防ぐ",
    summary:
      "地震後に起こる同時多発火災の原因と、出火防止・避難の基本を確認します。",
    category: "preparedness-action",
    tags: ["地震火災", "通電火災", "初期消火"],
    cardDefinitionId: "disaster-support-stamina",
    body:
      "## 地震火災の原因\n\n" +
      "地震では、調理器具の転倒、ガス漏れ、電気配線の損傷などが出火につながります。停電から復旧したときに、壊れた電気製品から出火する通電火災にも注意が必要です。\n\n" +
      "## 出火を防ぐ\n\n" +
      "- 揺れが収まったら、可能な範囲で火を止め、ブレーカーを確認します。\n" +
      "- 燃え広がっている場合は消火に固執せず、すぐに避難します。\n" +
      "- 避難するときは電気製品の電源を切り、ブレーカーを落とします。",
  },
  {
    slug: "card-disaster-support-debris-flow",
    title: "土石流が起こる場所を知る",
    summary:
      "大雨で土砂や流木が一気に流れる土石流の前兆と、避難の判断を学びます。",
    category: "disaster-information",
    tags: ["土石流", "土砂災害", "前兆"],
    cardDefinitionId: "disaster-support-remove-group",
    body:
      "## 土石流の特徴\n\n" +
      "土石流は、谷や沢にたまった土砂と水が一体となって高速で流れ下る現象です。大雨のあとに急に発生することがあり、流れの方向にある住宅や道路を短時間で覆います。\n\n" +
      "## 前兆と避難\n\n" +
      "- 山鳴り、川の濁り、流木、斜面の亀裂などに注意します。\n" +
      "- 土砂災害警戒情報や避難指示が出たら、早めに斜面や沢から離れます。\n" +
      "- 夜間や大雨の中での移動が危険になる前に、明るいうちに避難します。",
  },
  {
    slug: "card-disaster-support-magma-pressure",
    title: "火山の噴火に備える",
    summary:
      "火山活動の変化を知らせる情報を確認し、噴火時の降灰や避難に備えます。",
    category: "disaster-information",
    tags: ["火山", "噴火", "降灰"],
    cardDefinitionId: "disaster-support-destroy-draw",
    body:
      "## 噴火前の情報\n\n" +
      "火山では、火山性地震や地殻変動などの変化が観測されることがあります。噴火警戒レベルは、火山の状況と必要な防災対応を示すため、数字だけでなく自治体の避難情報とあわせて確認します。\n\n" +
      "## 噴火が起きたら\n\n" +
      "- 火口や立入規制区域に近づかず、自治体の指示に従います。\n" +
      "- 降灰に備えてマスク、ゴーグル、飲料水を用意します。\n" +
      "- 火山灰が降る地域では、車の利用や屋外活動を控えます。",
  },
  {
    slug: "card-disaster-support-westerlies",
    title: "偏西風が運ぶ火山灰への備え",
    summary: "火山灰を遠くへ運ぶ上空の風と、健康や交通への備えを確認します。",
    category: "preparedness-service",
    tags: ["火山灰", "偏西風", "防災情報"],
    cardDefinitionId: "disaster-support-group-boost",
    body:
      "## 広域に影響する降灰\n\n" +
      "上空の偏西風は、火山から離れた地域にも火山灰を運びます。少量の灰でも、目や喉への刺激、機器の故障、道路や鉄道の運行への影響が生じることがあります。\n\n" +
      "## 情報を使う\n\n" +
      "- 気象庁の降灰予報と自治体の防災情報を確認します。\n" +
      "- 外出が必要な場合は、マスクや目を守る用品を準備します。\n" +
      "- 灰が積もった道路や屋根では、転倒や落下に注意して無理に作業しません。",
  },
  {
    slug: "card-countermeasure-mana-1",
    title: "災害の前に備える力を育てる",
    summary:
      "ハザードマップ、備蓄、訓練を組み合わせ、災害前にできる準備を整理します。",
    category: "preparedness-action",
    tags: ["備蓄", "訓練", "ハザードマップ"],
    cardDefinitionId: "countermeasure-mana-1",
    body:
      "## 備えは組み合わせる\n\n" +
      "防災では、地図で危険を知ること、必要な物を備えること、実際に行動を練習することを組み合わせます。一つの対策だけに頼らず、家族や地域の事情に合わせて見直します。\n\n" +
      "## 最初の一歩\n\n" +
      "- 自宅、学校、職場のハザードマップを確認します。\n" +
      "- 水、食料、携帯トイレ、明かりを無理なく備蓄します。\n" +
      "- 避難先と連絡方法を家族で話し合い、実際に歩いてみます。",
  },
  {
    slug: "card-countermeasure-mana-2",
    title: "被害を減らす守りを知る",
    summary:
      "耐震化、堤防、地盤対策など、災害の被害を小さくする仕組みを学びます。",
    category: "preparedness-action",
    tags: ["減災", "耐震化", "治水"],
    cardDefinitionId: "countermeasure-mana-2",
    body:
      "## 守る対策\n\n" +
      "建物の耐震化や家具の固定、堤防や防潮堤などの施設は、災害の力を弱めたり、被害が広がる時間を遅らせたりします。ただし、施設だけで被害を完全に防げるわけではありません。\n\n" +
      "## 自分で確認すること\n\n" +
      "- 住まいの耐震性と、家具の転倒防止を点検します。\n" +
      "- 水害や津波の施設がどこにあるか、役割と限界を理解します。\n" +
      "- 施設を越える災害も想定し、避難先を別に決めます。",
  },
  {
    slug: "card-countermeasure-mana-3",
    title: "人と情報をつなげる防災",
    summary:
      "避難情報の共有や地域の助け合いによって、災害時の行動を広げる方法を確認します。",
    category: "preparedness-service",
    tags: ["地域連携", "情報共有", "共助"],
    cardDefinitionId: "countermeasure-mana-3",
    body:
      "## つながりが支えになる\n\n" +
      "災害時は、一人で情報を集めたり行動したりすることが難しくなります。家族、近所、学校、職場などで役割と連絡方法を決めておくと、助けを求める人を見つけやすくなります。\n\n" +
      "## 平時の準備\n\n" +
      "- 避難に支援が必要な人と、支援する人を地域で確認します。\n" +
      "- 災害用伝言サービスや自治体の配信に登録します。\n" +
      "- 不確かな情報を広めず、公式情報を確認してから共有します。",
  },
  {
    slug: "card-countermeasure-attack-2",
    title: "家具の固定でけがを防ぐ",
    summary:
      "家具の転倒・移動・落下を防ぎ、揺れの最中と避難時の安全を確保します。",
    category: "preparedness-action",
    tags: ["家具固定", "転倒防止", "室内安全"],
    cardDefinitionId: "countermeasure-attack-2",
    body:
      "## 家具は凶器になる\n\n" +
      "地震では、家具が倒れるだけでなく、収納物が落ちたり、家具が移動して出入口をふさいだりします。寝室や子ども部屋など、長く過ごす場所から対策します。\n\n" +
      "## 固定のポイント\n\n" +
      "- 壁や柱の位置に合わせて、家具を金具やベルトで固定します。\n" +
      "- 高い場所に重い物や割れ物を置かないようにします。\n" +
      "- 避難経路と寝る場所の周りに、倒れやすい物を置きません。",
  },
  {
    slug: "card-countermeasure-attack-3",
    title: "建物の耐震改修を考える",
    summary: "建物の耐震性を確認し、診断や改修につなげるための基本を学びます。",
    category: "preparedness-action",
    tags: ["耐震診断", "耐震改修", "住宅"],
    cardDefinitionId: "countermeasure-attack-3",
    body:
      "## 耐震性を確認する\n\n" +
      "建築された時期や構造によって、地震に対する強さは異なります。古い木造住宅などは、自治体の相談窓口で耐震診断や改修支援の制度を確認できます。\n\n" +
      "## 改修の進め方\n\n" +
      "- まず専門家や自治体へ相談し、建物の弱点を把握します。\n" +
      "- 壁、柱、基礎など、建物全体のバランスを考えて改修します。\n" +
      "- 改修中も、家具固定や避難計画など別の対策を続けます。",
  },
  {
    slug: "card-countermeasure-attack-4",
    title: "土のうと水のうで浸水を抑える",
    summary:
      "家の入口などへの浸水を一時的に抑える土のう・水のうの使い方と限界を学びます。",
    category: "preparedness-action",
    tags: ["土のう", "水のう", "浸水対策"],
    cardDefinitionId: "countermeasure-attack-4",
    body:
      "## 浸水を遅らせる対策\n\n" +
      "土のうや水のうは、玄関や車庫などから水が入るのを一時的に遅らせる方法です。短時間の浸水対策には役立ちますが、流れの強い水や津波を止めるものではありません。\n\n" +
      "## 使う前に\n\n" +
      "- 自治体の配布場所や、設置方法を平時に確認します。\n" +
      "- 排水口や側溝を掃除し、水が流れる経路を確保します。\n" +
      "- 危険が迫っているときは設置より早期避難を優先します。",
  },
  {
    slug: "card-countermeasure-attack-5",
    title: "堤防の役割と限界を知る",
    summary:
      "堤防が洪水を防ぐ仕組みと、堤防を越える水害に備える考え方を確認します。",
    category: "preparedness-service",
    tags: ["堤防", "治水", "洪水"],
    cardDefinitionId: "countermeasure-attack-5",
    body:
      "## 堤防の役割\n\n" +
      "堤防は、河川の水を川の中に収め、まちへあふれにくくする治水施設です。水位を下げる効果はありますが、想定を超える雨や堤防の損傷を完全になくすことはできません。\n\n" +
      "## 施設と避難を組み合わせる\n\n" +
      "- 自宅が浸水想定区域にあるか確認します。\n" +
      "- 水位情報と避難情報を確認し、早めに安全な場所へ移動します。\n" +
      "- 堤防や川の状態を見に行かず、近づかないことを徹底します。",
  },
  {
    slug: "card-countermeasure-attack-6",
    title: "防潮堤が守るものと避難",
    summary:
      "防潮堤が高潮や津波の被害を減らす仕組みと、施設を越える災害への備えを学びます。",
    category: "preparedness-service",
    tags: ["防潮堤", "高潮", "津波"],
    cardDefinitionId: "countermeasure-attack-6",
    body:
      "## 防潮堤の役割\n\n" +
      "防潮堤は、海からの高潮や津波の水を内陸へ入りにくくし、到達を遅らせる施設です。高さや構造には限界があり、施設がある地域でも避難が必要になることがあります。\n\n" +
      "## 沿岸地域の備え\n\n" +
      "- 防潮堤の内側にある避難先と、高さ・距離を確認します。\n" +
      "- 強い揺れや津波警報があれば、施設を確認せず高台へ向かいます。\n" +
      "- 第一波のあとも戻らず、警報が解除されるまで待ちます。",
  },
  {
    slug: "card-countermeasure-attack-10",
    title: "液状化を減らす地盤改良",
    summary:
      "地盤を固めたり水の圧力を逃がしたりして、液状化の被害を減らす方法を確認します。",
    category: "preparedness-service",
    tags: ["地盤改良", "液状化", "地震"],
    cardDefinitionId: "countermeasure-attack-10",
    body:
      "## 地盤改良の考え方\n\n" +
      "液状化対策には、地盤を締め固める、杭で建物を支える、地下水の圧力を逃がすなどの方法があります。土地の状態や建物によって適した工法が異なるため、専門家の調査が必要です。\n\n" +
      "## 住まいでの確認\n\n" +
      "- 自治体の地盤情報や過去の被害を確認します。\n" +
      "- 新築や改修の際は、地盤調査の結果をもとに対策を検討します。\n" +
      "- 道路や水道管の被害も想定し、避難経路と備蓄を準備します。",
  },
  {
    slug: "card-countermeasure-attack-11",
    title: "自助・共助・公助をつなぐ",
    summary:
      "自分で備える力、地域で助け合う力、行政の支援を組み合わせる考え方を学びます。",
    category: "preparedness-service",
    tags: ["自助", "共助", "公助"],
    cardDefinitionId: "countermeasure-attack-11",
    body:
      "## 三つの力\n\n" +
      "自助は自分や家族を守る備え、共助は近所や地域で支え合う活動、公助は自治体や国による支援です。災害の直後は公助がすぐ届かないこともあるため、三つを組み合わせることが重要です。\n\n" +
      "## 地域でできること\n\n" +
      "- 近所の避難場所と、支援が必要な人を確認します。\n" +
      "- 防災訓練や地域の連絡網に参加します。\n" +
      "- 自分でできる備えを続けながら、支援情報を公式窓口で確認します。",
  },
  {
    slug: "card-countermeasure-support-training",
    title: "津波・地震避難訓練を実践する",
    summary: "揺れたら高台へ移動する行動を、訓練で身につける方法を確認します。",
    category: "preparedness-action",
    tags: ["避難訓練", "津波", "地震"],
    cardDefinitionId: "countermeasure-support-group-boost",
    body:
      "## 訓練の意味\n\n" +
      "地震や津波の直後は、驚きや停電で判断が難しくなります。平時に歩いて避難する経験があると、危険な場所を避けて素早く行動しやすくなります。\n\n" +
      "## 訓練で確認すること\n\n" +
      "- 揺れを感じたら、海や川から離れて高い場所へ向かいます。\n" +
      "- 昼夜や天候が違う場合の経路も確認します。\n" +
      "- 訓練後に、所要時間、危険箇所、支援が必要な人を見直します。",
  },
  {
    slug: "card-countermeasure-support-community-check",
    title: "自主防災組織と安否確認",
    summary:
      "地域で役割を分担し、災害時に安否を確認して助け合う仕組みを学びます。",
    category: "preparedness-service",
    tags: ["自主防災組織", "安否確認", "共助"],
    cardDefinitionId: "countermeasure-support-remove-support",
    body:
      "## 地域で支える\n\n" +
      "自主防災組織は、住民が協力して初期消火、避難誘導、安否確認などを行う組織です。行政の救援を待つだけでなく、身近な人の状況を確認する役割があります。\n\n" +
      "## 事前に決めること\n\n" +
      "- 安否確認の方法と、情報を集める場所を決めます。\n" +
      "- 高齢者、障害のある人、乳幼児など支援が必要な人を把握します。\n" +
      "- 活動する人自身の安全を確保し、危険な場所には入らないルールを作ります。",
  },
  {
    slug: "card-countermeasure-support-stockpile",
    title: "非常用備蓄セットを整える",
    summary:
      "水、食料、トイレなど、避難生活を支える備蓄を無理なく整える方法を確認します。",
    category: "preparedness-action",
    tags: ["備蓄", "非常食", "携帯トイレ"],
    cardDefinitionId: "countermeasure-support-reduce-mana",
    body:
      "## まず必要なもの\n\n" +
      "災害直後は水道、電気、物流が止まる可能性があります。飲料水と食料だけでなく、携帯トイレ、明かり、衛生用品、薬など、普段の生活に必要な物を備えます。\n\n" +
      "## 続けられる備蓄\n\n" +
      "- 普段使う食品を少し多めに買い、使った分を補充します。\n" +
      "- 乳幼児用品、持病の薬、眼鏡など個別の必需品を確認します。\n" +
      "- 消費期限と電池を定期的に点検し、取り出しやすく保管します。",
  },
  {
    slug: "card-countermeasure-support-first-aid",
    title: "トリアージと応急救護",
    summary:
      "多数の負傷者が出たときのトリアージの考え方と、応急手当の基本を学びます。",
    category: "preparedness-service",
    tags: ["応急手当", "トリアージ", "救護"],
    cardDefinitionId: "countermeasure-support-stamina",
    body:
      "## 救護の優先順位\n\n" +
      "トリアージは、限られた人員や物資でできるだけ多くの命を救うため、負傷者の緊急度を判断する方法です。一般の人は無理に判定せず、周囲の安全を確保して救急要請と応急手当を行います。\n\n" +
      "## できる応急手当\n\n" +
      "- 出血があれば清潔な布で圧迫し、意識と呼吸を確認します。\n" +
      "- AEDや救命講習の場所を平時に確認します。\n" +
      "- 自分が危険になる場所へ入らず、専門機関の指示に従います。",
  },
  {
    slug: "card-countermeasure-support-emergency-safety",
    title: "警戒レベル5の緊急安全確保",
    summary:
      "危険が切迫したときの警戒レベル5の意味と、命を守る最終的な行動を確認します。",
    category: "preparedness-action",
    tags: ["警戒レベル", "緊急安全確保", "避難"],
    cardDefinitionId: "countermeasure-support-remove-group",
    body:
      "## 警戒レベル5の意味\n\n" +
      "警戒レベル5は、すでに災害が発生または切迫し、立退き避難が安全にできない場合に命を守る行動を取る段階です。レベル5を待って避難を始めるのではなく、レベル3や4の段階で安全な場所へ移動します。\n\n" +
      "## 逃げ遅れたとき\n\n" +
      "- その場で最も安全な部屋や建物の上階へ移ります。\n" +
      "- 川、崖、地下など危険な場所から離れます。\n" +
      "- 自治体の最新情報を確認し、可能なら周囲にも知らせます。",
  },
  {
    slug: "card-countermeasure-support-temporary-housing",
    title: "仮設住宅と生活再建",
    summary:
      "被災後の住まいを確保し、生活再建へ進むための支援と相談先を確認します。",
    category: "preparedness-service",
    tags: ["仮設住宅", "生活再建", "被災者支援"],
    cardDefinitionId: "countermeasure-support-destroy-draw",
    body:
      "## 住まいを失ったとき\n\n" +
      "災害で自宅に住めなくなった場合、避難所から仮設住宅などへ移り、生活を立て直します。入居要件や申請方法は災害の種類と自治体によって異なります。\n\n" +
      "## 支援につながる\n\n" +
      "- 自治体の窓口で、住まい、生活費、罹災証明書の手続きを確認します。\n" +
      "- 片付けや修理を急ぐ前に、被害状況を写真で記録します。\n" +
      "- 長期の復旧には時間がかかるため、地域の相談窓口や支援団体を活用します。",
  },
];

export const cardLearningArticles: readonly LearningArticle[] = Object.freeze(
  articleSpecs.map((spec) => {
    const source = articleSources[spec.category];
    return Object.freeze({
      id: "card-" + spec.slug,
      slug: spec.slug,
      title: spec.title,
      summary: spec.summary,
      category: spec.category,
      tags: Object.freeze([...spec.tags]),
      sourceName: source.name,
      sourceUrl: source.url,
      reviewedAt: "2026-08-03",
      status: "published" as const,
      body: spec.body,
      relatedCardDefinitionIds: Object.freeze([spec.cardDefinitionId]),
    });
  }),
);

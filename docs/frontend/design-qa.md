# 対戦画面 Design QA

- source visual truth path: `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-6e8a6da3-2b5c-469d-8593-d362911e8538.png`
- implementation screenshot path: `C:\Users\tomop\AppData\Local\Temp\disastar-resource-collapsed-1180x720.png`
- focused comparison paths: `C:\Users\tomop\AppData\Local\Temp\disastar-reference-field-crop.png` / `C:\Users\tomop\AppData\Local\Temp\disastar-implementation-field-crop.png`
- minimum viewport screenshot path: `C:\Users\tomop\AppData\Local\Temp\disastar-resource-collapsed-1180x720.png`
- expanded-event screenshot path: `C:\Users\tomop\AppData\Local\Temp\disastar-resource-expanded-1180x720.png`
- card-preview screenshot path: `C:\Users\tomop\AppData\Local\Temp\disastar-card-preview-1280x720.png`
- viewport: 1536 x 1024 CSS px（最小確認は1180 x 720 CSS px）
- pixels and density: source / implementationともに1536 x 1024 px。比較用スクリーンショットは同じCSS viewportで取得した。
- state: `/games/demo` fixture、配置フェーズ、カード画像アセット未登録

## Findings

- [P1][Image quality] 参照画像の写真調カードアートを再現できていない。
  - Evidence: 参照画像はカード面積の約55〜65%を災害・対策の写真調アートが占める。実装は`imageAssetId`がないため、属性色と輪郭だけの仮画像を表示している。
  - Impact: レイアウトは比較できるが、画面の色密度、カード識別性、光と影の最終的な一致は判定できない。
  - Fix: 対象カードのアートをR2へ配置し、カタログの`imageAssetId`へ接続して同じviewportで再比較する。

- [P2][Texture] 盤面の古地図テクスチャは線密度と階調が参照画像より弱い。
  - Evidence: 参照画像は道路・地名・紙面の擦れがフィールド全域に見える。実装の`/ui-assets/tactical-map.svg`は低密度の線画で、中央の空白が広い。
  - Impact: tactical HUDの奥行きと情報密度が参照画像より低く見える。
  - Fix: 参照に近い実画像の地図テクスチャへ差し替え、青黒overlayとvignetteを維持する。

- [P2][Card surface] 仮画像カードは参照画像より情報面が暗く、カード名・種別・POWERの光量差が小さい。
  - Evidence: focused comparisonでは参照カードが明るい画像、白いカード名、彩色された種別行で階層を作る一方、実装は仮画像が暗く各情報行のコントラストが近い。
  - Impact: 一目でカードを見分ける速度と参照画像への忠実度が落ちる。
  - Fix: 実アート差し込み後にカード画像下端のgradient、名前行の黒帯、属性色、数値コントラストを再調整する。

- [Resolved][Layout stability] 相手・自分のみなもとの優先度、公開イベントの開閉、手札詳細の重なり順、プレイヤーステータスの高さ配分を再確認した。
  - Evidence: `disastar-resource-collapsed-1180x720.png`では相手みなもとが144px、自分みなもとが約388px、イベントが54pxとなり、自分の属性値と「備える力」が欠けずに表示される。`disastar-resource-expanded-1180x720.png`ではAccordionの展開時だけイベント履歴が約230pxとなり、3件の公開イベントをスクロール可能な領域へ表示する。`disastar-card-preview-1280x720.png`では手札カードの詳細が盤面より前面に描画される。1180 x 720で相手・自分のステータスは各約198pxで、見出し、シルエット、STAMINA、セグメントゲージ、HAND、DECKを欠けずに表示する。
  - Fix: 相手みなもとをコンパクトな二次表示、自分みなもとを主表示へ分離した。相手の公開済みサポート・捨て札は、用途・枚数を明記した強調ボタンにした。`PublicEventFeed`はShadcn UIの`Accordion`配下でのみ展開し、閉じた時は余剰高を自分みなもとへ戻す。手札詳細はBase UIのPortal経由にし、`z-index: 1000`で`clip-path`を持つ盤面コンテナの外へ表示する。プレイヤーステータスは等しい行高と固定した情報行で崩れを防ぐ。

## Intentional contract-driven differences

- 最大ラウンド数は`PlayerGameView`に存在しないため、参照画像の`/ 30`を生成表示していない。
- プレイヤー表示名と公開イベント時刻は現行の表示契約に存在しないため、固定値や擬似時刻で補完していない。
- fixtureのカード配置・手札枚数だけを表示し、比較用の架空カードは追加していない。
- 右サイドバーは現行要件に従い、自分と相手双方のみなもとを表示する。
- 相手の非公開手札・山札順はDOMへ出力していない。

## Full-view comparison evidence

- 1536 x 1024で参照画像と実装を同じ比較入力に置き、3回比較した。
- Top HUDは約76px、左列は約210px、右列は約292px、下部操作帯は約188pxとし、参照画像の主要境界へ合わせた。
- 中央は上下各5枠、Opponent / Player、右情報列、下部Discard / Support / Hand / Deckの順序を一致させた。
- 角を丸いWebカードにせず、cut corner、多層border、inset shadow、赤・青・真鍮色の細いaccentで硬質なHUDへ寄せた。
- 1536 x 1024と1180 x 720の双方でdocument/bodyのscroll sizeがviewportと一致し、横スクロールとページクリップがないことを確認した。

## Focused region comparison evidence

- 中央フィールドを同じ座標`(228, 100)〜(1225, 817)`で切り出して比較した。
- 5列の幅、上下グループの境界、カードと空枠の比率、中央地図余白は参照に近い。
- 参照画像は各列に3枚ずつ配置され、fixtureは1枚ずつのため、占有率の差は状態差として扱った。
- 実装カードの外枠・画像・カード名・属性・POWER / コスト・説明という縦構造は一致しているが、仮画像品質はP1として残る。

## Required fidelity surfaces

- Fonts and typography: 日本語は既存のシステムフォント、英数字は既存font stackを使用。`ROUND`、`TIME`、`STAMINA`、資源数はtabular numsと具体値で階層化した。参照画像の専用書体は未提供。
- Spacing and layout rhythm: `p-[6px]`、`gap-[5px]`、固定列幅と高さ別media variantで高密度を維持した。
- Colors and tokens: black / navy、deep red、cyan blue、muted goldを面塗りではなくborder、line、icon、subtle glowへ使用した。
- Shape and surfaces: layered frames、inner border、inner shadow、scanline、radial / linear overlay、clip-pathによるcut cornerを使用した。
- Image quality and asset fidelity: カードアートと高品質な地図素材が未提供でblocked。カード裏面とポートレートは仮画像であり、最終品質ではない。
- Copy and content: 契約外情報は生成せず、現在ラウンド、フェーズ、操作主体、残り時間、公開イベント連番を表示した。
- Icons: 既存`lucide-react`の近似アイコンを使用し、色だけに頼らないラベルを併記した。

## Interaction, accessibility, and runtime checks

- 手札カードはキーボードのEnterで選択でき、`aria-pressed`が更新される。
- 公開イベントはShadcn UIのAccordionで開閉できる。閉じた状態では自分のみなもとが主表示となり、開いた状態だけ履歴領域が増える。
- D&D用の既存操作、送信中ロック、エラー表示、再同期、接続表示のロジックは変更していない。
- focus-visible、画像alt、`prefers-reduced-motion`対応を維持した。
- 手札カードのEnter選択で詳細ポップアップがBase UIのPortalから盤面より前面に表示されることを確認し、`z-index`は`1000`、表示状態はvisibleだった。
- ブラウザconsoleのerrorは0件だった。

## Comparison history

1. Iteration 1
   - Findings: 攻撃列が高すぎ、中央余白が狭い。Player statusの人物・数値領域が小さく、occupied slot番号がカード番号と重複していた。
   - Fixes: 3列・3行の基準寸法、status比率、slot番号、menu fallback、背景layerを修正した。
2. Iteration 2
   - Findings: 左列の上下比、上下attack group比、地図の可視性、カードの陣営accentが不足していた。
   - Fixes: 左列を`1.1fr / 1fr`、attack groupを`0.96fr / 1fr`へ調整し、map overlayとrelation toneを強化した。
3. Iteration 3
   - Findings: 大枠のgeometryは近づいたが、実アートと地図テクスチャの品質差が支配的だった。
   - Fixes: 1180 x 720向けの高さ調整とmana panelのclipを修正し、これ以上の仮画像調整は行わずP1 blockerとして記録した。
4. Stability fix
   - Findings: みなもとの縦方向の余白、攻撃枠バッジのヘッダー重なり、カード詳細ポップアップのレイヤー競合を確認した。
   - Fixes: みなもと2パネルの行・高さを再構成し、ゲーム用語を除去、攻撃枠バッジを再配置、手札とポップアップのz-index階層を明示した。1180 x 720で横スクロールなし、主要パネルの欠けなしを確認した。
5. Interaction stability fix
   - Findings: みなもとの主従関係が弱く、イベントのために常時領域を取り、カード詳細のポップアップは`clip-path`を持つ祖先により隠れる可能性があった。プレイヤーステータスも可変コンテンツの高さで情報行が圧迫され得た。
   - Fixes: 相手みなもとを144pxのコンパクトパネル、自分みなもとを閉じたイベント時に約388pxの主パネルへした。公開イベントはShadcn UIのAccordionとし、閉じた時は54px、開いた時のみ約230pxへ拡大する。手札詳細はPortal + `z-[1000]`に移し、Enter操作でも表示を確認した。ステータスは等しい2行と固定情報行にして1180 x 720で確認した。

## Follow-up

1. 参照調のカードアート、地図背景、陣営ポートレート、カード裏面をR2へ配置する。
2. `imageAssetId`とUIアセット参照を接続する。
3. 1536 x 1024で同じ比較を再実施し、カードのcrop、文字帯、glow、画像階調を最終調整する。

final result: blocked

blocker: 参照画像の主要な視覚要素である写真調カードアートと高品質な古地図背景が未提供で、画像品質・crop・画面全体の色密度を一致判定できない。

---

# HUDコントロール／装飾フレーム Design QA

- source visual truth path: `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-faba8cfd-daf5-4049-bc3e-740dae2a8663.png`
- implementation screenshot paths: `C:\Users\tomop\AppData\Local\Temp\game-ui-iteration-2.png` / `C:\Users\tomop\AppData\Local\Temp\game-ui-iteration-3.png`
- viewport: 1450 x 1086 CSS px
- scope: Primary / Secondary / Icon button、接続表示、Corner、Frame Line、Divider、Glow、Panel frame
- comparison policy: 画面配置ではなく、切り欠き形状、金属階調、recess、highlight、glow、状態差を優先して比較した。

## Iteration 1

差分:

1. Primaryの金属枠は多層化されていたが、面に摩耗感がなく均一だった。
2. Secondaryの下側metal toneがPrimary由来のbrownへ寄り、steel blueとして不十分だった。
3. Connection IndicatorがCSS border主体で、他のコントロールより平坦だった。
4. Panel surfaceがradial / linear gradientだけで、参照の細かな金属ムラが不足していた。
5. 相手の公開ゾーンボタンは複数要素を直接flex配置したため、狭い領域でラベルが縦に崩れた。

自己評価:

| 対象                 |    Score |
| -------------------- | -------: |
| Primary Button       | 7.8 / 10 |
| Secondary Button     | 7.2 / 10 |
| Icon Button          | 7.6 / 10 |
| Frame Corner         | 8.1 / 10 |
| Frame Line           | 8.0 / 10 |
| Divider              | 8.0 / 10 |
| Glow                 | 8.0 / 10 |
| Material Fidelity    | 7.4 / 10 |
| Reference Similarity | 7.5 / 10 |

対応: Button surfaceへ低opacityの摩耗レイヤーを追加し、SVG frameのgold / blue / gray paletteを分離した。Connection Indicatorにも多層SVG frameを適用し、公開ゾーンボタンの内容を単一grid wrapperへ固定した。

## Iteration 2

差分:

1. Blue frameは冷色化できたが、Hover時のframe core lightが参照より弱かった。
2. Gold frameのHoverはsurface glowが先行し、金属輪郭そのものの発光差が小さかった。
3. Active時のrecessはsurfaceで表現できたが、SVG frame側の減光が連動していなかった。
4. Button textureに対し、GameFrameの広い面はまだ均一に見えた。
5. Connection Indicatorは形状が揃った一方、contentとframeのz-orderを明示する必要があった。

自己評価:

| 対象                 |    Score |
| -------------------- | -------: |
| Primary Button       | 8.4 / 10 |
| Secondary Button     | 8.1 / 10 |
| Icon Button          | 8.2 / 10 |
| Frame Corner         | 8.3 / 10 |
| Frame Line           | 8.3 / 10 |
| Divider              | 8.1 / 10 |
| Glow                 | 8.2 / 10 |
| Material Fidelity    | 8.0 / 10 |
| Reference Similarity | 8.0 / 10 |

対応: SVG frameへvariant別の局所drop-shadowとActive減光を追加し、GameFrameへ低密度の擦れ筋を追加した。Connection contentをframeより前面へ固定した。

## Iteration 3

残る差分:

1. 参照画像は部品単体を大きく展示しているため、実画面へ組み込んだ状態ではmicro detailの見かけ上の密度が少し下がる。
2. Primaryのcenter surfaceは参照よりわずかに暗いが、既存HUD内で黄色いネオンに見えない光量を優先した。
3. Gray / red / blue / gold / greenの全variantはテストで描画確認したが、デモ画面の同一状態には全色を常時並べていない。
4. Icon buttonはデモ用fallbackがdisabledのため、通常状態はコンポーネント単体テストと実ゲームのForfeit triggerで担保している。
5. `Noto Sans JP`をfont stackの先頭に指定したが、フォントファイル自体は新規同梱していないため、未導入環境では既存日本語フォントへfallbackする。

自己評価:

| 対象                 |    Score |
| -------------------- | -------: |
| Primary Button       | 8.8 / 10 |
| Secondary Button     | 8.5 / 10 |
| Icon Button          | 8.3 / 10 |
| Frame Corner         | 8.6 / 10 |
| Frame Line           | 8.7 / 10 |
| Divider              | 8.3 / 10 |
| Glow                 | 8.5 / 10 |
| Material Fidelity    | 8.6 / 10 |
| Reference Similarity | 8.4 / 10 |

確認結果:

- Primary / Secondary / Iconはouter shadow、SVG metal frame、surface、texture、inner contour、edge highlight、label、state lightingの8層以上で構成した。
- Normal / Hover / Active / DisabledはTailwindの`group-hover:`、`group-active:`、`disabled:`、`motion-reduce:`で管理した。
- Cornerはouter / inner / highlight / recessed / notch / rivet、Frame Lineは固定cap / stretch line / center diamondへ分割した。
- Glowはdark base、blur halo、bright line、center flareの4層で構成した。
- 参照画像と実装スクリーンショットを同じ比較入力に置き、3回目の最終比較を行った。

component final result: passed

---

# 手札・バトルゾーン SVG金属フレーム拡張 QA

- source visual truth path: `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-6e8a6da3-2b5c-469d-8593-d362911e8538.png`
- implementation screenshot path: `C:\Users\tomop\AppData\Local\Temp\game-ui-metal-zones.png`
- viewport: 1450 x 1086 CSS px
- state: `/games/demo` fixture、配置フェーズ

## Iteration 1

- 相手・自分のバトルゾーンへred / blueの`GameFrame`、下部の手札・操作帯へgoldの`GameFrame`を適用した。
- Tailwindの外周`border`と疑似要素のinner borderを削除し、全周のshadow / metal / recess / highlight / notchをSVGへ移した。
- 初回の全周SVGは割合座標の斜辺を持っていたため、大型パネルで角の斜線が横方向へ伸びるP2差分が発生した。

## Iteration 2

- 伸縮する全周SVGは直線edgeだけに限定し、固定寸法の`FrameCorner`へ斜辺、notch、rivetを担当させた。
- バトルゾーンの角装飾はパネルサイズで歪まず、参照画像と同じred / blueの細いtechnical frameとして表示された。
- 手札・捨て札・サポート・山札を含む下部操作帯はgold metal frameで一体化した。
- 各領域を分ける`border-r` / `border-l` / `border-b`は外周フレームではなく情報区切り線のため維持した。

## Runtime checks

- 1450 x 1086でdocument scroll sizeとviewportが一致し、ページの横・縦スクロールは発生しない。
- `data-battle-frame="svg-metal"`は2件、`data-hand-frame="svg-metal"`は1件、全画面のSVG panel frameは9件。
- 手札カード詳細はPortal経由で表示され、SVG frame追加後もvisible。
- browser console errorは0件。

## Remaining P3

- 参照画像は実カードアートを含むため、frame内部の最終的な色密度はカード画像導入後に再調整する。
- 内部のslotやresource cellは操作境界を明確にするため、細いTailwind separatorを維持している。

Material Fidelity: 8.8 / 10  
Reference Similarity: 8.6 / 10

final result: passed

---

# R2 ゲームボード背景アセット QA

- source visual truth: `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-199e8977-6b69-4ead-86b1-d7dbf12c3e9c.png`
- intended object key: `backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png`
- integration: 同一オリジンの `/game-assets/<object-key>` を最優先の `background-image` とし、ローカル開発および画像取得失敗時は既存の `/ui-assets/tactical-map.svg` を背景レイヤーとして残す。
- status: **blocked**

## Blocker

- `pnpm --filter @disastar/frontend exec wrangler r2 bucket create disastar-game-assets` を実行したが、Cloudflare API が `Please enable R2 through the Cloudflare Dashboard. [code: 10042]` を返した。
- Wrangler は、R2 を有効化済みのアカウントではバケット作成とオブジェクト配置を行える。一方、このアカウントの R2 サービスそのものの初回有効化は Wrangler API から受理されないため、Dashboard での一度だけの有効化が必要である。

## Verification

- 背景キーとフォールバックのユニットテストは成功した。
- R2 オブジェクトが未作成のため、都市俯瞰画像を実際に取得した状態のブラウザ比較は未実施である。ローカルで確認できるのはフォールバック背景だけであり、実画像の表示確認としては扱わない。

final result: blocked

---

# Overlay Layer・Frame Header Clearance QA

- source visual truth (toast): `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-5c6b6fc3-a285-42c1-8258-70ac85488611.png`
- source visual truth (modal): `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-34a4a2b8-d8f2-446c-a733-d0d8de6e5fdd.png`
- implementation screenshot (toast): `C:\Users\tomop\AppData\Local\Temp\game-toast-layer-fixed-final.png`
- implementation screenshot (modal): `C:\Users\tomop\AppData\Local\Temp\game-modal-layer-fixed.png`
- implementation screenshot (minimum viewport): `C:\Users\tomop\AppData\Local\Temp\game-frame-spacing-min-viewport.png`
- route/state: `/games/demo?scenario=placement`、配置フェーズ
- source pixels: toast 800 x 526、modal 1536 x 962
- implementation pixels / CSS viewport: 1280 x 720 / 1280 x 720、minimum 1180 x 720 / 1180 x 720

## Comparison history

### Iteration 1 findings

- [P0] Game board内のHand/Cardが`z-index: 80–110`、Portal側のToast/Modalが`z-index: 50–60`で、手札のstacking contextがoverlayを覆っていた。
- [P2] Player status、Attack Group、Mana、Handの見出しがSVG FrameLineの切れ目へ埋め込まれ、frameと文字が一体化して見えていた。

### Fixes

- UI layerを`board 0 < boardRaised 20 < boardDrag 40 < popover 700 < modal 900 < toast 1000`として一元定義した。
- Game board rootを`isolate z-0`にし、盤面内部の高いz-indexがPortal overlayのstacking contextを越えないようにした。
- Toast、AlertDialog、ゲーム固有Modal、HoverCardへ用途別layerを適用した。
- FrameCaptionを撤去し、Player status、Attack Group、Mana、Handの見出しをnormal flowへ戻した。SVG FrameLineとの間には上・左右のclearanceを設けた。

### Post-fix evidence

- 無効なdrag-and-dropで表示したToastは`z-index: 1000`、Handはboard内`z-index: 20`で、Toast中央のhit testはToast要素へ解決した。
- 相手の捨て札Modalは`z-index: 900`で、Handの上を完全に覆い、Modal中央のhit testはModal要素へ解決した。
- 1180 x 720でdocument sizeとviewportが一致し、6件のframe headerにtext overflowはなかった。
- 見出しはSVG top lineの下に配置され、Player status、Attack Group、Mana、Handのいずれもline-gap表現を持たない。
- browser console warning / errorは0件。

## Required fidelity surfaces

- Fonts / typography: 既存のHUD font stack、weight、trackingを維持した。
- Spacing / layout rhythm: 高密度レイアウトを保ちつつ、見出し専用の上端clearanceだけを追加した。
- Colors / tokens: red / blue / gray / goldの既存variantを維持した。
- Image quality / assets: portrait、map、card artwork、SVG metal frameは変更していない。
- Copy / content: 既存の見出し、カード説明、Toast、Modal文言を維持した。

## Remaining P3

- Toast本体は既存Base UIの白い通知スタイルを維持しており、tactical HUD向けの外観統一は今回の積層修正には含めていない。

final result: passed

---

# プレイヤーステータス・右サイドバー Geometry QA

- source visual truth path: `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-70776609-6f4f-4dd4-b615-107cd389a449.png`
- layout requirements path: `C:\Users\tomop\.codex\attachments\1e276287-9d11-466b-855d-b01d03ca3535\pasted-text.txt`
- implementation screenshot (closed): `C:\Users\tomop\AppData\Local\Temp\game-sidebar-layout-fixed.png`
- implementation screenshot (open): `C:\Users\tomop\AppData\Local\Temp\game-sidebar-layout-open.png`

## Geometry fixes

- Player statusのcontent layerを`z-index: 2`、SVG perimeter / line / cornerを`3 / 4 / 5`に維持し、STAMINA・HAND・DECKがmetal frameを覆わない積層へ修正した。
- Player statusの上端に7〜10px、下端に7〜12pxのsafe clearanceを確保した。
- Sidebarを可変行gridから`flex h-fit`へ変更し、OpponentResources / PlayerResources / PublicEventをcontent-driven heightで配置した。
- OpponentResourcesは175px、PlayerResourcesは176px、closed PublicEventは54px。各Panel間gapは12px。
- Opponent resource rowは左右14px、上10px、下8px、card gap 9px。summary rowとの間は10px、summary cardの高さは72px。
- Player resource valueは3列とも同じbaselineで、card下端から14.5pxの余白を維持した。
- 公開済みlabelは`white-space: nowrap`かつ65pxのcontent columnを持ち、縦折り返しと0px幅を解消した。

## Runtime checks

- 1450 x 1086 closed: Sidebar 429px、Opponent 175px、Player 176px、PublicEvent 54px。
- 1450 x 1086 open: PlayerResourcesは176pxのまま、PublicEventのみ54pxから183pxへ自然に展開した。
- 1180 x 720: Player status bottom clearanceは7px、content z-index 2 / corner z-index 5。document scroll sizeはviewportと一致した。
- SVG panel frameは9件、corner motifは36件で、geometry修正後も維持した。
- console errorは0件。横方向のlabel overflow、document overflowはいずれも0件。

## Remaining P3

- 参照画像はPlayer status単体の拡大仕様で、実画面では210px columnへ収めるため文字とportraitの絶対寸法は縮小される。
- Card artworkは既存placeholderのままであり、本タスクでは変更していない。

final result: passed

---

# Frame Caption・Drag and Drop復旧 QA

- source visual truth (full): `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-6e8a6da3-2b5c-469d-8593-d362911e8538.png`
- source visual truth (Player status focus): `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-70776609-6f4f-4dd4-b615-107cd389a449.png`
- implementation screenshot: `C:\Users\tomop\AppData\Local\Temp\game-frame-caption-dnd-final.png`
- route/state: `/games/demo?scenario=placement`、配置フェーズ、公開イベントclosed
- source pixels: full 1536 x 1024、focus 442 x 856
- implementation pixels / CSS viewport: 1450 x 1086 / 1450 x 1086、device scale 1
- normalization: 今回はユーザー指定どおりlayoutの完全一致ではなく、frame内のcaption表現とPlayer statusのfocused regionを比較対象にした。

## Comparison history

### Iteration 1 findings

- [P0] Hand cardのdnd-kit source refが外側`div`にあり、実際にpointer eventを受ける内側`button`と一致していなかった。手動dragでdropが成立せず、配置操作が利用できなかった。
- [P2] Player status、Attack Group、Mana titleはSVG FrameLineと同一位置へ直接描画され、文字の背後をframe lineが通る箇所があった。

### Fixes

- Base UI HoverCardのtrigger refとdnd-kit source refを統合し、実際のカード`button`をdrag source nodeにした。
- `FrameCaption`を追加し、panel backgroundでFrameLineを局所的に切り、captionを`z-index: 6`、FrameLineを`z-index: 4`として線の間へ文字が収まる構造にした。
- Player statusはleft/right、Attack Groupはleft/right、Mana titleはcenter captionへ統一した。
- Playwrightのdrag操作を中間pointを持つpointer sequenceへ変更し、drag中の`data-drop-active=true`とdrop後の盤面更新を検証した。

### Post-fix evidence

- 1450 x 1086のfull-viewでred / blue / grayのcaptionがSVG frameを局所的に切り、文字と線の重なりがない。
- 1180 x 720でcaption 10件の相互overlapとtext overflowは0件。document sizeはviewportと一致した。
- 1180 x 720の実ブラウザpointer dragで「河川の氾濫」が手札から消え、攻撃グループへ移動した。
- Card Hover Previewはref統合後もvisibleで、Portal表示を維持した。
- browser console warning / errorは0件。

## Required fidelity surfaces

- Fonts / typography: 既存font stack、weight、trackingを維持し、captionは9〜12pxの高密度HUD hierarchyに収めた。
- Spacing / layout rhythm: captionの左右14px、上下18px枠内で統一し、Player / Attack Group / Manaの既存panel寸法を変更していない。
- Colors / tokens: red / blue / grayの既存`HudColorVariant`を再利用し、新しい独自paletteは追加していない。
- Image quality / assets: portrait、map、card artwork、SVG metal frameは変更していない。
- Copy / content: 既存の相手・自分・接続状態・Attack Group件数・みなもと名を維持した。

## Remaining P3

- Full referenceとfixtureではカードartworkとゲーム状態が異なるため、caption以外のカード密度差は本タスクの対象外。
- Player status focused referenceは442 x 856の拡大図で、実画面では210px columnへ縮小される。

final result: passed

---

# Modal・Toast Tactical Dark Theme QA

- source visual truth: `C:\Users\tomop\AppData\Local\Temp\codex-clipboard-faba8cfd-daf5-4049-bc3e-740dae2a8663.png`
- implementation screenshot (zone modal): `C:\Users\tomop\AppData\Local\Temp\game-dark-modal-final.png`
- implementation screenshot (confirmation modal): `C:\Users\tomop\AppData\Local\Temp\game-dark-confirm-modal-final.png`
- implementation screenshot (toast): `C:\Users\tomop\AppData\Local\Temp\game-dark-toast-final.png`
- route/state: `/games/demo?scenario=placement`、相手の捨て札、配置終了確認、無効drop通知
- source pixels: 1450 x 1086
- implementation pixels / CSS viewport: 1280 x 720 / 1280 x 720、device scale 1
- normalization: sourceはcontrol/frameのdesign specificationでmodal自体を含まないため、geometryの1:1比較ではなく黒／navyのsurface、muted gold border、gray-blue secondary control、gold primary controlのfocused material comparisonを行った。

## Comparison history

### Iteration 1 findings

- [P1] Zone、SupportTarget、PhaseEnd、GameResult、共通AlertDialogが白いsurfaceを持ち、暗いgame boardから切り離された一般的なWeb UIに見えていた。
- [P1] Toastも白いpopover surfaceで、HUDの黒／navy baseとmuted gold frameに一致していなかった。

### Fixes

- modal surfaceを`#04090d`、toast surfaceを`#050a0e`へ統一し、muted gold border、内側の低彩度highlight、深いshadowを共通themeとして定義した。
- backdropをblack 80%と2px blurへ変更し、modal contentを盤面から明確に分離した。
- header/footer、説明文、zone card、target option、primary/secondary actionを暗色theme用のcontrastへ調整した。
- success / info / warning / error / loadingのsemantic icon colorは黒背景上でも識別できる彩度に維持した。

### Post-fix evidence

- Zone modalのcomputed backgroundは`rgb(4, 9, 13)`、foregroundは`rgb(217, 226, 232)`で、672 x 390のsurface全体に白背景は残っていない。
- Confirmation modalも同じsurface tokenを使用し、secondaryはgray-blue、primaryはmuted goldで参照control hierarchyと一致した。
- 無効drop Toastのcomputed backgroundは`rgb(5, 10, 14)`、foregroundは`rgb(230, 224, 210)`で、384 x 78の通知全体が黒基調になった。
- 1280 x 720でdocument sizeとviewportが一致し、横・縦overflowは発生しない。
- browser console warning / errorは0件。

## Required fidelity surfaces

- Fonts / typography: 既存font familyとsizeを維持し、title weightとtoast trackingだけをdark surface上で明確化した。
- Spacing / layout rhythm: modal寸法、content padding、toast位置と高さは変更していない。
- Colors / tokens: sourceのblack/navy、muted gold、gray-blue control paletteへ統一した。
- Image quality / assets: 新規画像は不要で、既存card artwork、map、SVG metal frameを変更していない。
- Copy / content: modal、button、toastの既存文言を変更していない。

## Remaining P3

- modal専用のcut-corner SVG frameは追加せず、既存HUDと競合しない細い二重borderに留めている。

final result: passed

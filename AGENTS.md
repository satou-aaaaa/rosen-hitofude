# AGENTS.md

路線図ひと筆：架空の地下鉄の路線図で、始発から終点まで全部の駅を1回ずつ通る道（答えは1つ）を探す1日3路線のパズル。`index.html` と `gen.js`（問題の作り方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # 問題の作り方（答えが1つ・線路が交わらない・各大きさを何百〜千回）・押す/なぞる・戻る・ヒント・続きから・特急・記録・スマホ幅・PWA（CI の QA と同じ）
```

## このリポジトリの決まり

- 問題は `gen.js` の `make` が種から作る：ランダムなひと筆の道を作ってから、答えが1つのまま線路（まよう道）を足す。答えの数は `countPaths` で数える。大きさと足す線路の数は `SIZES`（各駅・快速・急行）と `HARD`（特急）。
- 線路はとなりの駅（たて・よこ・斜め）だけをつなぎ、同じ四角で斜め2本を交わらせない（QA が何百回も作って見る）。
- 今日の3路線・特急は日本時間の日付から作る種（`seedOf`）で決まり、だれでも同じ。`Math.random()` は練習・とことんの種だけ（QA が数を見る）。`gen.js` を変えると過去の日の問題も変わる。変えた PR に一言書く。
- 駅名と路線の色は種から決める架空のもの。実在の鉄道会社の名前・路線記号・色の組み合わせ・ロゴは使わない。
- ★はヒントの回数（0回★3・1回★2・2回以上★1）。特急はヒントなし。時間制限は付けない。今日の3路線・特急は1日1回で、途中で閉じても通った駅のまま続きから。練習は記録を増やさない（開通の数には入る）。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`・`runs.p`）、練習で今日・特急の途中を消さない。書き込む前に、保存した進み具合がこの画面と同じ路線か確かめる（古いタブで二重に数えない。2026-11-04 かさね染めで CodeRabbit が指摘）。
- とことん（`runs.e`）：今日の分のあとも続けて遊べるよう、各駅3→快速5→急行10→特急42路線を毎回ちがう種で次々に出し、使い切ったら特急を20路線ずつ足して続ける（`endlessList`・`moreList`。1回の中で同じ種は出さない）。ヒントは何回でも使え（★に出るだけ）、「ここで降りる」まで終わらない。前の版の途中経過にある🎫の `life` は読まずに無視する。開通させた路線の数の自己ベスト `ebest` を残す。今日の記録・連続・Ko-fi・シェアには数えない（開通の数・実績には入る）。他の人との順位は出さない。ホームと今日の結果の画面に大きなボタンを置く（2026-11-05 satou さん「一日で遊べる量が少なすぎる」）。
- 好きなだけ遊べる：チケット・回数制限・🔒で開くモードを入れない（2026-11-06 satou さん。寄付で成り立たせるため）。上級（特急）・とことん・練習ははじめて開いた日から遊べる（今日の3路線・特急は1日1回のまま）。練習・とことんの路線は種から作るので、各駅（いちばん小さい）でも2万種でほぼ全部ちがう（2026-11-06 に数えた。1万6千回あたりで初めて同じ路線）。
- 実績（`ACH`）は記録（`days`・`hdays`・`late`・`cnt`・`clean`）から毎回数える。新しく残すのは「見せた」印の `ach` だけ。腕前・集める・続けるを混ぜ、続けるは連続でなく合計で数える。実績を足したら QA の数（12）も直す。遊んでいる途中の画面では、行き止まり・もう行けない駅だけを知らせ、答え（次の駅）は言わない。結果の画面には、まだの実績のうち目標にいちばん近いもの1つを「🎯 次の実績」で出す（`nextAch`。shared-workflows `routines/game-dev.md` 研究の要点 12）。
- 乗車記録（カレンダー）から、遊んでいない過去7日（`EPOCH` より前は無し）の3路線をあとから遊べる（`dailyTags(その日)` と同じ問題）。途中経過は `runs.a`、結果は `late` に分けて置き、`days`（今日の記録）・連続の日・Ko-fi の1行には数えない（実績と開通の数には入る）。連続の日は1以上のときだけ出す。
- あとから遊ぶ日を切り替えたら、前の日の途中経過は `apark` に日付ごとに預けて、戻れば続きから（黙って消さない）。`load` は両側を `fresh()` で補ってから合わせ、片側にしか無い入れ物（`late`・`ach`・`apark`）も残す（2026-11-04 星座つなぎで CodeRabbit が指摘）。
- 文字は少なめ・一画面一路線。お笑いの言葉は入れない（本物っぽさ優先。QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に駅名（答え）を出さない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の3路線・特急を初めてヒントなしで解いたときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 押せる所は高さ44px以上、幅320pxの特急でも駅の間は40px以上（QA が見る）。駅は近くを押せば反応する（`nearest`）。
- 一行の式の途中にコメント `//` を足さない（2026-11-04 行の残りが消えて画面が真っ白になったのを QA で見つけた）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何百回も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の問題を入れない）。
- 引き継ぎコード（別の端末へ記録を移す）：`transfer.js`・`qa/transfer-check.mjs` は shared-workflows の `template/` の写し（ここで直さない。直すときはひな形を直して配り、`引き継ぎの版` を上げる）。`index.html` の script の `data-keys` は記録のキーだけを書く。記録の形を変えたら `qa/run.mjs` の `checkTransfer` の `sample` も合わせる。sw.js の `SHELL` から `./transfer.js` を外さない（shared-workflows `routines/game-dev.md`「引き継ぎコード」）。
- 見やすさ：`</head>` の前の見やすさの設定（`<!-- a11y:begin -->`〜`end`）は shared-workflows `template/a11y/a11y.html` の写しで、ここでは直さない。`qa/a11y.mjs` も `template/qa/a11y.mjs` の写し（画面の足し方・許しは `qa/a11y.json` に理由つき）。色だけで分けない・コントラスト 4.5:1・知らせは aria-live・決めつけの言葉を使わない（shared-workflows `routines/game-dev.md`「だれでも遊べるように」）。路線の色は飾り（色の見分けを助ける設定ではカラーユニバーサルデザインの組 `.ln.c0`〜`c8` に替える）。駅は role=button で矢印と Enter でも進め、名前に「いまいる・通った・まだ・もう行けない」を持つ。取れなかった星は ☆、進み具合の点は形（高さ・中が空）、もう行けない駅は点線、ヒントの駅は駅名でも知らせる（`#live`）。
- 公開リポジトリなので、個人情報・鍵を入れない。
- 同じ日はどの端末でも同じ問題にする：乱数は `sort` の比較の中で引かない（引く回数がブラウザで変わる。2026-11-04 路線図ひと筆で CodeRabbit が指摘。QA が見る）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。

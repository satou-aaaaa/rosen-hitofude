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
- 今日の3路線・特急は日本時間の日付から作る種（`seedOf`）で決まり、だれでも同じ。`Math.random()` は練習の種だけ（QA が数を見る）。`gen.js` を変えると過去の日の問題も変わる。変えた PR に一言書く。
- 駅名と路線の色は種から決める架空のもの。実在の鉄道会社の名前・路線記号・色の組み合わせ・ロゴは使わない。
- ★はヒントの回数（0回★3・1回★2・2回以上★1）。特急はヒントなし。時間制限は付けない。今日の3路線・特急は1日1回で、途中で閉じても通った駅のまま続きから。練習は記録を増やさない（開通の数には入る）。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`・`runs.p`）、練習で今日・特急の途中を消さない。書き込む前に、保存した進み具合がこの画面と同じ路線か確かめる（古いタブで二重に数えない。2026-11-04 かさね染めで CodeRabbit が指摘）。
- 文字は少なめ・一画面一路線。お笑いの言葉は入れない（本物っぽさ優先。QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に駅名（答え）を出さない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の3路線・特急を初めてヒントなしで解いたときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 押せる所は高さ44px以上、幅320pxの特急でも駅の間は40px以上（QA が見る）。駅は近くを押せば反応する（`nearest`）。
- 一行の式の途中にコメント `//` を足さない（2026-11-04 行の残りが消えて画面が真っ白になったのを QA で見つけた）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何百回も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の問題を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。
- 同じ日はどの端末でも同じ問題にする：乱数は `sort` の比較の中で引かない（引く回数がブラウザで変わる。2026-11-04 路線図ひと筆で CodeRabbit が指摘。QA が見る）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
